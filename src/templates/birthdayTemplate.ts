import type { CelebrationPerson } from "../services/celebrationService.js";
import { renderCelebrationEmail } from "./celebrationLayout.js";

export function birthdayEmail(people: CelebrationPerson[]): { subject: string; html: string; text: string } {
  const subject =
    people.length === 1
      ? `🎂 Birthday today — ${people[0].displayName}`
      : `🎂 Birthdays today — ${people.length} celebrations`;

  const list = people.map((p) => `• ${p.displayName}`).join("\n");

  const body =
    people.length === 1
      ? `We have a birthday to celebrate today!

Please join us in wishing ${people[0].displayName} a fantastic day and an amazing year ahead.

${list}

This is an automated note from our HR batch — the real magic is when we say it in person.`
      : `We have multiple birthdays on the calendar today — the more cake, the merrier!

Please celebrate these teammates and make their day special:

${list}

This is an automated note from our HR batch — the real magic is when we say it in person.`;

  return renderCelebrationEmail({ subject, body });
}
