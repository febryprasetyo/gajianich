# Asset Computer Specifications and XLSX Import Design

**Date:** 2026-09-01

**Status:** Approved for planning

**Scope:** Persist laptop/PC specifications and bundled accessories, expose them in the asset UI/API, and import prepared legacy inventory from a controlled XLSX template.

## Objective

AMS must permanently store the computer specifications supplied by employees and allow administrators to migrate prepared legacy inventory from an XLSX workbook. Imported values are already normalized before upload, so AMS stores only canonical values and does not preserve raw alternatives or attempt data normalization.

This phase covers:

- one specification record per laptop or PC;
- CPU name, RAM size, RAM slot count, Disk 1 size, and optional Disk 2 size;
- structured, non-tagged accessories bundled with a laptop or PC;
- specification fields in asset create/edit and detail views;
- a downloadable XLSX template;
- XLSX preview validation and transactional import;
- durable peripherals represented as separate physical assets.

This phase does not add automatic hardware detection, an employee survey campaign, automatic issue ticket creation, or general-purpose dynamic asset attributes.

The inventory uses a hybrid peripheral policy:

- durable or independently traceable equipment such as printers, scanners, monitors, UPS units, external drives, and high-value docking stations are normal `assets` records with their own asset codes and lifecycle;
- simple, non-tagged equipment such as mice, keyboards, chargers, LAN cables, USB hubs, laptop bags, and basic adapters are accessory records attached to a laptop or PC and do not receive asset codes.

## Existing System Constraints

- `assets` is the inventory source of truth.
- `asset_categories` supplies equipment types and code prefixes.
- `employees`, `locations`, and `asset_assignment_history` supply assignment context.
- asset creation and updates are limited to `SuperAdmin` and `ITAdmin`.
- asset assignment lifecycle operations are limited to `SuperAdmin`, `ITAdmin`, and `ITStaff`.
- the existing logical `assets.name` field is stored in the database column named `brand`; the implementation must preserve this mapping for backward compatibility.
- the current workspace contains unrelated uncommitted asset/equipment-type work. Implementation must preserve and integrate with those changes rather than overwrite them.

## Data Model

Add a one-to-one `asset_computer_specs` table:

| Column | Type | Rule |
|---|---|---|
| `id` | bigint identity | Primary key |
| `asset_id` | bigint | Required, unique FK to `assets.id`, cascade on asset deletion |
| `cpu_name` | varchar(200) | Required non-empty canonical CPU name |
| `ram_size_gb` | integer | Required, greater than zero |
| `ram_slot_count` | integer | Required, greater than zero |
| `disk_1_size_gb` | integer | Required, greater than zero |
| `disk_2_size_gb` | integer | Optional; when present, greater than zero |
| `created_at` | timestamp | Defaults to current time |
| `updated_at` | timestamp | Defaults to current time and changes on update |

There is no raw-value column and no storage-device child table. Disk 1 and Disk 2 are intentionally represented as sizes on the one-to-one computer specification record.

Add an `asset_accessories` table for simple equipment bundled with a computer:

| Column | Type | Rule |
|---|---|---|
| `id` | bigint identity | Primary key |
| `asset_id` | bigint | Required FK to `assets.id`, cascade on asset deletion |
| `accessory_type` | varchar(50) | Required canonical type, such as Mouse or Keyboard |
| `description` | varchar(150) | Optional brand/model or distinguishing description |
| `quantity` | integer | Required, defaults to one, greater than zero |
| `condition` | varchar(30) | Required: Good, Fair, Poor, or Damaged |
| `notes` | text | Optional |
| `created_at` | timestamp | Defaults to current time |
| `updated_at` | timestamp | Defaults to current time and changes on update |

Accessory records do not have asset codes, serial numbers, independent assignments, or lifecycle histories. They remain part of the parent computer bundle. Equipment that needs those capabilities must be created as a normal asset instead.

Only assets categorized as `Laptop` or `PC`, matched case-insensitively by category name, may have computer specifications. The API enforces this rule. Existing non-computer assets remain unchanged.

The existing `assets.name` remains the display name. XLSX Brand and Model values are combined with a single space to create that display name. If only one value is provided, that value becomes the display name.

## API Representation

Asset list and detail responses gain an optional nested field:

```json
{
  "computerSpecs": {
    "cpuName": "Intel Core i5-1135G7",
    "ramSizeGb": 12,
    "ramSlotCount": 2,
    "disk1SizeGb": 1024,
    "disk2SizeGb": 256
  },
  "accessories": [
    {
      "id": 41,
      "accessoryType": "Mouse",
      "description": "Logitech M100",
      "quantity": 1,
      "condition": "Good",
      "notes": null
    }
  ]
}
```

For non-computer assets or computers without recorded specifications, `computerSpecs` is `null`.

Asset create and update requests accept the same optional `computerSpecs` object. Rules are:

- Laptop and PC create requests require a complete specification object.
- Disk 2 may be null or omitted.
- Non-computer categories reject a non-null specification object.
- Changing a computer asset to a non-computer category removes its specification record within the same transaction.
- Changing a non-computer asset to Laptop or PC requires valid computer specifications.
- Asset and specification writes occur in a single database transaction.

Laptop and PC create/update requests also accept an `accessories` array. Each entry follows the accessory table validation rules. Updating an asset replaces its accessory collection within the same transaction so removed rows do not remain stale. Non-computer assets reject non-empty accessory arrays.

## XLSX Workbook Template

The backend generates the workbook so the downloadable template and import validator share one header contract. ExcelJS is used for workbook reading, writing, cell formatting, date handling, and list validation.

The workbook contains four visible sheets.

### Sheet: Petunjuk

Contains:

- preparation instructions;
- required-field explanations;
- accepted date format (`DD/MM/YYYY`);
- accepted device types (`LAPTOP`, `PC`);
- durable-peripheral assignment types (`EMPLOYEE`, `SHARED`);
- numeric unit rules stating that RAM and disk sizes are entered in GB;
- the distinction between independently tracked assets and non-tagged accessories;
- a warning not to rename sheets or headers;
- examples that do not get imported.

### Sheet: Laptop-PC

The exact ordered headers are:

1. `Computer Reference`
2. `Employee Code`
3. `Employee Name`
4. `Device Type`
5. `Assigned Date`
6. `Asset Code`
7. `Brand`
8. `Model`
9. `Serial Number`
10. `Location Code`
11. `CPU Name`
12. `RAM Size GB`
13. `RAM Slot Count`
14. `Disk 1 Size GB`
15. `Disk 2 Size GB`
16. `Complaint / Notes`

Computer Reference is a workbook-local unique identifier such as `COMP-001`. It allows accessory rows to refer to a computer even when Asset Code is left blank and generated during commit.

Required fields are Computer Reference, Employee Code, Employee Name, Device Type, Assigned Date, CPU Name, RAM Size GB, RAM Slot Count, and Disk 1 Size GB. At least one of Brand or Model is required so an asset display name can be created. Asset Code, Serial Number, Location Code, Disk 2, and Complaint / Notes are optional.

### Sheet: Other Assets

The exact ordered headers are:

1. `Equipment Type`
2. `Asset Code`
3. `Brand`
4. `Model`
5. `Serial Number`
6. `Assignment Type`
7. `Employee Code`
8. `Location Code`
9. `Assigned Date`
10. `Notes`

Each row represents one durable physical device, such as a Printer, Scanner, Monitor, UPS, External HDD, or Docking Station. Equipment Type must match an AMS equipment type. At least one of Brand or Model is required. Assignment Type is required. `EMPLOYEE` requires Employee Code. `SHARED` requires Location Code. Assigned Date is required. A shared device from the legacy combined sheet must be converted into one `SHARED` asset row rather than duplicated for every employee who uses it.

### Sheet: Accessories

The exact ordered headers are:

1. `Computer Reference`
2. `Accessory Type`
3. `Description`
4. `Quantity`
5. `Condition`
6. `Notes`

Each row represents a simple, non-tagged accessory bundled with the referenced laptop or PC. Computer Reference must match a Laptop-PC row in the same workbook. Accessory Type, Quantity, and Condition are required. Quantity must be a positive integer. Condition must be Good, Fair, Poor, or Damaged. Description and Notes are optional.

## Import Endpoints

All import endpoints require `SuperAdmin` or `ITAdmin`.

### `GET /api/v1/assets/import/template`

Returns the generated XLSX workbook as an attachment. The route must be registered before `/:id` so Express does not interpret `import` as an asset ID.

### `POST /api/v1/assets/import/preview`

Accepts one multipart field named `file`.

Behavior:

1. Reject non-XLSX files and files larger than 5 MB.
2. Parse the four expected sheets.
3. Validate exact sheet names and headers.
4. Ignore completely blank rows.
5. Reject formula cells in import columns.
6. Validate required values, integer ranges, dates, and conditional fields.
7. Resolve employee codes, optional location codes, required equipment categories, and accessory Computer References.
8. Detect duplicate asset codes and serial numbers both inside the workbook and against the database.
9. Compare Employee Name to the resolved employee and produce a warning when it differs; Employee Code remains authoritative.
10. Return a preview without writing to the database.

The response contains per-sheet valid counts, warning counts, error counts, and row-level messages with sheet and Excel row numbers. It also includes the parsed rows required by the frontend preview table.

### `POST /api/v1/assets/import/commit`

Accepts the same workbook again. The frontend retains the selected file after preview and re-uploads it on confirmation. No uploaded workbook or parsed raw row is stored by AMS.

The endpoint repeats all validation to avoid trusting client preview state. When validation succeeds, one database transaction:

1. creates laptop/PC assets;
2. creates their computer specification records;
3. creates their accessory records;
4. creates durable peripheral assets;
5. sets current employee or location assignments;
6. creates employee assignment-history rows using Assigned Date;
7. records the authenticated administrator as the assigning user;
8. writes audit-log entries for imported assets.

If any insert fails, the transaction rolls back. The response reports created counts and asset identifiers. Import only creates new assets; an existing asset code or serial number is an error and is never overwritten.

## Asset Creation Rules During Import

- Missing Asset Code uses the existing category-prefix/year sequence generator.
- Code generation must be transaction-safe for a multi-row import and must not assign the same generated code twice.
- Laptop/PC status is `Assigned` when an employee is resolved.
- Laptop/PC location uses Location Code when supplied; otherwise it uses the employee's current location.
- Durable peripheral status is `Assigned` for employee assignments and `Available` for shared-location placement, matching existing lifecycle semantics.
- Complaint / Notes is preserved in `assets.notes` without creating a ticket.
- Accessory rows are stored in `asset_accessories` and are not duplicated in `assets.notes`.

An example accessory bundle is:

```text
Laptop: AST-LPT-2026-0001
├── Mouse — Logitech M100 — 1 — Good
├── Charger — Lenovo 65W — 1 — Good
└── USB Hub — 4 Port — 1 — Fair
```

- No ticket is created from a complaint during import.

## Frontend Design

### Inventory Page

For `SuperAdmin` and `ITAdmin`, add:

- `Download Import Template` button;
- `Import XLSX` button;
- file-selection modal limited to `.xlsx`;
- preview summary and row-level errors/warnings;
- disabled commit button while any validation error exists;
- success summary followed by inventory refresh.

Mutating controls on the inventory page must be hidden for roles that the backend does not authorize, preventing the current experience where unauthorized users see buttons that later fail with HTTP 403.

### Asset Create/Edit Form

When the selected equipment type is Laptop or PC, show:

- CPU Name;
- RAM Size (GB);
- RAM Slot Count;
- Disk 1 Size (GB);
- Disk 2 Size (GB), optional.

The form also provides repeatable accessory rows with Accessory Type, Description, Quantity, Condition, and Notes. Simple accessories do not receive asset codes. Durable peripherals are created through the normal asset form using their own equipment type.

Changing away from Laptop or PC hides the section and makes the submitted `computerSpecs` null. Client validation mirrors backend validation but backend validation remains authoritative.

### Asset Detail

Laptop/PC detail pages display a Computer Specifications card and an Accessories card. Disk 2 displays an em dash when absent. Non-computer assets do not display either card.

## Error Handling

- XLSX parsing failures return HTTP 400 with a user-readable workbook error.
- Header or sheet mismatches return HTTP 400 with the expected and received names.
- Row validation errors return HTTP 200 from preview because the workbook was processed successfully; the payload marks the preview invalid.
- Commit with validation errors returns HTTP 400 and the same row-error structure.
- Missing employee/category/location references report the exact sheet and row.
- Unexpected database or workbook errors return HTTP 500 without exposing stack traces or filesystem paths.
- Uploaded workbooks stay in memory only and are released after the request.

## Security and Operational Limits

- Imports require authentication and admin role checks.
- Route-level multipart parsing accepts a single file only.
- Maximum workbook size is 5 MB.
- Only the expected sheets and scalar cell values are processed.
- Formula cells are rejected.
- All imported text passes existing length limits and explicit import limits before database writes.
- Database transactions prevent partial imports.
- Audit logs identify the administrator who committed the workbook.

## Testing Strategy

### Backend

- schema/migration test for `asset_computer_specs` constraints and cascade behavior;
- unit tests for template headers;
- parser tests for valid laptop/PC, durable peripheral, and accessory rows;
- validation tests for missing fields, invalid dates, non-positive sizes, formulas, duplicate codes/serials, employee-name warnings, and assignment rules;
- controller tests showing preview performs no writes;
- transaction tests showing a failed row rolls back the entire commit;
- role tests for template, preview, and commit endpoints;
- asset create/update tests for category/specification consistency;
- accessory create/update/replacement and cascade tests;
- asset response tests for nested `computerSpecs` and `accessories`.

### Frontend

- form-rule tests for conditional computer specifications;
- import-preview state tests where errors disable commit;
- role-visibility tests for import and mutation controls where practical;
- lint and production build verification.

### Project Verification

- backend tests and TypeScript build;
- frontend tests, lint, and production build;
- root CI command where environment dependencies permit it.

## Acceptance Criteria

- An administrator can download an XLSX template that matches the validator exactly.
- A prepared workbook can be previewed without modifying inventory.
- Preview identifies errors using sheet and Excel row numbers.
- A valid commit creates assets, computer specifications, assignments, history, and audit entries atomically.
- CPU name, RAM size, RAM slot count, Disk 1 size, and optional Disk 2 size persist and appear in asset detail.
- Simple accessories persist as structured children of their laptop/PC without asset codes.
- Printers, scanners, monitors, UPS units, external drives, and high-value docks can be imported as independently tracked assets.
- Admins can create and edit the same specification fields outside import.
- Non-computer assets cannot retain computer specifications.
- Existing inventory behavior and unrelated local changes remain intact.
- AMS stores only canonical imported values and does not retain raw alternatives or normalize user data.
