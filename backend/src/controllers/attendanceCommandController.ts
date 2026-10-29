import {requireHrScope} from '../services/hrOrganizationScope';
import type { Request, Response } from "express";
import { db } from "../db";
import {
  postAttendanceCommandBodySchema,
  COMMAND_PERMISSIONS_MAP,
} from "../domain/attendanceCommandInput";
import { hashRequestPayload } from "../domain/hrAudit";
import { resolveAuditContext } from "../services/hrAudit";
import { runHrMutation } from "../services/hrMutation";
import {
  loadAttendanceWorkspace,
  executeAttendanceCommand,
  ConflictError,
  ValidationError,
} from "../services/attendanceWorkspace";

export async function getAttendanceWorkspace(req: Request, res: Response) {
  try {
    const targetDb = (req as any).db || db;
    const context = await resolveAuditContext(req as any, targetDb);
    const workspace = await loadAttendanceWorkspace(targetDb, context,requireHrScope(req as any));
    return res.status(200).json({
      success: true,
      data: workspace,
    });
  } catch (err: any) {
    console.error("getAttendanceWorkspace error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to load attendance workspace",
    });
  }
}

export async function postAttendanceCommand(req: Request, res: Response) {
  try {
    const parseResult = postAttendanceCommandBodySchema.safeParse(req.body);
    if (!parseResult.success) {
      const issueSummary = parseResult.error.issues
        .map((iss) => `${iss.path.join('.') || 'body'}: ${iss.message}`)
        .join('; ');
      console.warn("postAttendanceCommand validation failed:", {
        summary: issueSummary,
        issues: parseResult.error.issues,
        body: req.body,
      });
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${issueSummary}`,
        details: parseResult.error.issues,
      });
    }

    const { operationId, command } = parseResult.data;

    // Check Idempotency-Key / X-Operation-Id header if present
    const headerOpId = (req.headers["idempotency-key"] || req.headers["x-operation-id"]) as string | undefined;
    if (headerOpId && headerOpId !== operationId) {
      return res.status(400).json({
        success: false,
        error: "Idempotency-Key header must match body.operationId",
      });
    }

    // Check RBAC permissions
    const requiredPerms = COMMAND_PERMISSIONS_MAP[command.type] || ["attendance.manage"];
    const userRole = (req as any).user?.role;
    const userPerms: string[] = (req as any).user?.permissions || [];
    const isSuperAdmin = userRole === "superadmin" || userRole === "admin";
    const isAuthorized = isSuperAdmin || requiredPerms.some((p) => userPerms.includes(p));

    if (!isAuthorized) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Insufficient permissions for this command",
      });
    }

    const targetDb = (req as any).db || db;
    const context = await resolveAuditContext(req as any, targetDb);
    const requestHash = hashRequestPayload({body:req.body,scope:requireHrScope(req as any)});

    const result = await runHrMutation(
      context,
      requestHash,
      async (tx) => {
        return await executeAttendanceCommand(tx, context, (command as any), parseResult.data.expectedBatchRevision,requireHrScope(req as any));
      },
      targetDb
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof ConflictError || err.statusCode === 409 || err.name === "MutationConflictError") {
      return res.status(409).json({
        success: false,
        error: err.message,
      });
    }
    if (err instanceof ValidationError || err.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    if (err.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: err.message,
      });
    }
    console.error("postAttendanceCommand error:", err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || "Failed to execute attendance command",
    });
  }
}
