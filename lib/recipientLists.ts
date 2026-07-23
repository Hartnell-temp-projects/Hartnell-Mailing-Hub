export interface RecipientGroup {
  id: string;
  name: string;
  description: string;
  emails: string[];
}

export const RECIPIENT_GROUPS: RecipientGroup[] = [
  {
    id: "all-faculty",
    name: "All Faculty",
    description: "Full-time & part-time faculty",
    emails: [],
  },
  {
    id: "all-staff",
    name: "All Staff",
    description: "Administrative & support staff",
    emails: [],
  },
  {
    id: "all-students",
    name: "All Students",
    description: "Currently enrolled students",
    emails: [],
  },
];
