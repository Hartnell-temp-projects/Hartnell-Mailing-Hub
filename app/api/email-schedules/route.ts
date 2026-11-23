import { CreateScheduleCommand, SchedulerClient } from "@aws-sdk/client-scheduler";
import { AssumeRoleCommand, STSClient } from "@aws-sdk/client-sts";
import { NextRequest, NextResponse } from "next/server";
import { requireStorageUser } from "@/lib/storage/http";

const AWS_REGION = process.env.AWS_REGION ?? "us-west-2";
const sts = new STSClient({ region: AWS_REGION });

const SES_TARGET_ARN = "arn:aws:scheduler:::aws-sdk:ses:sendEmail";

async function getSchedulerClient(stsClient: STSClient): Promise<SchedulerClient> {
  const roleArn = process.env.EVENTBRIDGE_CONTROL_ROLE_ARN;

  if (!roleArn) {
    throw new Error(
      "Missing required environment variable: EVENTBRIDGE_CONTROL_ROLE_ARN"
    );
  }

  const { Credentials: credentials } = await stsClient.send(
    new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: "hartnell-mailing-hub-eventbridge",
    })
  );

  if (!credentials || !credentials.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken) {
    throw new Error("Credentials not found for EventBridge Scheduler.");
  }

  return new SchedulerClient({
    region: AWS_REGION,
    credentials: {
      accessKeyId: credentials.AccessKeyId,
      secretAccessKey: credentials.SecretAccessKey,
      sessionToken: credentials.SessionToken,
    },
  });
}

function parseAddresses(value: unknown, fieldName: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  const addresses = value.map((address) => {
    if (typeof address !== "string") {
      throw new Error(`${fieldName} contains an invalid email address.`);
    }

    const trimmed = address.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      throw new Error(`Invalid email address: ${trimmed}`);
    }

    return trimmed;
  });

  return addresses;
}

export async function POST(request: NextRequest) {
  const user = await requireStorageUser(request);

  if (user instanceof NextResponse) {
    return user;
  }

  const controlRoleArn = process.env.EVENTBRIDGE_CONTROL_ROLE_ARN;
  const fromAddress = process.env.SES_FROM_ADDRESS;

  if (!controlRoleArn || !fromAddress) {
    return NextResponse.json(
      { error: "EventBridge and SES environment variables are missing." },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {sendAt, to, cc, bcc, subject, html, text} = body;

    if (!subject || typeof subject !== "string") {
      return NextResponse.json(
        { error: "A subject is required." },
        { status: 400 }
      );
    }

    if ((!html || typeof html !== "string") && (!text || typeof text !== "string")) {
      return NextResponse.json(
        { error: "HTML or text email content is required." },
        { status: 400 }
      );
    }

    const toAddresses = parseAddresses(to, "to");
    const ccAddresses = parseAddresses(cc, "cc");
    const bccAddresses = parseAddresses(bcc, "bcc");

    const totalRecipients = toAddresses.length + ccAddresses.length + bccAddresses.length;

    if (totalRecipients === 0) {
      return NextResponse.json(
        { error: "At least one recipient is required." },
        { status: 400 }
      );
    }

    if (totalRecipients > 50) {
      return NextResponse.json(
        {
          error:
            "This first scheduling version supports up to 50 recipients.",
        },
        { status: 400 }
      );
    }

    if (typeof sendAt !== "string") {
      return NextResponse.json(
        { error: "sendAt must be a date and time." },
        { status: 400 }
      );
    }

    const sendDate = new Date(sendAt);

    if (Number.isNaN(sendDate.getTime()) || sendDate <= new Date()) {
      return NextResponse.json(
        { error: "sendAt must be a valid future date." },
        { status: 400 }
      );
    }

    const destination: {
      ToAddresses: string[];
      CcAddresses?: string[];
      BccAddresses?: string[];
    } = {
      ToAddresses: toAddresses,
    };

    if (ccAddresses.length > 0) {
      destination.CcAddresses = ccAddresses;
    }

    if (bccAddresses.length > 0) {
      destination.BccAddresses = bccAddresses;
    }

    const messageBody: {
      Html?: { Data: string; Charset: string };
      Text?: { Data: string; Charset: string };
    } = {};

    if (typeof html === "string" && html.trim()) {
      messageBody.Html = {
        Data: html,
        Charset: "UTF-8",
      };
    }

    if (typeof text === "string" && text.trim()) {
      messageBody.Text = {
        Data: text,
        Charset: "UTF-8",
      };
    }

    const scheduleName = `hartnell-email-${crypto.randomUUID()}`;
    const scheduleExpression = sendDate.toISOString().replace(/\.\d{3}Z$/, "");
    const targetRoleArn = process.env.EVENTBRIDGE_TARGET_ROLE_ARN;

    if (!targetRoleArn) {
      return NextResponse.json(
        { error: "The EventBridge target role is not configured." },
        { status: 500 }
      );
    }

    const scheduler = await getSchedulerClient(sts);

    const result = await scheduler.send(
      new CreateScheduleCommand({
        Name: scheduleName,
        GroupName: "email-schedules",
        ScheduleExpression: `at(${scheduleExpression})`,
        ScheduleExpressionTimezone: "UTC",
        FlexibleTimeWindow: {
          Mode: "OFF",
        },
        ActionAfterCompletion: "DELETE",
        Target: {
          Arn: SES_TARGET_ARN,
          // This is the role EventBridge assumes when the schedule executes.
          RoleArn: targetRoleArn,
          Input: JSON.stringify({
            Source: fromAddress,
            Destination: destination,
            Message: {
              Subject: {
                Data: subject,
                Charset: "UTF-8",
              },
              Body: messageBody,
            },
          }),
        },
      })
    );

    return NextResponse.json({
      scheduled: true,
      scheduleName,
      scheduleArn: result.ScheduleArn,
    });
  } catch (error) {
    console.error("Unable to create email schedule:", error);

    return NextResponse.json(
      { error: "Unable to schedule the email." },
      { status: 500 }
    );
  }
}
