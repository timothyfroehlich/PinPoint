PinPoint now supports multi-tenant subdomain routing! This means:

- `localhost:3000` automatically redirects to `apc.localhost:3000` (Austin Pinball Collective)
- Each organization can have its own subdomain (e.g., `apc.localhost:3000`, `other-org.localhost:3000`)
- In production: `pinpoint.com` → `apc.pinpoint.com`

## Local Development Setup

### Option 1: Simple Setup (Recommended)

The easiest way is to just visit `apc.localhost:3000` directly in your browser. Most modern browsers support this automatically.

1.  Start the development server:

    ````shell
    npm run dev

        ```

    ````

2.  Visit `http://apc.localhost:3000` in your browser
3.  If visiting `http://localhost:3000`, you'll automatically be redirected to `apc.localhost:3000`

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

- `middleware.ts` intercepts all requests
- Extracts subdomain from the host header
- Redirects root domain to `apc` subdomain
- Sets `x-subdomain` header for organization resolution

### Organization Resolution

- tRPC context reads the `x-subdomain` header
- Looks up the organization by subdomain in the database
- Falls back to the organization specified by the `DEFAULT_ORG_SUBDOMAIN` environment variable (which defaults to "apc") if no subdomain is detected
- All subsequent API calls use the correct organization context

### Authentication

- User sessions still work across subdomains
- Organization context is resolved per request
- Users can potentially access multiple organizations (future feature)
- **Development**: Uses database sessions - sessions automatically clear when running `npm run db:reset`
- **Production**: Uses JWT sessions for better performance - sessions persist across server restarts

## Production Deployment

### DNS Configuration

Set up wildcard DNS for your domain:

```plain text
A *.yourdomain.com → Your server IP
A yourdomain.com → Your server IP

```

### Environment Variables

No additional environment variables needed. The middleware automatically detects production vs development mode.

## Troubleshooting

### Browser Not Resolving \..localhost

- Try Chrome or Firefox (better localhost subdomain support)
- Use the hosts file method above
- Or use a service like `localhost.run` for testing

### Organization Not Found Error

- Check that the "apc" organization exists in your database
- Run `npm run seed` to ensure test data is properly seeded
- Check browser network tab for the actual host being sent

### Redirect Loop

- Clear browser cache and cookies
- Check that middleware is not conflicting with any reverse proxy setup
- Ensure NEXT_PUBLIC_VERCEL_URL is not set in development
