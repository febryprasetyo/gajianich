export interface UserItem {
  groupIds?:number[];
  id: number;
  username: string;
  email?: string;
  roleId: number | null;
  role: string;
  employeeId: number | null;
  status: "active" | "inactive";
  mustChangePassword?: boolean;
  createdAt: string;
  updatedAt: string;
  roleCode?: string | null;
  roleName?: string | null;
  roleIsSystem?: boolean | null;
  employeeName?: string | null;
  employeeCode?: string | null;
  whatsappNotifiedAt?: string | null;
}

export interface RoleItem {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  createdAt: string;
  permissionIds: number[];
  permissionCount: number;
}

export interface PermissionItem {
  id: number;
  code: string;
  name: string;
  module: string;
  description?: string | null;
  createdAt: string;
}

export interface ModuleGroup {
  module: string;
  permissions: PermissionItem[];
}

export interface UserFormData {
  groupIds?:number[];
  username: string;
  email?: string;
  password?: string;
  roleId: number;
  employeeId?: number | null;
  status: "active" | "inactive";
}

export interface RoleFormData {
  code: string;
  name: string;
  description?: string;
}

export interface UnprovisionedEmployeeItem {
  id: number;
  employeeCode: string;
  fullName: string;
  department: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  hasValidPhone: boolean;
  email: string | null;
  hasAccount: boolean;
  userId: number | null;
  username: string | null;
  whatsappNotifiedAt: string | null;
}

export interface UnprovisionedSummaryResponse {
  totalActiveEmployees: number;
  unprovisionedCount: number;
  unnotifiedCount: number;
  employees: UnprovisionedEmployeeItem[];
}

export interface BulkProvisionBlastResultItem {
  employeeId: number;
  fullName: string;
  username: string;
  phone: string | null;
  normalizedPhone?: string | null;
  temporaryPassword: string;
  whatsappMessage?: string;
  whatsappLink?: string | null;
  whatsappStatus: 'sent' | 'failed' | 'skipped_no_phone' | 'disabled';
  whatsappError?: string;
}

export interface BulkProvisionBlastResponse {
  total: number;
  created: number;
  whatsappSent: number;
  whatsappFailed: number;
  whatsappSkipped: number;
  results: BulkProvisionBlastResultItem[];
}
