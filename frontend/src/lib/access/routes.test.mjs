import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessRoute, findMatchingRouteRule, getDefaultRedirectForUser, getDashboardHrefForUser } from './routes.ts';

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
