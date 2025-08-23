import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

export interface MinimalIssue {
  id: string;
  title: string;
  description: string;
  organizationId: string;
  machineId: string;
  priorityId: string;
  statusId: string;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export const minimalIssues: MinimalIssue[] = [
  {
    id: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
    title: "Kaiju figures on left ramp are not responding",
    description: "Kaiju figures on left ramp are not responding",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.NEW,
    createdById: SEED_TEST_IDS.USERS.MEMBER1,
    createdAt: new Date("2025-06-21T13:40:02.000Z"),
    updatedAt: new Date("2025-07-01T19:09:30.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.LOUD_BUZZING,
    title: "Loud buzzing noise then crashes",
    description: "Loud buzzing noise then crashes",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.XENON_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.CRITICAL,
    statusId: SEED_TEST_IDS.STATUSES.NEEDS_EXPERT,
    createdById: SEED_TEST_IDS.USERS.MEMBER2,
    createdAt: new Date("2025-06-27T19:05:40.000Z"),
    updatedAt: new Date("2025-07-06T10:27:36.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.LEFT_ROLLOVER,
    title: "Left top rollover target not responding",
    description: "Left top rollover target not responding",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.CLEOPATRA_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.NEW,
    createdById: SEED_TEST_IDS.USERS.MEMBER1,
    createdAt: new Date("2025-06-27T20:12:44.000Z"),
    updatedAt: new Date("2025-07-01T19:10:53.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.RIGHT_GUN_OPTO,
    title: "Right gun opto is flakey - auto fires",
    description:
      "Right gun opto is flakey - auto fires (current workaround -> power cycle)",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.HIGH,
    statusId: SEED_TEST_IDS.STATUSES.IN_PROGRESS,
    createdById: SEED_TEST_IDS.USERS.MEMBER2,
    createdAt: new Date("2025-07-05T15:07:02.000Z"),
    updatedAt: new Date("2025-07-06T10:32:27.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.B_TOP_ROLLOVER,
    title: "b top roll over does not register",
    description: "b top roll over does not register",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.FIXED,
    createdById: SEED_TEST_IDS.USERS.MEMBER1,
    createdAt: new Date("2025-06-16T22:00:40.000Z"),
    updatedAt: new Date("2025-06-16T22:00:40.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.GUN_CALIBRATION,
    title: "Gun calibration was off - left side hits poor",
    description: "Gun calibration was off - left side hits poor",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.NOT_TO_BE_FIXED,
    createdById: SEED_TEST_IDS.USERS.MEMBER2,
    createdAt: new Date("2025-06-28T12:59:21.000Z"),
    updatedAt: new Date("2025-07-04T23:34:55.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.CENTER_POP_BUMPER,
    title: "Center pop bumper is out",
    description: "Center pop bumper is out",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.CLEOPATRA_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.NEW,
    createdById: SEED_TEST_IDS.USERS.MEMBER2,
    createdAt: new Date("2025-06-27T20:13:27.000Z"),
    updatedAt: new Date("2025-07-01T19:10:58.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.TRAIN_WRECK_MULTIBALL,
    title: "Train Wreck multiball drains too fast",
    description:
      "Train Wreck multiball drains too fast - outlanes need adjustment",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.HIGH,
    statusId: SEED_TEST_IDS.STATUSES.NEW,
    createdById: SEED_TEST_IDS.USERS.ADMIN,
    createdAt: new Date("2025-07-08T14:22:15.000Z"),
    updatedAt: new Date("2025-07-08T14:22:15.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.MAGNA_SAVE,
    title: "Magna save not responding consistently",
    description: "Magna save button on the right side is intermittent",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.REVENGE_FROM_MARS_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.LOW,
    statusId: SEED_TEST_IDS.STATUSES.NEW,
    createdById: SEED_TEST_IDS.USERS.MEMBER1,
    createdAt: new Date("2025-07-09T10:15:30.000Z"),
    updatedAt: new Date("2025-07-09T10:15:30.000Z"),
  },
  {
    id: SEED_TEST_IDS.ISSUES.CASTLE_GATE,
    title: "Castle gate mechanism sticking",
    description:
      "Castle gate mechanism sticking during Battle for the Kingdom mode",
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    priorityId: SEED_TEST_IDS.PRIORITIES.HIGH,
    statusId: SEED_TEST_IDS.STATUSES.IN_PROGRESS,
    createdById: SEED_TEST_IDS.USERS.ADMIN,
    createdAt: new Date("2025-07-10T16:45:00.000Z"),
    updatedAt: new Date("2025-07-10T16:45:00.000Z"),
  },
];

export default minimalIssues;
