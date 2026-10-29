import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImportEmployee } from "../domain/attendanceImportMapping";

test("attendance device PIN mapping resolves employee by NIK and barcode without collision from database ID", () => {
  const employees = [
    { id: 1, employeeCode: "30002", barcode: "30002" },
    { id: 152, employeeCode: "1", barcode: "1" },
    { id: 27, employeeCode: "122", barcode: "122" },
    { id: 122, employeeCode: "50219", barcode: "50219" },
    { id: 61, employeeCode: "603", barcode: "376" },
    { id: 19, employeeCode: "224", barcode: "224" },
    { id: 224, employeeCode: "50277", barcode: "50277" },
  ];

  const identities: { sourceId: number | null; externalNoId: string; employeeId: number }[] = [];

  // PIN 122 must resolve to ALVIN FAIZ (id 27, NIK 122), NEVER HELMI (id 122, NIK 50219)
  assert.equal(resolveImportEmployee("122", 1, employees, identities), 27);

  // PIN 50219 must resolve to HELMI SUHENDRA PUTRA (id 122, NIK 50219)
  assert.equal(resolveImportEmployee("50219", 1, employees, identities), 122);

  // PIN 1 must resolve to DWI FIANTI (id 152, NIK 1), NEVER ABDUL AZIZ (id 1, NIK 30002)
  assert.equal(resolveImportEmployee("1", 1, employees, identities), 152);

  // PIN 376 must resolve to PAYZA ZAKARIA (id 61, barcode 376)
  assert.equal(resolveImportEmployee("376", 1, employees, identities), 61);

  // PIN 224 must resolve to ACHMAD ROBBY (id 19, NIK 224), NEVER SYAFINA (id 224, NIK 50277)
  assert.equal(resolveImportEmployee("224", 1, employees, identities), 19);

  // PIN 50277 must resolve to SYAFINA (id 224, NIK 50277)
  assert.equal(resolveImportEmployee("50277", 1, employees, identities), 224);

  // Padded PIN 00122 must resolve to ALVIN FAIZ (id 27)
  assert.equal(resolveImportEmployee("00122", 1, employees, identities), 27);
});
