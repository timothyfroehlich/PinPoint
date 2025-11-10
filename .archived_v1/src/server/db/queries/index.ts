/**
 * @fileoverview Barrel export file for database queries.
 * This file centralizes all database query definitions and establishes a clear convention
 * for database interactions: **all queries must use snake_case for field names**.
 *
 * ## The Convention: snake_case in, camelCase out
 *
 * 1.  **Database Interaction (`snake_case`):**
 *     All Drizzle queries (`db.select()`, `db.insert()`, `db.update()`, etc.) and the
 *     objects passed to them (`select`, `where`, `set` clauses) MUST use `snake_case`
 *     field names that directly correspond to the database schema columns.
 *     - **Correct:** `eq(users.profile_picture, url)`
 *     - **Correct:** `select({ organization_id: organizations.id })`
 *     - **Incorrect:** `eq(users.profilePicture, url)`

 * 2.  **API Boundary (`camelCase`):**
 *     Data returned from the server to the client should have `camelCase` field names.
 *     This transformation MUST happen at the API boundary (e.g., in tRPC resolvers)
 *     using the provided case transformation utilities.
 *     - **Correct:** `return transformKeysToCamelCase(dbResult);`
 *
 * ## Reference & Validation
 * - **Reference Implementations:** See the exported `auditQueries` for clear examples of
 *   correctly structured queries.
 * - **Case Transformation:** Use utilities from `src/lib/utils/case-transformers.ts`.
 * - **Validation:** A validation helper is available at `src/server/services/validation-helper.ts`
 *   to enforce these conventions during development.
 */

import * as auditQueries from "./audit-queries";
import { membershipWithUserAndRoleSelect } from "./membership";

export {
  /**
   * A collection of reference queries demonstrating correct snake_case field access.
   * Use these as a template for writing new queries.
   */
  auditQueries,
  /**
   * A standard select object for retrieving membership details with user and role.
   * Returns snake_case fields.
   */
  membershipWithUserAndRoleSelect,
};
