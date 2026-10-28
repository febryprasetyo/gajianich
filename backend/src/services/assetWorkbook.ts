import ExcelJS from 'exceljs';

export const LAPTOP_PC_HEADERS = [
  'Computer Reference',
  'Device Type',
  'Asset Code',
  'Asset Name',
  'Serial Number',
  'Location Code',
  'Employee Code',
  'Employee Name',
  'Assigned Date',
  'Condition',
  'CPU Name',
  'RAM Size (GB)',
  'RAM Slot Count',
  'Disk 1 Size (GB)',
  'Disk 2 Size (GB)',
  'Complaint / Notes',
] as const;

export const OTHER_ASSET_HEADERS = [
  'Equipment Category',
  'Asset Code',
  'Asset Name',
  'Serial Number',
  'Assignment Type',
  'Location Code',
  'Employee Code',
  'Employee Name',
  'Assigned Date',
  'Condition',
  'Complaint / Notes',
] as const;

export const ACCESSORY_HEADERS = [
  'Computer Reference',
  'Accessory Type',
  'Description',
  'Quantity',
  'Condition',
  'Notes',
] as const;

export interface ParsedLaptopPcRow {
  rowNumber: number;
  computerReference: string;
  deviceType: string;
  assetCode?: string | null;
  assetName: string;
  serialNumber?: string | null;
  locationCode?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  assignedDate?: string | null;
  condition: string;
  cpuName?: string | null;
  ramSizeGb?: number | null;
  ramSlotCount?: number | null;
  disk1SizeGb?: number | null;
  disk2SizeGb?: number | null;
  complaintNotes?: string | null;
  raw: Record<string, unknown>;
}

export interface ParsedOtherAssetRow {
  rowNumber: number;
  equipmentCategory: string;
  assetCode?: string | null;
  assetName: string;
  serialNumber?: string | null;
  assignmentType: string;
  locationCode?: string | null;
  employeeCode?: string | null;
  employeeName?: string | null;
  assignedDate?: string | null;
  condition: string;
  complaintNotes?: string | null;
  raw: Record<string, unknown>;
}

export interface ParsedAccessoryRow {
  rowNumber: number;
  computerReference: string;
  accessoryType: string;
  description?: string | null;
  quantity: number;
  condition: string;
  notes?: string | null;
  raw: Record<string, unknown>;
}

export interface ParsedAssetWorkbook {
  laptopPcRows: ParsedLaptopPcRow[];
  otherAssetRows: ParsedOtherAssetRow[];
  accessoryRows: ParsedAccessoryRow[];
}

function formatDateValue(val: unknown): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return trimmed;
  }
  if (typeof val === 'number') {
    // Excel serial date number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

function getScalarString(cell: ExcelJS.Cell, sheetName: string): string | null {
  const val = cell.value;
  if (val === null || val === undefined) return null;

  if (cell.type === ExcelJS.ValueType.Formula || (typeof val === 'object' && val !== null && 'formula' in val)) {
    throw new Error(`Formulas are not permitted in import sheet "${sheetName}" at cell ${cell.address}`);
  }

  if (typeof val === 'object' && val !== null) {
    if ('text' in val && typeof (val as any).text === 'string') {
      const t = (val as any).text.trim();
      return t.length > 0 ? t : null;
    }
    if ('richText' in val && Array.isArray((val as any).richText)) {
      const text = (val as any).richText.map((item: any) => item.text).join('').trim();
      return text.length > 0 ? text : null;
    }
    if (val instanceof Date) {
      return formatDateValue(val);
    }
  }

  const str = String(val).trim();
  return str.length > 0 ? str : null;
}

function getScalarNumber(cell: ExcelJS.Cell, sheetName: string): number | null {
  const val = cell.value;
  if (val === null || val === undefined) return null;

  if (cell.type === ExcelJS.ValueType.Formula || (typeof val === 'object' && val !== null && 'formula' in val)) {
    throw new Error(`Formulas are not permitted in import sheet "${sheetName}" at cell ${cell.address}`);
  }

  if (typeof val === 'number') {
    return isFinite(val) ? val : null;
  }

  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return null;
    const parsed = Number(trimmed);
    return isNaN(parsed) ? null : parsed;
  }

  if (typeof val === 'object' && val !== null && 'text' in val) {
    const parsed = Number(String((val as any).text).trim());
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

export async function buildAssetImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GAJIANICH ITSM';
  workbook.created = new Date();

  // 1. Petunjuk Sheet
  const guideSheet = workbook.addWorksheet('Petunjuk');
  guideSheet.columns = [
    { header: 'No', key: 'no', width: 8 },
    { header: 'Bagian / Sheet', key: 'section', width: 25 },
    { header: 'Penjelasan & Aturan Pengisian', key: 'description', width: 80 },
  ];
  guideSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideSheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };

  guideSheet.addRows([
    { no: 1, section: 'Laptop-PC', description: 'Gunakan sheet ini untuk mendaftarkan aset Komputer / Laptop. Kolom Computer Reference (misal: COMP-01) bersifat unik per komputer dan digunakan pada sheet Accessories untuk menghubungkan aksesoris.' },
    { no: 2, section: 'Laptop-PC (Wajib)', description: 'Computer Reference, Device Type (LAPTOP / PC), Asset Name, dan Condition wajib diisi. Semua kolom spesifikasi hardware bersifat opsional; angka yang diisi harus lebih besar dari 0.' },
    { no: 3, section: 'Laptop-PC (Assignment)', description: 'Isi Employee Code untuk holder resmi HR, atau Employee Name saja untuk holder manual tanpa data HR. Kosongkan keduanya untuk aset yang belum ditugaskan. Assigned Date dan Location Code opsional.' },
    { no: 4, section: 'Other Assets', description: 'Gunakan sheet ini untuk printer, scanner, monitor, proyektor, server, UPS, dll. Untuk Assignment Type EMPLOYEE, isi Employee Code atau Employee Name; nama saja membuat holder manual. SHARED memerlukan Location Code.' },
    { no: 5, section: 'Accessories', description: 'Gunakan sheet ini untuk mendaftarkan aksesoris yang melekat pada laptop/PC (misal: Mouse, Charger, Tas, Docking, Adaptor). Computer Reference harus cocok dengan yang ada di sheet Laptop-PC.' },
    { no: 6, section: 'Ketentuan Umum', description: 'Jangan mengubah nama sheet atau urutan kolom header. Seluruh rumus/formula Excel dilarang dan akan ditolak validator.' },
  ]);

  // Style header helper
  const applyHeaderStyle = (sheet: ExcelJS.Worksheet) => {
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;
  };

  // 2. Laptop-PC Sheet
  const pcSheet = workbook.addWorksheet('Laptop-PC');
  pcSheet.columns = LAPTOP_PC_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: h.length < 15 ? 18 : h.length + 5,
  }));
  applyHeaderStyle(pcSheet);

  // 3. Other Assets Sheet
  const otherSheet = workbook.addWorksheet('Other Assets');
  otherSheet.columns = OTHER_ASSET_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: h.length < 15 ? 18 : h.length + 5,
  }));
  applyHeaderStyle(otherSheet);

  // 4. Accessories Sheet
  const accSheet = workbook.addWorksheet('Accessories');
  accSheet.columns = ACCESSORY_HEADERS.map((h) => ({
    header: h,
    key: h,
    width: h.length < 15 ? 18 : h.length + 5,
  }));
  applyHeaderStyle(accSheet);

  const uint8Array = await workbook.xlsx.writeBuffer();
  return Buffer.from(uint8Array);
}

export async function parseAssetImportWorkbook(buffer: Buffer): Promise<ParsedAssetWorkbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);

  const sheetNames = workbook.worksheets.map((s) => s.name);
  const requiredSheets = ['Petunjuk', 'Laptop-PC', 'Other Assets', 'Accessories'];

  for (const reqSheet of requiredSheets) {
    if (!sheetNames.includes(reqSheet)) {
      throw new Error(`Workbook is missing required sheet: "${reqSheet}". Found sheets: ${sheetNames.join(', ')}`);
    }
  }

  // Validate headers
  const pcSheet = workbook.getWorksheet('Laptop-PC')!;
  const pcHeaderRow = pcSheet.getRow(1);
  for (let i = 0; i < LAPTOP_PC_HEADERS.length; i++) {
    const expected = LAPTOP_PC_HEADERS[i];
    const actual = pcHeaderRow.getCell(i + 1).value;
    if (String(actual ?? '').trim() !== expected) {
      throw new Error(`Invalid header on sheet "Laptop-PC" at column ${i + 1}. Expected "${expected}", got "${actual}"`);
    }
  }

  const otherSheet = workbook.getWorksheet('Other Assets')!;
  const otherHeaderRow = otherSheet.getRow(1);
  for (let i = 0; i < OTHER_ASSET_HEADERS.length; i++) {
    const expected = OTHER_ASSET_HEADERS[i];
    const actual = otherHeaderRow.getCell(i + 1).value;
    if (String(actual ?? '').trim() !== expected) {
      throw new Error(`Invalid header on sheet "Other Assets" at column ${i + 1}. Expected "${expected}", got "${actual}"`);
    }
  }

  const accSheet = workbook.getWorksheet('Accessories')!;
  const accHeaderRow = accSheet.getRow(1);
  for (let i = 0; i < ACCESSORY_HEADERS.length; i++) {
    const expected = ACCESSORY_HEADERS[i];
    const actual = accHeaderRow.getCell(i + 1).value;
    if (String(actual ?? '').trim() !== expected) {
      throw new Error(`Invalid header on sheet "Accessories" at column ${i + 1}. Expected "${expected}", got "${actual}"`);
    }
  }

  // Parse Laptop-PC
  const laptopPcRows: ParsedLaptopPcRow[] = [];
  pcSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    let hasAnyValue = false;
    for (let c = 1; c <= LAPTOP_PC_HEADERS.length; c++) {
      if (row.getCell(c).value !== null && row.getCell(c).value !== undefined && String(row.getCell(c).value).trim() !== '') {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) return;

    const raw: Record<string, unknown> = {};
    for (let c = 1; c <= LAPTOP_PC_HEADERS.length; c++) {
      raw[LAPTOP_PC_HEADERS[c - 1]] = row.getCell(c).value;
    }

    const computerReference = getScalarString(row.getCell(1), 'Laptop-PC') ?? '';
    const deviceType = getScalarString(row.getCell(2), 'Laptop-PC') ?? '';
    const assetCode = getScalarString(row.getCell(3), 'Laptop-PC');
    const assetName = getScalarString(row.getCell(4), 'Laptop-PC') ?? '';
    const serialNumber = getScalarString(row.getCell(5), 'Laptop-PC');
    const locationCode = getScalarString(row.getCell(6), 'Laptop-PC');
    const employeeCode = getScalarString(row.getCell(7), 'Laptop-PC');
    const employeeName = getScalarString(row.getCell(8), 'Laptop-PC');
    const assignedDate = formatDateValue(row.getCell(9).value);
    const condition = getScalarString(row.getCell(10), 'Laptop-PC') ?? 'Good';
    const cpuName = getScalarString(row.getCell(11), 'Laptop-PC');
    const ramSizeGb = getScalarNumber(row.getCell(12), 'Laptop-PC');
    const ramSlotCount = getScalarNumber(row.getCell(13), 'Laptop-PC');
    const disk1SizeGb = getScalarNumber(row.getCell(14), 'Laptop-PC');
    const disk2SizeGb = getScalarNumber(row.getCell(15), 'Laptop-PC');
    const complaintNotes = getScalarString(row.getCell(16), 'Laptop-PC');

    laptopPcRows.push({
      rowNumber,
      computerReference,
      deviceType,
      assetCode,
      assetName,
      serialNumber,
      locationCode,
      employeeCode,
      employeeName,
      assignedDate,
      condition,
      cpuName,
      ramSizeGb,
      ramSlotCount,
      disk1SizeGb,
      disk2SizeGb,
      complaintNotes,
      raw,
    });
  });

  // Parse Other Assets
  const otherAssetRows: ParsedOtherAssetRow[] = [];
  otherSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    let hasAnyValue = false;
    for (let c = 1; c <= OTHER_ASSET_HEADERS.length; c++) {
      if (row.getCell(c).value !== null && row.getCell(c).value !== undefined && String(row.getCell(c).value).trim() !== '') {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) return;

    const raw: Record<string, unknown> = {};
    for (let c = 1; c <= OTHER_ASSET_HEADERS.length; c++) {
      raw[OTHER_ASSET_HEADERS[c - 1]] = row.getCell(c).value;
    }

    const equipmentCategory = getScalarString(row.getCell(1), 'Other Assets') ?? '';
    const assetCode = getScalarString(row.getCell(2), 'Other Assets');
    const assetName = getScalarString(row.getCell(3), 'Other Assets') ?? '';
    const serialNumber = getScalarString(row.getCell(4), 'Other Assets');
    const assignmentType = getScalarString(row.getCell(5), 'Other Assets') ?? '';
    const locationCode = getScalarString(row.getCell(6), 'Other Assets');
    const employeeCode = getScalarString(row.getCell(7), 'Other Assets');
    const employeeName = getScalarString(row.getCell(8), 'Other Assets');
    const assignedDate = formatDateValue(row.getCell(9).value);
    const condition = getScalarString(row.getCell(10), 'Other Assets') ?? 'Good';
    const complaintNotes = getScalarString(row.getCell(11), 'Other Assets');

    otherAssetRows.push({
      rowNumber,
      equipmentCategory,
      assetCode,
      assetName,
      serialNumber,
      assignmentType,
      locationCode,
      employeeCode,
      employeeName,
      assignedDate,
      condition,
      complaintNotes,
      raw,
    });
  });

  // Parse Accessories
  const accessoryRows: ParsedAccessoryRow[] = [];
  accSheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    let hasAnyValue = false;
    for (let c = 1; c <= ACCESSORY_HEADERS.length; c++) {
      if (row.getCell(c).value !== null && row.getCell(c).value !== undefined && String(row.getCell(c).value).trim() !== '') {
        hasAnyValue = true;
        break;
      }
    }
    if (!hasAnyValue) return;

    const raw: Record<string, unknown> = {};
    for (let c = 1; c <= ACCESSORY_HEADERS.length; c++) {
      raw[ACCESSORY_HEADERS[c - 1]] = row.getCell(c).value;
    }

    const computerReference = getScalarString(row.getCell(1), 'Accessories') ?? '';
    const accessoryType = getScalarString(row.getCell(2), 'Accessories') ?? '';
    const description = getScalarString(row.getCell(3), 'Accessories');
    const quantity = getScalarNumber(row.getCell(4), 'Accessories') ?? 1;
    const condition = getScalarString(row.getCell(5), 'Accessories') ?? 'Good';
    const notes = getScalarString(row.getCell(6), 'Accessories');

    accessoryRows.push({
      rowNumber,
      computerReference,
      accessoryType,
      description,
      quantity,
      condition,
      notes,
      raw,
    });
  });

  return {
    laptopPcRows,
    otherAssetRows,
    accessoryRows,
  };
}
