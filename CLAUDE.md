# PinPoint Development Instructions

[... existing content ...]

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
