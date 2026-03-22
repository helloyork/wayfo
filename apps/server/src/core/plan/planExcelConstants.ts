/** Reserved Plan column ids (row 2). Row 1 is display only. */
export const PLAN_BASE_FIELD_IDS = new Set([
  "amazonUrl",
  "sku",
  "partNumber",
  "upc",
  "planDate"
]);

export const PLAN_BASE_COLUMNS: Array<{ fieldId: string; displayName: string; width: number }> = [
  { fieldId: "amazonUrl", displayName: "产品链接", width: 50 },
  { fieldId: "sku", displayName: "SKU", width: 20 },
  { fieldId: "partNumber", displayName: "Part Number", width: 26 },
  { fieldId: "upc", displayName: "UPC", width: 18 },
  { fieldId: "planDate", displayName: "时间", width: 18 }
];

export const PLAN_REQUIRED_FIELD_IDS = ["amazonUrl", "sku", "partNumber", "planDate"] as const;

/** Hard cap so we do not scan huge sparse sheets forever. */
export const PLAN_MAX_COLUMNS_SCAN = 512;
