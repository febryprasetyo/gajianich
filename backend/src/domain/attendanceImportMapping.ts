/** Machine identifiers are text. Numeric fallback accepts complete digits only. */
export function resolveImportEmployee(
  externalNoId: string,
  sourceId: number,
  employees: { id: number; employeeCode: string; barcode?: string | null }[],
  identities: { sourceId: number | null; externalNoId: string; employeeId: number }[],
): number | null {
  const normalize = (value: string) => value.trim().toLowerCase();
  const external = normalize(externalNoId);
  if (!external) return null;
  const unique = (ids: number[]) => {
    const distinct = [...new Set(ids)];
    return distinct.length === 1 ? distinct[0] : null;
  };
  const mapped = identities.filter(i => i.sourceId === sourceId && normalize(i.externalNoId) === external);
  if (mapped.length) return unique(mapped.filter(i => employees.some(e => e.id === i.employeeId)).map(i => i.employeeId));
  const exact = employees.filter(e => normalize(e.employeeCode) === external || (e.barcode && normalize(e.barcode) === external));
  if (exact.length) return unique(exact.map(e => e.id));
  if (!/^\d+$/.test(external)) return null;
  const numeric = (value: string) => value.replace(/^0+(?=\d)/, '');
  return unique(employees.filter(e => /^\d+$/.test(e.employeeCode.trim()) && numeric(e.employeeCode.trim()) === numeric(external)).map(e => e.id));
}
