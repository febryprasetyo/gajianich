import { test } from 'node:test';
import assert from 'node:assert';
import leaveRoutes from './leaveRoutes';
import { documentAssetRoutes, organizationLogoRoutes } from './organizationLogoRoutes';

test('leave routes register expected endpoints', () => {
  const router = leaveRoutes;
  const routes = router.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => ({
      path: layer.route.path,
      method: Object.keys(layer.route.methods)[0].toUpperCase(),
    }));

  const paths = routes.map((r: any) => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /balance-summary'), 'GET /balance-summary must exist');
  assert.ok(paths.includes('GET /document-organizations'), 'GET /document-organizations must exist');
  assert.ok(paths.includes('POST /calculate-days'), 'POST /calculate-days must exist');
  assert.ok(paths.includes('POST /requests'), 'POST /requests must exist');
  assert.ok(paths.includes('GET /requests/:id'), 'GET /requests/:id must exist');
  assert.ok(paths.includes('GET /requests'), 'GET /requests must exist');
  assert.ok(paths.includes('PATCH /requests/:id/approve'), 'PATCH /requests/:id/approve must exist');
  assert.ok(paths.includes('DELETE /requests/:id'), 'DELETE /requests/:id must exist');
  assert.ok(paths.includes('GET /holidays'), 'GET /holidays must exist');

  // Master leaves endpoints
  assert.ok(paths.includes('GET /master/config'), 'GET /master/config must exist');
  assert.ok(paths.includes('POST /master/config'), 'POST /master/config must exist');
  assert.ok(paths.includes('GET /master/balances'), 'GET /master/balances must exist');
  assert.ok(paths.includes('PUT /master/balances/:id'), 'PUT /master/balances/:id must exist');
});

test('leave routes enforce authentication and permissions', () => {
  const router = leaveRoutes;
  // Verify top-level middleware includes authentication
  const middlewareLayers = router.stack.filter((layer: any) => !layer.route);
  assert.ok(middlewareLayers.length > 0, 'Router should have top-level middleware');

  // Verify route handlers have permission checks
  const routeLayers = router.stack.filter((layer: any) => layer.route);
  for (const layer of routeLayers) {
    assert.ok(
      layer.route.stack.length >= 2,
      `Route ${layer.route.path} must have permission middleware before handler`
    );
  }
});

test('organization logo and document asset routes register expected endpoints', () => {
  const logoPaths = organizationLogoRoutes.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

  assert.ok(logoPaths.includes('GET /'), 'GET /hr/organization-logos must exist');
  assert.ok(logoPaths.includes('POST /'), 'POST /hr/organization-logos must exist');
  assert.ok(logoPaths.includes('POST /:organizationId'), 'POST /hr/organization-logos/:organizationId must exist');

  const assetPaths = documentAssetRoutes.stack
    .filter((layer: any) => layer.route)
    .map((layer: any) => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);

  assert.ok(assetPaths.includes('GET /:id'), 'GET /document-assets/:id must exist');
});
