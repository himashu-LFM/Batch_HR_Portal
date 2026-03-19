import type { AnniversaryPerson } from "../services/celebrationService.js";
import { renderCelebrationEmail } from "./celebrationLayout.js";

export function anniversaryEmail(people: AnniversaryPerson[]): { subject: string; html: string; text: string } {
  const subject =
    people.length === 1
      ? `🎉 Work anniversary — ${people[0].displayName} (${people[0].years} yr)`
      : `🎉 Work anniversaries today — ${people.length} milestones`;

  const list = people.map((p) => `• ${p.displayName} — ${p.years} year${p.years === 1 ? "" : "s"} with us`).join("\n");

  const body =
    people.length === 1
      ? `A work anniversary is worth a proper shout-out!

Today we recognize ${people[0].displayName} for ${people[0].years} year${people[0].years === 1 ? "" : "s"} of dedication, growth, and impact.

${list}

Thank you for helping build what we are — today and every day.`
      : `Milestone moments — we have several work anniversaries to celebrate!

Please recognize these teammates for their commitment and contributions:

${list}

Thank you all for helping build what we are — today and every day.`;

  return renderCelebrationEmail({ subject, body });
}
