/**
 * Shared celebration email layout — party-themed (People Lens style).
 * HTML/text built from subject + body paragraphs (split on blank lines).
 */

export interface CelebrationEmailParams {
  subject: string;
  body: string;
  /** If set, greeting becomes "Hi {userName},"; else "Hi Team," */
  userName?: string;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function celebrationText(params: CelebrationEmailParams): string {
  const greeting = params.userName ? `Hi ${params.userName},` : "Hi Team,";
  const sections = params.body
    .split("\n\n")
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  let output = `${greeting}\n\n`;
  output += `${params.subject}\n`;
  output += `${"=".repeat(Math.max(params.subject.length, 10))}\n\n`;
  output += `${sections.join("\n\n")}\n\n`;
  output += "Let's celebrate together.\n\n";
  output += "Cheers,\nPeople Lens Team";
  return output.trim();
}

export function celebrationHtml(params: CelebrationEmailParams): string {
  const greeting = params.userName ? `Hi ${params.userName},` : "Hi Team,";
  const sections = params.body
    .split("\n\n")
    .map((section) => section.trim())
    .filter((section) => section.length > 0);

  const sectionHtml = sections
    .map(
      (section) => `
        <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.7; color: #1f2937; white-space: pre-line;">
          ${escapeHtml(section)}
        </p>
      `,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f1ff;font-family:Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:28px 16px;background:#f4f1ff;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(109,40,217,0.18);border:1px solid #e9d5ff;">
          <tr>
            <td style="padding:0;background:linear-gradient(135deg,#7c3aed,#db2777,#f59e0b);">
              <div style="padding:28px 28px 24px;">
                <div style="display:inline-block;padding:6px 10px;border-radius:999px;background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;">
                  Celebration
                </div>
                <h1 style="margin:14px 0 8px;color:#ffffff;font-size:30px;line-height:1.2;">
                  ${escapeHtml(params.subject)}
                </h1>
                <p style="margin:0;color:#fdf4ff;font-size:14px;">
                  A party-themed update from People Lens
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 18px;font-size:18px;font-weight:700;color:#4c1d95;">
                ${escapeHtml(greeting)}
              </p>
              ${sectionHtml}
              <div style="margin-top:22px;padding:16px;border-radius:12px;background:#faf5ff;border:1px dashed #c084fc;">
                <p style="margin:0;font-size:15px;line-height:1.6;color:#5b21b6;font-weight:600;">
                  Let's celebrate this moment together.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:22px 28px;background:#111827;">
              <p style="margin:0;color:#fde68a;font-size:15px;font-weight:700;">Cheers,</p>
              <p style="margin:6px 0 0;color:#ffffff;font-size:14px;">People Lens Team</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function renderCelebrationEmail(params: CelebrationEmailParams): { subject: string; html: string; text: string } {
  return {
    subject: params.subject,
    html: celebrationHtml(params),
    text: celebrationText(params),
  };
}
