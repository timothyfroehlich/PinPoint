#!/usr/bin/env node
/**
 * Normalization script for Wave 0 Lane A inventories.
 * Reads raw baseline JSON inventories and emits spec-compliant normalized versions
 * into docs/baseline/normalized/*.normalized.json
 */
const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'docs', 'baseline');
const outDir = path.join(root, 'normalized');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(root, `${name}.json`), 'utf8'));
}

function write(name, data) {
  const file = path.join(outDir, name);
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  return file;
}

const timestamp = new Date().toISOString();

// 1. Auth Functions
const authRaw = load('auth-functions');
const authNormalized = {
  inventoryDate: authRaw.inventoryDate || timestamp.substring(0,10),
  totalFunctions: authRaw.functions.length,
  patterns: authRaw.patterns,
  functions: authRaw.functions.map(f => ({
    name: f.name,
    location: f.location,
    pattern: f.pattern,
    usageCount: f.usageCount ?? 0,
    description: f.description || ''
  })),
  highUsageFunctions: (authRaw.highUsageFunctions || []).map(h => ({ name: h.name, usageCount: h.usageCount })),
  duplicateNames: authRaw.duplicateNames || []
};
write('auth-functions.normalized.json', authNormalized);

// 2. Server Fetchers (exclude auth resolver & legacy wrappers from fetchers classification)
const fetcherRaw = load('server-fetchers');
const exclude = new Set(['getRequestAuthContext','requireOrganizationContext','requireMemberAccess']);
const fetchersFiltered = fetcherRaw.fetchers.filter(f => !exclude.has(f.name));
const uncached = fetchersFiltered.filter(f => !f.isCached);
const fetchersNormalized = {
  inventoryDate: fetcherRaw.inventoryDate || timestamp.substring(0,10),
  totalFetchers: fetchersFiltered.length,
  cacheWrapped: fetchersFiltered.filter(f => f.isCached).length,
  uncachedFetchers: uncached.map(f => f.name),
  fetchers: fetchersFiltered.map(f => ({
    name: f.name,
    location: f.location,
    isCached: !!f.isCached,
    returnType: f.returnType || null,
    usesAuth: !!f.usesAuth,
    authPattern: f.authPattern || null
  })),
  patterns: fetcherRaw.patterns
};
write('server-fetchers.normalized.json', fetchersNormalized);

// 3. Role Conditionals
const roleRaw = load('role-conditionals');
const roleNormalized = {
  inventoryDate: roleRaw.inventoryDate || timestamp.substring(0,10),
  totalConditionals: roleRaw.conditionals.length,
  conditionals: roleRaw.conditionals.map(c => ({
    location: c.location,
    condition: c.condition,
    context: c.context,
    function: c.function,
    lineNumber: c.lineNumber
  })),
  roleChecks: roleRaw.roleChecks,
  patterns: roleRaw.patterns
};
write('role-conditionals.normalized.json', roleNormalized);

// 4. Org Scoped Functions
const orgRaw = load('org-scoped-functions');
const orgNormalized = {
  inventoryDate: orgRaw.inventoryDate || timestamp.substring(0,10),
  totalFunctions: orgRaw.functions.length,
  scopingPatterns: orgRaw.scopingPatterns,
  functions: orgRaw.functions.map(fn => ({
    name: fn.name,
    location: fn.location,
    scopingMethod: fn.scopingMethod,
    requiresOrgId: fn.requiresOrgId,
    usesRLS: fn.usesRLS
  })),
  violations: orgRaw.violations || []
};
write('org-scoped-functions.normalized.json', orgNormalized);

// 5. Metrics baseline passthrough (rename for consistency)
let metricsFileWritten = null;
try {
  const metricsRaw = load('metrics-initial');
  metricsFileWritten = write('metrics-initial.normalized.json', metricsRaw);
} catch (_) {
  // ignore if missing
}

// Summary report
const summary = {
  generatedAt: timestamp,
  outputs: [
    'auth-functions.normalized.json',
    'server-fetchers.normalized.json',
    'role-conditionals.normalized.json',
    'org-scoped-functions.normalized.json'
  ].concat(metricsFileWritten ? ['metrics-initial.normalized.json'] : []),
  fetcherExclusions: Array.from(exclude)
};
write('NORMALIZATION_SUMMARY.json', summary);

console.log('[Lane A] Normalization complete:', summary);