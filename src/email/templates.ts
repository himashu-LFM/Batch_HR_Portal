function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

const COMPANY_NAME = "Listen First Media"
const SIGNATURE_TEXT = "Team Listen First Media"

export function birthdayTemplate(params: { firstName: string }) {
  const subject = `Happy Birthday, ${params.firstName}!`

  const bodyText = `Hi ${params.firstName},

🎂✨ Today is all about YOU!

On behalf of everyone at ${COMPANY_NAME}, we want to wish you a very Happy Birthday! 🥳

Your energy, creativity, and dedication bring so much value to the team every single day. Whether it's the ideas you share, the problems you solve, or simply the positivity you bring — you make a difference.

💡 Fun Thought for Today:
Take a break, treat yourself, and do something that makes you genuinely happy — you’ve earned it!

🎁 Here’s to:
* More success 🚀
* More growth 🌱
* More amazing moments ahead ✨

We’re lucky to have you with us, and we hope this year brings you everything you’re working towards (and more!).

Enjoy your day to the fullest — you deserve it! 🎈

Warm wishes,
${SIGNATURE_TEXT} 💙`

  const bodyHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e8e8ef;border-radius:12px;padding:28px;">
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(params.firstName)},</p>

        <p style="margin:0 0 14px;font-size:18px;line-height:1.6;font-weight:700;">🎂✨ Today is all about YOU!</p>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          On behalf of everyone at <strong>${escapeHtml(COMPANY_NAME)}</strong>, we want to wish you a
          <strong>very Happy Birthday!</strong> 🥳
        </p>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          Your energy, creativity, and dedication bring so much value to the team every single day. Whether it's the ideas you share, the problems you solve, or simply the positivity you bring — you make a difference.
        </p>

        <div style="margin:18px 0;padding:16px;border-radius:10px;background:#f9fafb;border:1px solid #eef0f5;">
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>💡 Fun Thought for Today:</strong></p>
          <p style="margin:0;font-size:14px;line-height:1.6;">
            Take a break, treat yourself, and do something that makes you genuinely happy — you’ve earned it!
          </p>
        </div>

        <p style="margin:0 0 10px;font-size:15px;line-height:1.7;"><strong>🎁 Here’s to:</strong></p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;">
          <li>More success 🚀</li>
          <li>More growth 🌱</li>
          <li>More amazing moments ahead ✨</li>
        </ul>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          We’re lucky to have you with us, and we hope this year brings you everything you’re working towards (and more!).
        </p>
        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
          Enjoy your day to the fullest — you deserve it! 🎈
        </p>

        <p style="margin:0;font-size:15px;line-height:1.7;">
          Warm wishes,<br />
          <strong>${escapeHtml(SIGNATURE_TEXT)}</strong> 💙
        </p>
      </div>
    </div>
  </body>
</html>`

  return { subject, bodyText, bodyHtml }
}

export function anniversaryTemplate(params: { firstName: string; years: number }) {
  const subject = `Happy Work Anniversary, ${params.firstName}!`

  const bodyText = `Hi ${params.firstName},

🎉 Today marks a special milestone — your Work Anniversary with ${COMPANY_NAME}!

It’s been ${params.years} year(s) since you became a part of our journey, and what an incredible journey it has been. Your contributions, dedication, and passion have played a meaningful role in shaping our success.

👏 From day one to today:
* You’ve grown professionally 📈
* You’ve inspired people around you 🌟
* You’ve made an impact that truly matters 💼

💬 What makes this milestone special?
It’s not just about time — it’s about the value you’ve created and the relationships you’ve built along the way.

We’re proud to have you as part of our team and excited about everything we’ll achieve together in the future.

🚀 Here’s to:
* New challenges
* Bigger achievements
* And many more milestones ahead

Thank you for being an important part of ${COMPANY_NAME}.

Happy Work Anniversary! 🎊

With appreciation,
${SIGNATURE_TEXT} 💙`

  const bodyHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#111;">
    <div style="max-width:680px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border:1px solid #e8e8ef;border-radius:12px;padding:28px;">
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(params.firstName)},</p>

        <p style="margin:0 0 14px;font-size:18px;line-height:1.6;font-weight:700;">
          🎉 Today marks a special milestone — your <strong>Work Anniversary</strong> with ${escapeHtml(COMPANY_NAME)}!
        </p>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          It’s been <strong>${params.years} year(s)</strong> since you became a part of our journey, and what an incredible journey it has been. Your contributions, dedication, and passion have played a meaningful role in shaping our success.
        </p>

        <p style="margin:0 0 10px;font-size:15px;line-height:1.7;"><strong>👏 From day one to today:</strong></p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;">
          <li>You’ve grown professionally 📈</li>
          <li>You’ve inspired people around you 🌟</li>
          <li>You’ve made an impact that truly matters 💼</li>
        </ul>

        <div style="margin:18px 0;padding:16px;border-radius:10px;background:#f9fafb;border:1px solid #eef0f5;">
          <p style="margin:0 0 8px;font-size:14px;line-height:1.6;"><strong>💬 What makes this milestone special?</strong></p>
          <p style="margin:0;font-size:14px;line-height:1.6;">
            It’s not just about time — it’s about the value you’ve created and the relationships you’ve built along the way.
          </p>
        </div>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          We’re proud to have you as part of our team and excited about everything we’ll achieve together in the future.
        </p>

        <p style="margin:0 0 10px;font-size:15px;line-height:1.7;"><strong>🚀 Here’s to:</strong></p>
        <ul style="margin:0 0 16px;padding-left:20px;font-size:15px;line-height:1.8;">
          <li>New challenges</li>
          <li>Bigger achievements</li>
          <li>And many more milestones ahead</li>
        </ul>

        <p style="margin:0 0 14px;font-size:15px;line-height:1.7;">
          Thank you for being an important part of ${escapeHtml(COMPANY_NAME)}.
        </p>

        <p style="margin:0 0 18px;font-size:15px;line-height:1.7;">
          Happy Work Anniversary! 🎊
        </p>

        <p style="margin:0;font-size:15px;line-height:1.7;">
          With appreciation,<br />
          <strong>${escapeHtml(SIGNATURE_TEXT)}</strong> 💙
        </p>
      </div>
    </div>
  </body>
</html>`

  return { subject, bodyText, bodyHtml }
}

