# Asset Computer Specifications and XLSX Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persistent laptop/PC specifications and bundled accessories, plus a validated XLSX template and atomic admin import flow for computers and durable peripherals.

**Architecture:** Keep the existing `assets` table as the inventory source of truth and add one-to-one computer specifications plus one-to-many simple accessories. Isolate workbook generation/parsing and import validation in focused services, then connect them to admin-only routes and the existing asset inventory UI.

**Tech Stack:** TypeScript, Node.js, Express, PostgreSQL, Drizzle ORM, Zod, ExcelJS, Multer, Next.js 16, React 19, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-01-asset-computer-specs-xlsx-import-design.md`

## Global Constraints

- Imported values are canonical; do not store raw alternatives or normalize hardware descriptions.
- Computer fields are exactly CPU name, RAM size in GB, RAM slot count, Disk 1 size in GB, and optional Disk 2 size in GB.
- Simple accessories have no asset code, serial number, independent assignment, or lifecycle history.
- Durable peripherals are normal assets with their own equipment type and asset code.
- XLSX imports are admin-only, limited to one `.xlsx` file of at most 5 MB, and reject formula cells.
- Preview never writes; commit revalidates and writes everything in one database transaction.
- Preserve the existing logical `assets.name` to physical `brand` column mapping.
- Preserve all pre-existing workspace changes. Before every commit, stage only task-specific hunks with `git add -p` for overlapping files and verify using `git diff --cached`.
- Run backend commands from `backend/` and frontend commands from `frontend/`.

---

## File Structure

### Backend files to create

- `backend/src/domain/assetDetails.ts` — canonical Zod schemas, types, and computer-category rules.
- `backend/src/domain/assetDetails.test.ts` — specification/accessory validation tests.
- `backend/src/domain/assetCode.ts` — deterministic sequence calculation used by create and import.
- `backend/src/domain/assetCode.test.ts` — code-allocation unit tests.
- `backend/src/services/assetDetailsPersistence.ts` — transactional child replacement behind a small repository interface.
- `backend/src/services/assetDetailsPersistence.test.ts` — repository-driven persistence behavior tests.
- `backend/src/services/assetWorkbook.ts` — workbook constants, template generation, scalar parsing, and formula rejection.
- `backend/src/services/assetWorkbook.test.ts` — real in-memory XLSX template/parser tests.
- `backend/src/services/assetImport.ts` — lookup validation, preview result construction, and transactional commit orchestration.
- `backend/src/services/assetImport.test.ts` — pure preview validation and repository-driven commit tests.
- `backend/src/controllers/assetImportController.ts` — HTTP download, preview, and commit handlers.
- `backend/src/db/assetComputerDetailsMigration.test.ts` — migration/schema contract tests.
- `frontend/src/lib/assetImport.ts` — import response types and pure UI state helpers.
- `frontend/src/lib/assetImport.test.mjs` — import-preview and role helper tests.

### Existing files to modify

- `backend/src/db/schema/assets.ts` — add `assetComputerSpecs` and `assetAccessories`.
- `backend/src/controllers/assetController.ts` — nested reads and transactional detail writes.
- `backend/src/routes/assetRoutes.ts` — ordered import endpoints and Multer guard.
- `backend/package.json` and `backend/package-lock.json` — add ExcelJS, Multer, and Multer types.
- `backend/drizzle/meta/_journal.json`, the next generated migration SQL, and its generated snapshot — journaled schema migration.
- `frontend/src/lib/api.ts` — authenticated Blob download and multipart upload.
- `frontend/src/lib/assetForm.ts` and `frontend/src/lib/assetForm.test.mjs` — conditional specification/accessory validation.
- `frontend/src/app/dashboard/assets/page.tsx` — admin role controls, spec/accessory form, XLSX workflow.
- `frontend/src/app/dashboard/assets/[id]/page.tsx` — specification and accessory cards.

---

### Task 1: Database schema and journaled migration

**Files:**
- Modify: `backend/src/db/schema/assets.ts`
- Create: `backend/src/db/assetComputerDetailsMigration.test.ts`
- Create (Drizzle-generated): next SQL migration and snapshot under `backend/drizzle/`
- Modify (Drizzle-generated): `backend/drizzle/meta/_journal.json`

**Interfaces:**
- Produces: `assetComputerSpecs` and `assetAccessories` Drizzle tables consumed by controllers and import services.
- Produces: database constraints for positive sizes/quantities and cascade deletion.

- [ ] **Step 1: Write the failing schema tests**

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { assetAccessories, assetComputerSpecs } from './schema/assets';

test('computer specifications require one asset and canonical numeric fields', () => {
  assert.equal(assetComputerSpecs.assetId.notNull, true);
  assert.equal(assetComputerSpecs.cpuName.notNull, true);
  assert.equal(assetComputerSpecs.ramSizeGb.notNull, true);
  assert.equal(assetComputerSpecs.ramSlotCount.notNull, true);
  assert.equal(assetComputerSpecs.disk1SizeGb.notNull, true);
  assert.equal(assetComputerSpecs.disk2SizeGb.notNull, false);
});

test('accessories require a parent, type, quantity, and condition', () => {
  assert.equal(assetAccessories.assetId.notNull, true);
  assert.equal(assetAccessories.accessoryType.notNull, true);
  assert.equal(assetAccessories.quantity.notNull, true);
  assert.equal(assetAccessories.condition.notNull, true);
});

test('journal contains computer detail tables and positive checks', () => {
  const journal = JSON.parse(readFileSync(resolve('drizzle/meta/_journal.json'), 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const sql = journal.entries
    .map(({ tag }) => readFileSync(resolve(`drizzle/${tag}.sql`), 'utf8'))
    .find((body) => body.includes('CREATE TABLE "asset_computer_specs"'));
  assert.ok(sql);
  assert.match(sql, /CREATE TABLE "asset_accessories"/);
  assert.match(sql, /ON DELETE cascade/);
  assert.match(sql, /CHECK/);
});
```

- [ ] **Step 2: Run the test and verify the missing exports fail**

Run: `npm test -- --test-name-pattern="computer specifications|accessories require|journal contains"` from `backend/`
Expected: FAIL because the two Drizzle tables do not exist.

- [ ] **Step 3: Add the Drizzle tables with database checks**

Add `integer`, `check`, and the two exports to `backend/src/db/schema/assets.ts`:

```ts
export const assetComputerSpecs = pgTable('asset_computer_specs', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' })
    .references(() => assets.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  cpuName: varchar('cpu_name', { length: 200 }).notNull(),
  ramSizeGb: integer('ram_size_gb').notNull(),
  ramSlotCount: integer('ram_slot_count').notNull(),
  disk1SizeGb: integer('disk_1_size_gb').notNull(),
  disk2SizeGb: integer('disk_2_size_gb'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check('asset_computer_specs_ram_size_positive', sql`${table.ramSizeGb} > 0`),
  check('asset_computer_specs_ram_slots_positive', sql`${table.ramSlotCount} > 0`),
  check('asset_computer_specs_disk_1_positive', sql`${table.disk1SizeGb} > 0`),
  check('asset_computer_specs_disk_2_positive', sql`${table.disk2SizeGb} IS NULL OR ${table.disk2SizeGb} > 0`),
]);

export const assetAccessories = pgTable('asset_accessories', {
  id: bigint('id', { mode: 'number' }).generatedAlwaysAsIdentity().primaryKey(),
  assetId: bigint('asset_id', { mode: 'number' })
    .references(() => assets.id, { onDelete: 'cascade' })
    .notNull(),
  accessoryType: varchar('accessory_type', { length: 50 }).notNull(),
  description: varchar('description', { length: 150 }),
  quantity: integer('quantity').default(1).notNull(),
  condition: varchar('condition', { length: 30 }).default('Good').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  check('asset_accessories_quantity_positive', sql`${table.quantity} > 0`),
]);
```

- [ ] **Step 4: Generate and inspect the journaled migration**

Run: `npm run db:generate` from `backend/`.
Expected: Drizzle creates the next migration, snapshot, and journal entry after existing `0004_melodic_vapor`.

Inspect the generated SQL and confirm it creates both tables, a unique constraint on `asset_computer_specs.asset_id`, positive checks, and `ON DELETE cascade` foreign keys. Do not edit or regenerate existing migration `0004_melodic_vapor.sql`.

- [ ] **Step 5: Run schema and migration tests**

Run: `npm test -- --test-name-pattern="computer specifications|accessories require|journal contains|journal exists"` from `backend/`
Expected: PASS.

- [ ] **Step 6: Commit only schema task changes**

```bash
git add -p backend/src/db/schema/assets.ts
git add backend/src/db/assetComputerDetailsMigration.test.ts backend/drizzle
git diff --cached --check
git diff --cached
git commit -m "feat: add computer specs and accessories schema"
```

### Task 2: Canonical detail validation and asset-code allocation

**Files:**
- Create: `backend/src/domain/assetDetails.ts`
- Create: `backend/src/domain/assetDetails.test.ts`
- Create: `backend/src/domain/assetCode.ts`
- Create: `backend/src/domain/assetCode.test.ts`

**Interfaces:**
- Produces: `computerSpecsSchema`, `accessorySchema`, `assetDetailsSchema`, `ComputerSpecsInput`, and `AccessoryInput`.
- Produces: `isComputerEquipmentType(name: string): boolean`.
- Produces: `allocateSequentialCodes(prefix: string, year: number, existingCodes: string[], count: number): string[]`.

- [ ] **Step 1: Write failing detail validation tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { assetDetailsSchema, isComputerEquipmentType } from './assetDetails';

test('computer details accept canonical positive values', () => {
  const result = assetDetailsSchema.parse({
    computerSpecs: { cpuName: 'Intel Core i5-1135G7', ramSizeGb: 12, ramSlotCount: 2, disk1SizeGb: 1024, disk2SizeGb: 256 },
    accessories: [{ accessoryType: 'Mouse', description: 'Logitech M100', quantity: 1, condition: 'Good', notes: null }],
  });
  assert.equal(result.computerSpecs.cpuName, 'Intel Core i5-1135G7');
});

test('computer details reject zero sizes and quantities', () => {
  assert.throws(() => assetDetailsSchema.parse({
    computerSpecs: { cpuName: 'CPU', ramSizeGb: 0, ramSlotCount: 2, disk1SizeGb: 512 },
    accessories: [{ accessoryType: 'Mouse', quantity: 0, condition: 'Good' }],
  }));
});

test('computer type matching is case insensitive and limited to laptop or pc', () => {
  assert.equal(isComputerEquipmentType('Laptop'), true);
  assert.equal(isComputerEquipmentType('pc'), true);
  assert.equal(isComputerEquipmentType('Printer'), false);
});
```

- [ ] **Step 2: Write failing code allocation tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateSequentialCodes } from './assetCode';

test('allocates a collision-free block after the highest valid sequence', () => {
  assert.deepEqual(
    allocateSequentialCodes('LPT', 2026, ['LPT-2026-0001', 'LPT-2026-0003', 'OTHER'], 2),
    ['LPT-2026-0004', 'LPT-2026-0005'],
  );
});
```

- [ ] **Step 3: Run tests to verify missing modules fail**

Run: `npm test -- --test-name-pattern="computer details|computer type|allocates a collision"` from `backend/`
Expected: FAIL with module-not-found errors.

- [ ] **Step 4: Implement the canonical schemas and helper**

Use strict positive integers and the existing condition values:

```ts
export const computerSpecsSchema = z.object({
  cpuName: z.string().trim().min(1).max(200),
  ramSizeGb: z.number().int().positive(),
  ramSlotCount: z.number().int().positive(),
  disk1SizeGb: z.number().int().positive(),
  disk2SizeGb: z.number().int().positive().nullable().optional(),
});

export const accessorySchema = z.object({
  accessoryType: z.string().trim().min(1).max(50),
  description: z.string().trim().max(150).nullable().optional(),
  quantity: z.number().int().positive().default(1),
  condition: z.enum(['Good', 'Fair', 'Poor', 'Damaged']).default('Good'),
  notes: z.string().trim().nullable().optional(),
});

export const assetDetailsSchema = z.object({
  computerSpecs: computerSpecsSchema,
  accessories: z.array(accessorySchema).default([]),
});

export function isComputerEquipmentType(name: string): boolean {
  return ['laptop', 'pc'].includes(name.trim().toLowerCase());
}
```

Implement `allocateSequentialCodes` by matching only `^PREFIX-YEAR-(\d+)$`, finding the maximum, and returning `count` zero-padded four-digit successors.

- [ ] **Step 5: Run focused tests**

Run: `npm test -- --test-name-pattern="computer details|computer type|allocates a collision"` from `backend/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/domain/assetDetails.ts backend/src/domain/assetDetails.test.ts backend/src/domain/assetCode.ts backend/src/domain/assetCode.test.ts
git diff --cached --check
git commit -m "feat: validate canonical asset details"
```

### Task 3: Transactional asset create/update and nested reads

**Files:**
- Modify: `backend/src/controllers/assetController.ts`
- Create: `backend/src/services/assetDetailsPersistence.ts`
- Create: `backend/src/services/assetDetailsPersistence.test.ts`

**Interfaces:**
- Consumes: schemas and types from `backend/src/domain/assetDetails.ts`.
- Consumes: `assetComputerSpecs` and `assetAccessories` tables.
- Produces: `replaceAssetDetails(repository, input): Promise<void>`.
- Produces: asset GET responses with `computerSpecs` and `accessories`.
- Produces: create/update support for `computerSpecs` and `accessories`.

- [ ] **Step 1: Write failing category/detail consistency tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { replaceAssetDetails, type AssetDetailsRepository } from './assetDetailsPersistence';

function recordingRepository() {
  const calls: Array<{ operation: string; value?: unknown }> = [];
  const repository: AssetDetailsRepository = {
    deleteComputerSpecs: async (assetId) => { calls.push({ operation: 'deleteSpecs', value: assetId }); },
    deleteAccessories: async (assetId) => { calls.push({ operation: 'deleteAccessories', value: assetId }); },
    insertComputerSpecs: async (value) => { calls.push({ operation: 'insertSpecs', value }); },
    insertAccessories: async (values) => { calls.push({ operation: 'insertAccessories', value: values }); },
  };
  return { calls, repository };
}

test('Laptop replaces specs and accessories in deterministic order', async () => {
  const { calls, repository } = recordingRepository();
  await replaceAssetDetails(repository, {
    assetId: 7,
    categoryName: 'Laptop',
    computerSpecs: { cpuName: 'Intel Core i5', ramSizeGb: 16, ramSlotCount: 2, disk1SizeGb: 512, disk2SizeGb: null },
    accessories: [{ accessoryType: 'Mouse', quantity: 1, condition: 'Good' }],
  });
  assert.deepEqual(calls.map((item) => item.operation), [
    'deleteSpecs', 'deleteAccessories', 'insertSpecs', 'insertAccessories',
  ]);
});

test('Printer rejects computer-only child values', async () => {
  const { repository } = recordingRepository();
  await assert.rejects(() => replaceAssetDetails(repository, {
    assetId: 8,
    categoryName: 'Printer',
    computerSpecs: { cpuName: 'CPU', ramSizeGb: 8, ramSlotCount: 1, disk1SizeGb: 256 },
    accessories: [],
  }), /Laptop or PC/i);
});

test('changing to a non-computer category removes existing child rows', async () => {
  const { calls, repository } = recordingRepository();
  await replaceAssetDetails(repository, {
    assetId: 9,
    categoryName: 'Printer',
    computerSpecs: null,
    accessories: [],
  });
  assert.deepEqual(calls.map((item) => item.operation), ['deleteSpecs', 'deleteAccessories']);
});
```

- [ ] **Step 2: Run tests and verify they fail on missing request/response fields**

Run: `npm test -- --test-name-pattern="replaces specs|rejects computer-only|removes existing child"` from `backend/`
Expected: FAIL because `assetDetailsPersistence.ts` does not exist.

- [ ] **Step 3: Extend create/update request schemas**

Merge these optional fields into the existing asset schemas without duplicating validation definitions:

```ts
computerSpecs: computerSpecsSchema.nullable().optional(),
accessories: z.array(accessorySchema).optional(),
```

Resolve the effective category before writing. For Laptop/PC, require `computerSpecs`; for other categories reject specs and non-empty accessories.

- [ ] **Step 4: Implement repository-driven child replacement**

```ts
export interface AssetDetailsRepository {
  deleteComputerSpecs(assetId: number): Promise<void>;
  deleteAccessories(assetId: number): Promise<void>;
  insertComputerSpecs(value: ComputerSpecsInput & { assetId: number }): Promise<void>;
  insertAccessories(values: Array<AccessoryInput & { assetId: number }>): Promise<void>;
}

export async function replaceAssetDetails(repository: AssetDetailsRepository, input: ReplaceAssetDetailsInput) {
  const computer = isComputerEquipmentType(input.categoryName);
  if (!computer && (input.computerSpecs || input.accessories.length > 0)) {
    throw new Error('Computer specifications and accessories require a Laptop or PC category');
  }
  if (computer && !input.computerSpecs) throw new Error('Computer specifications are required');
  await repository.deleteComputerSpecs(input.assetId);
  await repository.deleteAccessories(input.assetId);
  if (!computer) return;
  await repository.insertComputerSpecs({ assetId: input.assetId, ...input.computerSpecs! });
  if (input.accessories.length) {
    await repository.insertAccessories(input.accessories.map((item) => ({ assetId: input.assetId, ...item })));
  }
}
```

- [ ] **Step 5: Make controller create/update atomic**

Wrap base asset, specification, and accessory writes in `db.transaction`. On update:

1. update the asset;
2. delete existing specification/accessory rows;
3. insert the submitted computer specification and accessories only for Laptop/PC;
4. return the fully hydrated asset.

For generated asset codes, acquire a PostgreSQL transaction advisory lock keyed by category/year before reading existing codes, then call `allocateSequentialCodes`. Reuse the same locked helper for single asset creation and later XLSX import.

- [ ] **Step 6: Hydrate reads without row multiplication**

Keep the existing asset query as the base query. Fetch specs and accessories in additional `inArray(assetId, ids)` queries, group children in maps, and attach:

```ts
return {
  ...asset,
  computerSpecs: specsByAssetId.get(asset.id) ?? null,
  accessories: accessoriesByAssetId.get(asset.id) ?? [],
};
```

Use the same hydration helper for list, detail, create, and update responses.

- [ ] **Step 7: Run backend tests and build**

Run: `npm test` from `backend/`
Expected: all tests PASS.

Run: `npm run build` from `backend/`
Expected: TypeScript compilation succeeds.

- [ ] **Step 8: Commit task-specific hunks**

```bash
git add -p backend/src/controllers/assetController.ts
git add backend/src/services/assetDetailsPersistence.ts backend/src/services/assetDetailsPersistence.test.ts
git diff --cached --check
git diff --cached
git commit -m "feat: persist asset computer details"
```

### Task 4: XLSX template and parser

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Create: `backend/src/services/assetWorkbook.ts`
- Create: `backend/src/services/assetWorkbook.test.ts`

**Interfaces:**
- Produces: `buildAssetImportTemplate(): Promise<Buffer>`.
- Produces: `parseAssetImportWorkbook(buffer: Buffer): Promise<ParsedAssetWorkbook>`.
- Produces: exact header constants `LAPTOP_PC_HEADERS`, `OTHER_ASSET_HEADERS`, and `ACCESSORY_HEADERS`.

- [ ] **Step 1: Install workbook and multipart dependencies**

Run from `backend/`:

```bash
npm install exceljs multer
npm install --save-dev @types/multer
```

Expected: package manifest and lockfile contain the new dependencies.

- [ ] **Step 2: Write failing workbook contract tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import ExcelJS from 'exceljs';
import { buildAssetImportTemplate, parseAssetImportWorkbook } from './assetWorkbook';

test('template exposes the four exact sheets and headers', async () => {
  const buffer = await buildAssetImportTemplate();
  const workbook = await new ExcelJS.Workbook().xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ['Petunjuk', 'Laptop-PC', 'Other Assets', 'Accessories']);
  assert.equal(workbook.getWorksheet('Laptop-PC')!.getCell('A1').value, 'Computer Reference');
  assert.equal(workbook.getWorksheet('Accessories')!.getCell('F1').value, 'Notes');
});

test('parser rejects formula cells', async () => {
  const buffer = await buildAssetImportTemplate();
  const workbook = await new ExcelJS.Workbook().xlsx.load(buffer);
  workbook.getWorksheet('Laptop-PC')!.getCell('K2').value = { formula: '1+1', result: 2 };
  const formulaBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  await assert.rejects(() => parseAssetImportWorkbook(formulaBuffer), /formula/i);
});
```

- [ ] **Step 3: Run workbook tests and verify missing module/functions fail**

Run: `npm test -- --test-name-pattern="template exposes|parser rejects formula"` from `backend/`
Expected: FAIL because `assetWorkbook.ts` does not exist.

- [ ] **Step 4: Implement template generation**

Create the four sheets and exact headers from the spec. Style headers, freeze the header row, set readable widths, mark required columns, add examples only to `Petunjuk`, and add list validation for:

- Device Type: `LAPTOP,PC`
- Assignment Type: `EMPLOYEE,SHARED`
- Condition: `Good,Fair,Poor,Damaged`

Return `Buffer.from(await workbook.xlsx.writeBuffer())`.

- [ ] **Step 5: Implement strict scalar parsing**

Define parsed row types for computers, other assets, and accessories. Reject missing/renamed sheets, out-of-order headers, rich text, hyperlinks, and formula values. Accept plain strings, finite numbers, blank cells, and Excel Date values. Convert dates to an ISO date string only as structural parsing; do not rewrite CPU, brand, model, or accessory descriptions.

- [ ] **Step 6: Run workbook tests**

Run: `npm test -- --test-name-pattern="template exposes|parser rejects formula"` from `backend/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/package.json backend/package-lock.json backend/src/services/assetWorkbook.ts backend/src/services/assetWorkbook.test.ts
git diff --cached --check
git commit -m "feat: generate and parse asset xlsx template"
```

### Task 5: Import preview validation and atomic commit service

**Files:**
- Create: `backend/src/services/assetImport.ts`
- Create: `backend/src/services/assetImport.test.ts`

**Interfaces:**
- Consumes: `ParsedAssetWorkbook` from `assetWorkbook.ts`.
- Produces: `validateAssetImport(workbook, lookup): AssetImportPreview`.
- Produces: `loadAssetImportLookup(database): Promise<AssetImportLookup>`.
- Produces: `commitAssetImport(database, workbook, actor): Promise<AssetImportCommitResult>`.

- [ ] **Step 1: Write failing pure validation tests**

Create fixture rows and lookup maps, then assert:

```ts
test('validates references and returns canonical rows without writing', () => {
  const preview = validateAssetImport(validWorkbook, validLookup);
  assert.equal(preview.valid, true);
  assert.equal(preview.summary.computers, 1);
  assert.equal(preview.summary.accessories, 1);
  assert.equal(preview.errors.length, 0);
});

test('uses employee code as authority and warns on a different name', () => {
  const preview = validateAssetImport(workbookWithDifferentEmployeeName, validLookup);
  assert.equal(preview.valid, true);
  assert.match(preview.warnings[0].message, /employee name/i);
});

test('rejects duplicate codes, missing references, and invalid accessory parents', () => {
  const preview = validateAssetImport(invalidWorkbook, validLookup);
  assert.equal(preview.valid, false);
  assert.ok(preview.errors.some((item) => item.sheet === 'Accessories' && item.row === 2));
});
```

- [ ] **Step 2: Run tests and verify missing service fails**

Run: `npm test -- --test-name-pattern="validates references|employee code as authority|invalid accessory parents"` from `backend/`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement preview types and pure validation**

Use these public shapes:

```ts
export interface AssetImportMessage {
  sheet: 'Laptop-PC' | 'Other Assets' | 'Accessories';
  row: number;
  field?: string;
  message: string;
}

export interface AssetImportPreview {
  valid: boolean;
  summary: { computers: number; otherAssets: number; accessories: number; warnings: number; errors: number };
  rows: ParsedAssetWorkbook;
  warnings: AssetImportMessage[];
  errors: AssetImportMessage[];
}
```

Validate positive integers, required Brand-or-Model, exact Device/Assignment/Condition values, employee/location/category references, workbook-local Computer Reference uniqueness, accessory parent references, and duplicate codes/serials inside and outside the workbook.

- [ ] **Step 4: Implement lookup loading**

Load active employees by `employeeCode`, locations by `code`, categories by lowercase name, and existing non-empty asset codes/serial numbers. Preserve database IDs and category prefixes in lookup values.

- [ ] **Step 5: Write repository-driven commit tests**

Use a fake transaction repository that records calls. Assert commit order and rollback propagation:

```ts
test('commit creates computer, specs, accessories, assignment, and audit in one transaction', async () => {
  const repository = createRecordingImportRepository();
  const result = await commitAssetImport(repository, validPreview, actor);
  assert.deepEqual(repository.calls.map((call) => call.type), [
    'asset', 'computerSpecs', 'accessories', 'assignmentHistory', 'auditLog',
  ]);
  assert.equal(result.computersCreated, 1);
});

test('commit surfaces transaction failure without a partial success result', async () => {
  const repository = createFailingImportRepository('accessories');
  await assert.rejects(() => commitAssetImport(repository, validPreview, actor));
  assert.equal(repository.committed, false);
});
```

- [ ] **Step 6: Implement the database repository and commit orchestration**

Use one `db.transaction`. Acquire per-category/year advisory locks before allocating missing codes. Insert base assets, specs, accessories, assignment histories, and audit logs. For shared durable assets, set location and `Available`; for employee assets, set employee/location and `Assigned`. Return counts plus created IDs only after the transaction resolves.

- [ ] **Step 7: Run import service tests and backend build**

Run: `npm test -- --test-name-pattern="validates references|employee code as authority|invalid accessory parents|commit creates|transaction failure"` from `backend/`
Expected: PASS.

Run: `npm run build` from `backend/`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/services/assetImport.ts backend/src/services/assetImport.test.ts
git diff --cached --check
git commit -m "feat: validate and commit asset imports"
```

### Task 6: Admin-only import HTTP endpoints

**Files:**
- Create: `backend/src/controllers/assetImportController.ts`
- Modify: `backend/src/routes/assetRoutes.ts`
- Modify: `backend/src/routes/assetRoutes.test.ts`

**Interfaces:**
- Consumes: workbook and import services.
- Produces: `GET /assets/import/template`, `POST /assets/import/preview`, and `POST /assets/import/commit`.

- [ ] **Step 1: Extend route contract tests first**

```ts
test('asset import routes are registered before the dynamic asset id route', () => {
  const paths = router.stack.flatMap((layer: any) => layer.route ? [layer.route.path] : []);
  assert.ok(paths.indexOf('/import/template') < paths.indexOf('/:id'));
  assert.ok(paths.indexOf('/import/preview') < paths.indexOf('/:id'));
  assert.ok(paths.indexOf('/import/commit') < paths.indexOf('/:id'));
});

test('asset import endpoints expose download and upload methods', () => {
  assert.deepEqual(registeredMethods('/import/template'), ['get']);
  assert.deepEqual(registeredMethods('/import/preview'), ['post']);
  assert.deepEqual(registeredMethods('/import/commit'), ['post']);
});
```

- [ ] **Step 2: Run route tests and verify failure**

Run: `npm test -- --test-name-pattern="asset import routes|asset import endpoints"` from `backend/`
Expected: FAIL because routes are absent.

- [ ] **Step 3: Implement HTTP handlers**

`downloadAssetImportTemplate` sets the XLSX content type and attachment filename `ams-asset-import-template.xlsx`. Preview and commit reject a missing file, call `parseAssetImportWorkbook`, load lookups, validate, and return the response rules from the spec. Convert Zod/workbook errors to HTTP 400 and unexpected errors to a generic HTTP 500 response.

- [ ] **Step 4: Add route-local Multer configuration and ordered routes**

```ts
const uploadXlsx = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    callback(null, file.originalname.toLowerCase().endsWith('.xlsx'));
  },
});

router.get('/import/template', adminOnly, downloadAssetImportTemplate);
router.post('/import/preview', adminOnly, uploadXlsx.single('file'), previewAssetImport);
router.post('/import/commit', adminOnly, uploadXlsx.single('file'), commitAssetImportUpload);
```

Place these routes before `router.get('/:id', ...)`.

- [ ] **Step 5: Run route tests, all backend tests, and build**

Run: `npm test` from `backend/`
Expected: PASS.

Run: `npm run build` from `backend/`
Expected: PASS.

- [ ] **Step 6: Commit task-specific hunks**

```bash
git add backend/src/controllers/assetImportController.ts
git add -p backend/src/routes/assetRoutes.ts backend/src/routes/assetRoutes.test.ts
git diff --cached --check
git diff --cached
git commit -m "feat: expose admin asset import endpoints"
```

### Task 7: Frontend API helpers and form/import rules

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/lib/assetForm.ts`
- Modify: `frontend/src/lib/assetForm.test.mjs`
- Create: `frontend/src/lib/assetImport.ts`
- Create: `frontend/src/lib/assetImport.test.mjs`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `api.upload<T>(endpoint: string, formData: FormData): Promise<T>`.
- Produces: `api.download(endpoint: string): Promise<Blob>`.
- Produces: `canManageAssets(roleName?: string): boolean`.
- Produces: `canCommitAssetImport(preview: AssetImportPreview | null, submitting: boolean): boolean`.
- Extends: `canSubmitAssetForm` with conditional computer-detail validation.

- [ ] **Step 1: Write failing pure frontend tests**

Add these cases:

```js
test('Laptop requires complete computer specs but permits an empty Disk 2', () => {
  assert.equal(canSubmitAssetForm(validLaptopForm), true);
  assert.equal(canSubmitAssetForm({ ...validLaptopForm, ramSizeGb: 0 }), false);
});

test('Printer ignores computer-only fields', () => {
  assert.equal(canSubmitAssetForm(validPrinterForm), true);
});

test('only asset admins can import and invalid previews cannot commit', () => {
  assert.equal(canManageAssets('ITAdmin'), true);
  assert.equal(canManageAssets('Employee'), false);
  assert.equal(canCommitAssetImport({ valid: false, errors: [{}] }, false), false);
});
```

- [ ] **Step 2: Run frontend tests and verify failure**

Run: `npm test` from `frontend/`
Expected: FAIL because the new inputs/helpers do not exist.

- [ ] **Step 3: Extend form rules and add import types/helpers**

Add nullable numeric inputs for RAM/disk fields and validate them only when `isComputerType` is true. Accessory rows require type, positive integer quantity, and a valid condition. Normalize role names the same way as backend middleware.

- [ ] **Step 4: Implement authenticated Blob and multipart requests**

Refactor header creation so JSON Content-Type is omitted for `FormData`, allowing the browser to set its multipart boundary. Add:

```ts
upload: <T>(endpoint: string, formData: FormData) =>
  apiFetch<T>(endpoint, { method: 'POST', body: formData }),

download: async (endpoint: string) => {
  const response = await authenticatedFetch(endpoint, { method: 'GET' });
  if (!response.ok) throw await responseError(response);
  return response.blob();
},
```

Keep existing JSON `get`, `post`, `put`, and `delete` behavior unchanged.

- [ ] **Step 5: Run tests and lint the helper files**

Run: `npm test` from `frontend/`
Expected: PASS.

Run: `npx eslint src/lib/api.ts src/lib/assetForm.ts src/lib/assetImport.ts` from `frontend/`
Expected: PASS.

- [ ] **Step 6: Commit helper changes**

```bash
git add -p frontend/src/lib/api.ts frontend/src/lib/assetForm.ts frontend/src/lib/assetForm.test.mjs frontend/package.json
git add frontend/src/lib/assetImport.ts frontend/src/lib/assetImport.test.mjs
git diff --cached --check
git diff --cached
git commit -m "feat: add asset detail and import client rules"
```

### Task 8: Asset create/edit and detail UI

**Files:**
- Modify: `frontend/src/app/dashboard/assets/page.tsx`
- Modify: `frontend/src/app/dashboard/assets/[id]/page.tsx`

**Interfaces:**
- Consumes: nested `computerSpecs` and `accessories` API fields.
- Consumes: form validation helpers from `assetForm.ts`.
- Produces: editable computer fields and repeatable accessory rows.

- [ ] **Step 1: Extend frontend Asset types and local form state**

Use these shapes consistently on list and detail pages:

```ts
interface ComputerSpecs {
  cpuName: string;
  ramSizeGb: number;
  ramSlotCount: number;
  disk1SizeGb: number;
  disk2SizeGb?: number | null;
}

interface AssetAccessory {
  id?: number;
  accessoryType: string;
  description?: string | null;
  quantity: number;
  condition: 'Good' | 'Fair' | 'Poor' | 'Damaged';
  notes?: string | null;
}
```

- [ ] **Step 2: Add conditional computer inputs**

Derive `isComputerType` from the selected category name. Show CPU Name, RAM Size, RAM Slot Count, Disk 1 Size, and optional Disk 2 Size only for Laptop/PC. Populate values when editing and submit:

```ts
computerSpecs: isComputerType ? {
  cpuName: formCpuName.trim(),
  ramSizeGb: Number(formRamSizeGb),
  ramSlotCount: Number(formRamSlotCount),
  disk1SizeGb: Number(formDisk1SizeGb),
  disk2SizeGb: formDisk2SizeGb === '' ? null : Number(formDisk2SizeGb),
} : null,
```

- [ ] **Step 3: Add repeatable accessory inputs**

Provide Add/Remove controls and inputs for type, description, quantity, condition, and notes. Reset accessory state on create; clone existing values on edit. Submit `accessories: []` when a computer has none and no accessories for non-computer assets.

- [ ] **Step 4: Render detail cards**

On laptop/PC detail, render a Computer Specifications card and an Accessories table. Use `—` for absent Disk 2 and show an explicit `No accessories recorded` empty state.

- [ ] **Step 5: Run frontend tests, lint, and build**

Run: `npm test` from `frontend/`
Expected: PASS.

Run: `npm run lint` from `frontend/`
Expected: PASS with no new warnings in modified files.

Run: `npm run build` from `frontend/`
Expected: production build succeeds.

- [ ] **Step 6: Commit task-specific hunks**

```bash
git add -p frontend/src/app/dashboard/assets/page.tsx frontend/src/app/dashboard/assets/[id]/page.tsx
git diff --cached --check
git diff --cached
git commit -m "feat: edit and view computer asset details"
```

### Task 9: XLSX import modal and role-aware inventory controls

**Files:**
- Modify: `frontend/src/app/dashboard/assets/page.tsx`
- Modify: `frontend/src/components/layout/DashboardLayout.tsx`

**Interfaces:**
- Consumes: `api.download`, `api.upload`, import response types, and role helpers.
- Produces: template download, XLSX preview, commit confirmation, and role-hidden mutation controls.

- [ ] **Step 1: Hide unauthorized mutation controls**

Read the authenticated user from `useAuth`, compute `canManageAssets`, and hide Add, Edit, Delete, Download Template, and Import controls for unauthorized roles. Keep assignment controls available only for `SuperAdmin`, `ITAdmin`, and `ITStaff`. Filter or disable sidebar master-management entries consistently without blocking read-only navigation that the backend permits.

- [ ] **Step 2: Add template download**

Call `api.download('/assets/import/template')`, create an object URL, click a temporary anchor named `ams-asset-import-template.xlsx`, revoke the URL, and surface errors in the existing page error UI.

- [ ] **Step 3: Add XLSX selection and preview modal**

Accept one `.xlsx` file, put it in `FormData` under `file`, and call `/assets/import/preview`. Render totals plus row messages with sheet, row, field, and message. Preserve the selected `File` object for commit.

- [ ] **Step 4: Add guarded commit**

Disable commit when preview is absent, invalid, has any errors, or a request is in flight. Re-upload the same file to `/assets/import/commit`; on success close the modal, show created counts, and await `fetchAssets()`.

- [ ] **Step 5: Add accessible error and loading states**

The modal must show upload, preview, and commit progress separately; retain validation results after a failed commit; allow cancel when no commit is running; and reset file/preview state when closed.

- [ ] **Step 6: Run frontend verification**

Run: `npm test` from `frontend/`
Expected: PASS.

Run: `npm run lint` from `frontend/`
Expected: PASS.

Run: `npm run build` from `frontend/`
Expected: PASS.

- [ ] **Step 7: Commit task-specific hunks**

```bash
git add -p frontend/src/app/dashboard/assets/page.tsx frontend/src/components/layout/DashboardLayout.tsx
git diff --cached --check
git diff --cached
git commit -m "feat: add xlsx asset import workflow"
```

### Task 10: End-to-end verification and documentation alignment

**Files:**
- Modify only if verification finds an implementation/spec mismatch: `docs/superpowers/specs/2026-09-01-asset-computer-specs-xlsx-import-design.md`
- Modify only if user-facing setup changes: `README.md`

**Interfaces:**
- Consumes: all prior task deliverables.
- Produces: verified, release-ready feature with no partial import behavior.

- [ ] **Step 1: Run complete backend verification**

Run from `backend/`:

```bash
npm test
npm run build
```

Expected: all tests pass or database-dependent tests explicitly skip only when `TEST_DATABASE_URL` is absent; TypeScript build succeeds.

- [ ] **Step 2: Run complete frontend verification**

Run from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Expected: all commands exit zero.

- [ ] **Step 3: Run root validation that does not require destructive state changes**

Run from the repository root:

```bash
npm run build
bash scripts/validate-compose.sh prod
```

Expected: backend/frontend builds and production Compose validation pass.

- [ ] **Step 4: Manually exercise the XLSX contract against a development database**

1. Download the template as an admin.
2. Enter one laptop with two accessories, one shared printer, and one employee scanner.
3. Preview and verify zero errors.
4. Confirm database counts do not change after preview.
5. Commit and verify all assets/details/history/audit entries appear.
6. Upload the same workbook again and verify duplicate validation prevents a second commit.
7. Attempt import as Employee and verify HTTP 403 plus hidden UI controls.

- [ ] **Step 5: Review the final diff for pre-existing-change safety**

Run:

```bash
git status --short
git diff --check
git diff --stat
```

Compare the final diff with the baseline dirty files recorded before implementation. Confirm unrelated changes in CI, equipment types, infrastructure, Next configuration, and root scripts were neither reverted nor accidentally included in feature commits.

- [ ] **Step 6: Commit only verification-driven fixes**

If verification required changes, stage only those hunks, inspect `git diff --cached`, and commit:

```bash
git commit -m "test: verify asset xlsx import workflow"
```

If no files changed, do not create an empty commit.
