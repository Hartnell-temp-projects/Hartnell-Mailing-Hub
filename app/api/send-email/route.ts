import { NextRequest, NextResponse } from "next/server";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "us-west-2" });

export async function POST(req: NextRequest) {
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
  const { content, subject, to, cc, bcc } = await req.json();

  if (!content || !subject || !to?.length) {
    return NextResponse.json(
      { error: "content, subject, and to are required" },
      { status: 400 }
    );
  }

  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_ADDRESS,
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
      ...(cc?.length && { CcAddresses: Array.isArray(cc) ? cc : [cc] }),
      ...(bcc?.length && { BccAddresses: Array.isArray(bcc) ? bcc : [bcc] }),
    },
    Message: {
      Subject: { Data: subject },
      Body: { Html: { Data: content } },
    },
  });

  await ses.send(command);
  return NextResponse.json({ message: "email sent" }, { status: 200 });
}
