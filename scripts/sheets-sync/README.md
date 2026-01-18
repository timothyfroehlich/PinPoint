# PinPoint Google Sheets Sync Setup

This script allows two-way synchronization between the APC Maintenance Spreadsheet and the PinPoint database.

## Prerequisites

1. **Google Service Account**:
   - Go to the [Google Cloud Console](https://console.cloud.google.com/).
   - Create a new project (or use an existing one).
   - Enable the **Google Sheets API**.
   - Create a **Service Account** under "IAM & Admin" > "Service Accounts".
   - Create and download a **JSON Key** for the service account.
   - Rename this file to `credentials.json` and place it in `scripts/sheets-sync/`.

2. **Spreadsheet Access**:
   - Open your copy of the spreadsheet.
   - Click "Share".
   - Add the service account's email address (found in your `credentials.json`) with "Editor" access.

## Usage

### Dry Run (Recommended)

This will fetch data and show what changes would be made without modifying anything.

```bash
npx tsx scripts/sheets-sync/sync.ts
```

### Execute Sync

This will apply changes to both the sheet and the database.

```bash
npx tsx scripts/sheets-sync/sync.ts --execute
```

## How it works

1. **New Issues**: Rows in the sheet without a "PinPoint" ID are treated as new issues and created in the database.
2. **Existing Issues**: Matched using the UUID in the "PinPoint" column.
3. **Conflicts**: If both the sheet and database have changed since the last sync, the script will bail out for that row and ask for manual resolution.
4. **New Machines**: If a game name in the sheet doesn't match a machine initials in PinPoint, the script will skip it and notify you to create the machine first.
