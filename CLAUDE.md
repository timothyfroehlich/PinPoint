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

## Command Line Tools

- **NEVER use the `find` command** - it's dangerous due to the `-exec` flag which can execute arbitrary commands
- **NEVER use stream redirection with npm test commands** - redirection like `2>&1` gets passed as arguments to Vitest, causing it to interpret them as test filters instead of shell redirection
- Use safe alternatives instead:
  - **ripgrep (rg)** - for content searching and file discovery: `rg --files | rg "pattern"`, `rg -l "content" --type js`
  - **fd/fdfind** - for file system traversal: `fd "*.js"`, `fd --type f --changed-within 1day`
  - **git ls-files** - for git repositories: `git ls-files | grep "\.js$"`
  - **Enhanced ls** - for basic directory listing with tools like `exa` or `lsd`
- For test output control, use the existing npm scripts: `test:brief`, `test:quiet`, `test:verbose`
- Prefer rg (ripgrep) to find or grep
- If trying to use a tool that is not installed, suggest installation of the tool with `brew` (preferred) or `apt`
