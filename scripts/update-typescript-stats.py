#!/usr/bin/env python3
"""
Script to update TypeScript migration statistics in TYPESCRIPT_MIGRATION.md
Usage: python scripts/update-typescript-stats.py
"""

import subprocess
import re
import json
from datetime import datetime
from pathlib import Path


def run_command(cmd: str) -> str:
    """Run a shell command and return its output."""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        return result.stdout + result.stderr
    except Exception as e:
        print(f"Error running command '{cmd}': {e}")
        return ""


def extract_ts_errors() -> int:
    """Get TypeScript error count."""
    print("Running typecheck... ", end="", flush=True)
    output = run_command("npm run typecheck")
    
    # Try to find "Found X errors" summary
    error_match = re.search(r"Found (\d+) error", output)
    if error_match:
        count = int(error_match.group(1))
    else:
        # Count individual error lines
        error_lines = re.findall(r"error TS\d+:", output)
        count = len(error_lines)
    
    print(f"✓ Found {count} TypeScript errors")
    return count


def extract_eslint_warnings() -> tuple[int, int]:
    """Get ESLint warning counts (total, type-safety)."""
    print("Running lint check... ", end="", flush=True)
    output = run_command("npm run lint")
    
    # Extract total warnings
    warning_match = re.search(r"(\d+) warning", output)
    total_warnings = int(warning_match.group(1)) if warning_match else 0
    
    # Count type-safety specific warnings
    type_safety_patterns = [
        "@typescript-eslint/no-unsafe-",
        "@typescript-eslint/no-explicit-any",
        "@typescript-eslint/explicit-function-return-type"
    ]
    type_warnings = sum(output.count(pattern) for pattern in type_safety_patterns)
    
    print(f"✓ Found {total_warnings} total warnings ({type_warnings} type-safety)")
    return total_warnings, type_warnings


def count_any_usage() -> int:
    """Count instances of 'any' type usage."""
    print("Counting 'any' usage... ", end="", flush=True)
    
    patterns = [r":\s*any", r"as\s+any", r"<any>", r"any\[\]"]
    any_count = 0
    
    src_path = Path("src")
    if src_path.exists():
        for ts_file in src_path.rglob("*.ts"):
            if "node_modules" in str(ts_file):
                continue
            try:
                content = ts_file.read_text()
                # Skip lines with eslint-disable
                for line in content.split('\n'):
                    if "eslint-disable.*no-explicit-any" not in line:
                        for pattern in patterns:
                            any_count += len(re.findall(pattern, line))
            except Exception:
                continue
    
    print(f"✓ Found {any_count} instances of 'any'")
    return any_count


def get_git_info() -> tuple[str, str]:
    """Get current date and git commit."""
    current_date = datetime.now().strftime("%Y-%m-%d")
    commit_output = run_command("git rev-parse --short HEAD")
    current_commit = commit_output.strip()
    return current_date, current_commit


def update_markdown_file(ts_errors: int, total_warnings: int, type_warnings: int, any_count: int):
    """Update TYPESCRIPT_MIGRATION.md with new statistics."""
    migration_file = Path("TYPESCRIPT_MIGRATION.md")
    if not migration_file.exists():
        print("Error: TYPESCRIPT_MIGRATION.md not found")
        return
    
    print("\n📝 Updating TYPESCRIPT_MIGRATION.md...")
    
    content = migration_file.read_text()
    current_date, current_commit = get_git_info()
    
    # Update Last Updated
    content = re.sub(
        r"\*\*Last Updated\*\*:.*",
        f"**Last Updated**: {current_date}",
        content
    )
    
    # Update Error Counts table
    updates = [
        (r"\| TypeScript Errors\s+\|.*\|.*\|", f"| TypeScript Errors       | {ts_errors}     | 0      | {'✅ COMPLETE' if ts_errors == 0 else f'↓ Progress'} |"),
        (r"\| ESLint Warnings \(Total\)\s+\|.*\|.*\|", f"| ESLint Warnings (Total) | {total_warnings}     | 0      | {'✅ COMPLETE' if total_warnings == 0 else 'In progress'} |"),
        (r"\| Type-Safety Warnings\s+\|.*\|.*\|", f"| Type-Safety Warnings    | {type_warnings}   | 0      | {'✅ COMPLETE' if type_warnings == 0 else 'In progress'} |"),
        (r"\| 'any' Usage\s+\|.*\|.*\|", f"| 'any' Usage             | {any_count}    | 0      | {'✅ COMPLETE' if any_count == 0 else 'In progress'} |"),
    ]
    
    for pattern, replacement in updates:
        content = re.sub(pattern, replacement, content)
    
    # Add history entry if TypeScript errors changed
    history_pattern = r"\| (\d{4}-\d{2}-\d{2}) \| \w+ \| (\d+) \|"
    history_matches = re.findall(history_pattern, content)
    
    if history_matches:
        last_ts_count = int(history_matches[0][1])  # Most recent entry
        if ts_errors != last_ts_count:
            print("Adding new history entry...")
            # Find the history table header and add new row after it
            history_header = r"(\| Date.*\| Commit.*\| TS Errors.*\| ESLint Warnings.*\| 'any' Count.*\| Notes.*\|\n\| [-\s\|]+ \|)"
            new_row = f"| {current_date} | {current_commit} | {ts_errors} | {total_warnings} ({type_warnings} type) | {any_count} | Auto-updated |"
            content = re.sub(
                history_header,
                rf"\1\n{new_row}",
                content
            )
    
    # Write updated content
    migration_file.write_text(content)
    print("✅ Update complete!")


def main():
    """Main function to gather stats and update markdown."""
    print("📊 Gathering TypeScript migration statistics...")
    
    ts_errors = extract_ts_errors()
    total_warnings, type_warnings = extract_eslint_warnings()
    any_count = count_any_usage()
    
    update_markdown_file(ts_errors, total_warnings, type_warnings, any_count)
    
    print(f"\nSummary:")
    print(f"  TypeScript Errors: {ts_errors}")
    print(f"  ESLint Warnings: {total_warnings} ({type_warnings} type-safety)")
    print(f"  'any' Usage: {any_count}")
    
    # Show progress message
    if ts_errors == 0 and total_warnings == 0 and any_count == 0:
        print("\n🎉 Congratulations! Full TypeScript strict compliance achieved! 🎉")
    elif ts_errors < 50:
        print("\n📈 Great progress! Almost there...")
    else:
        print("\n💪 Keep going! Every error fixed is progress!")


if __name__ == "__main__":
    main()