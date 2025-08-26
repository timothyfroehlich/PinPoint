import { SEED_TEST_IDS } from "./constants";

export interface MinimalIssue {
  id: string;
  title: string;
  description: string;
  organization_id: string;
  machine_id: string;
  priority_id: string;
  status_id: string;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

export const minimalIssues: MinimalIssue[] = [
  {
    id: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
    title: "Kaiju figures on left ramp are not responding",
    description: "Kaiju figures on left ramp are not responding",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.NEW,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER1,
    created_at: new Date("2025-06-21T13:40:02.000Z"),
    updated_at: new Date("2025-07-01T19:09:30.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.LOUD_BUZZING,
    title: "Loud buzzing noise then crashes",
    description: "Loud buzzing noise then crashes",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.XENON_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.CRITICAL,
    status_id: SEED_TEST_IDS.STATUSES.NEEDS_EXPERT,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER2,
    created_at: new Date("2025-06-27T19:05:40.000Z"),
    updated_at: new Date("2025-07-06T10:27:36.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.LEFT_ROLLOVER,
    title: "Left top rollover target not responding",
    description: "Left top rollover target not responding",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.CLEOPATRA_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.NEW,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER1,
    created_at: new Date("2025-06-27T20:12:44.000Z"),
    updated_at: new Date("2025-07-01T19:10:53.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.RIGHT_GUN_OPTO,
    title: "Right gun opto is flakey - auto fires",
    description:
      "Right gun opto is flakey - auto fires (current workaround -> power cycle)",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.HIGH,
    status_id: SEED_TEST_IDS.STATUSES.IN_PROGRESS,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER2,
    created_at: new Date("2025-07-05T15:07:02.000Z"),
    updated_at: new Date("2025-07-06T10:32:27.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.B_TOP_ROLLOVER,
    title: "b top roll over does not register",
    description: "b top roll over does not register",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.FIXED,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER1,
    created_at: new Date("2025-06-16T22:00:40.000Z"),
    updated_at: new Date("2025-06-16T22:00:40.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.GUN_CALIBRATION,
    title: "Gun calibration was off - left side hits poor",
    description: "Gun calibration was off - left side hits poor",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.NOT_TO_BE_FIXED,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER2,
    created_at: new Date("2025-06-28T12:59:21.000Z"),
    updated_at: new Date("2025-07-04T23:34:55.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.CENTER_POP_BUMPER,
    title: "Center pop bumper is out",
    description: "Center pop bumper is out",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.CLEOPATRA_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.NEW,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER2,
    created_at: new Date("2025-06-27T20:13:27.000Z"),
    updated_at: new Date("2025-07-01T19:10:58.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.TRAIN_WRECK_MULTIBALL,
    title: "Train Wreck multiball drains too fast",
    description:
      "Train Wreck multiball drains too fast - outlanes need adjustment",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.HIGH,
    status_id: SEED_TEST_IDS.STATUSES.NEW,
    created_by_id: SEED_TEST_IDS.USERS.ADMIN,
    created_at: new Date("2025-07-08T14:22:15.000Z"),
    updated_at: new Date("2025-07-08T14:22:15.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.MAGNA_SAVE,
    title: "Magna save not responding consistently",
    description: "Magna save button on the right side is intermittent",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.LOW,
    status_id: SEED_TEST_IDS.STATUSES.NEW,
    created_by_id: SEED_TEST_IDS.USERS.MEMBER1,
    created_at: new Date("2025-07-09T10:15:30.000Z"),
    updated_at: new Date("2025-07-09T10:15:30.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.CASTLE_GATE,
    title: "Castle gate mechanism sticking",
    description:
      "Castle gate mechanism sticking during Battle for the Kingdom mode",
    organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    priority_id: SEED_TEST_IDS.PRIORITIES.HIGH,
    status_id: SEED_TEST_IDS.STATUSES.IN_PROGRESS,
    created_by_id: SEED_TEST_IDS.USERS.ADMIN,
    created_at: new Date("2025-07-10T16:45:00.000Z"),
    updated_at: new Date("2025-07-10T16:45:00.000Z"),
  },
];

export default minimalIssues;
