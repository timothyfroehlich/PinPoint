# Plan for updating creating-skills/SKILL.md

## Goal

Update the "Writing Skills" skill to be compatible with Gemini CLI's new Agent Skills support and the agentskills.io standard.

## References

- Gemini CLI PR #15698: Added tiered skill discovery (`~/.gemini/skills`, `.gemini/skills`) and `SkillManager`.
- Agent Skills Standard: Uses `SKILL.md` with YAML frontmatter.

## Proposed Changes

1.  **Frontmatter**:
    - Keep `name` and `description`.
    - Keep `version` and `languages`.
    - Keep `when_to_use` as it helps the agent understand context, even if strictly `description` is the primary discovery key in the CLI currently.

2.  **File Paths & Locations**:
    - Change `${SUPERPOWERS_SKILLS_ROOT}` to `.gemini/skills` (project-local) and `~/.gemini/skills` (global).
    - Explain the tiered discovery: Project overrides User.

3.  **Terminology**:
    - "Claude" -> "Gemini" / "Agent".
    - "Superpowers" -> "Gemini CLI".
    - `find-skills` -> `/skills` command or automatic discovery.

4.  **Structure Definition**:
    - Update the `SKILL.md` template to match the standard.
    - Emphasize that `SKILL.md` is the entry point.

5.  **Workflow**:
    - Update the "Discovery Workflow" to reflect how Gemini CLI loads skills (automatic discovery based on placement).

## Step-by-Step Implementation

1.  **Read** the file `.gemini/skills/creating-skills/SKILL.md`.
2.  **Replace** the Overview section to explain Gemini CLI skill locations.
3.  **Update** the Directory Structure section to show `.gemini/skills/`.
4.  **Update** "Discovery Workflow" to remove `find-skills` tool reference and explain the new discovery mechanism.
5.  **Refine** the "Claude Search Optimization" section to "Agent Search Optimization" (ASO) or similar, focusing on how Gemini will read the `SKILL.md`.
6.  **Verify** the TDD process remains applicable (it does, as it's about content quality).

## Verification

- The file should describe how to create a skill that _works_ in Gemini CLI.
- The pathing instructions must be correct for the user's OS (Linux) and Gemini CLI structure.
