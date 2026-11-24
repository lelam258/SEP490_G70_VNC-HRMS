import type { CommissionExportDetailRow } from '../types/procedureSlip';
import { formatDateOnly } from './format';
import { PROCEDURE_ROLE_LABELS } from './procedureHelpers';

// --- Minimal, standard-compliant ZIP (STORE method) builder for .xlsx ---
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  name: string;
  data: Uint8Array;
}

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    // Local file header (30 bytes + name)
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // signature
    lv.setUint16(4, 20, true); // version needed
    lv.setUint16(6, 0x0800, true); // UTF-8 flag
    lv.setUint16(8, 0, true); // compression: STORE
    lv.setUint16(10, 0, true); // mod time
    lv.setUint16(12, 0, true); // mod date
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    localParts.push(localHeader, data);

    // Central directory header (46 bytes + name)
    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // signature
    cv.setUint16(4, 20, true); // version made by
    cv.setUint16(6, 20, true); // version needed
    cv.setUint16(8, 0x0800, true); // UTF-8 flag
    cv.setUint16(10, 0, true); // compression: STORE
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);
    cv.setUint16(32, 0, true);
    cv.setUint16(34, 0, true);
    cv.setUint16(36, 0, true);
    cv.setUint32(38, 0, true);
    cv.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDirOffset = offset;
  let centralDirSize = 0;
  for (const part of centralParts) {
    centralDirSize += part.length;
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralDirSize, true);
  ev.setUint32(16, centralDirOffset, true);
  ev.setUint16(20, 0, true);

  const totalSize = offset + centralDirSize + eocd.length;
  const result = new Uint8Array(totalSize);
  let pos = 0;
  for (const part of localParts) {
    result.set(part, pos);
    pos += part.length;
  }
  for (const part of centralParts) {
    result.set(part, pos);
    pos += part.length;
  }
  result.set(eocd, pos);
  return result;
}

// --- XML helpers ---
function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function inlineStrCell(ref: string, value: string, styleIdx: number): string {
  return `<c r="${ref}" t="inlineStr" s="${styleIdx}"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function numberCell(ref: string, value: number, styleIdx: number): string {
  const safeNum = Number.isFinite(value) ? value : 0;
  return `<c r="${ref}" s="${styleIdx}"><v>${safeNum}</v></c>`;
}

function formulaCell(ref: string, formula: string, cachedValue: number, styleIdx: number): string {
  const safeNum = Number.isFinite(cachedValue) ? cachedValue : 0;
  return `<c r="${ref}" s="${styleIdx}"><f>${xmlEscape(formula)}</f><v>${safeNum}</v></c>`;
}

// Style indices (matching styles.xml cellXfs below):
// 0: Default
// 1: Title banner (bold 14pt white on #0F766E, center/center)
// 2: Subtitle banner (italic 10pt #334155 on #F0FDFA, left/center)
// 3: Table Header (bold 10.5pt white on #0D9488, center/center, wrap, border)
// 4: Data Left - even row (white)
// 5: Data Left - odd row (#F8FAFC)
// 6: Data Center - even row (white)
// 7: Data Center - odd row (#F8FAFC)
// 8: Data Currency - even row (white, #,##0)
// 9: Data Currency - odd row (#F8FAFC, #,##0)
// 10: Data Commission - even row (bold #047857 on white, #,##0)
// 11: Data Commission - odd row (bold #047857 on #F8FAFC, #,##0)
// 12: Data AfterHours "Có" badge (bold #6D28D9 on #F5F3FF, center)
// 13: Total label (bold 11pt #065F46 on #ECFDF5, right/center, top medium border)
// 14: Total currency (bold 11pt #065F46 on #ECFDF5, right/center, #,##0, top medium border)
// 15: Total commission (bold 11pt #047857 on #D1FAE5, right/center, #,##0, top medium border)

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="164" formatCode="#,##0"/>
  </numFmts>
  <fonts count="7">
    <font><sz val="10"/><color rgb="FF1E293B"/><name val="Calibri"/></font>
    <font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><i/><sz val="10"/><color rgb="FF334155"/><name val="Calibri"/></font>
    <font><b/><sz val="10.5"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF047857"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF6D28D9"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF065F46"/><name val="Calibri"/></font>
  </fonts>
  <fills count="8">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0F766E"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDFA"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF0D9488"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF5F3FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFCBD5E1"/></left>
      <right style="thin"><color rgb="FFCBD5E1"/></right>
      <top style="thin"><color rgb="FFCBD5E1"/></top>
      <bottom style="thin"><color rgb="FFCBD5E1"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF0F766E"/></left>
      <right style="thin"><color rgb="FF0F766E"/></right>
      <top style="thin"><color rgb="FF0F766E"/></top>
      <bottom style="medium"><color rgb="FF0F766E"/></bottom>
      <diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FF94A3B8"/></left>
      <right style="thin"><color rgb="FF94A3B8"/></right>
      <top style="medium"><color rgb="FF0D9488"/></top>
      <bottom style="medium"><color rgb="FF0D9488"/></bottom>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="16">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" indent="1"/>
    </xf>
    <xf numFmtId="0" fontId="3" fillId="4" borderId="2" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="left" vertical="center" wrapText="1"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="0" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="4" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="4" fillId="5" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="5" fillId="6" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <xf numFmtId="0" fontId="6" fillId="7" borderId="3" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="6" fillId="7" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
    <xf numFmtId="164" fontId="6" fillId="7" borderId="3" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">
      <alignment horizontal="right" vertical="center"/>
    </xf>
  </cellXfs>
</styleSheet>`;
}

export interface ExportCommissionDetailsExcelOptions {
  payMonth: string;
  scopeLabel: string;
  rows: CommissionExportDetailRow[];
}

export function exportCommissionDetailsExcel({
  payMonth,
  scopeLabel,
  rows,
}: ExportCommissionDetailsExcelOptions): void {
  const headers = [
    'STT',
    'Mã phiếu',
    'Ngày thực hiện',
    'Khoa / Phòng ban',
    'Mã bệnh nhân',
    'Mã dịch vụ',
    'Tên dịch vụ',
    'Mã NV',
    'Họ và tên',
    'Vai trò',
    'Ngoài giờ',
    'Viện phí (VNĐ)',
    'Chi phí trực tiếp (VNĐ)',
    'Hoa hồng được hưởng (VNĐ)',
  ];

  const colWidths = [
    6,  // STT
    20, // Mã phiếu
    14, // Ngày thực hiện
    22, // Khoa / Phòng ban
    15, // Mã bệnh nhân
    14, // Mã dịch vụ
    32, // Tên dịch vụ
    11, // Mã NV
    22, // Họ và tên
    20, // Vai trò
    11, // Ngoài giờ
    17, // Viện phí
    19, // Chi phí trực tiếp
    21, // Hoa hồng được hưởng
  ];

  const now = new Date();
  const exportTimestamp = `${String(now.getDate()).padStart(2, '0')}/${String(
    now.getMonth() + 1
  ).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}`;

  const lastCol = colLetter(headers.length - 1); // N
  const rowXmls: string[] = [];

  // Row 1: Title banner (A1:N1)
  const titleCells = [inlineStrCell('A1', `BẢNG KÊ CHI TIẾT HOA HỒNG THỦ THUẬT — KỲ ${payMonth}`, 1)];
  for (let c = 1; c < headers.length; c++) {
    titleCells.push(`<c r="${colLetter(c)}1" s="1"/>`);
  }
  rowXmls.push(`<row r="1" ht="32" customHeight="1">${titleCells.join('')}</row>`);

  // Row 2: Metadata subtitle (A2:N2)
  const subtitleText = `Phạm vi: ${scopeLabel}   |   Tổng số lượt phân công: ${rows.length}   |   Xuất lúc: ${exportTimestamp}`;
  const subCells = [inlineStrCell('A2', subtitleText, 2)];
  for (let c = 1; c < headers.length; c++) {
    subCells.push(`<c r="${colLetter(c)}2" s="2"/>`);
  }
  rowXmls.push(`<row r="2" ht="22" customHeight="1">${subCells.join('')}</row>`);

  // Row 3: Blank spacer
  rowXmls.push(`<row r="3" ht="8" customHeight="1"/>`);

  // Row 4: Table headers
  const headerCells = headers.map((h, idx) => inlineStrCell(`${colLetter(idx)}4`, h, 3));
  rowXmls.push(`<row r="4" ht="30" customHeight="1">${headerCells.join('')}</row>`);

  // Data rows (Row 5+)
  let totalCharged = 0;
  let totalDirectCost = 0;
  let totalCommission = 0;

  rows.forEach((item, idx) => {
    const r = 5 + idx;
    const isOdd = idx % 2 === 1;
    const sLeft = isOdd ? 5 : 4;
    const sCenter = isOdd ? 7 : 6;
    const sCurr = isOdd ? 9 : 8;
    const sComm = isOdd ? 11 : 10;
    const sAfterHours = item.isAfterHours ? 12 : sCenter;

    totalCharged += item.chargedAmount;
    totalDirectCost += item.directCost;
    totalCommission += item.commissionAmount;

    const cells = [
      numberCell(`A${r}`, idx + 1, sCenter),
      inlineStrCell(`B${r}`, item.slipNumber, sCenter),
      inlineStrCell(`C${r}`, formatDateOnly(item.procedureDate), sCenter),
      inlineStrCell(`D${r}`, item.departmentName || 'Chưa phân khoa', sLeft),
      inlineStrCell(`E${r}`, item.patientCode || '-', sCenter),
      inlineStrCell(`F${r}`, item.serviceCode, sCenter),
      inlineStrCell(`G${r}`, item.serviceName, sLeft),
      inlineStrCell(`H${r}`, item.staffCode, sCenter),
      inlineStrCell(`I${r}`, item.staffName, sLeft),
      inlineStrCell(`J${r}`, PROCEDURE_ROLE_LABELS[item.role] || item.role, sLeft),
      inlineStrCell(`K${r}`, item.isAfterHours ? 'Ngoài giờ' : 'Trong giờ', sAfterHours),
      numberCell(`L${r}`, item.chargedAmount, sCurr),
      numberCell(`M${r}`, item.directCost, sCurr),
      numberCell(`N${r}`, item.commissionAmount, sComm),
    ];

    rowXmls.push(`<row r="${r}" ht="22" customHeight="1">${cells.join('')}</row>`);
  });

  // Totals row
  const lastDataRow = 4 + rows.length;
  const totalRow = lastDataRow + 1;
  const totalCells: string[] = [
    inlineStrCell(`A${totalRow}`, `TỔNG CỘNG (${rows.length} dòng)`, 13),
  ];
  for (let c = 1; c <= 10; c++) {
    totalCells.push(`<c r="${colLetter(c)}${totalRow}" s="13"/>`);
  }
  if (rows.length > 0) {
    totalCells.push(
      formulaCell(`L${totalRow}`, `SUM(L5:L${lastDataRow})`, totalCharged, 14),
      formulaCell(`M${totalRow}`, `SUM(M5:M${lastDataRow})`, totalDirectCost, 14),
      formulaCell(`N${totalRow}`, `SUM(N5:N${lastDataRow})`, totalCommission, 15)
    );
  } else {
    totalCells.push(
      numberCell(`L${totalRow}`, 0, 14),
      numberCell(`M${totalRow}`, 0, 14),
      numberCell(`N${totalRow}`, 0, 15)
    );
  }
  rowXmls.push(`<row r="${totalRow}" ht="26" customHeight="1">${totalCells.join('')}</row>`);

  const colsXml = colWidths
    .map((w, idx) => `<col min="${idx + 1}" max="${idx + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  const sheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="20"/>
  <cols>${colsXml}</cols>
  <sheetData>${rowXmls.join('')}</sheetData>
  <autoFilter ref="A4:${lastCol}${Math.max(4, lastDataRow)}"/>
  <mergeCells count="3">
    <mergeCell ref="A1:${lastCol}1"/>
    <mergeCell ref="A2:${lastCol}2"/>
    <mergeCell ref="A${totalRow}:K${totalRow}"/>
  </mergeCells>
  <pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Chi tiet ca thu thuat" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const encoder = new TextEncoder();
  const zipBytes = buildZip([
    { name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) },
    { name: '_rels/.rels', data: encoder.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: encoder.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) },
    { name: 'xl/styles.xml', data: encoder.encode(buildStylesXml()) },
    { name: 'xl/worksheets/sheet1.xml', data: encoder.encode(sheetXml) },
  ]);

  const blob = new Blob([zipBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `Bang_ke_chi_tiet_ca_thu_thuat_${payMonth}.xlsx`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
