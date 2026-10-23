'use client';

import React, { useState, useMemo } from 'react';
import { UserItem, RoleItem } from '@/lib/access/types';
import {
  Search,
  Filter,
  Plus,
  KeyRound,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  Shield,
  Briefcase,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import ConfirmDeleteModal from '@/components/ui/ConfirmDeleteModal';

interface UserTableProps {
  users: UserItem[];
  roles: RoleItem[];
  currentUserId?: number;
  onAddUser: () => void;
  onEditUser: (user: UserItem) => void;
  onResetPassword: (user: UserItem) => void;
  onToggleStatus: (user: UserItem, nextStatus: 'active' | 'inactive') => Promise<void>;
  onDeleteUser: (user: UserItem) => Promise<void>;
  isLoading?: boolean;
}

export default function UserTable({
  users,
  roles,
  currentUserId,
  onAddUser,
  onEditUser,
  onResetPassword,
  onToggleStatus,
  onDeleteUser,
  isLoading = false,
}: UserTableProps) {
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [statusLoadingId, setStatusLoadingId] = useState<number | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        u.username.toLowerCase().includes(search.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
        (u.employeeName && u.employeeName.toLowerCase().includes(search.toLowerCase()));

      const matchesRole =
        selectedRole === 'all' ||
        String(u.roleId) === selectedRole ||
        u.role.toLowerCase() === selectedRole.toLowerCase();

      const matchesStatus = selectedStatus === 'all' || u.status === selectedStatus;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, selectedRole, selectedStatus]);

  const handleStatusToggle = async (user: UserItem) => {
    const nextStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      setStatusLoadingId(user.id);
      await onToggleStatus(user, nextStatus);
    } finally {
      setStatusLoadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username, email, or employee..."
              className="w-full pl-9 pr-3.5 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400 hidden sm:inline" />
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
            >
              <option value="all">All Roles ({roles.length})</option>
              {roles.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-white"
          >
            <option value="all">All Status</option>
            <option value="active">Active Accounts</option>
            <option value="inactive">Inactive Accounts</option>
          </select>
        </div>

        {/* Add User Button */}
        <button
          onClick={onAddUser}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-mono uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4 sm:px-6">User Account</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Linked Employee</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Created Date</th>
                <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <p className="font-medium">No users found matching current filters.</p>
                    <p className="text-[11px] text-slate-400 mt-1">Try clearing your search keyword or changing status/role filter.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const isCurrent = currentUserId === u.id;
                  const isSuperAdmin = (u.role || '').toLowerCase().replace(/_/g, '') === 'superadmin';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* User Account */}
                      <td className="py-3 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 border border-slate-200">
                            {u.username[0]?.toUpperCase() || 'U'}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 truncate">{u.username}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.2 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                                  You
                                </span>
                              )}
                              {u.mustChangePassword && (
                                <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium" title="Temporary password active: user must change password upon next login">
                                  Temp Password
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">{u.email && !u.email.endsWith("@ams.internal") ? u.email : (u.employeeCode ? `NIK: ${u.employeeCode}` : "Akun Sistem")}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                            isSuperAdmin
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{u.roleName || u.role}</span>
                        </span>
                      </td>

                      {/* Linked Employee */}
                      <td className="py-3 px-4">
                        {u.employeeName ? (
                          <div className="flex items-center gap-1.5 text-slate-700">
                            <Briefcase className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <div>
                              <p className="font-medium text-slate-800">{u.employeeName}</p>
                              {u.employeeCode && (
                                <p className="text-[10px] text-slate-400 font-mono">{u.employeeCode}</p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">None (Independent)</span>
                        )}
                      </td>

                      {/* Status Toggle */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => handleStatusToggle(u)}
                          disabled={statusLoadingId === u.id || isCurrent}
                          title={isCurrent ? 'Cannot deactivate your own account' : 'Click to toggle status'}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors cursor-pointer disabled:cursor-not-allowed ${
                            u.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200/70'
                          }`}
                        >
                          {statusLoadingId === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                          )}
                          <span className="capitalize">{u.status}</span>
                        </button>
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Reset Password */}
                          <button
                            type="button"
                            onClick={() => onResetPassword(u)}
                            title="Reset password"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {/* Edit User */}
                          <button
                            type="button"
                            onClick={() => onEditUser(u)}
                            title="Edit user"
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Delete User */}
                          <button
                            type="button"
                            onClick={() => setUserToDelete(u)}
                            disabled={isCurrent}
                            title={isCurrent ? 'Cannot delete your own account' : 'Delete user'}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(userToDelete)}
        onClose={() => setUserToDelete(null)}
        onConfirm={async () => {
          if (userToDelete) {
            await onDeleteUser(userToDelete);
            setUserToDelete(null);
          }
        }}
        title="Delete User Account"
        itemName={userToDelete ? `${userToDelete.username} (${userToDelete.email})` : 'User'}
        description="Are you sure you want to permanently delete this account? This action cannot be undone."
      />
    </div>
  );
}
