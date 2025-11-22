#!/bin/bash
set -e

# Multi-Worktree Sync Script
# Synchronizes dependencies, schemas, and environment variables across all PinPoint worktrees

MAIN_DIR="$HOME/Code/PinPoint"
SECONDARY_DIR="$HOME/Code/PinPoint-Secondary"
REVIEW_DIR="$HOME/Code/PinPoint-review"
ANTIGRAVITY_DIR="$HOME/Code/PinPoint-AntiGravity"

WORKTREES=("$MAIN_DIR" "$SECONDARY_DIR" "$REVIEW_DIR" "$ANTIGRAVITY_DIR")

echo "🔄 Syncing 4 worktrees..."

# 1. Sync dependencies
echo ""
echo "📦 Running npm install in all worktrees..."
for dir in "${WORKTREES[@]}"; do
  if [ -d "$dir" ]; then
    echo "  → $(basename "$dir")"
    (cd "$dir" && npm install --silent 2>&1 | grep -v "^npm")
  fi
done

# 2. Sync test schemas (Drizzle schema.ts is auto-synced by git)
echo ""
echo "🗄️  Regenerating test schemas..."
for dir in "${WORKTREES[@]}"; do
  if [ -d "$dir" ]; then
    echo "  → $(basename "$dir")"
    (cd "$dir" && npm run test:generate-schema --silent 2>&1 | grep -v "warn" | grep -v "npm")
  fi
done

# 3. Check for new environment variables
echo ""
echo "🔑 Checking for new environment variables..."
if [ -f "$MAIN_DIR/.env.example" ]; then
  EXAMPLE_KEYS=$(grep -v '^#' "$MAIN_DIR/.env.example" | grep -v '^$' | grep '=' | cut -d'=' -f1)

  for worktree_dir in "$SECONDARY_DIR" "$REVIEW_DIR" "$ANTIGRAVITY_DIR"; do
    if [ -f "$worktree_dir/.env.local" ]; then
      worktree_name=$(basename "$worktree_dir")
      missing_keys=()

      for key in $EXAMPLE_KEYS; do
        if ! grep -q "^$key=" "$worktree_dir/.env.local"; then
          missing_keys+=("$key")
        fi
      done

      if [ ${#missing_keys[@]} -gt 0 ]; then
        echo "  ⚠️  Missing in $worktree_name:"
        for key in "${missing_keys[@]}"; do
          echo "      - $key"
        done
      fi
    fi
  done
fi

# 4. Check for Supabase config.toml changes
echo ""
echo "📝 Checking Supabase config + skip-worktree..."

# Warn if base config.toml was modified (needs manual propagation to other worktrees)
if git -C "$MAIN_DIR" diff --quiet -- supabase/config.toml; then
  echo "  ✅ Base supabase/config.toml matches HEAD in main worktree"
else
  echo "  ⚠️  Base supabase/config.toml has local changes in main worktree"
  echo "     After committing or pulling, re-apply port offsets in other worktrees."
fi

for worktree_dir in "$SECONDARY_DIR" "$REVIEW_DIR" "$ANTIGRAVITY_DIR"; do
  if [ -d "$worktree_dir" ]; then
    worktree_name=$(basename "$worktree_dir")
    config_path="$worktree_dir/supabase/config.toml"

    if [ ! -f "$config_path" ]; then
      echo "  ⚠️  $worktree_name missing supabase/config.toml"
      continue
    fi

    skip_flag=$(git -C "$worktree_dir" ls-files -v supabase/config.toml 2>/dev/null | cut -c 1)
    if [ "$skip_flag" != "S" ]; then
      echo "  ⚠️  $worktree_name config.toml is tracked (no skip-worktree). Run:"
      echo "      git -C \"$worktree_dir\" update-index --skip-worktree supabase/config.toml"
    fi

    if diff -q "$MAIN_DIR/supabase/config.toml" "$config_path" > /dev/null 2>&1; then
      echo "  ⚠️  $worktree_name config.toml matches main (ports/project_id not overridden)."
      echo "      Update ports and project_id, then re-apply skip-worktree."
    else
      echo "  ✅ $worktree_name config.toml differs from main (custom ports applied)"
    fi
  fi
done

echo ""
echo "✅ Sync complete!"
echo ""
echo "Next steps:"
echo "  1. If env vars are missing, add them to each worktree's .env.local"
echo "  2. If base config.toml changed, propagate updates then re-apply port overrides"
echo "  3. Ensure skip-worktree is set for non-main supabase/config.toml files"
echo "  4. Run 'supabase start' in each worktree to refresh Supabase keys"
