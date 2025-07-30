# OAuth Setup Instructions for Phase 1A

## Overview

This document provides step-by-step instructions for configuring Google OAuth for PinPoint's production deployment.

## 1. Google OAuth Production Configuration

### Update Google Cloud Console

1. **Access Google Cloud Console**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to APIs & Services > Credentials

2. **Update OAuth 2.0 Client**:
   - Find your existing OAuth 2.0 client ID for PinPoint
   - Click to edit the client
   - Under "Authorized domains", add: `austinpinballcollective.org`
   - Under "Authorized redirect URIs", add: `https://pinpoint.austinpinballcollective.org/api/auth/callback/google`

### Add Google Credentials to Vercel Production

```bash
# Add to Production environment (if not already present)
vercel env add GOOGLE_CLIENT_ID production
# Paste the Google Client ID when prompted

vercel env add GOOGLE_CLIENT_SECRET production
# Paste the Google Client Secret when prompted
```

## 3. Verification Steps

### Test OAuth Configuration

1. **Check Current Environment Variables**:

   ```bash
   vercel env ls
   ```

   Verify that all environments have:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

2. **Test Development Environment**:

   ```bash
   npm run dev:bg:status
   npm run dev:bg || npm run dev
   ```

   Check console output for OAuth validation messages.

3. **Test Authentication Flows**:
   - Navigate to `/sign-in`
   - Verify Google OAuth button is present
   - Test Google authentication flow in development

## 4. Production Domain Configuration

### Required Callback URLs

Ensure this callback URL is configured in your Google OAuth application:

- **Google OAuth**: `https://pinpoint.austinpinballcollective.org/api/auth/callback/google`

### Domain Authorization

- **Google**: Add `austinpinballcollective.org` to authorized domains

## 5. Troubleshooting

### Common Issues

1. **OAuth validation failures**:
   - Check that environment variables are set in all Vercel environments
   - Verify variable names match exactly: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

2. **Callback URL mismatches**:
   - Ensure callback URLs in Google OAuth app match exactly
   - Check for trailing slashes or protocol mismatches

3. **Domain authorization errors**:
   - Verify `austinpinballcollective.org` is added to Google OAuth authorized domains
   - Check for subdomain vs root domain issues

### Debug Commands

```bash
# Check environment variables
vercel env ls

# Validate OAuth configuration
npm run dev
# Check console output for validation messages

# Test authentication
npm run dev:bg:status
# Navigate to http://localhost:3000/sign-in
```

## 6. Security Notes

- **Client Secrets**: Never commit OAuth secrets to version control
- **Environment Separation**: Use different OAuth apps for development/staging/production if needed
- **Access Control**: Limit OAuth app access to necessary scopes only
- **Rotation**: Plan for regular credential rotation in production

## Next Steps

After completing the Google OAuth configuration:

1. Test Google authentication flow in development
2. Deploy to preview environment and test
3. Deploy to production and verify Google OAuth works end-to-end
4. Update team documentation with OAuth management procedures
