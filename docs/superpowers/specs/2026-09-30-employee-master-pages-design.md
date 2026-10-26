# Design Specification: Employee Master Pages and Attendance Lifecycle

**Date:** 2026-09-30
**Status:** Approved design
**Feature:** Employee master data pages, filters, and safe lifecycle actions

## Summary

The employee master module will use dedicated pages for creating, viewing, and editing one employee. The create and edit pages share one form that covers the same 33 Talenta fields already supported by import and export.

The employee directory will separate current employees from historical employees. An employee who resigns or becomes inactive is retained with their attendance history. Permanent deletion is reserved for a mistaken or duplicate employee record that has no attendance history.

## Goals

- Add dedicated create, detail, and edit pages for employee master data.
- Show and accept all 33 Talenta fields in create and edit flows.
- Filter employees by Employee ID, department, and lifecycle status.
- Separate active employees from resigned and inactive employees to keep attendance selection and searching clear.
- Preserve attendance history when an employee resigns or becomes inactive.
- Allow permanent deletion only when the employee has no attendance history.

## Out of scope

- Asset, licence, ticket, and custodian integrations. This work is limited to attendance employee data.
- Creating departments from the employee form. Departments are managed only from the department master page.
- Merging duplicate employees or moving attendance records from one employee to another.
- Adding a resignation date or other fields outside the existing 33-field Talenta contract.

## Information architecture

| Purpose | Route | Behaviour |
| --- | --- | --- |
| Employee directory | `/dashboard/master/employees` | Shows Active and Archive tabs, filters, and row actions. |
| Create employee | `/dashboard/master/employees/new` | Shows the complete 33-field form. On success, opens the new employee detail page. |
| Employee detail | `/dashboard/master/employees/[id]` | Shows all fields read-only, grouped for scanning. |
| Edit employee | `/dashboard/master/employees/[id]/edit` | Reuses the create form with the selected employee values loaded. |

## Directory design

The directory has two separate tabs with their own tables:

| Tab | Included lifecycle statuses | Intended use |
| --- | --- | --- |
| Karyawan Aktif | `Active` | Current attendance master data. This is the default tab. |
| Nonaktif & Resign | `Inactive`, `Resigned` | Historical employee data and correction review. |

Each tab has an Employee ID search field and a department filter. The archive tab also has a lifecycle status filter with `Semua Status`, `Nonaktif`, and `Resign`. The active tab has the fixed lifecycle status `Active`, so a status filter there would not add information.

Each row has these actions:

- Lihat opens the employee detail page.
- Edit opens the employee edit page.
- Nonaktifkan or Tandai Resign changes the lifecycle status and moves the record to the archive tab.
- Hapus is available only when the employee has no attendance history.

The list does not display bank account, tax, or BPJS values.

## Two distinct statuses

The system maintains two independent values:

| Value | Purpose | Examples |
| --- | --- | --- |
| Status Employee | Employment type from Talenta field 8. It is mandatory. | Tetap, Kontrak, Magang |
| Lifecycle status | Determines active attendance eligibility and which directory tab contains the employee. | Active, Inactive, Resigned |

Creating an employee assigns lifecycle status `Active`. Status Employee does not change lifecycle status.

## Form design

The shared form groups the 33 Talenta fields into three sections. The section grouping is visual only. It does not alter the Talenta field mapping.

### Data pekerjaan

1. Employee ID
2. Full Name
3. Barcode (optional - default = employee ID)
4. Organization, represented by a required department selector
5. Job Position
6. Job Level
7. Join Date
8. Status Employee
9. Email

### Data pribadi dan kontak

10. Birth Date
11. Age
12. Birth Place
13. Citizen ID Address
14. Residential Address
15. Mobile Phone
16. Phone
17. Religion
18. Gender
19. Marital Status
20. Blood Type
21. Nationality Code

### Pajak, bank, dan kepesertaan

22. NPWP
23. PTKP Status
24. Employee Tax Status
25. Bank Name
26. Bank Account
27. Bank Account Holder
28. BPJS Ketenagakerjaan
29. BPJS Kesehatan
30. NIK (NPWP 16 Digit)
31. Currency
32. Length Of Service
33. NPWP 16 digit (new)

## Validation and save behaviour

- Required fields are Employee ID, Full Name, Department, and Status Employee.
- Employee ID is the application employee code. It must be unique.
- Email is optional. If populated, it must use a valid email format and must be unique.
- Department is selected only from the department master. The form cannot create a department.
- Phone, bank account, tax, NIK, and BPJS values are text inputs. This preserves leading zeroes.
- A validation error appears beside the field that needs correction. Entered values remain in the form.
- A successful create redirects to the corresponding detail page. A successful edit redirects to that employee's detail page.

## Detail page

The detail page uses the same three groups as the form. It shows `Belum diisi` for an empty optional value, and it shows the department name rather than an internal department ID. The page header includes Employee ID, name, department, lifecycle status, and actions that the user's permission allows.

Tax, bank, NIK, and BPJS fields remain visible on the detail page because the requirement is to display all 33 fields. They are never added to the directory table.

## Lifecycle and deletion policy

- Marking an employee Inactive or Resigned retains their employee record and all attendance history. The employee is no longer shown in the active attendance directory.
- A permanent delete requires an attendance-history check against the authoritative attendance record source.
- If attendance history exists, permanent deletion is blocked. The UI explains that historical attendance must be retained and offers lifecycle actions instead.
- If no attendance history exists, the UI asks for a destructive-action confirmation that identifies the employee by full name and Employee ID. A confirmed delete permanently removes the employee.
- The API must enforce the same rule. The client-side action alone is not a security boundary.
- If an authoritative attendance-history check is unavailable, deletion must fail closed rather than risk removing a historical record.

## Access and error handling

- Existing view permissions apply to the directory and detail page.
- Existing management permissions apply to create, edit, lifecycle changes, and permanent deletion.
- A missing employee returns a clear not-found state with a route back to the directory.
- Loading and request failures retain the current page state where possible and show an actionable message.
- A rejected delete explains whether attendance history is the cause.

## Implementation boundaries

The implementation will reuse the existing employee CRUD routes and full employee data shape. It will add page-level presentation and enforce the lifecycle and attendance-history rules. No database field beyond the existing employee data contract is required for the approved scope.

## Verification

- Create and edit save and reload every one of the 33 Talenta fields.
- The required-field, unique Employee ID, optional-email, and department validations behave as specified.
- The detail page presents every field and preserves the selected department display name.
- Active employees appear only in the Active tab. Inactive and resigned employees appear only in the Archive tab.
- Employee ID and department filters narrow the current tab. The archive status filter distinguishes Inactive from Resigned.
- An employee with attendance history cannot be permanently deleted and can be marked Inactive or Resigned.
- An employee without attendance history can be permanently deleted after confirmation.
- View and management permissions protect the correct actions.
