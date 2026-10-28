import assert from "node:assert/strict";
import test from "node:test";
import router from "../routes/hardwareAuditRoutes";

function registeredRoutes(): Array<{ path: string; methods: string[] }> {
  const stack = (router as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> } }> }).stack;
  return stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route!.path,
      methods: Object.keys(layer.route!.methods).filter((m) => layer.route!.methods[m]),
    }));
}

test("hardware audit routes expose ingest, batch-sync, list, link, and create-asset endpoints", () => {
  const routes = registeredRoutes();
  const routeMap = new Map(routes.map((r) => [r.path, r.methods]));

  assert.ok(routeMap.has("/ingest"), "Missing /ingest route");
  assert.ok(routeMap.get("/ingest")!.includes("post"));

  assert.ok(routeMap.has("/batch-sync"), "Missing /batch-sync route");
  assert.ok(routeMap.get("/batch-sync")!.includes("post"));

  assert.ok(routeMap.has("/"), "Missing / route");
  assert.ok(routeMap.get("/")!.includes("get"));

  assert.ok(routeMap.has("/:id/link"), "Missing /:id/link route");
  assert.ok(routeMap.get("/:id/link")!.includes("post"));

  assert.ok(routeMap.has("/:id/create-asset"), "Missing /:id/create-asset route");
  assert.ok(routeMap.get("/:id/create-asset")!.includes("post"));

  assert.ok(routeMap.has("/:id"), "Missing /:id route");
  assert.ok(routeMap.get("/:id")!.includes("delete"));
});

test('hardware registration hides SQL details when a database uniqueness race rejects the insert', async (t) => {
  const { db } = await import('../db');
  const { createAssetFromHardwareAudit } = await import('./hardwareAuditController');
  const failure = new Error('Failed query: insert into assets params: private notes', { cause: { code: '23505' } });
  const mocked = t.mock.method(db, 'select', () => { throw failure; });
  let status = 0;
  let body: any;
  const response = { status(code: number) { status = code; return this; }, json(value: unknown) { body = value; return this; } };
  await createAssetFromHardwareAudit({ params: { id: '91' }, body: { categoryId: 3, status: 'Assigned', custodianId: 81 } } as any, response as any);
  assert.equal(status, 409);
  assert.match(body.error, /Tautkan Spesifikasi/);
  assert.doesNotMatch(body.error, /Failed query|insert into|private notes/);
  mocked.mock.restore();
});
