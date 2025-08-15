# Phase 7: Dependency & Configuration Cleanup

**Timeline**: 1 day  
**Impact**: Low - Build system and deployment  
**Approach**: Systematic removal of Prisma packages, configs, and build scripts  

## 🎯 Overview

Remove all Prisma-related dependencies, configuration files, build scripts, and environment variables. This final cleanup eliminates the last traces of Prisma from the project.

**Why Phase 7**: Complete removal of unused dependencies reduces build time, bundle size, security surface area, and eliminates confusion for future developers.

## 📋 Tasks

### **Priority 1: Package Dependencies**

- [ ] **Remove `@prisma/client` from `package.json`**
  - Current: Listed in dependencies for database access
  - Target: Removed completely
  - Action: `npm uninstall @prisma/client`

- [ ] **Remove `prisma` from `package.json` devDependencies**  
  - Current: Listed in devDependencies for schema management
  - Target: Removed completely
  - Action: `npm uninstall prisma`

- [ ] **Remove any Prisma-related packages**
  - Search: Check for additional Prisma packages (prisma-extensions, etc.)
  - Target: Remove all Prisma ecosystem packages
  - Action: Clean uninstall of discovered packages

### **Priority 2: Configuration Files & Directories**

- [ ] **Remove `prisma/` directory and all contents**
  - Current: Contains schema files and migration history
  - Target: Directory completely removed
  - Action: `rm -rf prisma/` (after backup if desired)

- [ ] **Remove `prisma/schema.prisma`**
  - Current: Main Prisma schema definition
  - Target: File removed (included in directory removal)
  - Action: Included in directory cleanup

- [ ] **Remove `prisma/schema.prisma.backup`**
  - Current: Backup copy of schema
  - Target: File removed (included in directory removal)  
  - Action: Included in directory cleanup

### **Priority 3: Build Scripts & Commands**

- [ ] **Remove Prisma scripts from `package.json`**
  - Current: May include `prisma generate`, `prisma migrate`, etc.
  - Target: All Prisma scripts removed
  - Actions: Remove from scripts section

- [ ] **Update build pipeline scripts**
  - Current: Build scripts may include `prisma generate`
  - Target: Build scripts with Drizzle-only commands
  - Focus: CI/CD pipeline, development scripts

- [ ] **Review and update script files in `scripts/` directory**
  - Current: May contain Prisma-related utility scripts
  - Target: Remove or update scripts to Drizzle-only
  - Focus: Database utilities, seed scripts, development helpers

### **Priority 4: Environment Variables**

- [ ] **Review and update `.env` files**
  - Current: May have `DATABASE_URL` used by Prisma
  - Target: Single `DATABASE_URL` used by Drizzle  
  - Action: Consolidate database URL usage

- [ ] **Update `.env.example` or similar**
  - Current: May show Prisma-specific environment variables
  - Target: Show Drizzle-only environment variables
  - Action: Update example configurations

- [ ] **Remove Prisma-specific environment variables**
  - Search: `PRISMA_DATABASE_URL`, `PRISMA_*` variables
  - Target: Remove unused environment variables
  - Action: Clean up environment configuration

### **Priority 5: Configuration Files**

- [ ] **Update `.gitignore`**
  - Current: May contain Prisma-specific ignore patterns
  - Target: Remove Prisma patterns, ensure Drizzle patterns present
  - Focus: Generated files, database files, cache directories

- [ ] **Review `next.config.mjs`**  
  - Current: May contain Prisma-related webpack or build configuration
  - Target: Remove Prisma configuration
  - Action: Clean up build configuration

- [ ] **Update `tooling.config.ts` or similar tooling configurations**
  - Current: May reference Prisma in tooling setup
  - Target: Remove Prisma references
  - Action: Update tooling configuration

### **Priority 6: Docker & Deployment Configuration**

- [ ] **Update `docker-compose.yml` or deployment configs**
  - Current: May contain Prisma migration or setup commands
  - Target: Drizzle-only deployment configuration
  - Action: Update container setup and initialization

- [ ] **Review deployment scripts and CI configuration**
  - Current: CI may run Prisma commands
  - Target: CI runs Drizzle commands only
  - Focus: GitHub Actions, deployment pipelines

## 🔧 Cleanup Strategy

### **Step-by-Step Removal Process**

**1. Package Cleanup**
```bash
# Remove packages safely
npm uninstall @prisma/client prisma
npm audit fix
npm install  # Ensure lockfile is updated
```

**2. File System Cleanup**
```bash
# Remove Prisma directory (backup first if desired)
cp -r prisma/ ../prisma-backup/  # Optional backup
rm -rf prisma/
```

**3. Configuration Cleanup**
```bash
# Search for Prisma references in configs
grep -r "prisma" --include="*.json" --include="*.js" --include="*.ts" .
grep -r "PRISMA" --include="*.env*" .
```

**4. Script Updates**
- Review `package.json` scripts section
- Update build and development scripts
- Remove or update utility scripts

### **Safe Removal Checklist**

**Before Removing Each Item:**
- [ ] Confirm item is no longer referenced in codebase
- [ ] Verify no dependencies require the item
- [ ] Check that removal won't break build process
- [ ] Consider creating backup if historical value exists

## 🚨 Critical Safety Checks

### **Before Final Cleanup:**

- [ ] **Full codebase search for Prisma references**
  ```bash
  # Comprehensive search
  grep -r "prisma" --exclude-dir=node_modules .
  grep -r "@prisma" --exclude-dir=node_modules .
  grep -r "Prisma" --exclude-dir=node_modules .
  ```

- [ ] **Verify all tests pass** - Run full test suite before cleanup
- [ ] **Check build succeeds** - Ensure TypeScript compilation works  
- [ ] **Test development environment** - Verify dev server starts properly

### **Environmental Dependencies Check:**

- [ ] **Database connectivity** - Ensure Drizzle can connect properly
- [ ] **Environment variable validation** - Verify all required vars present
- [ ] **Build process validation** - Ensure build completes successfully
- [ ] **Deployment readiness** - Check deployment configuration works

## 🔍 File Categories for Review

### **Configuration Files to Check:**

- `package.json` - Dependencies and scripts
- `package-lock.json` - Dependency lockfile  
- `.env*` files - Environment variables
- `.gitignore` - Ignore patterns
- `next.config.mjs` - Next.js configuration
- `tooling.config.*` - Tool configurations
- `docker-compose.yml` - Container setup
- `tsconfig.json` - TypeScript paths/references

### **Script Files to Review:**

- `scripts/` directory - Utility and setup scripts
- GitHub Actions in `.github/workflows/` - CI/CD pipelines
- Build and deployment scripts
- Database migration or seed scripts

### **Documentation Files to Update:**

- Setup and installation instructions
- Development environment guides  
- Deployment guides
- API documentation referencing database setup

## 🚦 Validation Process

### **After Each Cleanup Step:**

1. **Dependency Check** - `npm ls` to verify clean dependency tree
2. **Build Validation** - `npm run build` to ensure build works
3. **Test Execution** - `npm test` to verify functionality  
4. **Development Server** - `npm run dev` to check dev environment
5. **TypeScript Compilation** - `npm run typecheck` for type safety

### **Phase 7 Completion Criteria:**

- [ ] Zero Prisma packages in package.json
- [ ] No prisma/ directory or schema files
- [ ] No Prisma build scripts or commands
- [ ] Clean environment variable configuration
- [ ] Updated .gitignore and configuration files
- [ ] Build process works without Prisma
- [ ] Development environment stable
- [ ] Test suite passes completely

## 📊 Risk Assessment

### **Low Risk (Most Cleanup Items):**

**Package Removal** - Standard npm operations
**Configuration Updates** - Well-understood file formats
**Script Cleanup** - Clear ownership and dependencies

### **Medium Risk Areas:**

**Environment Variable Changes** - Could affect runtime behavior
**Build Script Updates** - Could break CI/CD pipelines  
**Docker Configuration** - Could affect deployment

### **Mitigation Strategies:**

- **Incremental changes** - One category at a time
- **Validation after each step** - Ensure system still works
- **Backup strategy** - Keep git history for rollback
- **Testing emphasis** - Run full validation between changes

## 🎯 Success Metrics

**Dependency Metrics:**
- Zero Prisma packages in dependency tree
- Reduced total package count
- No security vulnerabilities from unused packages
- Clean npm audit results

**Configuration Metrics:**
- No Prisma references in configuration files
- Simplified build process  
- Clean environment variable setup
- Updated ignore patterns

**Operational Metrics:**
- Build process completes successfully
- Development environment starts properly
- Test suite passes completely
- Deployment configuration works

---

**Next Phase**: Phase 8 (Final Validation) - Comprehensive testing and validation

**Dependencies**: Phases 1-6 completion required (all code must be Drizzle-only)
**Blockers**: None identified
**Estimated Completion**: 1 day of systematic cleanup

**Critical**: This phase should only be executed after confirming that all code references to Prisma have been removed in previous phases.