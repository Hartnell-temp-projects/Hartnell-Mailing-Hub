export type RecipientType = "faculty" | "student" | "staff";

export interface RecipientGroup {
  id: string;
  name: string;
  description: string;
  /** Matches the SQL file in lib/sql and the allowlist in /api/db. */
  recipientType: RecipientType;
}

export const RECIPIENT_GROUPS: RecipientGroup[] = [
  {
    id: "all-faculty",
    name: "All Faculty",
    description: "Full-time & part-time faculty",
    recipientType: "faculty",
  },
  {
    id: "all-staff",
    name: "All Staff",
    description: "Administrative & support staff",
    recipientType: "staff",
  },
  {
    id: "all-students",
    name: "All Students",
    description: "Currently enrolled students",
    recipientType: "student",
  },
];
