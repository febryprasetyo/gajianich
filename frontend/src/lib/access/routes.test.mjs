import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute, findMatchingRouteRule, getDefaultRedirectForUser, getDashboardHrefForUser, isRouteMatchingHref } from './routes.ts';

test('findMatchingRouteRule matches the most specific prefix first', () => {
  const equipRule = findMatchingRouteRule('/dashboard/master/equipment-types');
  assert.equal(equipRule?.prefix, '/dashboard/master/equipment-types');
  assert.equal(equipRule?.itOnly, true);

  const deptRule = findMatchingRouteRule('/dashboard/master/departments');
  assert.equal(deptRule?.prefix, '/dashboard/master/departments');
  assert.equal(deptRule?.permission, 'master.view');

  const assetOverviewRule = findMatchingRouteRule('/dashboard/assets/overview');
  assert.equal(assetOverviewRule?.prefix, '/dashboard/assets/overview');

  const assetRule = findMatchingRouteRule('/dashboard/assets/123');
  assert.equal(assetRule?.prefix, '/dashboard/assets');
  assert.equal(assetRule?.permission, 'assets.view');
});

test('SuperAdmin redirects to asset overview', () => {
  const superAdmin = { roleName: 'SuperAdmin', permissions: ['*'] };
  assert.equal(canAccessRoute('/dashboard/assets', superAdmin), true);
  assert.equal(canAccessRoute('/dashboard/assets/overview', superAdmin), true);
  assert.equal(canAccessRoute('/dashboard/access', superAdmin), true);
  assert.equal(canAccessRoute('/dashboard/master/equipment-types', superAdmin), true);
  assert.equal(canAccessRoute('/dashboard/attendance', superAdmin), true);
  assert.equal(getDefaultRedirectForUser(superAdmin), '/dashboard/assets/overview');
  assert.equal(getDashboardHrefForUser(superAdmin), '/dashboard/assets/overview');
});

test('ITAdmin and ITStaff redirect to asset overview', () => {
  assert.equal(getDefaultRedirectForUser({ roleName: 'ITAdmin', permissions: ['assets.view'] }), '/dashboard/assets/overview');
  assert.equal(getDefaultRedirectForUser({ roleName: 'ITStaff', permissions: ['assets.view'] }), '/dashboard/assets/overview');
  assert.equal(getDefaultRedirectForUser({ roleName: 'it_admin' }), '/dashboard/assets/overview');
});

test('HR roles redirect to attendance overview', () => {
  const hrdUser = {
    roleName: 'HR Attendance & Time',
    role: 'HR Attendance & Time',
    permissions: [
      'attendance.view',
      'attendance.import',
      'attendance.manage',
    ],
  };

  assert.equal(canAccessRoute('/dashboard/attendance', hrdUser), true);
  assert.equal(canAccessRoute('/dashboard/assets', hrdUser), false);
  assert.equal(getDefaultRedirectForUser(hrdUser), '/dashboard/attendance/overview');
  assert.equal(getDashboardHrefForUser(hrdUser), '/dashboard/attendance/overview');
});

test('Employee role redirects to employee overview and can access workspace', () => {
  const employee = {
    roleName: 'Employee',
    permissions: ['tickets.view', 'tickets.create'],
  };

  assert.equal(canAccessRoute('/dashboard/employee/overview', employee), true);
  assert.equal(canAccessRoute('/dashboard/tickets', employee), true);
  assert.equal(canAccessRoute('/dashboard/assets', employee), false);
  assert.equal(getDefaultRedirectForUser(employee), '/dashboard/employee/overview');
  assert.equal(getDashboardHrefForUser(employee), '/dashboard/employee/overview');
});

test('Management role redirects to management overview', () => {
  const management = { roleName: 'Management', permissions: [] };
  assert.equal(canAccessRoute('/dashboard/management/overview', management), true);
  assert.equal(getDefaultRedirectForUser(management), '/dashboard/management/overview');
  assert.equal(getDashboardHrefForUser(management), '/dashboard/management/overview');
});

test('Unknown role redirects to fallback welcome', () => {
  const guest = { roleName: 'Guest' };
  assert.equal(getDefaultRedirectForUser(guest), '/dashboard/welcome');
  assert.equal(getDashboardHrefForUser(guest), '/dashboard/welcome');
});

test('mustChangePassword forces redirect to /change-password regardless of user role', () => {
  const employeeTemp = { roleName: 'Employee', permissions: [], mustChangePassword: true };
  const superAdminTemp = { roleName: 'SuperAdmin', permissions: ['*'], mustChangePassword: true };
  const hrdTemp = { roleName: 'HR Attendance & Time', permissions: ['attendance.view'], mustChangePassword: true };

  assert.equal(getDefaultRedirectForUser(employeeTemp), '/change-password');
  assert.equal(getDefaultRedirectForUser(superAdminTemp), '/change-password');
  assert.equal(getDefaultRedirectForUser(hrdTemp), '/change-password');
  assert.equal(getDashboardHrefForUser(employeeTemp), '/change-password');
});

test('leave settings route requires attendance.manage and overrides generic leave view', () => {
  const staff = {
    roleName: 'Staff',
    permissions: ['attendance.view'],
  };
  const manager = {
    roleName: 'HR Manager',
    permissions: ['attendance.view', 'attendance.manage'],
  };

  assert.equal(canAccessRoute('/dashboard/leaves', staff), true);
  assert.equal(canAccessRoute('/dashboard/leaves/settings', staff), false);
  assert.equal(canAccessRoute('/dashboard/leaves/settings', manager), true);
  assert.equal(canAccessRoute('/dashboard/master/organization-logos', staff), false);
  assert.equal(canAccessRoute('/dashboard/master/organization-logos', manager), true);
});

test('HR role with access.users.view can access /dashboard/access', () => {
  const hrdUser = {
    roleName: 'HR Attendance & Time',
    role: 'HR Attendance & Time',
    permissions: [
      'attendance.view',
      'attendance.import',
      'attendance.manage',
      'access.users.view',
      'access.users.manage',
    ],
  };

  assert.equal(canAccessRoute('/dashboard/access', hrdUser), true);
});
test('access route moduleName is Kelola Pengguna and accessible to HR', () => {
  const rule = findMatchingRouteRule('/dashboard/access');
  assert.equal(rule?.moduleName, 'Kelola Pengguna');

  const hrdBasic = {
    roleName: 'HR Attendance & Time',
    permissions: [],
  };
  assert.equal(canAccessRoute('/dashboard/access', hrdBasic), true);
});

test('infrastructure, servers, and subscriptions routes are accessible to IT roles with infrastructure.view', () => {
  const serverRule = findMatchingRouteRule('/dashboard/servers');
  assert.equal(serverRule?.moduleName, 'Monitoring Server & VPS');
  assert.equal(serverRule?.permission, 'infrastructure.view');

  const subRule = findMatchingRouteRule('/dashboard/subscriptions');
  assert.equal(subRule?.moduleName, 'Monitoring Domain, Hosting & Email');
  assert.equal(subRule?.permission, 'infrastructure.view');

  const itUser = { roleName: 'ITStaff', permissions: ['infrastructure.view'] };
  assert.equal(canAccessRoute('/dashboard/servers', itUser), true);
  assert.equal(canAccessRoute('/dashboard/servers/srv-local-onprem', itUser), true);
  assert.equal(canAccessRoute('/dashboard/subscriptions', itUser), true);
  assert.equal(canAccessRoute('/dashboard/infrastructure', itUser), true);

  const regularEmployee = { roleName: 'Employee', permissions: [] };
  assert.equal(canAccessRoute('/dashboard/servers', regularEmployee), false);
  assert.equal(canAccessRoute('/dashboard/servers/srv-local-onprem', regularEmployee), false);
  assert.equal(canAccessRoute('/dashboard/subscriptions', regularEmployee), false);
});

test('mobile approvals require their dedicated permission for a custom reviewer', () => {
  assert.equal(canAccessRoute('/dashboard/attendance/approvals', { roleName: 'CustomReviewer', permissions: ['attendance.mobile.verify'] }), true);
  assert.equal(canAccessRoute('/dashboard/attendance/approvals', { roleName: 'HRViewer', permissions: ['attendance.view'] }), false);
});

test('ADMS monitoring requires dedicated attendance.adms.view permission and rejects general import/viewer', () => {
  assert.equal(canAccessRoute('/dashboard/attendance/adms', { roleName: 'HRViewer', permissions: ['attendance.view'] }), false);
  assert.equal(canAccessRoute('/dashboard/attendance/adms', { roleName: 'MachineOperator', permissions: ['attendance.import'] }), false);
  assert.equal(canAccessRoute('/dashboard/attendance/adms', { roleName: 'HRD', permissions: ['attendance.manage'] }), false);
  assert.equal(canAccessRoute('/dashboard/attendance/adms', { roleName: 'AdmsAuditor', permissions: ['attendance.adms.view'] }), true);
  assert.equal(canAccessRoute('/dashboard/attendance/adms', { roleName: 'SuperAdmin', permissions: ['*'] }), true);
  assert.equal(canAccessRoute('/dashboard/attendance/devices', { roleName: 'CustomManager', permissions: ['attendance.manage'] }), false);
});

test('isRouteMatchingHref highlights only the active sub-item under Verifikasi Presensi', () => {
  const allHrefs = [
    '/dashboard/attendance/approvals',
    '/dashboard/attendance/approvals/photos',
    '/dashboard/attendance/approvals/rules',
  ];

  // 1. When on /dashboard/attendance/approvals/rules (Aturan Auto-Approve)
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/rules', '/dashboard/attendance/approvals/rules', allHrefs), true);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals/rules', allHrefs), false);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/photos', '/dashboard/attendance/approvals/rules', allHrefs), false);

  // 2. When on /dashboard/attendance/approvals/photos (Validasi Foto Wajah)
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/photos', '/dashboard/attendance/approvals/photos', allHrefs), true);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals/photos', allHrefs), false);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/rules', '/dashboard/attendance/approvals/photos', allHrefs), false);

  // 3. When on /dashboard/attendance/approvals (Review Absensi main page)
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals', allHrefs), true);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/photos', '/dashboard/attendance/approvals', allHrefs), false);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals/rules', '/dashboard/attendance/approvals', allHrefs), false);

  // 4. Also works without allHrefs parameter through explicit guard
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals/rules'), false);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals/photos'), false);
  assert.equal(isRouteMatchingHref('/dashboard/attendance/approvals', '/dashboard/attendance/approvals'), true);
});

test('isRouteMatchingHref handles asset custodians and leaves correctly', () => {
  const allHrefs = [
    '/dashboard/master/asset-custodians',
    '/dashboard/master/asset-custodians/reconciliation',
    '/dashboard/leaves',
    '/dashboard/leaves/balances',
    '/dashboard/leaves/settings',
  ];

  // When on reconciliation, asset-custodians parent should not be active
  assert.equal(isRouteMatchingHref('/dashboard/master/asset-custodians/reconciliation', '/dashboard/master/asset-custodians/reconciliation', allHrefs), true);
  assert.equal(isRouteMatchingHref('/dashboard/master/asset-custodians', '/dashboard/master/asset-custodians/reconciliation', allHrefs), false);

  // When on leave balances, leaves parent should not be active
  assert.equal(isRouteMatchingHref('/dashboard/leaves/balances', '/dashboard/leaves/balances', allHrefs), true);
  assert.equal(isRouteMatchingHref('/dashboard/leaves', '/dashboard/leaves/balances', allHrefs), false);
});

