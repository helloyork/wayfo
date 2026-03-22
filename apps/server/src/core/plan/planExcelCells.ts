import {
  PLAN_BASE_COLUMNS,
  PLAN_MAX_COLUMNS_SCAN,
  PLAN_REQUIRED_FIELD_IDS
} from "./planExcelConstants";

type ExcelCellLike = {
  text?: string;
  value?: unknown;
};

/**
 * Read display / id from Excel cells: prefers ExcelJS computed text, then rich text,
 * then formula result, then primitive value.
 */
export function readPlanExcelCellText(cell: ExcelCellLike): string {
  const directText = cell.text?.trim();
  if (directText) {
    return directText;
  }
  const v = cell.value;
  if (v === null || v === undefined) {
    return "";
  }
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v).trim();
  }
  if (typeof v === "object") {
    const rich = v as { richText?: Array<{ text?: string }> };
    if (Array.isArray(rich.richText) && rich.richText.length > 0) {
      return rich.richText.map((p) => p.text ?? "").join("").trim();
    }
    const formula = v as { result?: unknown };
    if ("result" in formula && formula.result !== undefined && formula.result !== null) {
      const r = formula.result;
      if (typeof r === "string" || typeof r === "number" || typeof r === "boolean") {
        return String(r).trim();
      }
    }
  }
  return String(v).trim();
}

type ExcelRowLike = {
  eachCell: (
    opt: { includeEmpty: boolean },
    cb: (cell: ExcelCellLike, colNumber: number) => void
  ) => void;
  getCell(col: number): ExcelCellLike;
};

type ExcelSheetLike = {
  columnCount?: number;
  getRow(rowNumber: number): ExcelRowLike;
};

/** Max column index (1-based) that has any non-empty cell in the given rows. */
export function getPlanSheetMaxUsedColumn(sheet: ExcelSheetLike, rowNumbers: number[]): number {
  let max = 0;
  for (const rowNumber of rowNumbers) {
    const row = sheet.getRow(rowNumber);
    row.eachCell({ includeEmpty: false }, (_cell: ExcelCellLike, colNumber: number) => {
      if (colNumber > max) {
        max = colNumber;
      }
    });
  }
  return max;
}

/**
 * Build fieldId -> column index from row 2. Scans all columns that appear used in row 1 or 2
 * so sparse / wide sheets still resolve questionId columns.
 */
export function parsePlanFieldIdRow(sheet: ExcelSheetLike): {
  ok: true;
  colByFieldId: Map<string, number>;
} | {
  ok: false;
  error: string;
} {
  const usedMax = getPlanSheetMaxUsedColumn(sheet, [1, 2]);
  const maxCol = Math.min(
    Math.max(usedMax, sheet.columnCount ?? 0, PLAN_BASE_COLUMNS.length, 1),
    PLAN_MAX_COLUMNS_SCAN
  );

  const idRow = sheet.getRow(2);
  const colByFieldId = new Map<string, number>();
  for (let colNumber = 1; colNumber <= maxCol; colNumber += 1) {
    const id = readPlanExcelCellText(idRow.getCell(colNumber));
    if (id && !colByFieldId.has(id)) {
      colByFieldId.set(id, colNumber);
    }
  }

  const missing = PLAN_REQUIRED_FIELD_IDS.filter((f) => !colByFieldId.has(f));
  if (missing.length > 0) {
    return {
      ok: false,
      error: `第二行缺少字段 id: ${missing.join(", ")}（需要两行表头：第 1 行可读名，第 2 行为 amazonUrl / sku / partNumber / planDate 等）`
    };
  }
  return { ok: true, colByFieldId };
}

/** Multi-value cells in Plan: split on ; or | */
export function splitPlanCellMultiValues(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(/[;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
