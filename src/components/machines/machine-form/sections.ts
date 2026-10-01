/**
 * Fragment ids of the machine form's sections (machine-editing 5.1–5.2).
 *
 * One list, read by both the form (which renders an anchor at each section's
 * start) and the Manage tab's section navigation (which links to them and
 * marks the one in view). A new section is one entry here plus its anchor —
 * the Apron card section (PP-wqit.14.3) lands between Integrations and Danger
 * zone.
 */
export const MACHINE_FORM_SECTION_IDS = {
  details: "section-nav-details",
  modelDetails: "section-nav-model-details",
  integrations: "section-nav-integrations",
  dangerZone: "section-nav-danger-zone",
} as const;

export interface SectionNavItem {
  /** Fragment id of the section's anchor. */
  id: string;
  label: string;
}
