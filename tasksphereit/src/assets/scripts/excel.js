// src/utils/excel.js
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

/**
 * Parse Excel file and extract user data with images
 * @param {File} file - The Excel file to parse
 * @param {string} selectedRole - The default role to assign
 * @returns {Promise<Array>} Array of user objects with data
 */
export const parseExcelFile = async (file) => {
  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array", dense: true }); // dense = faster/lower mem
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, {
    header: 1, // array-of-arrays (fast)
    raw: true, // skip expensive formatting
    blankrows: false,
    defval: "", // keep empty strings
  });

  // find header row within first 10 rows
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  let H = -1,
    cols = { id: -1, first: -1, middle: -1, last: -1 };
  for (let r = 0; r < Math.min(10, aoa.length); r++) {
    const row = aoa[r];
    if (!row) continue;
    const idx = (labels) => row.findIndex((v) => labels.includes(norm(v)));
    const id = idx(["id number", "id", "student number"]);
    const first = idx(["first name", "firstname", "given name", "given"]);
    const middle = idx([
      "middle name",
      "middlename",
      "middle initial",
      "mi",
      "middle",
    ]);
    const last = idx(["last name", "lastname", "surname", "last"]);
    if (id !== -1 || (first !== -1 && last !== -1)) {
      H = r;
      cols = { id, first, middle, last };
      break;
    }
  }

  const out = [];
  for (let r = H + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const idNumber = (cols.id >= 0 ? row[cols.id] : "").toString().trim();
    const firstName = (cols.first >= 0 ? row[cols.first] : "")
      .toString()
      .trim();
    const middleName = (cols.middle >= 0 ? row[cols.middle] : "")
      .toString()
      .replace(/\./g, "")
      .trim();
    const lastName = (cols.last >= 0 ? row[cols.last] : "").toString().trim();
    if (!(idNumber || firstName || middleName || lastName)) continue;
    out.push({ _select: true, idNumber, firstName, middleName, lastName });
  }
  return out;
};

/**
 * Validate if file is a valid Excel file
 * @param {File} file - The file to validate
 * @returns {boolean} True if valid Excel file
 */
export const validateExcelFile = (file) => {
  if (!file) return false;
  const name = (file.name || "").toLowerCase().trim();
  const type = (file.type || "").toLowerCase();

  const isXlsx =
    type ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    name.endsWith(".xlsx");

  const isXlsb =
    type === "application/vnd.ms-excel.sheet.binary.macroenabled.12" || // some UAs
    type ===
      "application/vnd.ms-excel.sheet.binary.macroenabled.12".toLowerCase() ||
    type === "application/vnd.ms-excel.sheet.binary.macroEnabled.12" || // canonical
    name.endsWith(".xlsb");

  return isXlsx || isXlsb;
};
