# Security Review Issues

This directory contains issue templates created from the comprehensive security review conducted on November 25, 2025.

**Full Security Review Report:** [SECURITY_REVIEW_2025-11-25.md](../../SECURITY_REVIEW_2025-11-25.md) on branch `claude/security-review-codebase-011jfKFnKjKcqTDdG5njh7kQ`

## How to Create Issues on GitHub

Since the `gh` CLI doesn't have permission to create issues automatically, you'll need to create them manually. Here's the easiest way:

### Option 1: Create Issues via GitHub Web UI

1. Go to https://github.com/timothyfroehlich/PinPoint/issues/new
2. Copy the content from each markdown file in this directory
3. Paste into the issue description
4. Add appropriate labels (see below)
5. Submit

### Option 2: Use the Main Issue Template

1. Go to https://github.com/timothyfroehlich/PinPoint/issues/new/choose
2. Select "Security Review - Main Issue" template
3. The main issue will have checkboxes for all sub-issues
4. Create the main issue first
5. Then create sub-issues and link them by replacing the checkbox placeholders

### Option 3: Bulk Create with Script (Recommended)

If you have the `gh` CLI installed locally and authenticated:

```bash
# Navigate to the repository
cd /path/to/PinPoint

# Create main issue
gh issue create --title "Security Review: Critical Findings & Recommendations" \
  --body-file .github/ISSUE_TEMPLATE/security-review-main.md \
  --label "security,priority: critical"

# Create P0 issues
gh issue create --title "[P0] Add Security Headers (CSP, HSTS, X-Frame-Options)" \
  --body-file .github/ISSUES/p0-1-security-headers.md \
  --label "security,priority: critical,good first issue"

gh issue create --title "[P0] Implement Rate Limiting on Public Issue Form" \
  --body-file .github/ISSUES/p0-2-rate-limiting-public-form.md \
  --label "security,priority: critical,enhancement"

gh issue create --title "[P0] Protect Test API Routes with Authentication" \
  --body-file .github/ISSUES/p0-3-test-api-routes.md \
  --label "security,priority: critical,good first issue"

# Create P1 issues
gh issue create --title "[P1] DECISION NEEDED: Clarify Authorization Model" \
  --body-file .github/ISSUES/p1-1-authorization-decision.md \
  --label "security,priority: high,decision needed,architecture"

gh issue create --title "[P1] Add Login Rate Limiting / Brute Force Protection" \
  --body-file .github/ISSUES/p1-2-login-rate-limiting.md \
  --label "security,priority: high,enhancement"

gh issue create --title "[P1] Add Signup Rate Limiting" \
  --body-file .github/ISSUES/p1-3-signup-rate-limiting.md \
  --label "security,priority: high,enhancement"

# Create P2 issues
gh issue create --title "[P2] Add Forgot Password Rate Limiting" \
  --body-file .github/ISSUES/p2-1-forgot-password-rate-limiting.md \
  --label "security,priority: medium,enhancement"

gh issue create --title "[P2] Strengthen Password Reset Origin Validation" \
  --body-file .github/ISSUES/p2-2-password-reset-origin-validation.md \
  --label "security,priority: medium,refactoring"

gh issue create --title "[P2] Add Runtime Validation for Flash Messages" \
  --body-file .github/ISSUES/p2-3-flash-message-validation.md \
  --label "security,priority: medium,enhancement,good first issue"
```

## Issue Summary

### P0 - Critical (Production Blockers)
| Issue | Effort | Labels |
|-------|--------|--------|
| Add Security Headers | 30 min | `security`, `priority: critical`, `good first issue` |
| Rate Limiting on Public Form | 2-4 hours | `security`, `priority: critical`, `enhancement` |
| Protect Test API Routes | 30 min | `security`, `priority: critical`, `good first issue` |

### P1 - High Priority (Before Beta)
| Issue | Effort | Labels |
|-------|--------|--------|
| Clarify Authorization Model | 4-8 hours OR 30 min | `security`, `priority: high`, `decision needed`, `architecture` |
| Login Rate Limiting | 2-3 hours | `security`, `priority: high`, `enhancement` |
| Signup Rate Limiting | 1-2 hours | `security`, `priority: high`, `enhancement` |

### P2 - Medium Priority (Next Sprint)
| Issue | Effort | Labels |
|-------|--------|--------|
| Forgot Password Rate Limiting | 1 hour | `security`, `priority: medium`, `enhancement` |
| Password Reset Origin Validation | 30 min | `security`, `priority: medium`, `refactoring` |
| Flash Message Validation | 30 min | `security`, `priority: medium`, `enhancement`, `good first issue` |

## Labels to Create

If these labels don't exist in your repository, create them first:

```bash
gh label create "security" --color "d73a4a" --description "Security-related issues"
gh label create "priority: critical" --color "b60205" --description "Critical priority - blocks production"
gh label create "priority: high" --color "d93f0b" --description "High priority - needed for beta"
gh label create "priority: medium" --color "fbca04" --description "Medium priority - next sprint"
gh label create "decision needed" --color "d876e3" --description "Requires architectural or design decision"
gh label create "good first issue" --color "7057ff" --description "Good for newcomers"
```

## Linking Issues

After creating all issues, update the main issue to link to the sub-issues by replacing the placeholder checkboxes with actual issue numbers:

```markdown
- [ ] #123 Add Security Headers (CSP, HSTS, X-Frame-Options)
- [ ] #124 Implement Rate Limiting on Public Issue Form
# etc.
```

## Production Readiness Checklist

**Before production deployment, ALL P0 issues MUST be resolved:**

- [ ] Security headers added (CSP, HSTS, X-Frame-Options)
- [ ] Rate limiting on public issue form
- [ ] Test API routes protected

**Estimated time to production-ready:** 1-2 days

---

**Questions?** See the full security review report: [SECURITY_REVIEW_2025-11-25.md](../../SECURITY_REVIEW_2025-11-25.md)
