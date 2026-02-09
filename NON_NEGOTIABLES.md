# PinPoint Non-Negotiables

This document contains strict rules that must always be followed in the PinPoint codebase to prevent bugs and maintain consistency.

## Privacy: Email Address Visibility

**Rule:** User email addresses must NEVER be displayed outside of admin views and the user's own settings page.

**Why:** Email addresses are PII. Displaying them to non-admin users violates user privacy expectations. Anonymous reporters who provide an email for follow-up do not consent to public display.

**Applies to:**

- Issue timeline events and comments
- Reporter display names (sidebar, cards, lists)
- Notification content
- Seed data and test fixtures
- Any client-serialized data

**Use instead:**

- User's display name (from `userProfiles.name`)
- Invited user's name (from `invitedUsers.name`)
- `reporterName` field (guest-provided name)
- `"Anonymous"` as final fallback

**Examples:**

```typescript
// ✅ Correct - uses name hierarchy with Anonymous fallback
const name =
  issue.reportedByUser?.name ??
  issue.invitedReporter?.name ??
  issue.reporterName ??
  "Anonymous";

// ❌ Wrong - leaks email to non-admin UI
const name = issue.reporterName ?? issue.reporterEmail ?? "Guest";
```

## Network: localhost Domain Standard

**Rule:** Always use `localhost` (not `127.0.0.1`) for local development URLs.

**Why:** Browser cookie isolation - cookies set on `localhost` domain won't be sent to `127.0.0.1`, breaking Supabase SSR auth. This causes Server Actions to see anonymous users even after successful login.

**Applies to:**

- Supabase URLs in config files
- Next.js dev server URLs
- Playwright E2E test baseURL
- Health check scripts
- Any local HTTP endpoints

**Exceptions:**

- CSP rules (can include both for security)
- Validation checks (can detect both patterns)

**Examples:**

```bash
# ✅ Correct
NEXT_PUBLIC_SUPABASE_URL=http://localhost:55321
baseURL = "http://localhost:3100"
curl http://localhost:54321/health

# ❌ Wrong - breaks auth cookies
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321
baseURL = "http://127.0.0.1:3100"
curl http://127.0.0.1:54321/health
```
