import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import minimalIssues, { MinimalIssue } from "./minimal-issues";

// Helper mappers and assumptions
const mapSeverityToPriority = (severity?: string) => {
  if (!severity) return SEED_TEST_IDS.PRIORITIES.LOW;
  const s = severity.toLowerCase();
  if (s.includes("severe")) return SEED_TEST_IDS.PRIORITIES.CRITICAL;
  if (s.includes("major")) return SEED_TEST_IDS.PRIORITIES.HIGH;
  if (s.includes("minor") || s.includes("cosmetic"))
    return SEED_TEST_IDS.PRIORITIES.LOW;
  return SEED_TEST_IDS.PRIORITIES.MEDIUM;
};

const mapStatusToStatusId = (status?: string) => {
  if (!status) return SEED_TEST_IDS.STATUSES.NEW;
  const s = status.toLowerCase();
  if (s.includes("new")) return SEED_TEST_IDS.STATUSES.NEW;
  if (s.includes("in progress") || s.includes("inprogress"))
    return SEED_TEST_IDS.STATUSES.IN_PROGRESS;
  if (s.includes("needs expert") || s.includes("needs expert help"))
    return SEED_TEST_IDS.STATUSES.NEEDS_EXPERT;
  if (s.includes("fixed")) return SEED_TEST_IDS.STATUSES.FIXED;
  // Match variants like "not to be fixed", "Not-to-be-fixed", etc.
  if (/not\s*[-_\s]*to\s*[-_\s]*be\s*[-_\s]*fixed/i.test(status))
    return SEED_TEST_IDS.STATUSES.NOT_TO_BE_FIXED;
  // Fallback for statuses like "Needs Parts" -> treat as IN_PROGRESS
  return SEED_TEST_IDS.STATUSES.IN_PROGRESS;
};

const mapReporterToUserId = (email?: string) => {
  if (!email) return SEED_TEST_IDS.USERS.MEMBER1;
  const e = email.toLowerCase();
  if (e.includes("roger.sharpe")) return SEED_TEST_IDS.USERS.MEMBER1;
  if (e.includes("gary.stern")) return SEED_TEST_IDS.USERS.MEMBER2;
  if (e.includes("harry.williams")) return SEED_TEST_IDS.USERS.MEMBER1;
  if (e.includes("escher.lefkoff")) return SEED_TEST_IDS.USERS.MEMBER2;
  if (
    e.includes("timfroehlich") ||
    e.includes("tim@") ||
    e.includes("tim.example") ||
    e.includes("tim@example.com")
  )
    return SEED_TEST_IDS.USERS.ADMIN;
  // Fallback to MEMBER1
  return SEED_TEST_IDS.USERS.MEMBER1;
};

// Map common game titles/opdb ids to known machines; for unknown games we use MOCK_PATTERNS.MACHINE
const knownMachineByTitle = (title?: string, opdb?: string) => {
  // Primary deterministic lookup by OPDB id when available
  if (opdb) {
    const o = opdb.trim();
    switch (o) {
      case "GBLLd-MdEON-A94po":
        return SEED_TEST_IDS.MACHINES.ULTRAMAN_KAIJU;
      case "G42Pk-MZe2e":
        return SEED_TEST_IDS.MACHINES.XENON_1;
      case "GrknN-MQrdv":
        return SEED_TEST_IDS.MACHINES.CLEOPATRA_1;
      case "G50Wr-MLeZP":
        return SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1;
      case "G4835-M2YPK-AR5ln":
        return SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1;
      // Add other deterministic OPDB -> machine mappings here as needed
      default:
        break;
    }
  }

  // Fallback to title-based heuristic when OPDB lookup not available
  const t = (title || "").toLowerCase();
  if (t.includes("medieval")) return SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1;
  if (t.includes("ultraman") || t.includes("kaiju"))
    return SEED_TEST_IDS.MACHINES.ULTRAMAN_KAIJU;
  if (t.includes("cactus canyon"))
    return SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1;
  if (t.includes("revenge from mars"))
    return SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1;
  if (t.includes("cleopatra")) return SEED_TEST_IDS.MACHINES.CLEOPATRA_1;
  if (t.includes("xenon")) return SEED_TEST_IDS.MACHINES.XENON_1;
  // Unknown: return undefined to allow mock pattern
  return undefined;
};

// Source data converted from scripts/seed/shared/sample-issues.json
const sampleData: Array<Record<string, any>> = [
  {
    title: "Kaiju figures on left ramp are not responding",
    description: "Kaiju figures on left ramp are not responding",
    severity: "Cosmetic",
    status: "New",
    gameTitle: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
    reporterEmail: "roger.sharpe@pinpoint.dev",
    createdAt: "2025-06-21T13:40:02.000Z",
    updatedAt: "2025-07-01T19:09:30.000Z",
    gameOpdbId: "GBLLd-MdEON-A94po",
  },
  {
    title: "Loud buzzing noise then crashes",
    description: "Loud buzzing noise then crashes",
    severity: "Severe",
    status: "Needs expert help",
    gameTitle: "Xenon",
    reporterEmail: "gary.stern@pinpoint.dev",
    createdAt: "2025-06-27T19:05:40.000Z",
    updatedAt: "2025-07-06T10:27:36.000Z",
    gameOpdbId: "G42Pk-MZe2e",
  },
  {
    title: "Left top rollover target not responding",
    description: "Left top rollover target not responding",
    severity: "Minor",
    status: "New",
    gameTitle: "Cleopatra",
    reporterEmail: "harry.williams@pinpoint.dev",
    createdAt: "2025-06-27T20:12:44.000Z",
    updatedAt: "2025-07-01T19:10:53.000Z",
    gameOpdbId: "GrknN-MQrdv",
  },
  {
    title: "Center pop bumper is out",
    description: "Center pop bumper is out",
    severity: "Minor",
    status: "New",
    gameTitle: "Cleopatra",
    reporterEmail: "escher.lefkoff@pinpoint.dev",
    createdAt: "2025-06-27T20:13:27.000Z",
    updatedAt: "2025-07-01T19:10:58.000Z",
    gameOpdbId: "GrknN-MQrdv",
  },
  {
    title: "Sensitive Tilt Warning - needs adjustment/testing",
    description:
      "Sensitive Tilt Warning - needs adjustment/testing. A designer suggests it may be a loose connector or cracked solder joint.",
    severity: "Minor",
    status: "Needs expert help",
    gameTitle: "Ultraman: Kaiju Rumble (Blood Sucker Edition)",
    reporterEmail: "roger.sharpe@pinpoint.dev",
    createdAt: "2025-06-28T12:55:37.000Z",
    updatedAt: "2025-07-02T15:30:02.000Z",
    gameOpdbId: "GBLLd-MdEON-A94po",
  },
  {
    title: "Capture Switch not always reading",
    description:
      "Capture Switch not always reading - Ball Lock shot not reading ball immediately",
    severity: "Minor",
    status: "Not to be Fixed",
    gameTitle: "Revenge from Mars",
    reporterEmail: "gary.stern@pinpoint.dev",
    createdAt: "2025-06-28T12:59:21.000Z",
    updatedAt: "2025-07-04T23:34:55.000Z",
    gameOpdbId: "G50Wr-MLeZP",
  },
  {
    title: "Right gun opto is flakey - auto fires",
    description:
      "Right gun opto is flakey - auto fires (current workaround -> power cycle)",
    severity: "Major",
    status: "New",
    gameTitle: "Star Trek: The Next Generation",
    reporterEmail: "timfroehlich@pinpoint.dev",
    createdAt: "2025-06-28T13:01:33.000Z",
    updatedAt: "2025-07-01T19:11:54.000Z",
    gameOpdbId: "GR6d8-M1rZd",
  },
  {
    title: "Lock Shot is inconsistently responding",
    description: "Lock Shot is inconsistently responding - rattling",
    severity: "Minor",
    status: "New",
    gameTitle: "Star Trek: The Next Generation",
    reporterEmail: "harry.williams@pinpoint.dev",
    createdAt: "2025-06-28T13:02:22.000Z",
    updatedAt: "2025-06-29T14:35:23.000Z",
    gameOpdbId: "GR6d8-M1rZd",
  },
  {
    title: "Sarumon front screw missing",
    description: "Sarumon front screw missing",
    severity: "Cosmetic",
    status: "New",
    gameTitle: "Lord of the Rings",
    reporterEmail: "escher.lefkoff@pinpoint.dev",
    createdAt: "2025-06-28T13:03:48.000Z",
    updatedAt: "2025-07-01T19:12:49.000Z",
    gameOpdbId: "GrqZX-MD15w",
  },
  {
    title: "The Rescue: No CPU / VRAM",
    description: "No CPU / VRAM",
    severity: "Severe",
    status: "Needs Parts",
    gameTitle: "Transporter the Rescue",
    reporterEmail: "roger.sharpe@pinpoint.dev",
    createdAt: "2025-06-28T13:06:09.000Z",
    updatedAt: "2025-07-01T13:13:11.000Z",
    gameOpdbId: "G5n2D-MLn85",
  },
  {
    title: "will not turn on",
    description: "will not turn on",
    severity: "Severe",
    status: "Needs expert help",
    gameTitle: "Sea Ray",
    reporterEmail: "gary.stern@pinpoint.dev",
    createdAt: "2025-06-28T13:08:51.000Z",
    updatedAt: "2025-07-01T19:21:25.000Z",
    gameOpdbId: "G4jBk-MLB1w",
  },
  {
    title: "Bonus Counter jams up",
    description: "Bonus Counter jams up - incorrectly counts",
    severity: "Minor",
    status: "New",
    gameTitle: "Super Soccer",
    reporterEmail: "timfroehlich@pinpoint.dev",
    createdAt: "2025-06-28T13:10:20.000Z",
    updatedAt: "2025-07-06T10:24:09.000Z",
    gameOpdbId: "GRn8D-MQd21",
  },
  {
    title: "3rd top lane light and scoring issues",
    description: "3rd top lane light and scoring issues",
    severity: "Minor",
    status: "New",
    gameTitle: "Super Soccer",
    reporterEmail: "harry.williams@pinpoint.dev",
    createdAt: "2025-06-28T13:11:14.000Z",
    updatedAt: "2025-07-01T19:13:48.000Z",
    gameOpdbId: "GRn8D-MQd21",
  },
  {
    title: "Pop bumpers weak / not responsive",
    description: "Pop bumpers weak / not responsive",
    severity: "Minor",
    status: "New",
    gameTitle: "Domino",
    reporterEmail: "escher.lefkoff@pinpoint.dev",
    createdAt: "2025-06-28T13:11:58.000Z",
    updatedAt: "2025-07-01T19:15:04.000Z",
    gameOpdbId: "G4j8k-MJK5K",
  },
  {
    title: "Right flipper electrical issues",
    description:
      "Right flipper electrical issues; new coil stop needed for right flipper A-18702",
    severity: "Major",
    status: "Needs Parts",
    gameTitle: "Domino",
    reporterEmail: "roger.sharpe@pinpoint.dev",
    createdAt: "2025-06-28T13:12:48.000Z",
    updatedAt: "2025-07-01T19:15:05.000Z",
    gameOpdbId: "G4j8k-MJK5K",
  },
  {
    title: "Game logic faulty",
    description: "Game logic faulty - light issues, sound issues",
    severity: "Minor",
    status: "New",
    gameTitle: "Cleopatra",
    reporterEmail: "gary.stern@pinpoint.dev",
    createdAt: "2025-06-28T13:13:53.000Z",
    updatedAt: "2025-07-06T10:35:04.000Z",
    gameOpdbId: "GrknN-MQrdv",
  },
  {
    title: "Multiple lights out",
    description:
      "Multiple lights out. Yoppsicle LED Upgrade in progress - NEED TOOLS",
    severity: "Cosmetic",
    status: "In Progress",
    gameTitle: "Xenon",
    reporterEmail: "roger.sharpe@pinpoint.dev",
    createdAt: "2025-06-08T00:00:00.000Z",
    updatedAt: "2025-07-01T19:18:58.000Z",
    gameOpdbId: "G42Pk-MZe2e",
  },
  {
    title: "Lock needs to be keyed",
    description:
      "Lock needs to be keyed (unable to access machine). Locks are in tech room; old lock needs to be drilled out and replaced",
    severity: "Major",
    status: "In Progress",
    gameTitle: "Hokus Pokus",
    reporterEmail: "gary.stern@pinpoint.dev",
    createdAt: "2025-06-08T00:00:00.000Z",
    updatedAt: "2025-07-01T19:19:13.000Z",
    gameOpdbId: "GRwBN-MJ5ln",
  },
  {
    title: "Does not start a game",
    description:
      "Does not start a game. A designer looked at game; thinks contacts may need to be cleaned; previously it was recommended to use something to poke the stepper motor, however, this fix no longer works and game is inoperable.",
    severity: "Severe",
    status: "In Progress",
    gameTitle: "Top Score",
    reporterEmail: "timfroehlich@pinpoint.dev",
    createdAt: "2025-06-08T00:00:00.000Z",
    updatedAt: "2025-07-01T19:21:32.000Z",
    gameOpdbId: "G5W1w-MQVkq",
  },
  {
    title: "Broken railing under house",
    description:
      "Broken railing under house. A designer is ordering parts from Spooky",
    severity: "Major",
    status: "In Progress",
    gameTitle: "Halloween (CE)",
    reporterEmail: "harry.williams@pinpoint.dev",
    createdAt: "2025-06-16T00:00:00.000Z",
    updatedAt: "2025-07-01T19:22:09.000Z",
    gameOpdbId: "Gj66Z-Mp4BN-A9Y6n",
  },
  {
    title: "Auto plunger does not clear the lane",
    description:
      "Auto plunger does not clear the lane, only about 20% of the time",
    severity: "Major",
    status: "Occasionally",
    gameTitle: "Game of Thrones (Pro)",
    reporterEmail: "escher.lefkoff@pinpoint.dev",
    createdAt: "2025-06-30T00:00:00.000Z",
    updatedAt: "2025-07-01T19:22:32.000Z",
    gameOpdbId: "G41d5-MKNwX",
  },
];

// Runtime validator for MinimalIssue
const isMinimalIssue = (obj: any): obj is MinimalIssue => {
  return (
    obj &&
    typeof obj.id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.description === "string" &&
    typeof obj.organizationId === "string" &&
    typeof obj.machineId === "string" &&
    typeof obj.priorityId === "string" &&
    typeof obj.statusId === "string" &&
    typeof obj.createdById === "string" &&
    obj.createdAt instanceof Date &&
    obj.updatedAt instanceof Date
  );
};

// Convert sampleData into MinimalIssue objects using SEED_TEST_IDS where possible
const otherIssues: MinimalIssue[] = sampleData.map((s, idx) => {
  const knownMachine = knownMachineByTitle(s.gameTitle, s.gameOpdbId);
  const machineId =
    knownMachine ?? `${SEED_TEST_IDS.MOCK_PATTERNS.MACHINE}-${idx + 1}`;

  const issue: MinimalIssue = {
    id: `${SEED_TEST_IDS.MOCK_PATTERNS.ISSUE}-${idx + 1}`,
    title: s.title ?? "Untitled",
    description: s.description ?? "",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId,
    priorityId: mapSeverityToPriority(s.severity),
    statusId: mapStatusToStatusId(s.status),
    createdById: mapReporterToUserId(s.reporterEmail),
    createdAt: new Date(s.createdAt ?? new Date().toISOString()),
    updatedAt: new Date(s.updatedAt ?? s.createdAt ?? new Date().toISOString()),
  };

  return issue;
});

// Validate minimalIssues shape before merging
if (!Array.isArray(minimalIssues) || !minimalIssues.every(isMinimalIssue)) {
  throw new Error(
    "minimalIssues is not a valid MinimalIssue[] - aborting seed merge",
  );
}

export const allIssues: MinimalIssue[] = [...minimalIssues, ...otherIssues];

export default allIssues;
