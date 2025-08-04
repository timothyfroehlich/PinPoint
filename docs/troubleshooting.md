# PinPoint Troubleshooting Guide

This document contains detailed troubleshooting procedures for development and deployment issues.

## Development Server Issues

### Problem: Server says "Ready" but doesn't respond

**Solutions**:

1. Check for TypeScript compilation errors: `npm run typecheck`
2. Verify health endpoint: `curl http://localhost:3000/api/health`
3. Kill all Node processes: `pkill -f node` then restart
4. Check for port conflicts: `netstat -tlnp | grep :3000`

### Problem: Material-UI TypeScript errors

**Solutions**:

1. Check package.json for version compatibility
2. Verify import statements match current API
3. Consider pinning to known-working version
4. Check Material-UI migration guides

### Problem: Next.js dynamic route errors

**Solutions**:

1. Verify params handling matches Next.js version API
2. Check if params should be Promise (Next.js 15+)
3. Ensure proper async/await usage in components

### Problem: Development environment not responding

**Solutions**:

1. **Check status**: `npm run dev:status` (shows health of all services)
2. **Graceful restart**: `npm run dev:clean` (cleanup + fresh start)
3. **Emergency stop**: `npm run kill:all` (intelligent process cleanup)
4. **Port cleanup**: If needed, manually reboot or kill processes on development ports (49200, 5555)

### Problem: Services starting but not responding

**Solutions**:

1. **Health check**: `npm run health` (detailed service diagnostics)
2. **Fresh environment**: `npm run dev:clean` (complete reset)
3. **Manual verification**: Check individual service logs in colored output

## Database Issues

### Problem: Prisma schema out of sync

**Solutions**:

1. **Quick fix**: Run `npx prisma db push` to sync schema
2. **Complete reset**: Run `npm run db:reset` to wipe everything and start fresh
3. Regenerate client: `npx prisma generate`

### Problem: Database has old/inconsistent data

**Solutions**:

1. **Recommended**: Run `npm run db:reset` for clean slate
2. Manual cleanup: Run `npm run seed` to add fresh data (preserves existing data)

### Problem: Database sessions not clearing

**Solutions**:

1. **Database reset**: `npm run db:reset` (clears all sessions automatically)
2. **Verify strategy**: Check that development uses database session strategy
3. **Manual check**: Verify `Session` table is empty after reset

## Emergency Procedures

### If Development is Completely Broken

1. **Check Git Status**: `git status` to see what changed
2. **Revert Recent Changes**: `git checkout -- .` to discard unstaged changes
3. **Clean Install**: Delete `node_modules` and `package-lock.json`, run `npm install`
4. **Database Reset**: If needed, reset database and run `npm run seed`
5. **Validate Clean State**: Run `npm run validate` and `npm run build`

### If Dependencies Are Broken

1. **Check for Breaking Changes**: Review package changelogs
2. **Pin to Previous Version**: Update package.json to last known working version
3. **Clean Reinstall**: `rm -rf node_modules package-lock.json && npm install`
4. **Document the Issue**: Add notes to CLAUDE.md about problematic versions

### Legacy Manual Procedures (Fallback)

If modern tools fail, these legacy procedures still work:

1. **Manual process kill**: `pkill -f node` then restart
2. **Port checking**: `netstat -tlnp | grep :3000`
3. **Clean install**: Delete `node_modules`, run `npm install`

## Development Environment Architecture

### Selective Restart Logic

**File Change Detection:**

- **Schema changes** (`prisma/schema.prisma`) → Full restart + Prisma regeneration
- **Environment changes** (`.env`) → Full restart with validation
- **Server code changes** (`src/server/`) → Graceful server restart only
- **Frontend changes** (`src/app/`) → No restart (Next.js HMR handles it)
- **Configuration changes** (`*.config.js`) → Full restart

### Process Health Monitoring

**Automatic Health Checks:**

- **HTTP health endpoint** verification (localhost:3000/api/health)
- **Database** connectivity check via direct queries
- **Database** connection verification
- **File watchers** active status monitoring

**Recovery Procedures:**

- **Zombie process detection** and automatic cleanup
- **Port conflict resolution** with automatic retry
- **Graceful restart** on service failure
- **Exponential backoff** for repeated failures

## Session Management

### Database Session Strategy

- **Development environment** uses database sessions for automatic clearing
- **Sessions stored** in database `Session` table, not encrypted JWT tokens
- **Automatic cleanup** when running `npm run db:reset`
- **Fresh login required** after database resets (intentional for testing)

### When Sessions Clear Automatically

1. **Database reset** (`npm run db:reset`) - All sessions cleared
2. **Fresh environment start** (`npm run dev:clean`) - Option to reset database
3. **Schema changes** that trigger database regeneration
4. **Manual session cleanup** via direct database queries (see CLAUDE.md for examples)
