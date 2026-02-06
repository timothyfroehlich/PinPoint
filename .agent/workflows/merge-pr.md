---
description: Automated PR merge and cleanup workflow.
---

# Merge PR Workflow

Handles the final merge of a reviewed PR and cleans up ephemeral resources.

## Steps

1.  **Merge**:
    - Run the merge command with auto-squash and wait for checks:
      ```bash
      gh pr merge <PR_NUMBER> --auto --squash
      ```

2.  **Cleanup**:
    - Switch back to main and delete the local PR branch:
      ```bash
      git checkout main
      git branch -D <branch_name>
      ```

3.  **Sync**:
    - Run `bd sync` to update the status of linked issues.
      ```bash
      bd sync
      ```
