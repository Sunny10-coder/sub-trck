// Builds a real .xlsx workbook (OOXML in a ZIP "store" container) with one
// worksheet per section. Pure TypeScript with no native dependency, so it can
// run on the phone and in unit tests. Opens in Excel, Google Sheets and Numbers.

import type { JsonRecord, LocalDatabase } from "./local-db";
import { activeRows } from "./local-models";

export type Cell = string | number | boolean | null | undefined;
export type Sheet = { name: string; columns: { header: string; width: number }[]; rows: Cell[][] };

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 forbids most control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");

// Excel limits: 31 chars, none of : \ / ? * [ ]
export function safeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, " ").trim().slice(0, 31) || "Sheet";
}

export function columnLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

// style ids in styles.xml: 0 default, 1 header, 2 body, 3 alternate row
function cellXml(value: Cell, col: number, row: number, style: number): string {
  const ref = `${columnLetter(col)}${row}`;
  if (value == null || value === "") return `<c r="${ref}" s="${style}"/>`;
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${ref}" s="${style}"><v>${value}</v></c>`;
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
}

export function sheetXml(sheet: Sheet): string {
  const cols = sheet.columns
    .map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`)
    .join("");
  const header = `<row r="1" ht="22" customHeight="1">${sheet.columns.map((c, i) => cellXml(c.header, i, 1, 1)).join("")}</row>`;
  const body = sheet.rows
    .map((row, r) => `<row r="${r + 2}">${row.map((v, i) => cellXml(v, i, r + 2, r % 2 ? 3 : 2)).join("")}</row>`)
    .join("");
  const lastCol = columnLetter(Math.max(sheet.columns.length - 1, 0));
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${header}${body}</sheetData><autoFilter ref="A1:${lastCol}${Math.max(sheet.rows.length + 1, 1)}"/></worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF6D5DFB"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF1EEFF"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`;

// ---- minimal ZIP writer (method 0 = stored) ----
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function utf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const u16 = (v: number) => [v & 0xff, (v >>> 8) & 0xff];
const u32 = (v: number) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];

export function zipStore(files: { name: string; data: Uint8Array }[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const push = (arr: Uint8Array) => {
    chunks.push(arr);
    offset += arr.length;
  };

  for (const file of files) {
    const name = utf8(file.name);
    const crc = crc32(file.data);
    const size = file.data.length;
    const localOffset = offset;
    // flags 0x0800 = UTF-8 names; date 0x21 = 1980-01-01 keeps output deterministic
    const common = [...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size), ...u16(name.length), ...u16(0)];
    push(new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...common]));
    push(name);
    push(file.data);
    central.push(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...common, ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(localOffset)]),
      name,
    );
  }
  const centralStart = offset;
  central.forEach(push);
  const centralSize = offset - centralStart;
  push(
    new Uint8Array([
      0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(centralSize), ...u32(centralStart), ...u16(0),
    ]),
  );

  const out = new Uint8Array(offset);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

export function buildXlsx(sheets: Sheet[]): Uint8Array {
  const names = sheets.map((sheet, i) => safeSheetName(sheet.name) || `Sheet${i + 1}`);
  const parts: { name: string; text: string }[] = [
    {
      name: "[Content_Types].xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join("")}</Types>`,
    },
    {
      name: "_rels/.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names
        .map((name, i) => `<sheet name="${escapeXml(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join("")}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    { name: "xl/styles.xml", text: STYLES_XML },
    ...sheets.map((sheet, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, text: sheetXml(sheet) })),
  ];
  return zipStore(parts.map((f) => ({ name: f.name, data: utf8(f.text) })));
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
export function toBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[a >> 2] + B64[((a & 3) << 4) | (b >> 4)];
    out += i + 1 < bytes.length ? B64[((b & 15) << 2) | (c >> 6)] : "=";
    out += i + 2 < bytes.length ? B64[c & 63] : "=";
  }
  return out;
}

// ---------- data -> sheets ----------

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number | null => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v));
const list = (v: unknown): string => (Array.isArray(v) ? v.map(String).join(", ") : s(v));

type ColumnSpec = [header: string, widthChars: number];
const toColumns = (specs: ColumnSpec[]) => specs.map(([header, chars]) => ({ header, width: chars }));

export function monthlyEquivalent(sub: JsonRecord): number | null {
  const price = n(sub.price);
  if (price == null) return null;
  const cycle = s(sub.billing_cycle).toLowerCase();
  const monthly = cycle === "yearly" ? price / 12 : cycle === "weekly" ? price * 4.33 : price;
  return Math.round(monthly * 100) / 100;
}

export function subscriptionsSheet(db: LocalDatabase): Sheet {
  const rows = activeRows(db.subscriptions).map((r) => [
    s(r.provider), s(r.product), s(r.plan), s(r.category), s(r.status), n(r.price), s(r.currency),
    s(r.billing_cycle), monthlyEquivalent(r), s(r.start_date), s(r.renewal_date), s(r.trial_end),
    s(r.promo_applied), s(r.account_email), s(r.card_last4), list(r.tags), s(r.notes),
  ]);
  return {
    name: "Subscriptions",
    columns: toColumns([
      ["Provider", 22], ["Product", 22], ["Plan", 18], ["Category", 14], ["Status", 11], ["Price", 10], ["Currency", 9],
      ["Billing cycle", 12], ["Monthly equiv.", 14], ["Start date", 12], ["Renewal / expiry", 16], ["Trial end", 12],
      ["Promo code", 14], ["Account email", 26], ["Card last 4", 11], ["Tags", 22], ["Notes", 36],
    ]),
    rows,
  };
}

export function plansSheet(db: LocalDatabase): Sheet {
  const rows = activeRows(db.watchlist).map((r) => [
    s(r.provider), s(r.plan), n(r.price), s(r.currency), s(r.billing_cycle), s(r.status), s(r.offer_expiry),
    s(r.url), list(r.tags), s(r.notes), s(r.created_at).slice(0, 10),
  ]);
  return {
    name: "Plans (Watchlist)",
    columns: toColumns([
      ["Provider", 22], ["Plan", 20], ["Price", 10], ["Currency", 9], ["Billing cycle", 12], ["Status", 11],
      ["Offer expiry", 13], ["URL", 34], ["Tags", 22], ["Notes", 36], ["Added", 12],
    ]),
    rows,
  };
}

export function accountsSheet(db: LocalDatabase): Sheet {
  const rows = activeRows(db.accounts || []).map((r) => [
    s(r.service_name), s(r.account_type), s(r.category), s(r.platform_usage), s(r.allowed_credits), s(r.email_used),
    s(r.username), s(r.phone_used), s(r.auth_method), r.has_2fa ? "Yes" : "No", s(r.registration_date),
    s(r.cancelled_on), s(r.previous_plan), n(r.previous_price), s(r.service_url), list(r.tags), s(r.notes),
  ]);
  return {
    name: "Accounts",
    columns: toColumns([
      ["Service", 22], ["Type", 11], ["Category", 14], ["Used for", 24], ["Credits / quota", 18], ["Email", 26],
      ["Username", 16], ["Phone", 14], ["Login method", 12], ["2FA", 6], ["Registered", 12],
      ["Cancelled on", 12], ["Previous plan", 16], ["Previous price", 14], ["URL", 32], ["Tags", 22], ["Notes", 36],
    ]),
    rows,
  };
}

export function promosSheet(db: LocalDatabase): Sheet {
  const rows = activeRows(db.promos).map((r) => [
    s(r.service), s(r.code), s(r.discount), s(r.expiry_date), r.used ? "Yes" : "No", s(r.source), s(r.notes),
  ]);
  return {
    name: "Promo codes",
    columns: toColumns([
      ["Service", 22], ["Code", 16], ["Discount", 16], ["Expires", 12], ["Used", 7], ["Source", 16], ["Notes", 36],
    ]),
    rows,
  };
}

export type ExportScope = "plans" | "accounts" | "all";

export function buildExport(db: LocalDatabase, scope: ExportScope): { bytes: Uint8Array; filename: string } {
  const sheets =
    scope === "plans"
      ? [subscriptionsSheet(db), plansSheet(db), promosSheet(db)]
      : scope === "accounts"
      ? [accountsSheet(db)]
      : [subscriptionsSheet(db), plansSheet(db), accountsSheet(db), promosSheet(db)];
  const stamp = new Date().toISOString().slice(0, 10);
  const label = scope === "plans" ? "Plans" : scope === "accounts" ? "Accounts" : "Plans_Accounts";
  return { bytes: buildXlsx(sheets), filename: `SubMind_${label}_${stamp}.xlsx` };
}
