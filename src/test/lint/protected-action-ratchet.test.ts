import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * CORE-ARCH-013 ratchet: every exported Server Action is built with
 * `createProtectedAction` or `createPublicAction`, except the ones listed
 * below. The lists only shrink: a new hand-rolled action fails the first test,
 * and an entry that was migrated or deleted fails the second until it is
 * removed from its list.
 */

/** Permanent exceptions named by CORE-ARCH-013. */
const EXEMPT = new Set([
  // Signed-out auth flows.
  "src/app/(auth)/actions.ts#loginAction",
  "src/app/(auth)/actions.ts#signupAction",
  "src/app/(auth)/actions.ts#forgotPasswordAction",
  "src/app/(auth)/actions.ts#resetPasswordAction",
  // Redirect-only OAuth and consent actions.
  "src/app/(auth)/oauth-actions.ts#signInWithProviderAction",
  "src/app/(auth)/oauth-actions.ts#linkProviderAction",
  "src/app/(auth)/oauth-actions.ts#unlinkProviderAction",
  "src/app/(auth)/oauth/consent/actions.ts#approveConsentAction",
  "src/app/(auth)/oauth/consent/actions.ts#denyConsentAction",
]);

/** Hand-rolled actions that predate CORE-ARCH-013, waiting to migrate. */
const HAND_ROLLED = new Set([
  "src/app/(app)/admin/integrations/discord/actions.ts#validateBotToken",
  "src/app/(app)/admin/integrations/discord/actions.ts#validateServerId",
  "src/app/(app)/admin/integrations/discord/actions.ts#saveDiscordConfigAction",
  "src/app/(app)/admin/integrations/discord/actions.ts#saveDiscordConfig",
  "src/app/(app)/admin/integrations/discord/actions.ts#clearDiscordBotTokenAction",
  "src/app/(app)/admin/integrations/discord/activity-summary-actions.ts#saveActivitySummaryConfigAction",
  "src/app/(app)/admin/integrations/discord/activity-summary-actions.ts#sendActivitySummaryTestAction",
  "src/app/(app)/admin/integrations/discord/activity-summary-actions.ts#sendActivitySummaryNowAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#checkPinballMapLocationAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#commitCheckedPinballMapLocationAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#clearPinballMapLocationAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#syncPinballMapNowAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#saveRegionAlertConfigAction",
  "src/app/(app)/admin/integrations/pinballmap/actions.ts#sendRegionAlertTestAction",
  "src/app/(app)/admin/users/actions.ts#updateUserRole",
  "src/app/(app)/admin/users/actions.ts#inviteUser",
  "src/app/(app)/admin/users/actions.ts#removeInvitedUser",
  "src/app/(app)/admin/users/actions.ts#resendInvite",
  "src/app/(app)/c/collections/actions.ts#createCollectionAction",
  "src/app/(app)/c/collections/actions.ts#updateCollectionAction",
  "src/app/(app)/c/collections/actions.ts#setCollectionSharingAction",
  "src/app/(app)/c/collections/actions.ts#deleteCollectionAction",
  "src/app/(app)/c/collections/actions.ts#addCollectionCollaboratorAction",
  "src/app/(app)/c/collections/actions.ts#removeCollectionCollaboratorAction",
  "src/app/(app)/c/tags/actions.ts#createTagTypeAction",
  "src/app/(app)/c/tags/actions.ts#renameTagTypeAction",
  "src/app/(app)/c/tags/actions.ts#deleteTagTypeAction",
  "src/app/(app)/c/tags/actions.ts#setTagTypeExclusiveAction",
  "src/app/(app)/c/tags/actions.ts#createTagAction",
  "src/app/(app)/c/tags/actions.ts#renameTagAction",
  "src/app/(app)/c/tags/actions.ts#deleteTagAction",
  "src/app/(app)/c/tags/actions.ts#moveTagAction",
  "src/app/(app)/c/tags/actions.ts#setTagMachinesAction",
  "src/app/(app)/c/tags/actions.ts#setMachineTagAction",
  "src/app/(app)/issues/actions.ts#updateIssueStatusAction",
  "src/app/(app)/issues/actions.ts#updateIssueSeverityAction",
  "src/app/(app)/issues/actions.ts#updateIssueFrequencyAction",
  "src/app/(app)/issues/actions.ts#updateIssuePriorityAction",
  "src/app/(app)/issues/actions.ts#assignIssueAction",
  "src/app/(app)/issues/actions.ts#addCommentAction",
  "src/app/(app)/issues/actions.ts#editCommentAction",
  "src/app/(app)/issues/actions.ts#deleteCommentAction",
  "src/app/(app)/issues/actions.ts#updateIssueTitleAction",
  "src/app/(app)/issues/actions.ts#reassignIssueMachineAction",
  "src/app/(app)/issues/export-action.ts#exportIssuesAction",
  "src/app/(app)/m/[initials]/(tabs)/apron/actions.ts#saveApronCardsAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#saveSettingsSetAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#deleteSettingsSetAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#duplicateSettingsSetAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#setPreferredSettingsSetAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#publishSettingsSetAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#setTournamentTagAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#updateMachineSettingsInstructionsAction",
  "src/app/(app)/m/[initials]/(tabs)/settings/actions.ts#updateMachineSettingsRequestsAction",
  "src/app/(app)/m/[initials]/(tabs)/timeline/actions.ts#addMachineCommentAction",
  "src/app/(app)/m/[initials]/(tabs)/timeline/actions.ts#editMachineCommentAction",
  "src/app/(app)/m/[initials]/(tabs)/timeline/actions.ts#deleteMachineCommentAction",
  "src/app/(app)/m/[initials]/(tabs)/timeline/pinballmap-comment-actions.ts#convertPinballMapCommentAction",
  "src/app/(app)/m/actions.ts#createMachineAction",
  "src/app/(app)/m/actions.ts#updateMachineAction",
  "src/app/(app)/m/actions.ts#deleteMachineAction",
  "src/app/(app)/m/actions.ts#updateMachineDescription",
  "src/app/(app)/m/actions.ts#updateMachineOwnerRequirements",
  "src/app/(app)/m/actions.ts#updateMachinePresenceAction",
  "src/app/(app)/m/iscored-actions.ts#getIscoredGamesAction",
  "src/app/(app)/m/pinballmap-actions.ts#searchPinballMapFamiliesAction",
  "src/app/(app)/m/pinballmap-actions.ts#listPinballMapEditionsAction",
  "src/app/(app)/m/pinballmap-actions.ts#resolvePinballMapLinkAction",
  "src/app/(app)/m/pinballmap-actions.ts#getPinballMapTitleIcEligibleAction",
  "src/app/(app)/m/pinballmap-actions.ts#setPinballmapIntentAction",
  "src/app/(app)/m/pinballmap-actions.ts#addMachineToPinballMapAction",
  "src/app/(app)/m/pinballmap-actions.ts#removeMachineFromPinballMapAction",
  "src/app/(app)/m/pinballmap-actions.ts#removeUnlinkedPinballmapEntryAction",
  "src/app/(app)/m/pinballmap-actions.ts#linkMachineToPinballmapEntryAction",
  "src/app/(app)/m/pinballmap-actions.ts#setInsiderConnectedIntentAction",
  "src/app/(app)/m/pinballmap-actions.ts#updateInsiderConnectedAction",
  "src/app/(app)/m/pinballmap-actions.ts#checkRemovalCommentsAction",
  "src/app/(app)/m/pinballmap-actions.ts#refreshPinballmapLineupAction",
  "src/app/(app)/m/pinballmap-actions.ts#checkConfirmLineupAction",
  "src/app/(app)/m/pinballmap-actions.ts#confirmPinballmapLineupAction",
  "src/app/(app)/mentions/actions.ts#searchMentionableUsers",
  "src/app/(app)/report/(tabbed)/quick/actions.ts#submitQuickIssuesAction",
  "src/app/(app)/report/(tabbed)/quick/actions.ts#submitQuickIssueRowAction",
  "src/app/(app)/report/actions.ts#submitPublicIssueAction",
  "src/app/(app)/report/actions.ts#getRecentIssuesAction",
  "src/app/(app)/settings/actions.ts#deleteAccountAction",
  "src/app/(app)/settings/actions.ts#changePasswordAction",
  "src/app/(app)/settings/connected-accounts/test-discord-dm-action.ts#testDiscordDmAction",
  "src/app/(app)/settings/pinballmap/actions.ts#linkPinballMapAccountAction",
  "src/app/(app)/settings/pinballmap/actions.ts#unlinkPinballMapAccountAction",
  "src/app/(app)/u/[id]/actions.ts#updateProfileAction",
  "src/app/(auth)/actions.ts#logoutAction",
  "src/server/actions/avatar.ts#uploadAvatarAction",
  "src/server/actions/images.ts#uploadIssueImage",
]);

const ROOT = process.cwd();
const USE_SERVER = /^["']use server["'];?\s*$/m;
const PIPELINE_CONST =
  /^(?:export\s+)?const\s+(\w+)\s*=\s*create(?:Protected|Public)Action\b/gm;
const EXPORTED_ACTION =
  /^export\s+(?:async\s+function\s+(\w+)|const\s+(\w+)\s*=)/gm;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)
      ? [path]
      : [];
  });
}

/** The export's source, from its declaration to the next top-level `}`. */
function declarationAt(source: string, start: number): string {
  const end = source.indexOf("\n}", start);
  return end === -1 ? source.slice(start) : source.slice(start, end);
}

interface ServerAction {
  key: string;
  builtWithPipeline: boolean;
}

function serverActions(): ServerAction[] {
  return sourceFiles(join(ROOT, "src")).flatMap((path) => {
    const source = readFileSync(path, "utf8");
    if (!USE_SERVER.test(source)) return [];

    const file = relative(ROOT, path).split(sep).join("/");
    const pipelineConsts = [...source.matchAll(PIPELINE_CONST)].map(
      (match) => match[1]
    );

    return [...source.matchAll(EXPORTED_ACTION)].map((match) => {
      const name = match[1] ?? match[2] ?? "";
      const declaration = declarationAt(source, match.index);
      return {
        key: `${file}#${name}`,
        builtWithPipeline: pipelineConsts.some((identifier) =>
          new RegExp(`\\b${identifier}\\b`).test(declaration)
        ),
      };
    });
  });
}

describe("Server Actions go through the pipeline (CORE-ARCH-013)", () => {
  const actions = serverActions();

  it("finds the Server Actions it ratchets", () => {
    expect(actions.length).toBeGreaterThan(50);
  });

  it("builds every new Server Action with createProtectedAction or createPublicAction", () => {
    const unlisted = actions
      .filter(
        (action) =>
          !action.builtWithPipeline &&
          !EXEMPT.has(action.key) &&
          !HAND_ROLLED.has(action.key)
      )
      .map((action) => action.key);

    expect(unlisted).toEqual([]);
  });

  it("lists only actions that still exist and are still hand-rolled", () => {
    const handRolled = new Set(
      actions
        .filter((action) => !action.builtWithPipeline)
        .map((action) => action.key)
    );
    const stale = [...EXEMPT, ...HAND_ROLLED].filter(
      (key) => !handRolled.has(key)
    );

    expect(stale).toEqual([]);
  });
});
