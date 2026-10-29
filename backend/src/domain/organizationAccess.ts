export type ScopeModule = 'hr' | 'ga' | 'users' | 'assets';
export interface GroupAccess {groupIds: number[]; isGlobalAdministrator: boolean}
export interface RequestScope {module: ScopeModule; groupIds: number[]; includeUnmapped: boolean; selectedGroupId: number | null}
export class OrganizationScopeError extends Error {
  constructor(message: string, public readonly status: 400 | 403 = 403) { super(message); }
}
export function parseGroupSelection(value: unknown): number | null {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    throw new OrganizationScopeError('Invalid X-Organization-Group-Id', 400);
  }
  return Number(value);
}
export function resolveRequestScope(input: {access: GroupAccess; module: ScopeModule; selectedGroupId: number | null; mode: 'read' | 'write'}): RequestScope {
  const {access, module, mode} = input;
  const groupIds = [...new Set(access.groupIds)].filter(id => Number.isSafeInteger(id) && id > 0);
  let selectedGroupId = input.selectedGroupId;
  if (selectedGroupId !== null && !groupIds.includes(selectedGroupId)) throw new OrganizationScopeError('Group access denied');
  if (selectedGroupId === null && groupIds.length === 1 && (mode === 'write' || !access.isGlobalAdministrator)) selectedGroupId = groupIds[0];
  if (mode === 'write' && selectedGroupId === null) throw new OrganizationScopeError('Choose a destination group', 400);
  if (!groupIds.length && !access.isGlobalAdministrator) throw new OrganizationScopeError('Organization access not provisioned');
  return {module, groupIds: selectedGroupId === null ? groupIds : [selectedGroupId], selectedGroupId,
    includeUnmapped: mode === 'read' && selectedGroupId === null && access.isGlobalAdministrator};
}
