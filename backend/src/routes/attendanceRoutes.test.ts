import test from 'node:test';
import assert from 'node:assert/strict';
import router from './attendanceRoutes';

type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } };

test('attendance routes separate manual record updates and activity from imports', () => {
  const routes = (router.stack as RouteLayer[])
    .filter(layer => layer.route)
    .map(layer => ({ path: layer.route!.path, methods: layer.route!.methods }));

  assert.ok(routes.some(route => route.path === '/records' && route.methods.put));
  assert.ok(routes.some(route => route.path === '/activity' && route.methods.get));
  assert.ok(routes.some(route => route.path === '/commit-batch' && route.methods.post));
  assert.ok(routes.some(route => route.path === '/daily-report' && route.methods.get));
  assert.ok(routes.some(route => route.path === '/daily-report/note' && route.methods.post));
});
