# URL Construction Pattern

**Goal**: Ensure consistent site URL resolution across environments (Dev, Preview, Prod).

## The `getSiteUrl()` Helper

Always use `getSiteUrl()` from `~/lib/url` instead of manually checking `process.env`.

### Why?

- Handles fallback to `localhost` in development.
- Prioritizes `NEXT_PUBLIC_SITE_URL` for production/preview.
- Centralizes logic to avoid inconsistencies.

### Usage

```typescript
import { getSiteUrl } from "~/lib/url";

// Good
const url = `${getSiteUrl()}/some-path`;

// Bad
const port = process.env.PORT || 3000;
const url = `http://localhost:${port}/some-path`;
```
