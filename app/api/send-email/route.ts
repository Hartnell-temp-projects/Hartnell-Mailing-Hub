import { NextRequest, NextResponse } from "next/server";
import {
  CreateTemplateCommand,
  SESClient,
  SendBulkTemplatedEmailCommand,
  SendEmailCommand,
  UpdateTemplateCommand,
} from "@aws-sdk/client-ses";
import { getSession } from "@/lib/auth/session";
import type { RecipientRecord } from "@/components/types";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-west-2" });
const SES_RECIPIENT_LIMIT = 50;
const TEMPLATE_NAME = process.env.SES_TEMPLATE_NAME?.trim() || "HartnellMailerPersonalized";

function asAddresses(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return typeof value === "string" && value.trim().length > 0 ? [value] : [];
}

function asRecipientRecords(value: unknown): RecipientRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is RecipientRecord => {
    if (typeof item !== "object" || item === null) {
      return false;
    }
    const recipient = item as Partial<RecipientRecord>;
    return (
      typeof recipient.email === "string" &&
      recipient.email.trim().length > 0 &&
      (recipient.firstName === undefined || typeof recipient.firstName === "string") &&
      (recipient.lastName === undefined || typeof recipient.lastName === "string")
    );
  });
}

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>|<\/div>|<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function ensureSesTemplate(subject: string, content: string) {
  const template = {
    TemplateName: TEMPLATE_NAME,
    SubjectPart: subject,
    HtmlPart: content,
    TextPart: htmlToText(content),
  };

  try {
    await ses.send(new CreateTemplateCommand({ Template: template }));
  } catch (error) {
    if ((error as { name?: string }).name !== "AlreadyExistsException") {
      throw error;
    }
    await ses.send(new UpdateTemplateCommand({ Template: template }));
  }
}

function templateData(recipient: RecipientRecord): string {
  const firstName = recipient.firstName?.trim() || "there";
  const lastName = recipient.lastName?.trim() || "";
  const fullName = [recipient.firstName, recipient.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ") || firstName;

  return JSON.stringify({
    first_name: firstName,
    last_name: lastName,
    full_name: fullName,
    name: fullName,
  });
}

function validatePersonalizedFields(subject: string, content: string, recipients: RecipientRecord[]): string | null {
  const source = `${subject}\n${content}`;
  if (/{{\s*first_name\s*}}/i.test(source) && recipients.some((recipient) => !recipient.firstName?.trim())) {
    return "Every personalized recipient needs a first name.";
  }
  if (/{{\s*last_name\s*}}/i.test(source) && recipients.some((recipient) => !recipient.lastName?.trim())) {
    return "Every personalized recipient needs a last name.";
  }
  if (
    (/{{\s*(?:full_name|name)\s*}}/i.test(source)) &&
    recipients.some((recipient) => !recipient.firstName?.trim() && !recipient.lastName?.trim())
  ) {
    return "Every personalized recipient needs a first name or last name.";
  }
  return null;
}

async function sendPersonalizedEmail({
  subject,
  content,
  to,
  cc,
  personalizedRecipients,
  personalizedDestination,
}: {
  subject: string;
  content: string;
  to: string[];
  cc: string[];
  personalizedRecipients: RecipientRecord[];
  personalizedDestination: "to" | "bcc";
}): Promise<{
  sentRecipients: string[];
  failedRecipients: string[];
  failureReasons: Record<string, string>;
}> {
  await ensureSesTemplate(subject, content);
  const sentRecipients: string[] = [];
  const failedRecipients: string[] = [];
  const failureReasons: Record<string, string> = {};

  for (let start = 0; start < personalizedRecipients.length; start += SES_RECIPIENT_LIMIT) {
    const batch = personalizedRecipients.slice(start, start + SES_RECIPIENT_LIMIT);
    const response = await ses.send(
      new SendBulkTemplatedEmailCommand({
        Source: process.env.SES_FROM_ADDRESS,
        Template: TEMPLATE_NAME,
        DefaultTemplateData: templateData({ email: "", firstName: "there" }),
        Destinations: batch.map((recipient) => ({
          Destination:
            personalizedDestination === "bcc"
              ? {
                  ...(to.length > 0 ? { ToAddresses: to } : {}),
                  ...(cc.length > 0 ? { CcAddresses: cc } : {}),
                  BccAddresses: [recipient.email],
                }
              : {
                  ToAddresses: [recipient.email],
                  ...(cc.length > 0 ? { CcAddresses: cc } : {}),
                },
          ReplacementTemplateData: templateData(recipient),
        })),
      })
    );

    batch.forEach((recipient, index) => {
      const result = response.Status?.[index];
      if (result?.Status === "Success") {
        sentRecipients.push(recipient.email);
        return;
      }

      failedRecipients.push(recipient.email);
      failureReasons[recipient.email] = result?.Error || "AWS SES rejected this recipient.";
    });
  }

  return { sentRecipients, failedRecipients, failureReasons };
}

export async function POST(req: NextRequest) {
  if (!getSession(req)) {
    return NextResponse.json(
      { error: "Authentication is required before sending email." },
      { status: 401 }
    );
  }

  /**
   * use sdk to send email
   * email content will be sent in req
   * 
   * body: {
   *  content: html/plaintext content
   *  subject: text
   *  to: to recipients
   *  cc: cc recipients
   *  bcc: bcc recipients
   * }
   */
  const {
    content,
    subject,
    to,
    cc,
    bcc,
    personalizedRecipients: rawPersonalizedRecipients,
    personalizedDestination,
  } = await req.json();

  const toAddresses = asAddresses(to);
  const ccAddresses = asAddresses(cc);
  const bccAddresses = asAddresses(bcc);
  const personalizedRecipients = asRecipientRecords(rawPersonalizedRecipients);

  if (!content || !subject || (toAddresses.length === 0 && bccAddresses.length === 0)) {
    return NextResponse.json(
      { error: "content, subject, and at least one recipient are required" },
      { status: 400 }
    );
  }

  if (personalizedRecipients.length > 0) {
    if (personalizedDestination !== "to" && personalizedDestination !== "bcc") {
      return NextResponse.json(
        { error: "A valid personalized destination is required." },
        { status: 400 }
      );
    }

    const invalidFields = validatePersonalizedFields(subject, content, personalizedRecipients);
    if (invalidFields) {
      return NextResponse.json({ error: invalidFields }, { status: 400 });
    }

    const result = await sendPersonalizedEmail({
      subject,
      content,
      to: toAddresses,
      cc: ccAddresses,
      personalizedRecipients,
      personalizedDestination,
    });

    return NextResponse.json(
      {
        message:
          result.failedRecipients.length > 0
            ? "Some personalized recipients could not be sent."
            : "personalized email sent",
        ...result,
        recipientCount: personalizedRecipients.length,
      },
      { status: 200 }
    );
  }

  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_ADDRESS,
    Destination: {
      ...(toAddresses.length > 0 ? { ToAddresses: toAddresses } : {}),
      ...(ccAddresses.length > 0 ? { CcAddresses: ccAddresses } : {}),
      ...(bccAddresses.length > 0 ? { BccAddresses: bccAddresses } : {}),
    },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: content } },
    },
  });

  await ses.send(command);
  return NextResponse.json(
    {
      message: "email sent",
      sentRecipients: bccAddresses,
      failedRecipients: [],
      failureReasons: {},
    },
    { status: 200 }
  );
}
