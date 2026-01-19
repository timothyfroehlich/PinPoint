#!/bin/bash
set -euo pipefail

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Error: supabase CLI is not installed."
    exit 1
fi

# Check if supabase is running by checking the status
# We redirect both stdout and stderr because 'supabase status' can be noisy 
# or report errors when stopped.
if ! supabase status &> /dev/null; then
    echo "Supabase is not running. Starting..."
    if ! supabase start; then
        echo "Error: Failed to start Supabase."
        exit 1
    fi
else
    echo "Supabase is already running."
fi
