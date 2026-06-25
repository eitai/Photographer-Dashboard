// Shared CSV export helper.
// Builds a UTF-8 CSV (with BOM so Hebrew opens correctly in Excel) and triggers
// a browser download. Used by every report screen (orders / supplier / billing).

type Cell = string | number | null | undefined;

const escapeCell = (v: Cell): string => `"${String(v ?? '').replace(/"/g, '""')}"`;

/**
 * Download `rows` as a CSV file.
 * @param filenameBase  file name without extension; the date is appended automatically
 * @param headers       column headers (already localized)
 * @param rows          data rows (array of cell arrays)
 * @param summaryRow    optional final row (e.g. totals); rendered as-is
 */
export function downloadCsv(
  filenameBase: string,
  headers: Cell[],
  rows: Cell[][],
  summaryRow?: Cell[],
): void {
  const allRows = summaryRow ? [headers, ...rows, summaryRow] : [headers, ...rows];
  const csv = allRows.map((r) => r.map(escapeCell).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filenameBase}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
