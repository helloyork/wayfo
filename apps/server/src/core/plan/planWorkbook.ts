import ExcelJS from "exceljs";

type PlanColumn = { fieldId: string; displayName: string; width: number };

/** Two-row header Plan sheet; returns .xlsx buffer. */
export async function buildPlanTemplateXlsxBuffer(columns: PlanColumn[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "wayfo";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Plan");

  columns.forEach((colDef, idx) => {
    const c = idx + 1;
    sheet.getCell(1, c).value = colDef.displayName;
    sheet.getCell(2, c).value = colDef.fieldId;
    sheet.getColumn(c).width = colDef.width;
  });

  for (const rowIndex of [1, 2]) {
    const row = sheet.getRow(rowIndex);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.alignment = { vertical: "middle", horizontal: "center" };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
    row.height = 22;
  }

  const planDateColIndex = columns.findIndex((c) => c.fieldId === "planDate") + 1;
  if (planDateColIndex > 0) {
    sheet.getColumn(planDateColIndex).numFmt = "mm-dd-yyyy";
  }
  sheet.views = [{ state: "frozen", ySplit: 2 }];

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
