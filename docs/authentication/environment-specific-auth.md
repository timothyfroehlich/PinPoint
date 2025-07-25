# Environment-Specific Authentication Strategy

## Overview

PinPoint implements environment-aware authentication that provides different authentication methods and user seeding based on the deployment environment. This approach improves development experience while maintaining security in production.

## Environment Detection

The system uses `VERCEL_ENV` for Vercel deployments and falls back to `NODE_ENV` for local development:

- **Development**: `VERCEL_ENV=development` or `NODE_ENV=development`
- **Preview**: `VERCEL_ENV=preview` (Vercel preview deployments)
- **Production**: `VERCEL_ENV=production`
- **Test**: `NODE_ENV=test` (test environment)

## Authentication Providers by Environment

### Development Environment
- **Google OAuth**: Optional (warnings if not configured)
- **Credentials Provider**: Enabled as "Development Test Users"
- **Test Accounts**: Available with `.local` email domains

### Preview Environment
- **Google OAuth**: Required (errors if not configured)
- **Credentials Provider**: Enabled as "Demo Users"
- **Demo Accounts**: Available for stakeholder testing

### Production Environment
- **Google OAuth**: Required (errors if not configured)
- **Credentials Provider**: Disabled
- **No Test Accounts**: Only real users can authenticate

### Test Environment
- **Google OAuth**: Optional
- **Credentials Provider**: Enabled as "Test Users"
- **Mock Accounts**: For automated testing

## Database Seeding Strategy

### Environment-Specific Seed Files

1. **`prisma/seed.ts`** (Main Router)
   - Detects current environment
   - Executes appropriate environment-specific seed file
   - Provides unified seeding interface

2. **`prisma/seed-development.ts`**
   - Creates test organization "Development Test Organization"
   - Seeds comprehensive test data (users, machines, issues)
   - Includes both `.local` and legacy test accounts
   - Provides full development dataset

3. **`prisma/seed-production.ts`**
   - Creates production organization "Austin Pinball Collective"
   - Seeds minimal production data structure
   - No test accounts - only real user data
   - Optimized for production deployment

### Seeding Commands

```bash
# Environment auto-detection (recommended)
npm run db:seed

# Specific environment seeding
npx tsx prisma/seed-development.ts
npx tsx prisma/seed-production.ts
```

## OAuth Configuration Validation

### Validation Features

- **Environment-aware requirements**: OAuth required in production/preview
- **Configuration checking**: Validates credential format and presence
- **Startup validation**: Fails fast on invalid production configuration
- **Development warnings**: Non-blocking warnings in development

### Validation Functions

```typescript
import { validateGoogleOAuth, assertOAuthConfigValid } from '~/server/auth/validation';

// Manual validation
const result = validateGoogleOAuth();
if (!result.isValid) {
  console.error('OAuth validation failed:', result.errors);
}

// Automatic validation (throws in production)
assertOAuthConfigValid();
```

## Development Test Accounts

### Available Test Users

| Environment | Email Domain | Purpose |
|-------------|--------------|---------|
| Development | `@dev.local` | Primary development accounts |
| Development | `@test.com` | Legacy compatibility accounts |
| Preview | `@testaccount.dev` | Demo/preview accounts |
| Test | Various | Automated testing |

### Test Account Types

- **Admin**: `admin@dev.local` / `admin@test.com`
- **Member**: `member@dev.local` / `member@test.com`
- **Player**: `player@dev.local` / `player@test.com`

## Architecture Components

### Core Files

- **`src/lib/environment.ts`**: Environment detection functions
- **`src/server/auth/providers.ts`**: Authentication provider factory
- **`src/server/auth/validation.ts`**: OAuth configuration validation
- **`src/server/auth/config.ts`**: NextAuth configuration

### Key Functions

```typescript
// Environment detection
import { isDevelopment, isPreview, isProduction } from '~/lib/environment';

// Provider configuration
import { shouldEnableCredentialsProvider, shouldEnableTestLogin } from '~/lib/environment';

// Provider creation
import { createAuthProviders } from '~/server/auth/providers';
```

## Environment Variables

### Required in Production/Preview

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
AUTH_SECRET=your_nextauth_secret
```

### Optional in Development

```env
# OAuth (optional in development)
GOOGLE_CLIENT_ID=optional_dev_client_id
GOOGLE_CLIENT_SECRET=optional_dev_client_secret

# NextAuth
AUTH_SECRET=dev_secret

# Environment override (if needed)
VERCEL_ENV=development
```

## Testing Strategy

### Test Coverage

- **Environment detection**: Validates correct environment identification
- **Provider selection**: Tests provider availability by environment
- **OAuth validation**: Validates configuration requirements
- **Integration tests**: End-to-end authentication flows

### Running Tests

```bash
# All auth tests
npm run test -- auth

# Specific environment tests
npx vitest run src/server/auth/__tests__/auth-environment.vitest.test.ts
```

## Migration from Legacy System

### Changes Made

1. **Environment-aware providers**: Dynamic provider configuration
2. **Validation layer**: OAuth configuration validation
3. **Structured seeding**: Environment-specific seed files
4. **Test isolation**: Clear separation of test and production data

### Backward Compatibility

- Legacy test accounts (`@test.com`) maintained in development
- Existing authentication flows unchanged
- Production security requirements unchanged

## Security Considerations

### Production Security

- **No test accounts**: Credentials provider disabled in production
- **OAuth required**: Google OAuth configuration validated and required
- **Environment isolation**: Clear separation between environments

### Development Security

- **Test account isolation**: Test accounts clearly marked and domain-separated
- **Optional OAuth**: Development doesn't require OAuth configuration
- **Warning system**: Clear warnings for missing optional configurations

## Troubleshooting

### Common Issues

1. **OAuth validation failures**
   - Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` environment variables
   - Ensure variables are set in production/preview environments

2. **Seeding failures**
   - Check database connectivity
   - Verify environment detection is working correctly

3. **Test account access**
   - Ensure you're in development environment
   - Check that credentials provider is enabled

### Debug Commands

```bash
# Check environment detection
node -e "console.log('ENV:', process.env.VERCEL_ENV || process.env.NODE_ENV)"

# Validate OAuth configuration
npm run dev # Check console for OAuth validation messages

# Test database seeding
npm run db:reset && npm run db:seed
```

## Future Enhancements

### Potential Improvements

1. **Additional OAuth providers**: Microsoft, GitHub, etc.
2. **Environment-specific UI**: Different branding per environment
3. **Advanced test data**: More sophisticated test scenarios
4. **Automated validation**: CI/CD environment validation

### Extension Points

- **Provider factory**: Easy to add new authentication providers
- **Validation system**: Extensible configuration validation
- **Seeding system**: Template for additional environment types