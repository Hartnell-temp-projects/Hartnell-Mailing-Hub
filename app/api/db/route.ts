import path from 'path';
import { readFile } from 'fs/promises';
import { requireStorageUser } from "@/lib/storage/http";
import { getSecret } from "@/lib/secrets";
import { DescribeStatementCommand, ExecuteStatementCommand, Field, GetStatementResultCommand, RedshiftDataClient } from "@aws-sdk/client-redshift-data";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { NextRequest, NextResponse } from "next/server";

const sts = new STSClient({ region: process.env.AWS_REGION ?? 'us-west-2' });

class QueryError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function parseField(field: Field): string | null {
    if (field.isNull) return null;
    const [value] = Object.values(field);
    return value;
}

async function getRedshiftClient(stsClient: STSClient): Promise<RedshiftDataClient> {
    const { Credentials: c } = await stsClient.send(new AssumeRoleCommand({
        RoleArn: process.env.REDSHIFT_ROLE_ARN,
        RoleSessionName: "hartnell-mailing-hub"
    }));

    if (!c || !c.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) {
        throw new Error("Credentials not found for redshift connection.")
    }

    return new RedshiftDataClient({
        credentials: {
            accessKeyId: c.AccessKeyId,
            secretAccessKey: c.SecretAccessKey,
            sessionToken: c.SessionToken,
        },
    });
}

// Queries are kept out of the repo.
// Deployed: Secrets Manager secret `${SECRETS_MANAGER_PREFIX}/SQL_<TYPE>` (e.g. SQL_STUDENT), plain text.
// Local dev (no prefix): the gitignored lib/sql/<type>.sql file.
// queryType is already allowlisted by the caller, so it is safe to use in names/paths.
async function loadQuery(queryType: string): Promise<string> {
    if (process.env.SECRETS_MANAGER_PREFIX?.trim()) {
        return getSecret(`SQL_${queryType.toUpperCase()}`);
    }
    return readFile(path.join(process.cwd(), "lib", "sql", `${queryType}.sql`), "utf8");
}

async function executeQuery(redshiftClient: RedshiftDataClient, queryType: string) {
    const content = await loadQuery(queryType);
    
    const rows = [];
    const columns: string[] = [];
    try {
        // Execute sql query
        const { Id } = await redshiftClient.send(new ExecuteStatementCommand({
            ClusterIdentifier: process.env.REDSHIFT_CLUSTER,
            Database: process.env.REDSHIFT_DB,
            DbUser: process.env.REDSHIFT_DB_USER,
            Sql: content
        }));

        // Poll redshift for finished query
        let delay = 100;
        while (true) {
            const statusResponse = await redshiftClient.send(new DescribeStatementCommand({ Id }));
            if (statusResponse.Status === "FINISHED") {
                break;
            }
            if (statusResponse.Status === "ABORTED" || statusResponse.Status === "FAILED") {
                throw new QueryError(`Query ${Id} failed: ${statusResponse.Error ?? "unknown error"}`)
            }
            await sleep(delay);
            delay = Math.min(delay * 2, 1000);
        }

        // Grab returned rows in all pages
        let nextToken: string | undefined;
        do {
            const page = await redshiftClient.send(new GetStatementResultCommand({ Id, NextToken: nextToken }));
            if (!page || !page.ColumnMetadata || !page.Records) {
                throw new QueryError(`Query ${Id}: failed to retrieve results.`);
            }
            
            if (!nextToken) {
                columns.push(...page.ColumnMetadata.map((c) => c.name!))
            }

            for (const record of page.Records) {
                rows.push(
                    Object.fromEntries(
                        record.map((field, i) => [columns[i], parseField(field)])
                    )
                )
            }
            nextToken = page.NextToken;
        } while (nextToken);
    } catch (error) {
        if (error instanceof QueryError) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: "Error during db querying." }, { status: 500 });
    }

    return rows;
}

// Allowlist: each type maps to lib/sql/<type>.sql. Never build the path from raw input.
const RECIPIENT_TYPES = ["faculty", "student", "staff"];

export async function GET(request: NextRequest) {
    const user = await requireStorageUser(request);
    if (user instanceof NextResponse) return user;

    // GET requests carry no body, so the type comes from ?recipientType=
    const recipientType = request.nextUrl.searchParams.get("recipientType");
    if (!recipientType || !RECIPIENT_TYPES.includes(recipientType)) {
        return NextResponse.json(
            { error: `recipientType must be one of: ${RECIPIENT_TYPES.join(", ")}.` },
            { status: 400 }
        );
    }

    try {
        const redshiftClient = await getRedshiftClient(sts);
        const res = await executeQuery(redshiftClient, recipientType);
        if (res instanceof NextResponse) return res;

        return NextResponse.json(
            { body: res },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("Redshift recipient query failed:", error);
        return NextResponse.json({ error: "Unable to load recipients from Redshift." }, { status: 502 });
    }
}
