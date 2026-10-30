import type { Response, NextFunction } from 'express';
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
