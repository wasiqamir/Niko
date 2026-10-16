export const ACCOUNT_OPTIONS = [
  {
    id: "host",
    stored: "HOST",
    title: "For my work",
    audience: "Host",
    summary: "I host meetings with clients.",
    detail: "People book time with you for work.",
  },
  {
    id: "participant",
    stored: "PARTICIPANT",
    title: "I'm a participant",
    audience: "Participant",
    summary: "I only join meetings on Niko.",
    detail: "You take part in meetings, and you do not host them.",
  },
] as const;

export type AccountChoice = (typeof ACCOUNT_OPTIONS)[number]["id"];
export type StoredAccountType = (typeof ACCOUNT_OPTIONS)[number]["stored"];

export function isAccountChoice(value: string | undefined): value is AccountChoice {
  return value === "host" || value === "participant";
}

export function accountOption(stored: string) {
  return ACCOUNT_OPTIONS.find((option) => option.stored === stored) ?? null;
}
