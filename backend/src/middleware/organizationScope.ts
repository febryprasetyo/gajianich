import type { Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { employees } from '../db/schema/employees';
import { users } from '../db/schema/users';
import { departmentOrganizationMappings, organizations, userOrganizationGroupAccess } from '../db/schema/organizations';
import type { AuthenticatedRequest } from './auth';
import { loadGroupAccess } from '../services/organizationScope';
import { OrganizationScopeError, parseGroupSelection, resolveRequestScope, type ScopeModule, type RequestScope } from '../domain/organizationAccess';
export interface OrganizationScopedRequest extends AuthenticatedRequest { organizationScope?: RequestScope }

export async function requireGlobalAdministrator(req:AuthenticatedRequest,res:Response,next:NextFunction) {
  if(!req.user) return res.status(401).json({error:'Unauthorized'});
  try {
    if(!(await loadGroupAccess(req.user.userId)).isGlobalAdministrator) return res.status(403).json({error:'Global administrator required'});
    next();
  } catch { return res.status(503).json({error:'Account access temporarily unavailable'}); }
}

/** Mount after the module's permission middleware; membership never grants action permissions. */
export function requireOrganizationScope(module: ScopeModule, mode: 'read' | 'write') {
  return async (req: OrganizationScopedRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({error: 'Unauthorized'});
    try {
      let selectedGroupId = parseGroupSelection(req.headers['x-organization-group-id']);
      if (selectedGroupId === null && req.body?.groupId !== undefined) {
        selectedGroupId = parseGroupSelection(String(req.body.groupId));
      }
      if (selectedGroupId === null && Array.isArray(req.body?.groupIds) && req.body.groupIds.length === 1) {
        selectedGroupId = parseGroupSelection(String(req.body.groupIds[0]));
      }
      if (selectedGroupId === null && (module === 'hr' || module === 'users') && mode === 'write') {
        if (req.params?.id) {
          const targetId = Number(req.params.id);
          if (Number.isSafeInteger(targetId) && targetId > 0) {
            if (module === 'hr') {
              const [empMapping] = await db
                .select({ groupId: departmentOrganizationMappings.groupId })
                .from(employees)
                .innerJoin(departmentOrganizationMappings, eq(departmentOrganizationMappings.departmentId, employees.departmentId))
                .where(eq(employees.id, targetId))
                .limit(1);
              if (empMapping) {
                selectedGroupId = empMapping.groupId;
              }
            } else if (module === 'users') {
              const [userGroup] = await db
                .select({ groupId: userOrganizationGroupAccess.groupId })
                .from(userOrganizationGroupAccess)
                .where(eq(userOrganizationGroupAccess.userId, targetId))
                .limit(1);
              if (userGroup) {
                selectedGroupId = userGroup.groupId;
              } else {
                const [emp] = await db
                  .select({ groupId: departmentOrganizationMappings.groupId })
                  .from(users)
                  .innerJoin(employees, eq(users.employeeId, employees.id))
                  .innerJoin(departmentOrganizationMappings, eq(departmentOrganizationMappings.departmentId, employees.departmentId))
                  .where(eq(users.id, targetId))
                  .limit(1);
                if (emp) {
                  selectedGroupId = emp.groupId;
                }
              }
            }
          }
        } else if (req.body?.departmentId) {
          const deptId = Number(req.body.departmentId);
          if (Number.isSafeInteger(deptId) && deptId > 0) {
            const [deptMapping] = await db
              .select({ groupId: departmentOrganizationMappings.groupId })
              .from(departmentOrganizationMappings)
              .where(eq(departmentOrganizationMappings.departmentId, deptId))
              .limit(1);
            if (deptMapping) {
              selectedGroupId = deptMapping.groupId;
            }
          }
        } else if (req.body?.employeeId || req.query?.employeeId) {
          const empId = Number(req.body?.employeeId ?? req.query?.employeeId);
          if (Number.isSafeInteger(empId) && empId > 0) {
            const [empMapping] = await db
              .select({ groupId: departmentOrganizationMappings.groupId })
              .from(employees)
              .innerJoin(departmentOrganizationMappings, eq(departmentOrganizationMappings.departmentId, employees.departmentId))
              .where(eq(employees.id, empId))
              .limit(1);
            if (empMapping) {
              selectedGroupId = empMapping.groupId;
            }
          }
        } else if (req.params?.organizationId) {
          const orgId = Number(req.params.organizationId);
          if (Number.isSafeInteger(orgId) && orgId > 0) {
            const [orgRow] = await db
              .select({ groupId: organizations.groupId })
              .from(organizations)
              .where(eq(organizations.id, orgId))
              .limit(1);
            if (orgRow) {
              selectedGroupId = orgRow.groupId;
            }
          }
        }
      }
      const access = await loadGroupAccess(req.user.userId);
      const scope = resolveRequestScope({access, module, mode, selectedGroupId});
      if (mode === 'write' && req.body?.groupId !== undefined && req.body.groupId !== scope.selectedGroupId) {
        throw new OrganizationScopeError('Body groupId must match the request destination', 400);
      }
      req.organizationScope = scope;
      next();
    } catch (error) {
      if (error instanceof OrganizationScopeError) return res.status(error.status).json({error: error.message});
      return res.status(503).json({error: 'Organization access temporarily unavailable'});
    }
  };
}
