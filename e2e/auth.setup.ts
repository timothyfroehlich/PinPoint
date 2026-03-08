import { test as setup } from "@playwright/test";

import { loginAs } from "./support/actions.js";
import { TEST_USERS } from "./support/constants.js";
import { STORAGE_STATE } from "./support/auth-constants.js";

// One setup test per role — logs in via UI and saves storageState to disk
for (const [role, user] of Object.entries(TEST_USERS)) {
  setup(`authenticate as ${role}`, async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: user.email,
      password: user.password,
    });
    await page.context().storageState({ path: STORAGE_STATE[role] });
  });
}
