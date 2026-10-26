'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { UserItem, RoleItem, PermissionItem, ModuleGroup, UserFormData, RoleFormData } from '@/lib/access/types';
import UserStatsCard from '@/components/access/UserStatsCard';
import UserTable from '@/components/access/UserTable';
import UserFormModal from '@/components/access/UserFormModal';
import ResetPasswordModal from '@/components/access/ResetPasswordModal';
import TemporaryPasswordModal from '@/components/access/TemporaryPasswordModal';
import RoleListPanel from '@/components/access/RoleListPanel';
import RoleFormModal from '@/components/access/RoleFormModal';
import PermissionMatrixPanel from '@/components/access/PermissionMatrixPanel';
import {
  ShieldCheck,
  UserRoundCog,
  Users,
  Shield,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

export default function AccessManagementPage() {
  const { user: currentUser } = useAuth();

  const normRole = (currentUser?.roleName || (currentUser as any)?.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  const isHrd = normRole === "hrattendance" || normRole === "hrd" || normRole.includes("hr") || normRole.includes("attendance");
  const canManageRoles = Boolean(
    currentUser?.permissions?.includes("*") ||
    currentUser?.permissions?.includes("access.roles.manage")
  );

  const [activeTab, setActiveTab] = useState<'users' | 'roles'>('users');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [moduleGroups, setModuleGroups] = useState<ModuleGroup[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals state
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<UserItem | null>(null);

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [temporaryPasswordData, setTemporaryPasswordData] = useState<{
    username: string;
    email: string;
    temporaryPassword: string;
    isReset?: boolean;
  } | null>(null);

  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const promises: [Promise<any>, Promise<any>, Promise<any>, Promise<any>?] = [
        api.get<{ users: UserItem[] }>('/users').catch(() => ({ users: [] })),
        api.get<{ roles: RoleItem[] }>('/roles').catch(() => ({ roles: [] })),
        api.get<any>('/employees').catch(() => []),
      ];

      if (canManageRoles) {
        promises.push(
          api.get<{ permissions: PermissionItem[]; modules: ModuleGroup[] }>('/roles/permissions').catch(() => ({
            permissions: [],
            modules: [],
          }))
        );
      }

      const results = await Promise.all(promises);
      const usersRes = results[0];
      const rolesRes = results[1];
      const employeesRes = results[2];
      const permsRes = canManageRoles && results[3] ? results[3] : { permissions: [], modules: [] };

      const loadedUsers = usersRes.users || [];
      const loadedRoles = rolesRes.roles || [];
      const loadedModules = permsRes.modules || [];
      const loadedEmployees = Array.isArray(employeesRes) ? employeesRes : ((employeesRes as any)?.employees || (employeesRes as any)?.data || []);

      setUsers(loadedUsers);
      setRoles(loadedRoles);
      setModuleGroups(loadedModules);
      setEmployees(loadedEmployees);

      if (loadedRoles.length > 0 && selectedRoleId === null) {
        setSelectedRoleId(loadedRoles[0].id);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to load access control data');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRoleId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Selected role object
  const selectedRole = roles.find((r) => r.id === selectedRoleId) || roles[0] || null;

  // Handlers for User Management
  const handleSaveUser = async (formData: UserFormData) => {
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, formData);
        showToast('success', `User account ${formData.username} successfully updated`);
      } else {
        const res = await api.post<any>('/users', formData);
        showToast('success', `User account ${formData.username} successfully created`);
        if (res?.temporaryPassword) {
          setTemporaryPasswordData({
            username: formData.username,
            email: res?.user?.email || formData.email || '',
            temporaryPassword: res.temporaryPassword,
            isReset: false,
          });
        }
      }
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save user account');
      throw err;
    }
  };

  const handleToggleUserStatus = async (targetUser: UserItem, nextStatus: 'active' | 'inactive') => {
    try {
      await api.patch(`/users/${targetUser.id}/status`, { status: nextStatus });
      showToast('success', `User ${targetUser.username} is now ${nextStatus}`);
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to change account status');
    }
  };

  const handleResetPassword = async (userId: number) => {
    try {
      const res = await api.post<any>(`/users/${userId}/reset-password`, {});
      showToast('success', 'User password has been successfully reset');
      const targetUser = users.find((u) => u.id === userId);
      if (res?.temporaryPassword && targetUser) {
        setTemporaryPasswordData({
          username: targetUser.username,
          email: targetUser.email || "",
          temporaryPassword: res.temporaryPassword,
          isReset: true,
        });
      }
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to reset password');
      throw err;
    }
  };

  const handleDeleteUser = async (targetUser: UserItem) => {
    try {
      await api.delete(`/users/${targetUser.id}`);
      showToast('success', `User account ${targetUser.username} deleted`);
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete user account');
    }
  };

  // Handlers for Role & Permissions Management
  const handleSaveRole = async (formData: RoleFormData) => {
    try {
      if (editingRole) {
        await api.put(`/roles/${editingRole.id}`, formData);
        showToast('success', `Role ${formData.name} updated`);
      } else {
        const res = await api.post<{ role: RoleItem }>('/roles', formData);
        showToast('success', `Role ${formData.name} created`);
        if (res?.role?.id) {
          setSelectedRoleId(res.role.id);
        }
      }
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to save role');
      throw err;
    }
  };

  const handleDeleteRole = async (targetRole: RoleItem) => {
    try {
      await api.delete(`/roles/${targetRole.id}`);
      showToast('success', `Role ${targetRole.name} deleted`);
      setSelectedRoleId(null);
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete role');
    }
  };

  const handleSavePermissions = async (roleId: number, permissionIds: number[]) => {
    try {
      await api.put(`/roles/${roleId}/permissions`, { permissionIds });
      showToast('success', 'Role permission matrix successfully updated in database');
      await loadData();
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update role permissions');
      throw err;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Toast Feedback */}
      {toastMessage && (
        <div
          className={`p-3.5 px-4 rounded-xl border flex items-center justify-between text-xs font-medium shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <UserRoundCog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Manajemen Pengguna
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {isHrd
                  ? 'Kelola akun pengguna karyawan dan status akses absensi'
                  : 'Kelola akun pengguna, hak akses role, dan matriks wewenang'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Pengguna</span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
            {users.length}
          </span>
        </button>

        {canManageRoles && (
          <button
            type="button"
            onClick={() => setActiveTab('roles')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'roles'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Role & Hak Akses</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
              {roles.length}
            </span>
          </button>
        )}
      </div>

      {/* Content based on Active Tab */}
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs text-slate-500 font-medium">Loading access control configuration...</p>
        </div>
      ) : (activeTab === 'users' || !canManageRoles) ? (
        <div className="space-y-6">
          <UserStatsCard users={users} roles={roles} />
          <UserTable
            users={users}
            roles={roles}
            currentUserId={currentUser?.id}
            onAddUser={() => {
              setEditingUser(null);
              setIsUserModalOpen(true);
            }}
            onEditUser={(u) => {
              setEditingUser(u);
              setIsUserModalOpen(true);
            }}
            onResetPassword={(u) => {
              setResetPasswordUser(u);
            }}
            onToggleStatus={handleToggleUserStatus}
            onDeleteUser={handleDeleteUser}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4">
            <RoleListPanel
              roles={roles}
              selectedRoleId={selectedRole?.id || null}
              onSelectRole={(r) => setSelectedRoleId(r.id)}
              onAddRole={() => {
                setEditingRole(null);
                setIsRoleModalOpen(true);
              }}
              onEditRole={(r) => {
                setEditingRole(r);
                setIsRoleModalOpen(true);
              }}
              onDeleteRole={handleDeleteRole}
            />
          </div>

          <div className="lg:col-span-8">
            <PermissionMatrixPanel
              role={selectedRole}
              moduleGroups={moduleGroups}
              onSavePermissions={handleSavePermissions}
            />
          </div>
        </div>
      )}

      {/* User Form Modal */}
      <UserFormModal
        isOpen={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          setEditingUser(null);
        }}
        onSubmit={handleSaveUser}
        roles={roles}
        employees={employees}
        initialData={editingUser}
        isHrd={isHrd}
      />

      {/* Reset Password Modal */}
      <ResetPasswordModal
        isOpen={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        user={resetPasswordUser}
        onSubmit={handleResetPassword}
      />

      {/* Role Form Modal */}
      <RoleFormModal
        isOpen={isRoleModalOpen}
        onClose={() => {
          setIsRoleModalOpen(false);
          setEditingRole(null);
        }}
        onSubmit={handleSaveRole}
        initialData={editingRole}
      />

      {/* Temporary Password Modal */}
      <TemporaryPasswordModal
        isOpen={Boolean(temporaryPasswordData)}
        onClose={() => setTemporaryPasswordData(null)}
        data={temporaryPasswordData}
      />
      </div>
    </DashboardLayout>
  );
}
