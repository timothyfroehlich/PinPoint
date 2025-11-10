/**
 * Tests for custom ESLint rules
 * Lane B: ESLint enforcement rule validation
 */

import { RuleTester } from "@typescript-eslint/rule-tester";
import noDuplicateAuthResolution from "../no-duplicate-auth-resolution.js";
import noMissingCacheWrapper from "../no-missing-cache-wrapper.js";
import noDirectSupabaseClient from "../no-direct-supabase-client.js";

// Set up test framework functions for RuleTester
RuleTester.afterAll = () => {
  // Cleanup after tests
};
RuleTester.describe = (name, fn) => {
  console.log(`\n📋 Testing: ${name}`);
  fn();
};
RuleTester.it = (name, fn) => {
  console.log(`  🧪 ${name}`);
  fn();
};

const ruleTester = new RuleTester({
  languageOptions: {
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

// Test no-duplicate-auth-resolution rule
ruleTester.run("no-duplicate-auth-resolution", noDuplicateAuthResolution, {
  valid: [
    // Single auth call is fine
    `export async function validAction() {
      const ctx = await requireMemberAccess();
      return ctx.user.id;
    }`,

    // Different functions with single auth calls are fine
    `export async function action1() {
      const ctx = await requireMemberAccess();
      return ctx;
    }
    export async function action2() {
      const ctx = await getOrganizationContext();
      return ctx;
    }`,

    // Using stored auth result is fine
    `export async function validAction() {
      const ctx = await requireMemberAccess();
      const user = ctx.user;
      const org = ctx.organization;
      return { user, org };
    }`,
  ],

  invalid: [
    {
      code: `export async function duplicateAuth() {
        const ctx1 = await requireMemberAccess();
        const ctx2 = await getOrganizationContext();
        return { ctx1, ctx2 };
      }`,
      errors: [
        {
          messageId: "duplicateAuthResolution",
          data: {
            functionName: "duplicateAuth",
            authCalls: "requireMemberAccess, getOrganizationContext",
          },
        },
      ],
    },

    {
      code: `export async function sameFunctionTwice() {
        const ctx1 = await requireMemberAccess();
        const ctx2 = await requireMemberAccess();
        return ctx2;
      }`,
      errors: [
        {
          messageId: "duplicateAuthResolution",
        },
      ],
    },
  ],
});

// Test no-missing-cache-wrapper rule
ruleTester.run("no-missing-cache-wrapper", noMissingCacheWrapper, {
  valid: [
    // Cached function is fine
    `import { cache } from 'react';
    export const getUserById = cache(async (id) => {
      return await db.query.users.findFirst({ where: eq(users.id, id) });
    });`,

    // Non-async functions don't need cache
    `export function syncFunction() {
      return 'sync';
    }`,

    // Test files are allowed
    {
      code: `export async function testHelper() { return 'test'; }`,
      filename: "/path/to/test.test.ts",
    },
  ],

  invalid: [
    {
      code: `export async function getUserById(id) {
        return await db.query.users.findFirst({ where: eq(users.id, id) });
      }`,
      filename: "/src/lib/dal/users.ts",
      errors: [
        {
          messageId: "missingCacheWrapper",
          data: { functionName: "getUserById" },
        },
      ],
    },

    {
      code: `export const fetchData = async (id) => {
        return await db.select().from(table);
      };`,
      filename: "/src/lib/actions/data.ts",
      errors: [
        {
          messageId: "missingCacheWrapper",
          data: { functionName: "fetchData" },
        },
      ],
    },
  ],
});

// Test no-direct-supabase-client rule
ruleTester.run("no-direct-supabase-client", noDirectSupabaseClient, {
  valid: [
    // Using approved wrapper is fine
    `import { createClient } from '~/lib/supabase/server';
    const supabase = createClient();`,

    // Other imports are fine
    `import { something } from '@supabase/supabase-js';`,

    // Allowed files can import directly
    {
      code: `import { createClient } from '@supabase/supabase-js';`,
      filename: "/src/lib/supabase/server.ts",
    },
  ],

  invalid: [
    {
      code: `import { createClient } from '@supabase/supabase-js';
      const supabase = createClient(url, key);`,
      filename: "/src/app/api/test/route.ts",
      errors: [
        {
          messageId: "directSupabaseImport",
          data: {
            message:
              "Use createClient from ~/lib/supabase/server for SSR-compatible client per CORE-SSR-001",
          },
        },
      ],
    },

    {
      code: `import something from '@supabase/auth-helpers-nextjs';`,
      filename: "/src/components/AuthButton.tsx",
      errors: [
        {
          messageId: "directSupabaseImport",
          data: {
            message:
              "auth-helpers-nextjs is deprecated. Use ~/lib/supabase/server createClient() wrapper instead",
          },
        },
      ],
    },
  ],
});

console.log("✅ All ESLint rule tests passed!");
