import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2"

let client: SESv2Client | null = null

function getSES() {
  if (client) return client
  const region = process.env.AWS_REGION || "ap-south-1"
  client = new SESv2Client({ region })
  return client
}

export type SendEmailInput = {
  to: string | string[]
  from: string
  subject: string
  bodyText: string
  bodyHtml: string
}

export async function sendEmail(input: SendEmailInput): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  try {
    const to = Array.isArray(input.to) ? input.to : [input.to]
    const toAddresses = to.map((x) => x.trim()).filter(Boolean)
    if (toAddresses.length === 0) return { ok: false, error: "No recipients" }

    const cmd = new SendEmailCommand({
      FromEmailAddress: input.from,
      Destination: { ToAddresses: toAddresses },
      Content: {
        Simple: {
          Subject: { Data: input.subject },
          Body: {
            Text: { Data: input.bodyText },
            Html: { Data: input.bodyHtml },
          },
        },
      },
    })
    const res = await getSES().send(cmd)
    if (!res.MessageId) return { ok: false, error: "SES returned no MessageId" }
    return { ok: true, messageId: res.MessageId }
  } catch (e: any) {
    return { ok: false, error: e?.message || "SES send failed" }
  }
}

