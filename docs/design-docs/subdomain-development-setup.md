PinPoint supports multi-tenant subdomain routing with a metadata‑first model:

- Localhost and the canonical apex domain show the marketing/selection experience; no auto‑redirects.
- Each organization may have its own subdomain (e.g., `apc.localhost:3000`, `apc.pinpoint.app`) when the host supports subdomains.
- Custom alias domains (e.g., `pinpoint.austinpinballcollective.org`) are locked to a single organization.

## Local Development Setup

### Option 1: Simple Setup (Recommended)

For local development, visit `http://localhost:3000` for the marketing/selection flow, or use an org subdomain directly (e.g., `http://apc.localhost:3000`) if your browser supports localhost subdomains.

1.  Start the development server:

    ````shell
    npm run dev

        ```

    ````

2.  Visit `http://apc.localhost:3000` in your browser
3.  No automatic redirect from `http://localhost:3000` occurs; choose an org and authenticate.

### Option 2: Hosts File Configuration (If needed)

If your browser doesn't resolve `*.localhost` automatically, you can add entries to your hosts file:

**On macOS/Linux:**

```shell
sudo nano /etc/hosts

```

**On Windows:**

```plain text
# Open as Administrator: C:\\Windows\\System32\\drivers\\etc\\hosts

```

Add these lines:

```plain text
127.0.0.1 apc.localhost
127.0.0.1 localhost

```

### Testing Multiple Organizations

To test with multiple organizations:

1.  Create a new organization in the database:

    ````sql
    INSERT INTO "Organization" (id, name, subdomain)
    VALUES ('test-org-id', 'Test Organization', 'test');

        ```

    ````

2.  Visit `http://test.localhost:3000`

## How It Works

### Middleware

- `middleware.ts` intercepts requests and classifies the host as alias, subdomain‑capable, or non‑subdomain‑capable.
- For alias or recognized subdomain hosts, it sets trusted `x-subdomain` headers (no redirects).
- For apex/localhost/preview, it does not set subdomain headers; the app shows the marketing/selection flow.

### Organization Resolution

- Supabase `app_metadata.organizationId` is canonical for the session.
- On first login (when metadata is absent), a trusted alias/subdomain hint may be used to resolve an org row; the auth callback writes the org ID to metadata after validating membership.
- Subsequent requests rely on metadata. Host hints do not flip orgs once metadata exists.

### Authentication

- User sessions work across hosts; organization context is stored in `app_metadata`.
- Alias domains are locked to their org; marketing is not available on alias hosts.
- **Development**: Database‑backed sessions; `npm run db:reset` clears sessions.
- **Production**: JWT sessions; metadata included for RLS.

## Production Deployment

### DNS Configuration

Set up wildcard DNS for your domain:

```plain text
A *.yourdomain.com → Your server IP
A yourdomain.com → Your server IP

```

### Environment Variables

No special defaults are used for organization selection; there is no `DEFAULT_ORG_SUBDOMAIN` fallback. The middleware and auth flows infer behavior from the host and metadata.

## Troubleshooting

### Browser Not Resolving \..localhost

- Try Chrome or Firefox (better localhost subdomain support)
- Use the hosts file method above
- Or use a service like `localhost.run` for testing

### Organization Not Found Error

- Check that the "apc" organization exists in your database
- Run `npm run db:seed:local:sb` to ensure test data is properly seeded
- Check browser network tab for the actual host being sent

### Redirect Loop

- Redirect loops should not occur; the middleware does not auto‑redirect on apex/localhost/preview.
