import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSelectLeaveOrganization,
  resolveDefaultLeaveOrganizationId,
  stepOrganizationSelectionByKey,
  validateLogoFileClient,
} from './leaveOrganizationUtils.ts';

const OPTIONS = [
  {
    organizationId: 10,
    groupId: 1,
    name: 'PT Cahaya Mas Cemerlang',
    logoAssetKey: '/images/logo-cmc.png',
    isEmployeeDefault: true,
  },
  {
    organizationId: 20,
    groupId: 1,
    name: 'PT Cahaya Mitra Cemerlang',
    logoAssetKey: '/api/v1/document-assets/1',
    isEmployeeDefault: false,
  },
  {
    organizationId: 30,
    groupId: 1,
    name: 'PT Cahaya Abadi',
    logoAssetKey: '/api/v1/document-assets/2',
    isEmployeeDefault: false,
  },
];

test('canSelectLeaveOrganization allows HR/Admin with attendance.manage or SuperAdmin and denies ordinary employee', () => {
  assert.equal(canSelectLeaveOrganization(null), false);
  assert.equal(canSelectLeaveOrganization({ roleName: 'Employee', permissions: ['attendance.view'] }), false);
  assert.equal(canSelectLeaveOrganization({ roleName: 'HR Attendance & Time', permissions: ['attendance.view', 'attendance.manage'] }), true);
  assert.equal(canSelectLeaveOrganization({ roleName: 'SuperAdmin', permissions: ['*'] }), true);
});

test('resolveDefaultLeaveOrganizationId prefers explicit initialOrganizationId, then employee default, then first option', () => {
  assert.equal(resolveDefaultLeaveOrganizationId(OPTIONS, 20), 20);
  assert.equal(resolveDefaultLeaveOrganizationId(OPTIONS, null), 10);
  assert.equal(
    resolveDefaultLeaveOrganizationId(
      OPTIONS.map((o) => ({ ...o, isEmployeeDefault: false })),
      null
    ),
    10
  );
  assert.equal(resolveDefaultLeaveOrganizationId([], null), null);
});

test('stepOrganizationSelectionByKey supports keyboard arrow navigation across radio cards', () => {
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 10, 'ArrowRight'), 20);
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 30, 'ArrowRight'), 10);
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 10, 'ArrowLeft'), 30);
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 20, 'ArrowDown'), 30);
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 20, 'ArrowUp'), 10);
  assert.equal(stepOrganizationSelectionByKey(OPTIONS, 20, 'Enter'), null);
});

test('validateLogoFileClient enforces PNG/JPG/WebP and max 512 KB, rejecting SVG', () => {
  assert.equal(validateLogoFileClient({ type: 'image/png', size: 120 * 1024, name: 'logo.png' }), null);
  assert.equal(validateLogoFileClient({ type: 'image/jpeg', size: 200 * 1024, name: 'logo.jpg' }), null);
  assert.equal(validateLogoFileClient({ type: 'image/webp', size: 512 * 1024, name: 'logo.webp' }), null);

  const svgErr = validateLogoFileClient({ type: 'image/svg+xml', size: 10 * 1024, name: 'logo.svg' });
  assert.ok(svgErr && svgErr.includes('PNG, JPG, atau WebP'));

  const sizeErr = validateLogoFileClient({ type: 'image/png', size: 600 * 1024, name: 'big.png' });
  assert.ok(sizeErr && sizeErr.includes('512 KB'));
});

