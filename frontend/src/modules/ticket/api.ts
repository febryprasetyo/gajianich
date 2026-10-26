import { api } from "@/lib/api";
import {
  TicketSummary,
  TicketDetail,
  TicketStatsData,
  CreateTicketInput,
  EmployeeLookupItem,
  TechnicianLookupItem,
  TicketFilterParams,
} from "./types";
import { buildCreateTicketPayload } from "./constants";

export async function listTickets(
  params?: TicketFilterParams,
  signal?: AbortSignal
): Promise<{ success: boolean; data: TicketSummary[]; total: number; page: number; limit: number }> {
  const query = new URLSearchParams();
  if (params?.search) query.set("search", params.search);
  if (params?.status) query.set("status", params.status);
  if (params?.priority) query.set("priority", params.priority);
  if (params?.category) query.set("category", params.category);
  if (params?.origin) query.set("origin", params.origin);
  if (params?.departmentId) query.set("departmentId", String(params.departmentId));
  if (params?.isInternal && params.isInternal !== "all") query.set("isInternal", params.isInternal);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const res = await api.get<any>(
    `/helpdesk/tickets${qs ? `?${qs}` : ""}`,
    { signal }
  );
  const items = res?.data || res?.items || (Array.isArray(res) ? res : []);
  const total = Number(res?.totalCount ?? res?.total ?? items.length);
  return {
    success: true,
    data: items,
    total,
    page: Number(params?.page || 1),
    limit: Number(params?.limit || 20),
  };
}

export async function getTicketDetail(
  id: number | string,
  signal?: AbortSignal
): Promise<{ success: boolean; data: TicketDetail }> {
  return api.get<{ success: boolean; data: TicketDetail }>(`/helpdesk/tickets/${id}`, { signal });
}

export async function createTicket(
  input: CreateTicketInput
): Promise<{ success: boolean; data: TicketDetail }> {
  const payload = buildCreateTicketPayload(input);
  return api.post<{ success: boolean; data: TicketDetail }>("/helpdesk/tickets", payload);
}

export async function updateTicketStatus(
  id: number | string,
  body: {
    status: string;
    reason?: string;
    resolutionNotes?: string;
    confirmationChannel?: string;
    feedbackScore?: number;
    feedbackNotes?: string;
  }
): Promise<{ success: boolean; data: TicketDetail }> {
  return api.patch<{ success: boolean; data: TicketDetail }>(`/helpdesk/tickets/${id}/status`, body);
}

export async function assignTicket(
  id: number | string,
  assignedToEmployeeId: number
): Promise<{ success: boolean; data: TicketDetail }> {
  return api.patch<{ success: boolean; data: TicketDetail }>(`/helpdesk/tickets/${id}/assign`, {
    assignedToEmployeeId,
  });
}

export async function addTicketComment(
  id: number | string,
  comment: string,
  isInternal: boolean = false
): Promise<{ success: boolean; data: any }> {
  return api.post(`/helpdesk/tickets/${id}/comments`, { comment, isInternal });
}

export async function uploadTicketAttachment(
  id: number | string,
  file: File
): Promise<{ success: boolean; data: any }> {
  const formData = new FormData();
  formData.append("file", file);
  return api.upload(`/helpdesk/tickets/${id}/attachments`, formData);
}

export async function getTicketStats(): Promise<{ success: boolean; data: TicketStatsData }> {
  const res = await api.get<any>("/helpdesk/stats");
  const d = res?.data || res || {};
  return {
    success: true,
    data: {
      openCount: Number(d.openCount ?? d.openTickets ?? 0),
      inProgressCount: Number(d.inProgressCount ?? d.inProgressTickets ?? 0),
      resolvedTodayCount: Number(d.resolvedTodayCount ?? 0),
      criticalCount: Number(d.criticalCount ?? 0),
      avgResolutionMinutes: Number(d.avgResolutionMinutes ?? 0),
      avgDelayMinutes: Number(d.avgRecordingDelayMinutes ?? d.avgDelayMinutes ?? 0),
      slaCompliancePercentage: Number(d.slaCompliancePercentage ?? 0),
    },
  };
}

export async function getEmployeeLookups(
  search?: string
): Promise<{ success: boolean; data: EmployeeLookupItem[] }> {
  const qs = search ? `?q=${encodeURIComponent(search)}&search=${encodeURIComponent(search)}` : "";
  const res = await api.get<any>(`/helpdesk/employees${qs}`);
  const rawList = res?.data || res?.items || (Array.isArray(res) ? res : []);
  const mapped: EmployeeLookupItem[] = (Array.isArray(rawList) ? rawList : []).map((emp: any) => ({
    id: Number(emp.id),
    name: emp.fullName || emp.name || emp.full_name || emp.employeeCode || `Karyawan #${emp.id}`,
    email: emp.email || null,
    department: emp.departmentName || emp.department || null,
  }));
  return { success: true, data: mapped };
}

export async function getTechnicianLookups(): Promise<{
  success: boolean;
  data: TechnicianLookupItem[];
}> {
  const res = await api.get<any>("/helpdesk/technicians");
  const rawList = res?.data || res?.items || (Array.isArray(res) ? res : []);
  const mapped: TechnicianLookupItem[] = (Array.isArray(rawList) ? rawList : []).map((tech: any) => ({
    id: Number(tech.id),
    name: tech.fullName || tech.name || tech.username || `Teknisi #${tech.id}`,
    email: tech.email || null,
    role: tech.role || "",
  }));
  return { success: true, data: mapped };
}
