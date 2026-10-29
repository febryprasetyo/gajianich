import {requireHrScope} from '../services/hrOrganizationScope';
import type { Request, Response } from "express";
import { db } from "../db";
import { parseHrActivityQuery } from "../domain/hrActivityQuery";
import {
  listHrActivities,
  getHrActivity,
  listHrActivityTargets,
  listHrActivityActors,
} from "../services/hrActivityQuery";

export async function getActivities(req: Request, res: Response) {
  try {
    const targetDb = (req as any).db || db;
    const query = parseHrActivityQuery(req.query);
    const result = await listHrActivities(query, targetDb,requireHrScope(req as any));

    return res.status(200).json({
      success: true,
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (err: any) {
    if (err.statusCode === 400 || err.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: err.message || "Invalid query parameters",
      });
    }
    console.error("getActivities error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve HR activities",
    });
  }
}

export async function getActors(req: Request, res: Response) {
  try {
    const targetDb = (req as any).db || db;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 25;

    const result = await listHrActivityActors(q, cursor, limit, targetDb,requireHrScope(req as any));

    return res.status(200).json({
      success: true,
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (err: any) {
    console.error("getActors error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve activity actors",
    });
  }
}

export async function getActivityById(req: Request, res: Response) {
  try {
    const targetDb = (req as any).db || db;
    const id = req.params.id;

    const result = await getHrActivity(id, targetDb,requireHrScope(req as any));
    if (!result) {
      return res.status(404).json({
        success: false,
        error: "Activity event not found",
      });
    }

    return res.status(200).json({
      success: true,
      event: result.event,
      metadata: result.metadata,
      targets: result.targets,
      nextTargetCursor: result.nextTargetCursor,
    });
  } catch (err: any) {
    console.error("getActivityById error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve activity detail",
    });
  }
}

export async function getActivityTargets(req: Request, res: Response) {
  try {
    const targetDb = (req as any).db || db;
    const id = req.params.id;
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const result = await listHrActivityTargets(id, cursor, limit, targetDb,requireHrScope(req as any));

    return res.status(200).json({
      success: true,
      targets: result.targets,
      nextCursor: result.nextCursor,
    });
  } catch (err: any) {
    if (err.statusCode === 400) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
    console.error("getActivityTargets error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to retrieve activity targets",
    });
  }
}
