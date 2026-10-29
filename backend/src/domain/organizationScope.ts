export type GroupCode = 'CMC' | 'MGM';
export interface MasterRow { id: number; code: string; name: string }
export interface MappingCandidate {
  source: 'department' | 'location';
  sourceId: number;
  sourceCode: string;
  sourceName: string;
  groupCode: GroupCode | null;
  organizationCode: string | null;
  evidence: 'USER_CONFIRMED' | 'REQUIRES_REVIEW';
}

/** Preview suggestions only; applying a captured manifest requires separate approval. */
export function buildDepartmentCandidates(rows: MasterRow[]): MappingCandidate[] {
  return rows.map(row => {
    const mgm = ['MULTI GAS MEDIKA', 'MEDICARE SOLUSI INDONESIA'].includes(row.name);
    return { source: 'department', sourceId: row.id, sourceCode: row.code, sourceName: row.name,
      groupCode: mgm ? 'MGM' : 'CMC', organizationCode: null,
      evidence: mgm ? 'USER_CONFIRMED' : 'REQUIRES_REVIEW' };
  });
}
export function buildLocationCandidates(rows: MasterRow[]): MappingCandidate[] {
  return rows.map(row => ({ source: 'location', sourceId: row.id, sourceCode: row.code,
    sourceName: row.name, groupCode: null, organizationCode: null, evidence: 'REQUIRES_REVIEW' }));
}
export function resolveCandidate(candidates: MappingCandidate[], source: MappingCandidate['source'], id: number | null): MappingCandidate | null {
  return id === null ? null : candidates.find(row => row.source === source && row.sourceId === id) ?? null;
}
