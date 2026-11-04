import path from 'path';
import { readFile } from 'fs/promises';
import { readJsonBody, requireStorageUser } from "@/lib/storage/http";
import { InvalidInputError } from "@/lib/storage/userData";
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

async function executeQuery(redshiftClient: RedshiftDataClient, queryType: string) {
    const content = await readFile(
        path.join(process.cwd(), "lib", "sql", `${queryType}.sql`),
        "utf8"
    );
    
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

export async function GET(request: NextRequest) {
    const user = requireStorageUser(request);
    if (user instanceof NextResponse) return user;
    
    let body = undefined;
    try {
        const body = await readJsonBody(request);
    } catch (error) {
        if (error instanceof InvalidInputError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: "Something went wrong when reading request payload." }, { status: 500 });
    }
    
    if (!body) {
        return NextResponse.json({ error: "No payload given with request."}, { status: 400 });
    }
    
    const { recipientType } = body;
    try {
        const redshiftClient = await getRedshiftClient(sts);
        const res = await executeQuery(redshiftClient, recipientType);
        if (res instanceof NextResponse) return res;

        return NextResponse.json({ body: res });
    } catch (error) {
        if (error instanceof QueryError) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ error: "Temporary error msg" }, { status: 500 });
    }
}
