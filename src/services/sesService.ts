import { SendEmailCommand, SESClient } from "@aws-sdk/client-ses";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";

export type OutgoingMail = {
  subject: string;
  htmlBody: string;
  textBody: string;
};

export function createSesClient(config: Pick<AppConfig, "AWS_REGION">): SESClient {
  return new SESClient({ region: config.AWS_REGION });
}

export async function sendNotificationEmail(
  client: SESClient,
  config: Pick<AppConfig, "SES_FROM_EMAIL" | "SES_FROM_NAME" | "SES_NOTIFICATION_TO" | "SES_REPLY_TO" | "SES_CONFIGURATION_SET">,
  mail: OutgoingMail,
  log: Logger,
): Promise<void> {
  if (!config.SES_FROM_EMAIL || !config.SES_NOTIFICATION_TO) {
    throw new Error("SES_FROM_EMAIL and SES_NOTIFICATION_TO are required to send mail");
  }

  const cmd = new SendEmailCommand({
    Source: config.SES_FROM_NAME
      ? `${config.SES_FROM_NAME} <${config.SES_FROM_EMAIL}>`
      : config.SES_FROM_EMAIL,
    Destination: {
      ToAddresses: [config.SES_NOTIFICATION_TO],
    },
    Message: {
      Subject: { Data: mail.subject, Charset: "UTF-8" },
      Body: {
        Html: { Data: mail.htmlBody, Charset: "UTF-8" },
        Text: { Data: mail.textBody, Charset: "UTF-8" },
      },
    },
    ...(config.SES_REPLY_TO?.trim()
      ? { ReplyToAddresses: [config.SES_REPLY_TO.trim()] }
      : {}),
    ...(config.SES_CONFIGURATION_SET?.trim()
      ? { ConfigurationSetName: config.SES_CONFIGURATION_SET.trim() }
      : {}),
  });

  const out = await client.send(cmd);
  log.info("ses_send_ok", { messageId: out.MessageId });
}
