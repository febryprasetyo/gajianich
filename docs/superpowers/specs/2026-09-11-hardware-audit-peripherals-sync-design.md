# Hardware Audits & Collector Sync Multi-Peripheral Design Spec

## Summary

The GAJIANICH Hardware Collector portable tool allows IT engineers and technicians to perform rapid hardware audits on employee PCs and laptops. In real-world office environments, computers are often accompanied by multiple peripherals such as Printers, Scanners, Monitors, and custom manual accessories (Barcode Scanners, UPS, Projectors, Webcams, etc.).

This specification defines end-to-end support for capturing, transmitting, storing, displaying, and converting multiple attached peripherals across the entire Hardware Audit pipeline:
1. Portable Collector tool (`GAJIANICH-Collector.ps1`)
2. Ingest and Batch Sync APIs (`POST /api/v1/hardware-audits/ingest`, `POST /api/v1/hardware-audits/batch-sync`)
3. Database persistence (`hardware_audit_peripherals` table)
4. Query enrichment (`GET /api/v1/hardware-audits`)
5. Asset creation and linking workflows (`POST /api/v1/hardware-audits/:id/create-asset`, `POST /api/v1/hardware-audits/:id/link`)
6. Frontend management UI (`/dashboard/hardware-audits`)

## Goals

1. **Multi-Peripheral Payload Support**: Accept and validate an array of peripherals in single and batch audit sync endpoints, supporting preset categories (`Printer`, `Scanner`, `Monitor`) as well as user-specified custom manual categories (`DLL / Lainnya`).
2. **Normalized Database Persistence**: Persist attached peripherals in a dedicated `hardware_audit_peripherals` table with foreign key cascade to `hardware_audit_logs`.
3. **Rich Query Responses**: Enrich `GET /api/v1/hardware-audits` with full peripheral objects so the dashboard displays all attached peripherals associated with each audited machine.
4. **Seamless Asset Integration**: When an audit record is used to create a new computer asset or linked to an existing one, automatically convert or attach its peripherals to `asset_accessories` with appropriate categories, descriptions, conditions, and notes.
5. **High-Fidelity Dashboard UI**: Provide an intuitive, responsive UI in `/dashboard/hardware-audits` displaying peripheral counts, category tags, brand/model, serial numbers, and badges for custom categories.
6. **Tool Consistency**: Keep `hardware-collector/launcher/GAJIANICH-Collector.ps1` and `hardware-collector/src/GAJIANICH-Collector.ps1` in perfect sync.

## Non-goals

- Altering standalone asset management flows for independently purchased unassigned peripherals that are not part of an employee computer audit.
- Modifying authentication or agent secret token requirements (`X-Agent-Key`).

## Data Model & Schema

### 1. New Table: `hardware_audit_peripherals`

```sql
CREATE TABLE IF NOT EXISTS "hardware_audit_peripherals" (
  "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "audit_id" bigint NOT NULL REFERENCES "hardware_audit_logs"("id") ON DELETE CASCADE,
  "category" varchar(100) NOT NULL,
  "preset_category" varchar(50),
  "custom_category" varchar(100),
  "brand_model" varchar(200) NOT NULL,
  "serial_number" varchar(100),
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_hardware_audit_peripherals_audit_id" ON "hardware_audit_peripherals"("audit_id");
```

### 2. Drizzle Schema (`backend/src/db/schema/hardwareAudits.ts`)

```typescript
export const hardwareAuditPeripherals = pgTable('hardware_audit_peripherals', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  auditId: bigint('audit_id', { mode: 'number' })
    .references(() => hardwareAuditLogs.id, { onDelete: 'cascade' })
    .notNull(),
  category: varchar('category', { length: 100 }).notNull(),
  presetCategory: varchar('preset_category', { length: 50 }),
  customCategory: varchar('custom_category', { length: 100 }),
  brandModel: varchar('brand_model', { length: 200 }).notNull(),
  serialNumber: varchar('serial_number', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('hardware_audit_peripherals_audit_id_idx').on(table.auditId),
]);
```

## API Validation & Domain Layer (`backend/src/domain/hardwareAudit.ts`)

### Peripheral Schema

```typescript
export const hardwareAuditPeripheralSchema = z.object({
  category: z.string().trim().min(1, 'Category is required').max(100),
  presetCategory: z.string().trim().max(50).nullable().optional(),
  customCategory: z.string().trim().max(100).transform(v => v || null).nullable().optional(),
  brandModel: z.string().trim().min(1, 'Brand & Model is required').max(200),
  serialNumber: z.string().trim().max(100).transform(v => (!v || v === '-' || v.toUpperCase() === 'UNKNOWN' ? null : v)).nullable().optional(),
});

export type HardwareAuditPeripheral = z.infer<typeof hardwareAuditPeripheralSchema>;
```

### Updated `hardwareAuditPayloadSchema`

```typescript
export const hardwareAuditPayloadSchema = z.object({
  custodianName: z.string().trim().min(1, 'Custodian name is required').max(150),
  serialNumber: z.string().trim().max(100).transform(v => v || null).nullable().optional(),
  manufacturer: z.string().trim().max(100).transform(v => v || null).nullable().optional(),
  model: z.string().trim().max(150).transform(v => v || null).nullable().optional(),
  cpuName: z.string().trim().max(200).transform(v => v || null).nullable().optional(),
  ramSizeGb: z.number().int().positive().nullable().optional(),
  ramSlotCount: z.number().int().positive().nullable().optional(),
  disk1SizeGb: z.number().int().positive().nullable().optional(),
  disk2SizeGb: z.number().int().positive().nullable().optional(),
  rawSpecs: z.any().nullable().optional(),
  notes: z.string().trim().transform(v => v || null).nullable().optional(),
  hasPeripheral: z.boolean().default(false).optional(),
  peripherals: z.array(hardwareAuditPeripheralSchema).default([]).optional(),
  osName: z.string().trim().max(100).transform(v => v || null).nullable().optional(),
  hostname: z.string().trim().max(100).transform(v => v || null).nullable().optional(),
  macAddresses: z.string().trim().max(255).transform(v => v || null).nullable().optional(),
  scannedAt: z.string().nullable().optional(),
});
```

## Service Layer Workflow (`backend/src/services/hardwareAuditService.ts`)

1. **Ingestion (`processHardwareAuditIngest`)**:
   - Insert `hardware_audit_logs`.
   - If `payload.peripherals?.length > 0`, insert all peripheral records into `hardware_audit_peripherals`.
   - If auto-synced to an existing asset (`SYNCED_AUTO`), also attach the peripherals to the matched asset's `asset_accessories`.
2. **List Query (`getHardwareAudits`)**:
   - Select all audits.
   - Batch query `hardware_audit_peripherals` for all audit IDs: `SELECT * FROM hardware_audit_peripherals WHERE audit_id IN (...)`.
   - Attach `peripherals: HardwareAuditPeripheral[]` to each audit object.
3. **Asset Creation (`createAssetFromAudit`)**:
   - Create asset & computer specs.
   - Query attached peripherals for the audit.
   - Insert each peripheral into `asset_accessories` with:
     - `accessoryType`: peripheral.category
     - `description`: peripheral.brandModel
     - `quantity`: 1
     - `condition`: 'Good'
     - `notes`: `S/N: ${peripheral.serialNumber || 'N/A'} (Audit)`
4. **Asset Linking (`linkAuditToAsset`)**:
   - Query attached peripherals for the audit.
   - If user confirms/links, append or sync peripheral rows into `asset_accessories`.

## Frontend UX Design (`/dashboard/hardware-audits`)

1. **Audit Card Peripheral Section**:
   - Display a dedicated peripheral badge if count > 0: `🖨️ ${count} Periferal Terhubung`.
   - Collapsible/preview list showing:
     - Category pill (e.g. Printer: Sky, Scanner: Violet, Monitor: Indigo, Custom/DLL: Amber with `Kategori Manual` tag).
     - Brand and Model in bold text.
     - S/N pill with copy button if available.
2. **Link & Create Modal Context**:
   - In both modals, include a preview badge/list of attached peripherals that will be registered with the asset.

## Verification & Quality Gates

- Run unit tests on domain schema (`node --test src/**/*.test.ts`).
- Verify database migration on development Postgres.
- Test single ingest and batch sync with multiple peripherals (Printer, Scanner, Monitor, Custom).
- Verify frontend rendering and build (`npm run build`).
