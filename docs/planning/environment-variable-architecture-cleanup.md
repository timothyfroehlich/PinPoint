# **Environment Variable Architecture Cleanup \- Implementation Plan**

Date: 2025-08-03  
Status: Planning Phase (Revised)  
Priority: Highest

### **Executive Summary**

This plan addresses critical failures in the CI pipeline and a complex, resource-intensive local development setup. It outlines a phased approach to:

1. **Simplify Local Development**: Replace the multi-port/multi-instance Supabase setup with a single, shared local instance to improve stability and developer experience.
2. **Fix CI/CD**: Correctly implement environment variable handling in GitHub Actions to resolve test failures.
3. **Secure Secrets**: Remove all secrets from version control and establish a clear, secure file structure.
4. **Standardize Environments**: Implement a robust four-tier environment strategy (Dev, Test, Preview, Prod) with explicit controls for conditional features.

## **1\. Problem Statement**

### **Core Issues**

1. **CI Pipeline Blocked**: GitHub Actions workflows are failing due to "Invalid environment variables," preventing automated testing and merges.
2. **Complex Local Setup**: The current multi-port system for local Supabase instances is resource-heavy, confusing for developers, and requires complex, brittle scripting.
3. **Insecure Secret Management**: Production secrets are present in multiple, un-ignored .env files, posing a significant security risk.
4. **Lack of Clear Strategy**: There is no documented strategy for managing variables across environments, leading to confusion and errors.

### **Project Context**

- **Cost Constraint**: A single cloud Supabase database will be shared by preview and production environments.
- **Desired Workflow**: A standard Development → Preview → Production pipeline.
- **Conditional Features**: "Dev features" (e.g., quick login) must be enabled in dev/preview but disabled in production.

## **2\. The New Architecture: A Four-Tier Strategy**

This strategy provides clear separation of concerns while respecting project constraints.

| Environment     | Database                         | Dev Features | Source of Env Vars     | Use Case                       |
| :-------------- | :------------------------------- | :----------- | :--------------------- | :----------------------------- |
| **Development** | **Single Shared** Local Supabase | ✅ Enabled   | .env.development       | Local coding with npm run dev  |
| **CI / Test**   | Ephemeral PostgreSQL Container   | ❌ Disabled  | GitHub Actions Secrets | Automated tests in CI          |
| **Preview**     | Cloud Supabase (Shared)          | ✅ Enabled   | Vercel Preview Vars    | Staging, PR reviews, manual QA |
| **Production**  | Cloud Supabase (Shared)          | ❌ Disabled  | Vercel Production Vars | Live user-facing application   |

## **3\. Implementation Plan**

### **Phase 0: Simplify Local Development Workflow (Highest Priority)**

**Goal**: Eliminate the multi-port complexity by moving to a single, shared local Supabase instance.

1. **Update Supabase Config (supabase/config.toml)**: Remove all worktree-specific, hash-based port calculations. Revert to the standard Supabase ports (54321 for the API, 54322 for the database, etc.).
2. **Simplify Setup Scripts (scripts/setup-worktree.sh)**:
   - Remove all logic for MD5 hashing, port offsets, and custom config.toml generation.
   - The script should now simply ensure the standard configuration is in place.
3. **Simplify Cleanup Scripts (scripts/worktree-cleanup.sh, scripts/worktree-status.sh)**: Remove all logic related to discovering and managing custom ports or reading .worktree-ports files.
4. **Add Developer Coordination Guide**: Add a prominent warning to the project's main developer guide (README.md or a CONTRIBUTING.md) explaining the new shared database model and the need for manual coordination on schema changes.

### **Phase 1: Secure and Standardize Environment Files (High Priority)**

**Goal**: Establish a secure, logical, and easy-to-understand file structure for environment variables.

1. **Delete Insecure and Redundant Files**:
   - rm .env
   - rm .env.new
   - rm .env.development.local
2. **Create .env (Committed)**: This file will contain only non-sensitive, shared defaults that are safe for version control.  
   \# Safe defaults that apply to ALL environments  
   PORT="3000"  
   IMAGE_STORAGE_PROVIDER="local"  
   OPDB_API_URL="https://opdb.org/api"

3. **Create .env.development (Committed)**: This file contains overrides for local development, pointing to the now-standard local Supabase ports.  
   \# Overrides for local development using the single shared Supabase instance.  
   DATABASE_URL="postgresql://postgres:postgres@localhost:54322/postgres"  
   NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"  
   NEXT_PUBLIC_SUPABASE_ANON_KEY="\<your-local-anon-key\>"  
   ENABLE_DEV_FEATURES="true"

4. **Update .env.example**: Ensure this template is up-to-date and clearly instructs developers on what secrets they need to create in their personal, git-ignored .env.local file.

### **Phase 2: Fix GitHub Actions Workflow (High Priority)**

**Goal**: Get the CI pipeline passing by implementing correct environment variable and database handling.

1. **Update CI Workflow (.github/workflows/ci.yml)**:
   - Remove all dotenv workarounds.
   - Add a PostgreSQL service container to create an ephemeral database for each test run.
   - Use vercel env pull to fetch preview variables.
   - **Crucially, override the DATABASE_URL** after pulling from Vercel to ensure tests connect to the ephemeral container, not the cloud database.

jobs:  
 test:  
 runs-on: ubuntu-latest  
 services:  
 postgres:  
 image: postgres:16  
 env:  
 POSTGRES_USER: test_user  
 POSTGRES_PASSWORD: test_password  
 POSTGRES_DB: test_db  
 ports: \['5432:5432'\]  
 options: \>-  
 \--health-cmd pg_isready \--health-interval 10s \--health-timeout 5s \--health-retries 5

    steps:
      \# ... checkout, setup, install ...

      \- name: Pull Vercel Preview Environment Variables
        run: vercel env pull .env.local \--environment=preview \--token=${{ secrets.VERCEL\_TOKEN }}
        env:
          VERCEL\_ORG\_ID: ${{ secrets.VERCEL\_ORG\_ID }}
          VERCEL\_PROJECT\_ID: ${{ secrets.VERCEL\_PROJECT\_ID }}

      \- name: Run E2E Tests on Ephemeral DB
        env:
          DATABASE\_URL: "postgresql://test\_user:test\_password@localhost:5432/test\_db"
        run: npm run test:e2e

### **Phase 3: Implement Dev Features Toggle & Vercel Config (Medium Priority)**

**Goal**: Create an explicit, secure toggle for conditional features.

1. **Update src/env.mjs**: Add ENABLE_DEV_FEATURES to the Zod schema.  
   // server schema  
   ENABLE_DEV_FEATURES: z.string().transform(s \=\> s \=== 'true').default('false'),  
   // runtimeEnv  
   ENABLE_DEV_FEATURES: process.env.ENABLE_DEV_FEATURES,

2. **Refactor shouldEnableDevFeatures()**: Update the helper function to be the single source of truth, reading directly from the validated env object.  
   import { env } from "\~/env.mjs";  
   export function shouldEnableDevFeatures(): boolean {  
    return env.ENABLE_DEV_FEATURES;  
   }

3. **Configure Vercel Dashboard**:
   - In **Preview** settings, add ENABLE_DEV_FEATURES with a value of true.
   - In **Production** settings, add ENABLE_DEV_FEATURES with a value of false.

## **4\. Expected Outcomes & Validation**

- **Local Dev**: npm run dev works out-of-the-box, connecting to the shared local Supabase on standard ports, with dev features enabled.
- **CI/CD**: GitHub Actions workflows pass reliably, with tests running against a clean, isolated database on every run.
- **Vercel Deployments**:
  - Preview deployments connect to the cloud database with dev features enabled.
  - Production deployments connect to the cloud database with dev features disabled.
- **Security**: No secrets are in version control. The developer workflow is secure by default.
- **Maintainability**: The entire environment setup is simplified, documented, and follows industry best practices.
