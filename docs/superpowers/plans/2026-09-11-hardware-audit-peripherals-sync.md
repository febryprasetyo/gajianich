# Hardware Audits & Collector Sync Multi-Peripheral Implementation Plan

**Goal:** Implement full support for multi-peripherals with preset categories (Printer, Scanner, Monitor) and custom manual categories (DLL) across the collector script, ingest/sync endpoints, database, service layer, and frontend UI.

## Proposed Changes

### 1. Database & Schema Layer

#### [MODIFY] `backend/src/db/schema/hardwareAudits.ts`
- Add `hardwareAuditPeripherals` table schema with:
  - `id`: bigint generated always as identity primary key
  - `auditId`: bigint references `hardwareAuditLogs.id` on delete cascade
  - `category`: varchar(100) not null
  - `presetCategory`: varchar(50)
  - `customCategory`: varchar(100)
  - `brandModel`: varchar(200) not null
  - `serialNumber`: varchar(100)
  - `createdAt`: timestamp default now()
- Export `HardwareAuditPeripheralRecord` and `NewHardwareAuditPeripheralRecord` types.

#### [NEW] `backend/drizzle/0012_hardware_audit_peripherals.sql`
- SQL migration creating `hardware_audit_peripherals` table and index on `audit_id`.
- Run DDL on Postgres dev database.

### 2. Domain & Validation Layer

#### [MODIFY] `backend/src/domain/hardwareAudit.ts`
- Define `hardwareAuditPeripheralSchema` and `HardwareAuditPeripheral` type.
- Update `hardwareAuditPayloadSchema` to accept `hasPeripheral`, `peripherals: z.array(hardwareAuditPeripheralSchema)`, `osName`, `hostname`, `macAddresses`.

#### [MODIFY] `backend/src/domain/hardwareAudit.test.ts`
- Add unit tests verifying peripheral validation:
  - Valid multi-peripheral array with preset (Printer, Scanner, Monitor) and custom categories.
  - Normalizing empty serial numbers to `null`.
  - Rejecting empty category or brandModel.
  - Batch audit payload with peripherals.

### 3. Service Layer

#### [MODIFY] `backend/src/services/hardwareAuditService.ts`
- Update `processHardwareAuditIngest`:
  - When audit record is inserted, iterate and batch insert all peripherals into `hardware_audit_peripherals`.
  - If auto-synced (`SYNCED_AUTO`), also add accessories into `assetAccessories` for the matched computer.
- Update `getHardwareAudits`:
  - Fetch attached peripherals for all audits returned and attach `peripherals` array to each item.
- Update `createAssetFromAudit`:
  - When creating the new computer asset, query attached peripherals from `hardware_audit_peripherals` and populate `assetAccessories`.
- Update `linkAuditToAsset`:
  - When linking to an existing computer asset, copy/sync attached peripherals to `assetAccessories`.

### 4. Collector Scripts

#### [MODIFY] `hardware-collector/src/AMS-Collector.ps1`
- Mirror the peripheral form, dynamic custom category panel, and single-shot scan & sync logic from `hardware-collector/launcher/AMS-Collector.ps1`.

### 5. Frontend UI Layer

#### [MODIFY] `frontend/src/app/dashboard/hardware-audits/page.tsx`
- Update `HardwareAuditItem` interface to include `peripherals?: HardwareAuditPeripheral[]` and `hasPeripheral?: boolean`.
- In audit card rendering:
  - Add peripheral badge counter and collapsible/detailed list showing Category, Brand/Model, Serial Number.
  - Distinguish custom categories (DLL) with special badge styling.
- In Link Modal and Create Asset Modal:
  - Display summary of attached peripherals that will be linked to the computer asset.

## Verification Plan

### Automated Tests
- `npm test` in `backend` - all tests including new hardware audit peripheral tests pass.
- `npm run build` in `frontend` - typecheck and build succeeds with zero errors.

### Integration / Manual Verification
- Test `POST /api/v1/hardware-audits/ingest` with multi-peripheral payload (Printer, Scanner, Monitor, Barcode Scanner).
- Test `GET /api/v1/hardware-audits` and verify peripherals are returned.
- Test `create-asset` from the audit and check that `assetAccessories` are populated.
