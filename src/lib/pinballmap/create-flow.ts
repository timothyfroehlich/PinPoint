/**
 * The query parameter the New Machine page's create action adds to the Manage
 * tab URL when "Add to Pinball Map after creating" did not go through
 * (pinballmap 4.11). The machine exists either way; the Manage tab reads this
 * to say the add failed, beside the out-of-sync state that shows it.
 *
 * Lives outside the `"use server"` actions file, which may export only async
 * functions.
 */
export const PBM_ADD_FAILED_PARAM = "pbmAddFailed";
