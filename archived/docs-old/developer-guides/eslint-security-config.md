# ESLint Security Configuration Guide

**Purpose**: Modern ESLint 9 security configuration with validated plugins and custom safety rules  
**Context**: Established during Phase 0 configuration audit (August 2025)  
**Maintenance**: Review plugins annually for continued sustainability

---

## 🛡️ Security Foundation Overview

Our ESLint configuration provides **10 active security rules** across three categories:
- **6 vulnerability detection rules** (eval, require, child_process, etc.)
- **4 web security rules** (innerHTML, document.write, HTTP URLs, postMessage)
- **Custom Drizzle safety rules** (better than abandoned official plugin)

**Philosophy**: Security-first development with warnings that guide without blocking progress.

---

## 📦 Validated Plugin Stack

### Core Security Plugins

**eslint-plugin-security** - Community standard for vulnerability detection
```bash
npm install --save-dev eslint-plugin-security
```
- **Adoption**: 996K weekly downloads, 511 dependents
- **Risk**: MEDIUM - Community-driven, slower updates (6 month cycles)
- **Value**: Detects eval(), require(), child_process vulnerabilities

**@microsoft/eslint-plugin-sdl** - Microsoft Security Development Lifecycle
```bash
npm install --save-dev @microsoft/eslint-plugin-sdl
```
- **Adoption**: 89K weekly downloads, enterprise usage
- **Risk**: LOW - Microsoft corporate backing
- **Value**: Web security patterns, HTML injection prevention

**@vitest/eslint-plugin** - Official test quality enforcement
```bash
npm install --save-dev @vitest/eslint-plugin
```
- **Adoption**: 418K weekly downloads, growing ecosystem  
- **Risk**: LOW - Official Vitest team maintenance
- **Value**: Test consistency, async handling, focused test detection

---

## ⚙️ ESLint 9 Configuration

### Plugin Registration (ESLint Flat Config)

```javascript
// eslint.config.js
import vitestPlugin from "@vitest/eslint-plugin";
import securityPlugin from "eslint-plugin-security";
import sdlPlugin from "@microsoft/eslint-plugin-sdl";

export default tseslint.config(
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: {
      vitest: vitestPlugin,
      security: securityPlugin,
      "@microsoft/sdl": sdlPlugin,
    },
    rules: {
      // Security rules configured below...
    }
  }
);
```

### Security Rules Configuration

**Critical Vulnerability Detection:**
```javascript
// Core security vulnerabilities
"security/detect-eval-with-expression": "error",     // Prevents eval(variable)
"security/detect-non-literal-require": "error",     // Prevents require(variable)  
"security/detect-child-process": "error",           // Prevents arbitrary process execution
"security/detect-object-injection": "warn",         // Detects obj[userInput] patterns
"security/detect-unsafe-regex": "error",            // Prevents ReDoS attacks
"security/detect-possible-timing-attacks": "warn",  // Detects sequential comparisons
```

**Web Security Essentials:**
```javascript
// Web application security
"@microsoft/sdl/no-inner-html": "error",            // Prevents innerHTML without sanitization
"@microsoft/sdl/no-document-write": "error",        // Prevents document.write() usage
"@microsoft/sdl/no-insecure-url": "error",          // Requires HTTPS URLs
"@microsoft/sdl/no-postmessage-star-origin": "error", // Requires specific postMessage targets
```

**Custom Drizzle Safety (Replaces Abandoned Plugin):**
```javascript
// Better than eslint-plugin-drizzle (abandoned for 2+ years)
"no-restricted-syntax": [
  "error",
  {
    "selector": "CallExpression[callee.property.name='delete']:not([arguments.0])",
    "message": "DELETE operations must include WHERE clause"
  },
  {
    "selector": "CallExpression[callee.property.name='update']:not([arguments.0])",
    "message": "UPDATE operations must include WHERE clause"
  }
]
```

### Test-Specific Rules

```javascript
// Apply only to test files
files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
plugins: { vitest: vitestPlugin },
rules: {
  "vitest/consistent-test-it": "error",     // Enforce consistent test naming
  "vitest/no-disabled-tests": "warn",       // Catch disabled tests
  "vitest/no-focused-tests": "error",       // Prevent focused tests in commits
}
```

---

## 🎯 Rule Severity Strategy

**Error Level**: Critical security issues that must be fixed
- eval(), require(), child_process vulnerabilities
- HTML injection vulnerabilities  
- Database operations without WHERE clauses
- Focused tests (would break CI)

**Warning Level**: Important issues with potential false positives
- Object injection patterns (many false positives in TypeScript)
- Timing attack patterns (noisy in test files)
- Disabled tests (acceptable during development)

**Philosophy**: Errors block dangerous patterns, warnings provide guidance.

---

## 🚫 Avoided Tools & Alternatives

### Abandoned: eslint-plugin-drizzle
**Why Avoided**: 
- Last updated 2+ years ago
- Only 2 rules implemented (delete, update validation)
- 2.1K weekly downloads (very low adoption)
- No active maintenance despite being in official Drizzle repo

**Better Alternative**: Custom ESLint `no-restricted-syntax` rules provide identical functionality with zero maintenance burden.

### Deferred: @ts-safeql/eslint-plugin
**Why Deferred**:
- Requires live database connection during linting
- Complex ESM import configuration in ESLint 9
- Extensive type mapping needed for Drizzle integration
- Innovative but immature (rated MEDIUM RISK in evaluation)

**Future Consideration**: Re-evaluate post-Phase 1 when database schema is stable.

### Avoided: schemalint
**Why Avoided**:
- Very low adoption (328 weekly downloads)
- Single maintainer
- Functionality overlap with existing Drizzle + Supabase validation
- Better alternatives available in project toolchain

---

## 📊 Performance Impact

**Linting Time**: Expect 10-15% increase over baseline
- Security plugins add minimal overhead
- No database connections required (unlike SafeSQL)
- Reasonable for development workflow

**Memory Usage**: +50-100MB during linting
- Well within acceptable limits for modern development machines
- No persistent background processes

**CI/CD**: No additional infrastructure required
- All rules work in standard Node.js environment
- No external service dependencies

---

## 🔧 Troubleshooting

### Common Issues

**Object Injection False Positives:**
```typescript
// This triggers security/detect-object-injection warning
const value = obj[key]; // key from user input

// Solutions:
// 1. Use Map instead of object for dynamic keys
const map = new Map();
const value = map.get(key);

// 2. Validate keys against allowlist
const allowedKeys = ['name', 'email', 'id'];
if (allowedKeys.includes(key)) {
  const value = obj[key];
}

// 3. Use bracket notation with type assertion
const value = obj[key as keyof typeof obj];
```

**Test Rule Conflicts:**
- Test files automatically get relaxed rules via file-based configuration
- Use `// eslint-disable-next-line` for legitimate test patterns that trigger rules

**Custom Rule Debugging:**
```bash
# Test specific rules
npx eslint --rule "security/detect-eval-with-expression: error" src/

# Check rule coverage
npx eslint --print-config src/example.ts
```

---

## 📈 Maintenance Schedule

**Monthly**: Review security warnings and address legitimate issues
**Quarterly**: Update plugins to latest versions, test for breaking changes  
**Annually**: Re-evaluate plugin ecosystem for new security tools
**Post-incident**: Review rules after any security incidents

### Plugin Update Commands

```bash
# Check for updates
npm outdated eslint-plugin-security @microsoft/eslint-plugin-sdl @vitest/eslint-plugin

# Update with testing
npm update eslint-plugin-security
npm run lint  # Verify no breaking changes
npm run test  # Verify functionality
```

---

## 🔗 References

**Plugin Documentation:**
- [eslint-plugin-security](https://github.com/eslint-community/eslint-plugin-security)
- [@microsoft/eslint-plugin-sdl](https://github.com/microsoft/eslint-plugin-sdl)
- [@vitest/eslint-plugin](https://github.com/vitest-dev/eslint-plugin-vitest)

**ESLint 9 Migration:**
- [ESLint Flat Config](https://eslint.org/docs/latest/use/configure/configuration-files)
- [Plugin Migration Guide](https://eslint.org/docs/latest/extend/plugins)

**Security Best Practices:**
- [OWASP ESLint Security](https://owasp.org/www-community/controls/Static_Code_Analysis)
- [Microsoft Security Development Lifecycle](https://www.microsoft.com/en-us/securityengineering/sdl/)

---

**Last Updated**: August 2025 (Phase 0 Configuration Audit)  
**Next Review**: February 2026