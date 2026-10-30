import { db } from './index';
import { roles, users, permissions, rolePermissions } from './schema/users';
import { departments, locations } from './schema/master';
import { organizationGroups, departmentOrganizationMappings, locationOrganizationMappings } from './schema/organizations';
import { vendors } from './schema/vendors';
import { employees } from './schema/employees';
import { assetCategories, assets } from './schema/assets';
import { ticketCategories, slaPolicies, itTickets, ticketComments } from './schema/tickets';
import { softwareLicenses, licenseAllocations } from './schema/licenses';
import { attendanceDevices } from './schema/attendanceDevices';
import { attendanceWorkHours, attendanceShifts, attendanceShiftAssignments } from './schema/attendanceWorkspace';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { DEFAULT_IT_EQUIPMENT_TYPES, shouldSeedDefaultEquipmentTypes } from '../domain/equipmentTypes';
import {
  DEFAULT_TICKET_CATEGORIES,
  DEFAULT_SLA_POLICIES,
  shouldSeedDefaultTicketCategories,
  shouldSeedDefaultSlaPolicies,
} from '../domain/ticketCategories';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '../domain/rbac';
import { getSeedCredentials } from '../domain/seedCredentials';

async function seed() {
  const credentials = getSeedCredentials();
  console.log('🌱 Starting database seed procedure...');

  // 0. Ensure custom tables & columns exist in PostgreSQL
  await db.execute(`
    CREATE TABLE IF NOT EXISTS asset_assignment_history (
      id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      asset_id bigint NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
      employee_id bigint REFERENCES employees(id),
      assigned_by_user_id bigint REFERENCES users(id),
      assigned_at timestamp DEFAULT now() NOT NULL,
      returned_at timestamp,
      condition_on_assign varchar(50) DEFAULT 'Good' NOT NULL,
      condition_on_return varchar(50),
      handoverNotes text,
      returnNotes text
    );

    CREATE TABLE IF NOT EXISTS ticket_comments (
      id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      ticket_id bigint NOT NULL REFERENCES it_tickets(id) ON DELETE CASCADE,
      user_id bigint NOT NULL REFERENCES users(id),
      comment_text text NOT NULL,
      is_internal boolean DEFAULT false NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS software_licenses (
      id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      license_name varchar(150) NOT NULL,
      license_key varchar(255),
      license_type varchar(50),
      vendor_id bigint REFERENCES vendors(id),
      total_seats integer DEFAULT 1 NOT NULL,
      used_seats integer DEFAULT 0 NOT NULL,
      purchase_date timestamp,
      expiry_date timestamp,
      purchase_price numeric,
      status varchar(30) DEFAULT 'Active' NOT NULL,
      notes text,
      created_at timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license_allocations (
      id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      license_id bigint REFERENCES software_licenses(id) ON DELETE CASCADE,
      employee_id bigint REFERENCES employees(id),
      asset_id bigint REFERENCES assets(id),
      allocated_at timestamp DEFAULT now() NOT NULL,
      notes text
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
      code varchar(100) NOT NULL UNIQUE,
      name varchar(150) NOT NULL,
      module varchar(50) NOT NULL,
      description varchar(255),
      created_at timestamp DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id bigint NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      permission_id bigint NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
      assigned_at timestamp DEFAULT now() NOT NULL,
      PRIMARY KEY (role_id, permission_id)
    );
  `);

  await db.execute(`
    ALTER TABLE ticket_comments DROP CONSTRAINT IF EXISTS ticket_comments_ticket_id_tickets_id_fk;
    ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS type varchar(20) DEFAULT 'Incident' NOT NULL;
    ALTER TABLE it_tickets ADD COLUMN IF NOT EXISTS resolution_notes text;
    ALTER TABLE ticket_comments ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false NOT NULL;
    ALTER TABLE software_licenses ADD COLUMN IF NOT EXISTS vendor_id bigint REFERENCES vendors(id);
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id bigint REFERENCES roles(id);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id bigint REFERENCES employees(id) ON DELETE SET NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT false NOT NULL;
  `);
  console.log('  ✓ Verified table columns in database');

  // 1. Seed Organization Groups (must exist before any FK references)
  const defaultOrganizationGroups = [
    { code: 'CMC' as const, name: 'Cahaya Mas Cemerlang' },
    { code: 'MGM' as const, name: 'Multi Gas Medika' },
  ];
  for (const group of defaultOrganizationGroups) {
    const existing = await db.select().from(organizationGroups).where(eq(organizationGroups.code, group.code));
    if (existing.length === 0) {
      await db.insert(organizationGroups).values(group);
      console.log(`  ✓ Inserted organization group: ${group.name} (${group.code})`);
    }
  }

  // 2. Seed Roles
  const defaultRoles = [
    { code: 'ga_staff', name: 'GA Staff', description: 'Permintaan barang General Affairs', isSystem: true },
    { code: 'super_admin', name: 'SuperAdmin', description: 'Full system access and security administration', isSystem: true },
    { code: 'it_admin', name: 'ITAdmin', description: 'IT asset, ticket, and infrastructure management', isSystem: true },
    { code: 'it_staff', name: 'ITStaff', description: 'IT service desk technician and maintenance staff', isSystem: true },
    { code: 'employee', name: 'Employee', description: 'Standard employee user for submitting IT tickets', isSystem: true },
    { code: 'management', name: 'Management', description: 'Read-only executive dashboard and reporting access', isSystem: true },
    { code: 'hr_attendance', name: 'HR Attendance & Time', description: 'HR attendance logs, biometric imports, and time tracking', isSystem: true },
  ];

  for (const role of defaultRoles) {
    const existing = await db.select().from(roles).where(eq(roles.code, role.code));
    if (existing.length === 0) {
      await db.insert(roles).values(role);
      console.log(`  ✓ Inserted role: ${role.name}`);
    } else {
      await db.update(roles).set({ isSystem: role.isSystem }).where(eq(roles.id, existing[0].id));
    }
  }

  // 1b. Seed Permissions Catalog
  for (const perm of DEFAULT_PERMISSIONS) {
    const existing = await db.select().from(permissions).where(eq(permissions.code, perm.code));
    if (existing.length === 0) {
      await db.insert(permissions).values(perm);
    }
  }
  console.log('  ✓ Verified permissions catalog');

  // 1c. Seed Role Permissions for System Roles
  const allPerms = await db.select().from(permissions);
  const permMap = new Map(allPerms.map((p) => [p.code, p.id]));

  for (const roleCode of Object.keys(DEFAULT_ROLE_PERMISSIONS)) {
    const roleRecord = (await db.select().from(roles).where(eq(roles.code, roleCode)))[0];

    const targetPermCodes = DEFAULT_ROLE_PERMISSIONS[roleCode];
    if (targetPermCodes.includes('*')) {
      for (const p of allPerms) {
        await db.execute(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES (${roleRecord.id}, ${p.id})
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `);
      }
    } else {
      for (const code of targetPermCodes) {
        const permId = permMap.get(code);
        if (permId) {
          await db.execute(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES (${roleRecord.id}, ${permId})
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `);
        }
      }
    }
  }
  console.log('  ✓ Seeded default role permissions matrix');

  // 3. Seed SuperAdmin User
  const superAdminRole = (await db.select().from(roles).where(eq(roles.code, 'super_admin')))[0];
  const existingAdmin = await db.select().from(users).where(eq(users.email, 'admin@company.com'));
  let superAdminUser = existingAdmin[0];
  if (!superAdminUser) {
    const passwordHash = await bcrypt.hash(credentials.password, 12);
    const [inserted] = await db.insert(users).values({
      username: 'admin',
      email: 'admin@company.com',
      passwordHash,
      mustChangePassword: credentials.mustChangePassword,
      role: 'SuperAdmin',
      roleId: superAdminRole?.id,
      status: 'active',
    }).returning();
    superAdminUser = inserted;
    console.log('  ✓ Created SuperAdmin User (username: admin; password supplied by seed configuration)');
  } else if (superAdminRole && !superAdminUser.roleId) {
    await db.update(users).set({ roleId: superAdminRole.id }).where(eq(users.id, superAdminUser.id));
  }

  // 4. Seed Departments
  const defaultDepartments = [
    { name: 'Information Technology', code: 'IT' },
    { name: 'Finance & Accounting', code: 'FIN' },
    { name: 'Human Resources', code: 'HR' },
    { name: 'Operations & Logistics', code: 'OPS' },
  ];

  for (const dept of defaultDepartments) {
    const existing = await db.select().from(departments).where(eq(departments.code, dept.code));
    if (existing.length === 0) {
      await db.insert(departments).values(dept);
      console.log(`  ✓ Inserted department: ${dept.name}`);
    }
  }

  // 5. Seed Locations
  const defaultLocations = [
    { code: 'CMC', name: 'Cahaya Mas Cemerlang', address: '' },
    { code: 'ARV', name: 'Arvirotech', address: '' },
    { code: 'MGM', name: 'Multi Gas medika', address: '' },
  ];

  for (const loc of defaultLocations) {
    const existing = await db.select().from(locations).where(eq(locations.code, loc.code));
    if (existing.length === 0) {
      await db.insert(locations).values(loc);
      console.log(`  ✓ Inserted location: ${loc.name}`);
    }
  }

  // 6. Map Departments & Locations to Organization Groups
  const allGroups = await db.select().from(organizationGroups);
  const cmcGroup = allGroups.find(g => g.code === 'CMC');
  const mgmGroup = allGroups.find(g => g.code === 'MGM');
  if (cmcGroup && mgmGroup) {
    const allDepts = await db.select().from(departments);
    for (const d of allDepts) {
      const isMgm = ['MULTI GAS MEDIKA', 'MEDICARE SOLUSI INDONESIA'].includes(d.name.trim().toUpperCase());
      const targetGroup = isMgm ? mgmGroup : cmcGroup;
      const existingMapping = await db.select().from(departmentOrganizationMappings).where(eq(departmentOrganizationMappings.departmentId, d.id));
      if (existingMapping.length === 0) {
        await db.insert(departmentOrganizationMappings).values({
          departmentId: d.id,
          groupId: targetGroup.id,
          approvalReference: 'seed-initial-mapping',
        });
      }
    }
    const allLocs = await db.select().from(locations);
    for (const l of allLocs) {
      const isMgm = l.name.trim().toUpperCase().includes('MULTI GAS MEDIKA') || l.code.trim().toUpperCase() === 'MGM';
      const targetGroup = isMgm ? mgmGroup : cmcGroup;
      const existingMapping = await db.select().from(locationOrganizationMappings).where(eq(locationOrganizationMappings.locationId, l.id));
      if (existingMapping.length === 0) {
        await db.insert(locationOrganizationMappings).values({
          locationId: l.id,
          groupId: targetGroup.id,
          approvalReference: 'seed-initial-mapping',
        });
      }
    }
    console.log('  ✓ Verified department and location organization mappings');
  }

  // 6b. Seed Default Office Work Hours, Shift, and Department Assignments
  const [existingWh] = await db
    .select()
    .from(attendanceWorkHours)
    .where(eq(attendanceWorkHours.name, 'Office Reguler'))
    .limit(1);

  let officeWhId = existingWh?.id;
  if (!officeWhId) {
    const [createdWh] = await db
      .insert(attendanceWorkHours)
      .values({
        name: 'Office Reguler',
        color: '#059669',
        scheduleIn: '08:00',
        scheduleOut: '17:00',
        scanInStart: '06:00',
        scanInEnd: '10:00',
        scanOutStart: '15:00',
        scanOutEnd: '20:00',
        lateToleranceMinutes: 5,
        earlyLeaveToleranceMinutes: 5,
        requireCheckIn: true,
        requireCheckOut: true,
        isActive: true,
      })
      .returning();
    officeWhId = createdWh.id;
    console.log('  ✓ Inserted default work hours: Office Reguler (08:00 - 17:00)');
  }

  const [existingShift] = await db
    .select()
    .from(attendanceShifts)
    .where(eq(attendanceShifts.code, 'OFFICE'))
    .limit(1);

  let officeShiftId = existingShift?.id;
  if (!officeShiftId) {
    const [createdShift] = await db
      .insert(attendanceShifts)
      .values({
        code: 'OFFICE',
        name: 'Office Reguler (Default)',
        description: 'Senin - Jumat 08:00 - 17:00 (Sabtu & Minggu Libur)',
        mondayWorkHoursId: officeWhId,
        tuesdayWorkHoursId: officeWhId,
        wednesdayWorkHoursId: officeWhId,
        thursdayWorkHoursId: officeWhId,
        fridayWorkHoursId: officeWhId,
        saturdayWorkHoursId: null,
        sundayWorkHoursId: null,
        isDefault: true,
        isActive: true,
      })
      .returning();
    officeShiftId = createdShift.id;
    console.log('  ✓ Inserted default shift: OFFICE (08:00 - 17:00)');
  }

  const allDeptsForShifts = await db.select().from(departments);
  for (const dept of allDeptsForShifts) {
    const existingAssignment = await db
      .select()
      .from(attendanceShiftAssignments)
      .where(eq(attendanceShiftAssignments.departmentId, dept.id));
    if (existingAssignment.length === 0) {
      await db.insert(attendanceShiftAssignments).values({
        departmentId: dept.id,
        shiftId: officeShiftId,
        isDefault: true,
      });
    }
  }
  console.log('  ✓ Configured all departments to default Office shift');

  // 4a. Seed IT Equipment Types
  const insertedEquipmentTypes = await db.transaction(async (tx) => {
    const existingEquipmentTypes = await tx
      .select({ id: assetCategories.id })
      .from(assetCategories)
      .limit(1);
    if (!shouldSeedDefaultEquipmentTypes(existingEquipmentTypes.length)) return [];

    return tx.insert(assetCategories).values([...DEFAULT_IT_EQUIPMENT_TYPES]).returning();
  });
  for (const equipmentType of insertedEquipmentTypes) {
    console.log(`  ✓ Inserted IT equipment type: ${equipmentType.name}`);
  }

  // 4b. Seed Vendors
  const defaultVendors = [
    { name: 'Schneider Electric / AVEVA', contactName: 'Sales Schneider ID', email: 'sales.id@se.com', phone: '+6221500800', address: 'Jakarta' },
  ];

  for (const vnd of defaultVendors) {
    const existing = await db.select().from(vendors).where(eq(vendors.name, vnd.name));
    if (existing.length === 0) {
      await db.insert(vendors).values(vnd);
      console.log(`  ✓ Inserted vendor: ${vnd.name}`);
    }
  }

  // 4c. Seed Ticket Categories
  const insertedTicketCategories = await db.transaction(async (tx) => {
    const existingCats = await tx
      .select({ id: ticketCategories.id })
      .from(ticketCategories)
      .limit(1);
    if (!shouldSeedDefaultTicketCategories(existingCats.length)) return [];

    return tx.insert(ticketCategories).values([...DEFAULT_TICKET_CATEGORIES]).returning();
  });
  for (const cat of insertedTicketCategories) {
    console.log(`  ✓ Inserted ticket category: ${cat.name}`);
  }

  // 4d. Seed SLA Policies
  const insertedSlaPolicies = await db.transaction(async (tx) => {
    const existingPolicies = await tx
      .select({ id: slaPolicies.id })
      .from(slaPolicies)
      .limit(1);
    if (!shouldSeedDefaultSlaPolicies(existingPolicies.length)) return [];

    return tx.insert(slaPolicies).values([...DEFAULT_SLA_POLICIES]).returning();
  });
  for (const sla of insertedSlaPolicies) {
    console.log(`  ✓ Inserted SLA policy: ${sla.priority}`);
  }

  
  // 4e. Seed Attendance Devices
  const defaultAttendanceDevices = [
    {
      code: "dev-1",
      name: "Solution X900 Utama",
      ip: "192.168.10.224",
      port: 4370,
      commKey: 0,
      deviceNumber: 1,
      serialNumber: "WAE4242900026",
      model: "Solution X900",
      platform: "ZAM180_TFT",
      firmware: "Ver 6.60 Aug 19 2021",
      location: "Lobby Kantor Pusat",
      connectionType: "Ethernet",
      status: "DISCONNECTED",
      isEnabled: true,
      timeoutMs: 5000,
    },
    {
      code: "dev-2",
      name: "Solution X900 MGM",
      ip: "192.168.10.4",
      port: 4370,
      commKey: 0,
      deviceNumber: 2,
      serialNumber: "WAE4242300038",
      model: "Solution X900",
      platform: "ZAM180_TFT",
      firmware: "Ver 6.60",
      location: "Gedung Operasional MGM",
      connectionType: "Ethernet",
      status: "DISCONNECTED",
      isEnabled: true,
      timeoutMs: 5000,
    },
  ];

  for (const dev of defaultAttendanceDevices) {
    const existing = await db.select().from(attendanceDevices).where(eq(attendanceDevices.code, dev.code));
    if (existing.length === 0) {
      const devGroupId = dev.name.includes('MGM') || dev.location.includes('MGM') ? mgmGroup?.id : cmcGroup?.id;
      await db.insert(attendanceDevices).values({ ...dev, groupId: devGroupId });
      console.log(`  ✓ Inserted attendance device: ${dev.name} (${dev.ip})`);
    }
  }

  console.log('✅ Database Seed Procedure Completed Successfully!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Database Seed Failed:', err);
  process.exit(1);
});
