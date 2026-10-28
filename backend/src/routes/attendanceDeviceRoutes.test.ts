import test from "node:test";
import assert from "node:assert/strict";
import router from "./attendanceDeviceRoutes";

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

test("attendanceDeviceRoutes defines complete CRUD, session, sync, and calculation endpoints", () => {
  const routes = (router.stack as RouteLayer[])
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route!.path, methods: layer.route!.methods }));

  // GET / (list devices)
  assert.ok(routes.some((r) => r.path === "/" && r.methods.get), "GET / must exist");

  // POST / (create device)
  assert.ok(routes.some((r) => r.path === "/" && r.methods.post), "POST / must exist");

  // PUT /:id (update device)
  assert.ok(routes.some((r) => r.path === "/:id" && r.methods.put), "PUT /:id must exist");

  // DELETE /:id (delete device)
  assert.ok(routes.some((r) => r.path === "/:id" && r.methods.delete), "DELETE /:id must exist");

  // POST /:id/connect
  assert.ok(routes.some((r) => r.path === "/:id/connect" && r.methods.post), "POST /:id/connect must exist");

  // POST /:id/disconnect
  assert.ok(routes.some((r) => r.path === "/:id/disconnect" && r.methods.post), "POST /:id/disconnect must exist");

  // POST /:id/sync
  assert.ok(routes.some((r) => r.path === "/:id/sync" && r.methods.post), "POST /:id/sync must exist");

  // GET /raw-logs/query
  assert.ok(routes.some((r) => r.path === "/raw-logs/query" && r.methods.get), "GET /raw-logs/query must exist");

  // POST /calculate
  assert.ok(routes.some((r) => r.path === "/calculate" && r.methods.post), "POST /calculate must exist");
});
