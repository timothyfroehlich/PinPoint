import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { type SheetRow } from "./types";
import { parseSheetRow } from "./field-mappings";
import fs from "node:fs/promises";

export class SheetsClient {
  private doc!: GoogleSpreadsheet;

  constructor(spreadsheetId: string, credentialsPath: string) {
    this.spreadsheetId = spreadsheetId;
    this.credentialsPath = credentialsPath;
  }

  private spreadsheetId: string;
  private credentialsPath: string;

  async load() {
    const credsRaw = await fs.readFile(this.credentialsPath, "utf-8");
    const creds = JSON.parse(credsRaw) as {
      client_email: string;
      private_key: string;
    };
    const auth = new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.doc = new GoogleSpreadsheet(this.spreadsheetId, auth);
    await this.doc.loadInfo();
  }

  async getRows(sheetName: string): Promise<SheetRow[]> {
    const sheet = this.doc.sheetsByTitle[sheetName];
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found`);

    const rows = await sheet.getRows();
    return rows.map((row, index) => parseSheetRow(row.toObject(), index + 2)); // +2 for 1-based index and header
  }

  async updatePinPointId(
    sheetName: string,
    rowIndex: number,
    pinpointId: string
  ): Promise<void> {
    const sheet = this.doc.sheetsByTitle[sheetName];
    if (!sheet) return;

    const rows = await sheet.getRows({ offset: rowIndex - 2, limit: 1 });
    if (rows[0]) {
      rows[0].set("PinPoint", pinpointId);
      await rows[0].save();
    }
  }
}
