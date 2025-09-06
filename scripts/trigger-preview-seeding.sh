#!/bin/bash

# =============================================================================
# Trigger Preview Environment Seeding via GitHub Actions
# =============================================================================
# This script triggers the GitHub Actions workflow to seed the Preview environment
# database with development users and memberships. This is designed to be run
# after `npm run db:reset:preview` to complete the seeding process securely.
#
# Usage:
#   ./scripts/trigger-preview-seeding.sh [--wait]
#
# Options:
#   --wait    Wait for the workflow to complete and show results
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}" >&2
}

# Check for required tools
check_dependencies() {
    if ! command -v gh >/dev/null 2>&1; then
        log_error "GitHub CLI (gh) is required but not installed"
        log_error "Install it with: brew install gh"
        log_error "Then authenticate with: gh auth login"
        exit 1
    fi

    # Check if authenticated
    if ! gh auth status >/dev/null 2>&1; then
        log_error "GitHub CLI is not authenticated"
        log_error "Run: gh auth login"
        exit 1
    fi

    log_success "GitHub CLI is available and authenticated"
}

# Trigger the workflow
trigger_workflow() {
    local wait_flag="$1"
    
    log_info "Triggering Preview Environment Seeding workflow..."
    
    local workflow_cmd="gh workflow run preview-seed.yml --field environment=preview"
    
    # Trigger the workflow
    if $workflow_cmd; then
        log_success "Workflow triggered successfully"
        
        if [[ "$wait_flag" == "true" ]]; then
            # Give GitHub a moment to register the run
            sleep 2
            wait_for_workflow_completion
        else
            log_info "Workflow running in background"
            log_info "Check status with: gh run list --workflow=preview-seed.yml"
            log_info "View logs with: gh run view --log"
        fi
    else
        log_error "Failed to trigger workflow"
        exit 1
    fi
}

# Wait for workflow completion and show results
wait_for_workflow_completion() {
    log_info "Waiting for workflow to complete..."
    
    # Get the most recent workflow run
    local run_id
    run_id=$(gh run list --workflow=preview-seed.yml --limit=1 --json databaseId --jq '.[0].databaseId')
    
    if [[ -z "$run_id" ]]; then
        log_error "Could not find workflow run ID"
        return 1
    fi
    
    log_info "Monitoring workflow run: $run_id"
    
    # Wait for completion with timeout
    local timeout=300  # 5 minutes
    local elapsed=0
    local check_interval=10
    
    while [[ $elapsed -lt $timeout ]]; do
        local status
        status=$(gh run view "$run_id" --json status --jq '.status')
        
        case "$status" in
            "completed")
                local conclusion
                conclusion=$(gh run view "$run_id" --json conclusion --jq '.conclusion')
                
                if [[ "$conclusion" == "success" ]]; then
                    log_success "Workflow completed successfully!"
                    log_info "View details with: gh run view $run_id"
                    return 0
                else
                    log_error "Workflow failed with conclusion: $conclusion"
                    log_error "View logs with: gh run view $run_id --log"
                    return 1
                fi
                ;;
            "in_progress"|"queued")
                echo -n "."
                ;;
            *)
                log_error "Unexpected workflow status: $status"
                return 1
                ;;
        esac
        
        sleep $check_interval
        ((elapsed += check_interval))
    done
    
    log_error "Workflow did not complete within ${timeout} seconds"
    return 1
}

# Main function
main() {
    echo -e "${GREEN}"
    echo "======================================================================"
    echo "🌱 Preview Environment Seeding Trigger"
    echo "======================================================================"
    echo -e "${NC}"
    
    local wait_flag="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --wait)
                wait_flag="true"
                shift
                ;;
            *)
                log_error "Unknown option: $1"
                log_error "Usage: $0 [--wait]"
                exit 1
                ;;
        esac
    done
    
    check_dependencies
    trigger_workflow "$wait_flag"
    
    echo -e "\n${GREEN}"
    echo "======================================================================"
    echo "✅ Preview seeding trigger completed"
    echo "======================================================================"
    echo -e "${NC}"
}

# Error handling
trap 'log_error "Script failed at line $LINENO"' ERR

# Execute main function
main "$@"
