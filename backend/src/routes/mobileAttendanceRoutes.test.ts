import test from "node:test";
import assert from "node:assert/strict";
import router from "./mobileAttendanceRoutes";

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

test("mobileAttendanceRoutes registers all required employee self-service and HRD verification endpoints", () => {
  const routes = (router.stack as RouteLayer[])
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route!.path, methods: layer.route!.methods }));

  // Employee endpoints
  assert.ok(
    routes.some((r) => r.path === "/summary" && r.methods.get),
    "GET /summary route must be registered"
  );
  assert.ok(
    routes.some((r) => r.path === "/clock" && r.methods.post),
    "POST /clock route must be registered"
  );
  assert.ok(
    routes.some((r) => r.path === "/history" && r.methods.get),
    "GET /history route must be registered"
  );
  assert.ok(
    routes.some((r) => r.path === "/enroll-face" && r.methods.post),
    "POST /enroll-face route must be registered"
  );
  assert.ok(
    routes.some((r) => r.path === "/face-profile" && r.methods.get),
    "GET /face-profile route must be registered"
  );

  // HRD verification endpoints
  assert.ok(
    routes.some((r) => r.path === "/verifications" && r.methods.get),
    "GET /verifications route must be registered"
  );
  assert.ok(
    routes.some((r) => r.path === "/verify" && r.methods.post),
    "POST /verify route must be registered"
  );
});
