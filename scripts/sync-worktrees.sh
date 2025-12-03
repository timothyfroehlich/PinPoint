#!/bin/bash
set -euo pipefail

# Comprehensive Worktree Management Script
# Fixes configs, merges main, detects merged PRs, restarts Supabase, and syncs dependencies

# ============================================================================
# GLOBAL VARIABLES
# ============================================================================

# Command-line flags
DRY_RUN=false
NON_INTERACTIVE=false
PROCESS_ALL=false

# State tracking (associative arrays)
declare -A WORKTREE_PATHS
declare -A CONFIG_FIXED
declare -A CONFIG_MESSAGES
declare -A STASH_REFS
declare -A PRE_MERGE_SHAS
declare -A MERGE_STATUS
declare -A MERGE_MESSAGES
declare -A CONFLICTS_PRESENT
declare -A RECOVERY_COMMANDS
declare -A OVERALL_STATUS
declare -A SUPABASE_RESTARTED
declare -A STATUS_SUMMARY

# Optional explicit worktree targets
WORKTREES_SELECTED=()
MAIN_WORKTREE_PATH=""

print_usage() {
  cat <<'EOF'
Usage: scripts/sync-worktrees.sh [options] [worktree path]

Options:
  --dry-run           Show actions without making changes
  -y                  Non-interactive (auto-confirm prompts)
  -a, --all           Process all worktrees
  -p, --path <dir>    Process a specific worktree (single path)
  --help              Show this help message

Notes:
- Without --all, the script processes exactly one worktree (current by default).
- When both positional path and --path are provided, only the first path is used.
EOF
}

# Port allocation table (from AGENTS.md)
# Next.js uses +100 offsets, Supabase uses +1000 offsets
declare -A NEXTJS_PORT_OFFSETS=(
  ["PinPoint"]=0
  ["PinPoint-Secondary"]=100
  ["PinPoint-review"]=200
  ["PinPoint-AntiGravity"]=300
)

declare -A SUPABASE_PORT_OFFSETS=(
  ["PinPoint"]=0
  ["PinPoint-Secondary"]=1000
  ["PinPoint-review"]=2000
  ["PinPoint-AntiGravity"]=3000
)

declare -A PROJECT_IDS=(
  ["PinPoint"]="pinpoint"
  ["PinPoint-Secondary"]="pinpoint-secondary"
  ["PinPoint-review"]="pinpoint-review"
  ["PinPoint-AntiGravity"]="pinpoint-antigravity"
)

# Base ports
BASE_PORT_NEXTJS=3000
BASE_PORT_API=54321
BASE_PORT_DB=54322
BASE_PORT_SHADOW=54320
BASE_PORT_POOLER=54329
BASE_PORT_INBUCKET=54324
BASE_PORT_SMTP=54325
BASE_PORT_POP3=54326

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

# Print colored output
print_status() {
  local status=$1
  shift
  case "$status" in
    success) echo "✅ $*" ;;
    warning) echo "⚠️  $*" ;;
    error) echo "❌ $*" ;;
    info) echo "ℹ️  $*" ;;
    *) echo "$*" ;;
  esac
}

# Dry-run wrapper
run_command() {
  local cmd="$1"
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: $cmd"
    return 0
  else
    eval "$cmd"
  fi
}

# Interactive prompt with timeout and -y override
prompt_with_timeout() {
  local message="$1"
  local default="${2:-N}"
  local timeout="${3:-5}"

  if [ "$DRY_RUN" = true ]; then
    local answer="N"
    if [ "$NON_INTERACTIVE" = true ]; then
      answer="Y"
    fi
    echo "[DRY-RUN] Would prompt: \"$message\" Answer: $answer"
    [ "$answer" = "Y" ]
    return $?
  fi

  if [ "$NON_INTERACTIVE" = true ]; then
    echo "$message Y (auto-accepted with -y)"
    return 0
  fi

  local response
  read -t "$timeout" -p "$message " response || true
  response=${response:-$default}

  [[ "$response" =~ ^[Yy]$ ]]
}

# Get worktree name from path
get_worktree_name() {
  basename "$1"
}

# Get expected configuration for a worktree
get_nextjs_port_offset() {
  local name="$1"
  echo "${NEXTJS_PORT_OFFSETS[$name]:-0}"
}

get_supabase_port_offset() {
  local name="$1"
  echo "${SUPABASE_PORT_OFFSETS[$name]:-0}"
}

get_project_id() {
  local name="$1"
  echo "${PROJECT_IDS[$name]:-unknown}"
}

# Build git status summary (branch/upstream and diff stats)
compute_status_summary() {
  local worktree_dir="$1"
  local branch
  branch=$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "UNKNOWN")

  local upstream_status
  if [ "$branch" = "HEAD" ] || [ "$branch" = "UNKNOWN" ]; then
    upstream_status="detached"
  elif git -C "$worktree_dir" rev-parse --abbrev-ref "@{u}" >/dev/null 2>&1; then
    local ahead_behind
    ahead_behind=$(git -C "$worktree_dir" rev-list --left-right --count "HEAD...@{u}" 2>/dev/null || echo "0 0")
    local ahead=$(echo "$ahead_behind" | awk '{print $1}')
    local behind=$(echo "$ahead_behind" | awk '{print $2}')
    upstream_status="ahead ${ahead}, behind ${behind}"
  else
    upstream_status="no upstream"
  fi

  local pending_files
  pending_files=$(git -C "$worktree_dir" status --porcelain --ignore-submodules | wc -l | tr -d ' ')
  local shortstat
  shortstat=$(git -C "$worktree_dir" diff --shortstat 2>/dev/null | tr -s ' ')

  local insertions=0
  local deletions=0

  if [ -n "$shortstat" ]; then
    insertions=$(echo "$shortstat" | sed -n 's/.* \([0-9]\+\) insertion(s).*/\1/p')
    deletions=$(echo "$shortstat" | sed -n 's/.* \([0-9]\+\) deletion(s).*/\1/p')
    insertions=${insertions:-0}
    deletions=${deletions:-0}
  fi

  if [ "$pending_files" -eq 0 ]; then
    STATUS_SUMMARY[$(get_worktree_name "$worktree_dir")]="branch ${branch} | ${upstream_status} | clean"
  else
    STATUS_SUMMARY[$(get_worktree_name "$worktree_dir")]="branch ${branch} | ${upstream_status} | files ${pending_files}, +${insertions}/-${deletions}"
  fi
}

# Update overall status (error > warning > success)
update_overall_status() {
  local name="$1"
  local status="$2"

  local current="${OVERALL_STATUS[$name]:-success}"

  if [ "$status" = "error" ] || [ "$current" = "error" ]; then
    OVERALL_STATUS[$name]="error"
  elif [ "$status" = "warning" ] || [ "$current" = "warning" ]; then
    OVERALL_STATUS[$name]="warning"
  else
    OVERALL_STATUS[$name]="success"
  fi
}

# ============================================================================
# PHASE 1: CONFIGURATION FIXING
# ============================================================================

fix_config_toml() {
  local worktree_dir="$1"
  local name="$2"
  local config_file="$worktree_dir/supabase/config.toml"

  if [ ! -f "$config_file" ]; then
    CONFIG_MESSAGES[$name]="Missing supabase/config.toml"
    update_overall_status "$name" "error"
    return 1
  fi

  # Calculate expected values
  local offset=$(get_supabase_port_offset "$name")
  local expected_project_id=$(get_project_id "$name")
  local expected_api_port=$((BASE_PORT_API + offset))
  local expected_db_port=$((BASE_PORT_DB + offset))
  local expected_shadow_port=$((BASE_PORT_SHADOW + offset))
  local expected_pooler_port=$((BASE_PORT_POOLER + offset))
  local expected_inbucket_port=$((BASE_PORT_INBUCKET + offset))
  local expected_smtp_port=$((BASE_PORT_SMTP + offset))
  local expected_pop3_port=$((BASE_PORT_POP3 + offset))

  # Read current values
  local current_project_id=$(grep '^project_id =' "$config_file" | sed 's/project_id = "\(.*\)"/\1/')
  local current_api_port=$(sed -n '/^\[api\]/,/^\[/ { /^port = / { s/port = //p; q } }' "$config_file")
  local current_db_port=$(sed -n '/^\[db\]/,/^\[/ { /^port = / { s/port = //p; q } }' "$config_file")
  local current_shadow_port=$(sed -n '/^\[db\]/,/^\[/ { /^shadow_port = / { s/shadow_port = //p; q } }' "$config_file")
  local current_pooler_port=$(sed -n '/^\[db\.pooler\]/,/^\[/ { /^port = / { s/port = //p; q } }' "$config_file")
  local current_inbucket_port=$(sed -n '/^\[inbucket\]/,/^\[/ { /^port = / { s/port = //p; q } }' "$config_file")
  local current_smtp_port=$(sed -n '/^\[inbucket\]/,/^\[/ { /^smtp_port = / { s/smtp_port = //p; q } }' "$config_file")
  local current_pop3_port=$(sed -n '/^\[inbucket\]/,/^\[/ { /^pop3_port = / { s/pop3_port = //p; q } }' "$config_file")

  local changes=()
  local needs_fix=false

  # Check each value
  if [ "$current_project_id" != "$expected_project_id" ]; then
    changes+=("project_id: $current_project_id → $expected_project_id")
    needs_fix=true
  fi

  if [ "$current_api_port" != "$expected_api_port" ]; then
    changes+=("API port: $current_api_port → $expected_api_port")
    needs_fix=true
  fi

  if [ "$current_db_port" != "$expected_db_port" ]; then
    changes+=("DB port: $current_db_port → $expected_db_port")
    needs_fix=true
  fi

  if [ "$current_shadow_port" != "$expected_shadow_port" ]; then
    changes+=("Shadow port: $current_shadow_port → $expected_shadow_port")
    needs_fix=true
  fi

  if [ "$current_pooler_port" != "$expected_pooler_port" ]; then
    changes+=("Pooler port: $current_pooler_port → $expected_pooler_port")
    needs_fix=true
  fi

  if [ "$current_inbucket_port" != "$expected_inbucket_port" ]; then
    changes+=("Mailpit port (config [inbucket]): $current_inbucket_port → $expected_inbucket_port")
    needs_fix=true
  fi

  if [ "$current_smtp_port" != "$expected_smtp_port" ]; then
    changes+=("Mailpit SMTP port (config [inbucket]): ${current_smtp_port:-<missing>} → $expected_smtp_port")
    needs_fix=true
  fi

  if [ "$current_pop3_port" != "$expected_pop3_port" ]; then
    changes+=("Mailpit POP3 port (config [inbucket]): ${current_pop3_port:-<missing>} → $expected_pop3_port")
    needs_fix=true
  fi

  if [ "$needs_fix" = false ]; then
    CONFIG_MESSAGES[$name]="Validated (no changes needed)"
    CONFIG_FIXED[$name]=false
    return 0
  fi

  # Create backup and apply fixes
  local backup_file="${config_file}.bak.$(date +%Y%m%d-%H%M%S)"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would fix config.toml in $name:"
    for change in "${changes[@]}"; do
      echo "[DRY-RUN]   $change"
    done
    echo "[DRY-RUN] Would create backup: $(basename "$backup_file")"
  else
    cp "$config_file" "$backup_file"

    # Apply fixes with sed
    sed -i "s/^project_id = .*/project_id = \"$expected_project_id\"/" "$config_file"
    sed -i "/^\[api\]/,/^\[/ s/^port = .*/port = $expected_api_port/" "$config_file"
    sed -i "/^\[db\]/,/^\[/ { /^port = / s/port = .*/port = $expected_db_port/ }" "$config_file"
    sed -i "/^\[db\]/,/^\[/ { /^shadow_port = / s/shadow_port = .*/shadow_port = $expected_shadow_port/ }" "$config_file"
    sed -i "/^\[db\.pooler\]/,/^\[/ s/^port = .*/port = $expected_pooler_port/" "$config_file"
    sed -i "/^\[inbucket\]/,/^\[/ s/^port = .*/port = $expected_inbucket_port/" "$config_file"

    # Handle SMTP port (update if exists, add if missing)
    if grep -q "^smtp_port = " "$config_file"; then
      sed -i "/^\[inbucket\]/,/^\[/ s/^smtp_port = .*/smtp_port = $expected_smtp_port/" "$config_file"
    else
      sed -i "/^\[inbucket\]/,/^\[/ { /^port = / a\\
smtp_port = $expected_smtp_port
}" "$config_file"
    fi

    # Handle POP3 port (update if exists, add if missing)
    if grep -q "^pop3_port = " "$config_file"; then
      sed -i "/^\[inbucket\]/,/^\[/ s/^pop3_port = .*/pop3_port = $expected_pop3_port/" "$config_file"
    else
      sed -i "/^\[inbucket\]/,/^\[/ { /^smtp_port = / a\\
pop3_port = $expected_pop3_port
}" "$config_file"
    fi
  fi

  CONFIG_FIXED[$name]=true
  CONFIG_MESSAGES[$name]="Fixed: ${changes[*]}"
  update_overall_status "$name" "warning"
}

fix_env_local() {
  local worktree_dir="$1"
  local name="$2"
  local env_file="$worktree_dir/.env.local"

  # Calculate expected values
  local nextjs_offset=$(get_nextjs_port_offset "$name")
  local supabase_offset=$(get_supabase_port_offset "$name")
  local expected_nextjs_port=$((BASE_PORT_NEXTJS + nextjs_offset))
  local expected_api_port=$((BASE_PORT_API + supabase_offset))
  local expected_db_port=$((BASE_PORT_DB + supabase_offset))
  local expected_inbucket_port=$((BASE_PORT_INBUCKET + supabase_offset))
  local expected_mailpit_smtp_port=$((BASE_PORT_SMTP + supabase_offset))
  local expected_smtp_port=$((BASE_PORT_SMTP + supabase_offset))
  local expected_site_url="http://localhost:${expected_nextjs_port}"

  # Helper to set or append a key=value pair
  set_or_add_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" "$env_file"; then
      sed -i "s|^${key}=.*|${key}=${value}|" "$env_file"
    else
      echo "${key}=${value}" >>"$env_file"
    fi
  }

  # Bootstrap .env.local if missing
  if [ ! -f "$env_file" ]; then
    cat >"$env_file" <<EOF
# Generated by scripts/sync-worktrees.sh
# Local Supabase + Next.js defaults for ${name}
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${expected_api_port}
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:${expected_db_port}/postgres
PORT=${expected_nextjs_port}
NEXT_PUBLIC_SITE_URL=${expected_site_url}

# Email Configuration
EMAIL_TRANSPORT=smtp
MAILPIT_PORT=${expected_inbucket_port}
MAILPIT_SMTP_PORT=${expected_mailpit_smtp_port}
INBUCKET_PORT=${expected_inbucket_port}
INBUCKET_SMTP_PORT=${expected_smtp_port}

# Fill these from 'supabase start' output for this worktree
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
EOF
    CONFIG_MESSAGES[$name]="${CONFIG_MESSAGES[$name]} | .env.local created"
  fi

  local changes=()
  local needs_fix=false

  # Check current values
  if grep -q "NEXT_PUBLIC_SUPABASE_URL" "$env_file"; then
    local current_url_port=$(grep "NEXT_PUBLIC_SUPABASE_URL" "$env_file" | grep -oP ':\K[0-9]+')
    if [ "$current_url_port" != "$expected_api_port" ]; then
      changes+=(".env PORT in URL: $current_url_port → $expected_api_port")
      needs_fix=true
    fi
  fi

  if grep -q "^PORT=" "$env_file"; then
    local current_nextjs_port=$(grep "^PORT=" "$env_file" | cut -d'=' -f2)
    if [ "$current_nextjs_port" != "$expected_nextjs_port" ]; then
      changes+=("Next.js PORT: $current_nextjs_port → $expected_nextjs_port")
      needs_fix=true
    fi
  fi

  if grep -q "^DATABASE_URL=" "$env_file"; then
    local current_db_port=$(grep "^DATABASE_URL=" "$env_file" | grep -oP '@127\.0\.0\.1:\K[0-9]+')
    if [ "$current_db_port" != "$expected_db_port" ]; then
      changes+=("DATABASE_URL port: ${current_db_port:-<unknown>} → $expected_db_port")
      needs_fix=true
    fi
  else
    changes+=("DATABASE_URL: <missing> → postgresql://postgres:postgres@127.0.0.1:$expected_db_port/postgres")
    needs_fix=true
  fi

  if grep -q "^PORT=" "$env_file"; then
    local current_nextjs_port=$(grep "^PORT=" "$env_file" | cut -d'=' -f2)
    if [ "$current_nextjs_port" != "$expected_nextjs_port" ]; then
      changes+=("Next.js PORT: $current_nextjs_port → $expected_nextjs_port")
      needs_fix=true
    fi
  else
    changes+=("PORT: <missing> → $expected_nextjs_port")
    needs_fix=true
  fi

  # Ensure NEXT_PUBLIC_SITE_URL matches expected host/port
  local current_site_url=""
  if grep -q "^NEXT_PUBLIC_SITE_URL=" "$env_file"; then
    current_site_url=$(grep "^NEXT_PUBLIC_SITE_URL=" "$env_file" | cut -d'=' -f2-)
  fi
  if [ "$current_site_url" != "$expected_site_url" ]; then
    changes+=("NEXT_PUBLIC_SITE_URL: ${current_site_url:-<missing>} → $expected_site_url")
    needs_fix=true
  fi

  # Ensure required keys exist
  for key in NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SERVICE_ROLE_KEY; do
    if ! grep -q "^${key}=" "$env_file"; then
      echo "${key}=" >>"$env_file"
    fi
  done

  if [ "$needs_fix" = false ]; then
    return 0
  fi

  # Apply fixes
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would fix .env.local in $name:"
    for change in "${changes[@]}"; do
      echo "[DRY-RUN]   $change"
    done
  else
    set_or_add_var "NEXT_PUBLIC_SUPABASE_URL" "http://127.0.0.1:${expected_api_port}"
    set_or_add_var "DATABASE_URL" "postgresql://postgres:postgres@127.0.0.1:${expected_db_port}/postgres"
    set_or_add_var "PORT" "${expected_nextjs_port}"
    set_or_add_var "NEXT_PUBLIC_SITE_URL" "${expected_site_url}"
    set_or_add_var "EMAIL_TRANSPORT" "smtp"
    set_or_add_var "MAILPIT_PORT" "${expected_inbucket_port}"
    set_or_add_var "MAILPIT_SMTP_PORT" "${expected_mailpit_smtp_port}"
    set_or_add_var "INBUCKET_PORT" "${expected_inbucket_port}"
    set_or_add_var "INBUCKET_SMTP_PORT" "${expected_smtp_port}"
  fi

  CONFIG_MESSAGES[$name]="${CONFIG_MESSAGES[$name]} | .env.local fixed"
}

fix_skip_worktree() {
  local worktree_dir="$1"
  local name="$2"
  local abs_path
  abs_path=$(cd "$worktree_dir" && pwd)

  local is_main_worktree=false
  if [ -n "$MAIN_WORKTREE_PATH" ] && [ "$abs_path" = "$MAIN_WORKTREE_PATH" ]; then
    is_main_worktree=true
  elif [ "$name" = "PinPoint" ] && [ -z "$MAIN_WORKTREE_PATH" ]; then
    # Fallback for environments where worktree list parsing failed
    is_main_worktree=true
  fi

  local skip_flag=$(git -C "$worktree_dir" ls-files -v supabase/config.toml 2>/dev/null | cut -c 1)

  if [ "$is_main_worktree" = true ]; then
    # Main worktree should NOT have skip-worktree
    if [ "$skip_flag" = "S" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would remove skip-worktree from $name"
      else
        git -C "$worktree_dir" update-index --no-skip-worktree supabase/config.toml
      fi
      CONFIG_MESSAGES[$name]="${CONFIG_MESSAGES[$name]} | skip-worktree removed"
    fi
  else
    # Others MUST have skip-worktree
    if [ "$skip_flag" != "S" ]; then
      if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would add skip-worktree to $name"
      else
        git -C "$worktree_dir" update-index --skip-worktree supabase/config.toml
      fi
      CONFIG_MESSAGES[$name]="${CONFIG_MESSAGES[$name]} | skip-worktree added"
    fi
  fi
}

# ============================================================================
# PHASE 2: GIT STATE MANAGEMENT
# ============================================================================

safe_stash() {
  local worktree_dir="$1"
  local branch="$2"
  local name=$(get_worktree_name "$worktree_dir")

  # Check if there are uncommitted changes
  if git -C "$worktree_dir" diff-index --quiet HEAD --; then
    return 0  # No changes, no stash needed
  fi

  local stash_name="sync-worktrees-auto-${branch}-$(date +%Y%m%d-%H%M%S)"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would stash: $stash_name"
  else
    git -C "$worktree_dir" stash push -u -m "$stash_name" >/dev/null 2>&1
    STASH_REFS[$name]="stash@{0}"
  fi
}

# ============================================================================
# PHASE 3: BRANCH OPERATIONS
# ============================================================================

check_merged_pr() {
  local branch="$1"

  # Check if gh CLI is available
  if ! command -v gh &> /dev/null; then
    return 1
  fi

  # Query for merged PR
  local pr_json=$(gh pr list --repo timothyfroehlich/PinPoint \
    --head "$branch" --state merged --json number,title,mergedAt --limit 1 2>/dev/null || echo "[]")

  if [ "$pr_json" = "[]" ] || [ -z "$pr_json" ]; then
    return 1
  fi

  # Extract PR number
  echo "$pr_json" | grep -oP '"number":\K[0-9]+'
}

safe_merge_main() {
  local worktree_dir="$1"
  local branch="$2"
  local name=$(get_worktree_name "$worktree_dir")

  # Check if there are outstanding changes
  local has_changes=false
  if ! git -C "$worktree_dir" diff-index --quiet HEAD -- 2>/dev/null; then
    has_changes=true
  fi

  # Handle detached HEAD state
  if [ "$branch" = "HEAD" ]; then
    if [ "$has_changes" = true ]; then
      MERGE_STATUS[$name]="skipped"
      MERGE_MESSAGES[$name]="Detached HEAD with outstanding changes - should be working on a branch"
      update_overall_status "$name" "warning"
      return 0
    fi

    # Switch to origin/main detached
    if [ "$DRY_RUN" = true ]; then
      echo "[DRY-RUN] Would run: git fetch origin && git checkout --detach origin/main"
    else
      git -C "$worktree_dir" fetch origin >/dev/null 2>&1
      git -C "$worktree_dir" checkout --detach origin/main >/dev/null 2>&1
    fi
    MERGE_STATUS[$name]="detached"
    MERGE_MESSAGES[$name]="Switched to origin/main detached"
    return 0
  fi

  # Handle main branch
  if [ "$branch" = "main" ]; then
    if [ "$has_changes" = true ]; then
      MERGE_STATUS[$name]="skipped"
      MERGE_MESSAGES[$name]="On main with outstanding changes - should be working on a branch"
      update_overall_status "$name" "warning"
      return 0
    fi

    # Pull latest main
    if [ "$DRY_RUN" = true ]; then
      echo "[DRY-RUN] Would run: git pull"
    else
      local pull_output
      pull_output=$(git -C "$worktree_dir" pull 2>&1)
      if echo "$pull_output" | grep -q "Already up to date"; then
        MERGE_STATUS[$name]="up-to-date"
        MERGE_MESSAGES[$name]="Main already up to date"
      else
        MERGE_STATUS[$name]="pulled"
        MERGE_MESSAGES[$name]="Main pulled successfully"
      fi
    fi
    return 0
  fi

  # Check for merged PR
  local pr_number=$(check_merged_pr "$branch")
  if [ -n "$pr_number" ]; then
    echo ""
    if prompt_with_timeout "Branch '$branch' has merged PR #$pr_number. Checkout detached HEAD at main? (y/N):" "N" 10; then
      if [ "$DRY_RUN" = true ]; then
        echo "[DRY-RUN] Would run: git checkout --detach main"
      else
        git -C "$worktree_dir" checkout --detach main >/dev/null 2>&1
      fi
      MERGE_STATUS[$name]="detached"
      MERGE_MESSAGES[$name]="Checked out detached HEAD at main (PR #$pr_number merged)"
      RECOVERY_COMMANDS[$name]="# Consider deleting merged branch:\ngit branch -d $branch"
      update_overall_status "$name" "warning"
      return 0
    else
      MERGE_STATUS[$name]="declined"
      MERGE_MESSAGES[$name]="Merged PR #$pr_number found, but user declined detached HEAD"
      update_overall_status "$name" "warning"
      return 0
    fi
  fi

  # Save pre-merge SHA for recovery
  PRE_MERGE_SHAS[$name]=$(git -C "$worktree_dir" rev-parse HEAD)

  # Attempt merge
  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: git merge main"
    MERGE_STATUS[$name]="success"
    MERGE_MESSAGES[$name]="Would merge main"
    return 0
  fi

  local merge_output
  local merge_exit_code=0
  merge_output=$(git -C "$worktree_dir" merge main 2>&1) || merge_exit_code=$?

  if [ $merge_exit_code -eq 0 ]; then
    if echo "$merge_output" | grep -q "Already up to date"; then
      MERGE_STATUS[$name]="up-to-date"
      MERGE_MESSAGES[$name]="Already up to date with main"
    else
      MERGE_STATUS[$name]="merged"
      MERGE_MESSAGES[$name]="Merged main successfully"
    fi
  else
    MERGE_STATUS[$name]="conflicts"
    MERGE_MESSAGES[$name]="Merge conflicts detected"
    CONFLICTS_PRESENT[$name]=true
    update_overall_status "$name" "error"

    # Generate recovery commands
    local recovery="cd $worktree_dir\n\n"
    recovery+="# Option 1: Resolve conflicts manually\ngit status\n# Edit files, then:\ngit add <resolved-files>\ngit commit\n\n"
    recovery+="# Option 2: Abort merge\ngit merge --abort\ngit reset --hard ${PRE_MERGE_SHAS[$name]}\n\n"
    recovery+="# Option 3: Accept main's changes\ngit checkout --theirs .\ngit add .\ngit commit -m \"Merge main (accept all main changes)\""
    RECOVERY_COMMANDS[$name]=$recovery

    return 1
  fi
}

# ============================================================================
# PHASE 4: STASH REAPPLICATION
# ============================================================================

safe_stash_pop() {
  local worktree_dir="$1"
  local name=$(get_worktree_name "$worktree_dir")

  # Skip if no stash
  if [ -z "${STASH_REFS[$name]:-}" ]; then
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: git stash pop"
    return 0
  fi

  local pop_output
  local pop_exit_code=0
  pop_output=$(git -C "$worktree_dir" stash pop 2>&1) || pop_exit_code=$?

  if [ $pop_exit_code -ne 0 ]; then
    CONFLICTS_PRESENT[$name]=true
    update_overall_status "$name" "error"

    local recovery="cd $worktree_dir\n\n"
    recovery+="# Stash pop conflicts detected\n\n"
    recovery+="# Option 1: Resolve conflicts\ngit status\n# Edit files, then:\ngit add <resolved-files>\n\n"
    recovery+="# Option 2: Discard stash changes\ngit reset --hard HEAD"

    if [ -n "${RECOVERY_COMMANDS[$name]:-}" ]; then
      RECOVERY_COMMANDS[$name]="${RECOVERY_COMMANDS[$name]}\n\n$recovery"
    else
      RECOVERY_COMMANDS[$name]=$recovery
    fi
  fi
}

# ============================================================================
# PHASE 5: DEPENDENCY & DATABASE SYNC
# ============================================================================

run_npm_install() {
  local worktree_dir="$1"
  local name=$(get_worktree_name "$worktree_dir")

  # Skip if conflicts present
  if [ "${CONFLICTS_PRESENT[$name]:-false}" = true ]; then
    return 1
  fi

  echo ""
  if ! prompt_with_timeout "Run npm ci in $name? [Y/n]:" "Y" 5; then
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: npm ci --silent"
  else
    (cd "$worktree_dir" && npm ci --silent 2>&1 | grep -v "^npm") || true
  fi
}

restart_supabase() {
  local worktree_dir="$1"
  local name=$(get_worktree_name "$worktree_dir")

  # Skip if conflicts present or config wasn't fixed
  if [ "${CONFLICTS_PRESENT[$name]:-false}" = true ] || [ "${CONFIG_FIXED[$name]:-false}" = false ]; then
    return 0
  fi

  echo ""
  if ! prompt_with_timeout "Restart Supabase and reseed database in $name? [Y/n]:" "Y" 5; then
    return 0
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run:"
    echo "[DRY-RUN]   supabase stop"
    echo "[DRY-RUN]   supabase start"
    echo "[DRY-RUN]   npm run db:reset:local"
    echo "[DRY-RUN]   npm run db:seed"
    echo "[DRY-RUN]   npm run db:seed-users"
  else
    (cd "$worktree_dir" && {
      supabase stop 2>/dev/null || true
      supabase start >/dev/null 2>&1 || true
      npm run db:reset:local --silent 2>&1 | grep -v "warn" || true
      npm run db:seed --silent 2>&1 || true
      npm run db:seed-users --silent 2>&1 || true
    })
    SUPABASE_RESTARTED[$name]=true
  fi
}

regenerate_test_schema() {
  local worktree_dir="$1"

  if [ "$DRY_RUN" = true ]; then
    echo "[DRY-RUN] Would run: npm run test:generate-schema"
  else
    (cd "$worktree_dir" && npm run test:generate-schema --silent 2>&1 | grep -v "warn" | grep -v "npm") || true
  fi
}

# ============================================================================
# MAIN PROCESSING FUNCTION
# ============================================================================

process_worktree() {
  local worktree_dir="$1"
  local name=$(get_worktree_name "$worktree_dir")

  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "Processing: $name"
  echo "Path: $worktree_dir"
  echo "════════════════════════════════════════════════════════════════"

  # Initialize state
  WORKTREE_PATHS[$name]=$worktree_dir
  OVERALL_STATUS[$name]="success"
  CONFLICTS_PRESENT[$name]=false

  # Phase 1: Configuration
  echo ""
  echo "Phase 1: Configuration Validation & Fixing"
  fix_config_toml "$worktree_dir" "$name"
  fix_env_local "$worktree_dir" "$name"
  fix_skip_worktree "$worktree_dir" "$name"
  echo "  ${CONFIG_MESSAGES[$name]}"

  # Phase 2: Git State
  echo ""
  echo "Phase 2: Git State Management"
  local current_branch=$(git -C "$worktree_dir" rev-parse --abbrev-ref HEAD 2>/dev/null)
  echo "  Current branch: $current_branch"
  safe_stash "$worktree_dir" "$current_branch"
  if [ -n "${STASH_REFS[$name]:-}" ]; then
    echo "  Stashed uncommitted changes"
  fi

  # Phase 3: Branch Operations
  echo ""
  echo "Phase 3: Branch Operations"
  safe_merge_main "$worktree_dir" "$current_branch"
  echo "  ${MERGE_MESSAGES[$name]:-Merge status unknown}"

  # Phase 4: Stash Reapplication
  if [ -n "${STASH_REFS[$name]:-}" ] && [ "${CONFLICTS_PRESENT[$name]}" = false ]; then
    echo ""
    echo "Phase 4: Stash Reapplication"
    safe_stash_pop "$worktree_dir"
    if [ "${CONFLICTS_PRESENT[$name]}" = false ]; then
      echo "  Stash popped successfully"
    else
      echo "  Stash pop conflicts - left in conflicted state"
    fi
  fi

  # Phase 5: Dependency & Database Sync
  if [ "${CONFLICTS_PRESENT[$name]}" = false ]; then
    echo ""
    echo "Phase 5: Dependency & Database Sync"
    run_npm_install "$worktree_dir"
    restart_supabase "$worktree_dir"
    regenerate_test_schema "$worktree_dir"
  else
    echo ""
    echo "Phase 5: Skipped (conflicts present)"
  fi
}

# ============================================================================
# SUMMARY REPORT
# ============================================================================

generate_report() {
  echo ""
  echo "===================================================================="
  echo "🔄 PinPoint Worktree Sync Report"
  echo "===================================================================="
  echo ""
  echo "Execution: $(date '+%Y-%m-%d %H:%M:%S')"

  local mode="NORMAL"
  [ "$DRY_RUN" = true ] && mode="DRY-RUN"
  local interactive="Interactive"
  [ "$NON_INTERACTIVE" = true ] && interactive="Non-interactive (-y)"
  echo "Mode: $mode | $interactive"

  local scope="Current worktree only"
  [ "$PROCESS_ALL" = true ] && scope="All worktrees (-a)"
  echo "Scope: $scope"

  echo "Worktrees: ${#WORKTREE_PATHS[@]} processed"
  echo ""
  echo "────────────────────────────────────────────────────────────────────"
  echo "📊 OVERALL SUMMARY"
  echo "────────────────────────────────────────────────────────────────────"

  local success_count=0
  local warning_count=0
  local error_count=0

  for name in "${!OVERALL_STATUS[@]}"; do
    case "${OVERALL_STATUS[$name]}" in
      success) success_count=$((success_count + 1)) ;;
      warning) warning_count=$((warning_count + 1)) ;;
      error) error_count=$((error_count + 1)) ;;
    esac
  done

  echo ""
  echo "✅ Success:  $success_count worktree(s)"
  echo "⚠️  Warnings: $warning_count worktree(s)"
  echo "❌ Errors:   $error_count worktree(s)"

  echo ""
  echo "────────────────────────────────────────────────────────────────────"
  echo "📋 WORKTREE DETAILS"
  echo "────────────────────────────────────────────────────────────────────"

  for name in "${!WORKTREE_PATHS[@]}"; do
    compute_status_summary "${WORKTREE_PATHS[$name]}"
    echo ""
    local status_icon="✅"
    case "${OVERALL_STATUS[$name]}" in
      warning) status_icon="⚠️ " ;;
      error) status_icon="❌" ;;
    esac

    echo "$status_icon $name (${OVERALL_STATUS[$name]^^})"
    echo "   Path: ${WORKTREE_PATHS[$name]}"
    echo "   Config: ${CONFIG_MESSAGES[$name]:-Unknown}"
    echo "   Merge: ${MERGE_MESSAGES[$name]:-Unknown}"
    echo "   Status: ${STATUS_SUMMARY[$name]:-unknown}"

    if [ "${CONFLICTS_PRESENT[$name]}" = true ]; then
      echo "   ⚠️  CONFLICTS PRESENT - See recovery section below"
    fi
  done

  # Recovery section
  local has_recovery=false
  for name in "${!RECOVERY_COMMANDS[@]}"; do
    if [ -n "${RECOVERY_COMMANDS[$name]:-}" ]; then
      has_recovery=true
      break
    fi
  done

  if [ "$has_recovery" = true ]; then
    echo ""
    echo "────────────────────────────────────────────────────────────────────"
    echo "🔧 RECOVERY ACTIONS NEEDED"
    echo "────────────────────────────────────────────────────────────────────"

    for name in "${!RECOVERY_COMMANDS[@]}"; do
      if [ -n "${RECOVERY_COMMANDS[$name]:-}" ]; then
        echo ""
        echo "$name:"
        echo -e "${RECOVERY_COMMANDS[$name]}"
      fi
    done
  fi

  # Supabase restart notices
  local needs_supabase_notice=false
  for name in "${!SUPABASE_RESTARTED[@]}"; do
    if [ "${SUPABASE_RESTARTED[$name]}" = true ]; then
      needs_supabase_notice=true
      break
    fi
  done

  if [ "$needs_supabase_notice" = true ]; then
    echo ""
    echo "────────────────────────────────────────────────────────────────────"
    echo "📝 NEXT STEPS"
    echo "────────────────────────────────────────────────────────────────────"
    echo ""
    echo "For worktrees with restarted Supabase:"
    echo "  1. Copy new Supabase keys to .env.local (from 'supabase status')"
    echo "  2. Test: npm run dev"
    echo "  3. Verify correct ports in browser"
  fi

  echo ""
  echo "===================================================================="
}

# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

main() {
  # Parse arguments
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        shift
        ;;
      -y)
        NON_INTERACTIVE=true
        shift
        ;;
      -a|--all)
        PROCESS_ALL=true
        shift
        ;;
      -p|--path)
        if [ -z "${2:-}" ]; then
          echo "Error: --path requires a directory argument"
          exit 1
        fi
        WORKTREES_SELECTED+=("$(cd "$2" && pwd)")
        shift 2
        ;;
      --help)
        print_usage
        exit 0
        ;;
      *)
        if [[ "$1" == -* ]]; then
          echo "Unknown option: $1"
          print_usage
          exit 1
        fi
        WORKTREES_SELECTED+=("$(cd "$1" && pwd)")
        shift
        ;;
    esac
  done

  echo "🔄 PinPoint Worktree Sync"
  echo ""

  # Resolve main worktree path (used for skip-worktree handling)
  MAIN_WORKTREE_PATH=$(git worktree list | awk '$3=="[main]" {print $1}' | head -n 1 || true)

  # ============================================================================
  # PRE-FLIGHT CHECKS
  # ============================================================================

  print_status info "Running pre-flight checks..."

  # 1. Check if Supabase instances are running - must be stopped manually
  print_status info "Checking for running Supabase instances..."
  if [ "$DRY_RUN" = false ]; then
    local running_instances=$(docker ps --filter "name=supabase_" --format "{{.Names}}" 2>/dev/null)
    if [ -n "$running_instances" ]; then
      print_status error "Running Supabase instances detected!"
      echo ""
      echo "The following Supabase containers are running:"
      echo "$running_instances"
      echo ""
      echo "These must be stopped before syncing to avoid port conflicts."
      echo ""
      echo "To fix:"
      echo "  supabase stop --all"
      echo ""
      echo "Then re-run this script."
      exit 1
    fi
    print_status success "No Supabase instances running"
  else
    echo "[DRY-RUN] Would check for running Supabase instances"
  fi

  # 2. Check for legacy Docker volumes - must be removed manually
  if command -v docker &>/dev/null; then
    local legacy_volumes=$(docker volume ls --filter label=com.supabase.cli.project=pinpoint-v2 --format '{{.Name}}' 2>/dev/null)
    if [ -n "$legacy_volumes" ]; then
      print_status warning "Found legacy pinpoint-v2 Docker volumes!"
      echo ""
      echo "The following legacy volumes exist:"
      echo "$legacy_volumes"
      echo ""
      echo "These should be removed to avoid conflicts with 'pinpoint' project."
      echo ""
      echo "To fix:"
      echo "  docker volume rm $legacy_volumes"
      echo ""
      if [ "$DRY_RUN" = false ]; then
        if ! prompt_with_timeout "Continue anyway? (y/N):" "N" 10; then
          echo "Aborting. Remove volumes and re-run."
          exit 1
        fi
      fi
    fi
  fi

  # 3. Check if main worktree needs updating
  local main_worktree=$(git worktree list | grep " \[main\]" | awk '{print $1}')
  if [ -n "$main_worktree" ] && [ -d "$main_worktree" ]; then
    print_status info "Checking main worktree status..."
    if [ "$DRY_RUN" = true ]; then
      echo "[DRY-RUN] Would check if main is behind origin"
    else
      git -C "$main_worktree" fetch origin >/dev/null 2>&1
      local behind_count=$(git -C "$main_worktree" rev-list --count HEAD..origin/main 2>/dev/null || echo "0")
      if [ "$behind_count" -gt 0 ]; then
        print_status error "Main worktree is $behind_count commits behind origin/main!"
        echo ""
        echo "Main must be up-to-date before syncing other worktrees."
        echo ""
        echo "To fix:"
        echo "  cd $main_worktree"
        echo "  git pull origin main"
        echo ""
        echo "Then re-run this script."
        exit 1
      fi
      print_status success "Main worktree is up to date"
    fi
  fi

  echo ""

  # Determine which worktrees to process
  local worktrees_to_process=()

  if [ "$PROCESS_ALL" = true ]; then
    # Process all worktrees
    while IFS= read -r line; do
      local path=$(echo "$line" | awk '{print $1}')
      worktrees_to_process+=("$path")
    done < <(git worktree list | tail -n +1)
  elif [ "${#WORKTREES_SELECTED[@]}" -gt 0 ]; then
    # Process only the first explicitly provided worktree
    local path="${WORKTREES_SELECTED[0]}"
    if [ ! -d "$path" ]; then
      echo "Error: Worktree path not found: $path"
      exit 1
    fi
    if ! git -C "$path" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
      echo "Error: Not a git worktree: $path"
      exit 1
    fi
    worktrees_to_process+=("$path")
    if [ "${#WORKTREES_SELECTED[@]}" -gt 1 ]; then
      echo "Note: Multiple paths provided; processing only the first (${path}). Re-run for others."
    fi
  else
    # Process current worktree only
    local current_worktree=$(git rev-parse --show-toplevel 2>/dev/null)
    if [ -z "$current_worktree" ]; then
      echo "Error: Not in a git repository"
      exit 1
    fi
    worktrees_to_process=("$current_worktree")
  fi

  # Process each worktree
  for worktree_dir in "${worktrees_to_process[@]}"; do
    process_worktree "$worktree_dir"
  done

  # Generate report
  generate_report
}

# Run main
main "$@"
