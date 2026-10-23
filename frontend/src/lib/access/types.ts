export interface UserItem {
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
