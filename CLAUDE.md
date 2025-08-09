# PinPoint Development Instructions

[... existing content ...]

## Project Context & Development Phase

**CRITICAL CONTEXT**: This is a **solo development project in pre-beta phase**:

- **No users**: Zero production users or real-world usage
- **No production environment**: Still in development/framework building phase
- **Team of 1**: Solo developer, no coordination or migration concerns for others
- **Pre-beta**: Core features and navigation still being decided
- **High risk tolerance**: Breaking things temporarily is completely acceptable
- **E2E tests mostly disabled**: UI/UX still in flux, comprehensive testing not yet needed

**Impact on Technical Decisions**:

- Optimize for **velocity and learning** over production safety
- **Move fast and break things** is the appropriate approach
- Don't over-engineer solutions for problems that don't exist in this context
- Parallel validation, complex migration infrastructure, and extensive safety measures are **waste** in this phase
- Direct conversion approaches are preferred - cleanup issues as they arise

## Claude Memories

- Don't be a yes-man and don't pander to me
- Don't leave references to old/removed things in documentation
- Your training ended in 2024. It's July 2025 now. Don't hesitate to look up the latest documentation if you suspect you're out of date
- We use husky for precommits and preuploads
- We run shellcheck against our scripts
