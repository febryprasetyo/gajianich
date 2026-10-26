export const CATEGORIES = [
  { value: "HARDWARE", label: "Perangkat Keras (Hardware)" },
  { value: "SOFTWARE", label: "Aplikasi & Sistem (Software)" },
  { value: "NETWORK", label: "Jaringan & Internet (Network)" },
  { value: "ACCESS", label: "Hak Akses & Akun (Access)" },
  { value: "EMAIL", label: "Email & Komunikasi" },
  { value: "OTHER", label: "Lainnya (Other)" },
] as const;

export const ORIGINS = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "PHONE", label: "Telepon" },
  { value: "EMAIL", label: "Email" },
  { value: "DIRECT", label: "Tatap Muka (Walk-in)" },
  { value: "PORTAL", label: "Portal Web" },
  { value: "OTHER", label: "Lainnya" },
] as const;

export const PRIORITIES = [
  { value: "LOW", label: "Rendah", sla: "24 Jam" },
  { value: "MEDIUM", label: "Sedang", sla: "8 Jam" },
  { value: "HIGH", label: "Tinggi", sla: "4 Jam" },
  { value: "CRITICAL", label: "Kritis", sla: "1 Jam" },
] as const;

export const STATUSES = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "Sedang Diproses" },
  { value: "PENDING", label: "Tertunda" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "CLOSED", label: "Ditutup" },
  { value: "CANCELLED", label: "Dibatalkan" },
] as const;

export function getStatusBadgeConfig(status: string) {
  switch (status?.toUpperCase()) {
    case "OPEN":
      return {
        label: "Open",
        bgClass: "bg-blue-50 border-blue-200",
        textClass: "text-blue-700",
        dotClass: "bg-blue-500",
      };
    case "IN_PROGRESS":
      return {
        label: "Diproses",
        bgClass: "bg-amber-50 border-amber-200",
        textClass: "text-amber-700",
        dotClass: "bg-amber-500",
      };
    case "PENDING":
      return {
        label: "Pending",
        bgClass: "bg-purple-50 border-purple-200",
        textClass: "text-purple-700",
        dotClass: "bg-purple-500",
      };
    case "RESOLVED":
      return {
        label: "Selesai",
        bgClass: "bg-emerald-50 border-emerald-200",
        textClass: "text-emerald-700",
        dotClass: "bg-emerald-500",
      };
    case "CLOSED":
      return {
        label: "Ditutup",
        bgClass: "bg-slate-100 border-slate-200",
        textClass: "text-slate-700",
        dotClass: "bg-slate-500",
      };
    case "CANCELLED":
      return {
        label: "Dibatalkan",
        bgClass: "bg-rose-50 border-rose-200",
        textClass: "text-rose-700",
        dotClass: "bg-rose-500",
      };
    default:
      return {
        label: status || "Unknown",
        bgClass: "bg-slate-50 border-slate-200",
        textClass: "text-slate-600",
        dotClass: "bg-slate-400",
      };
  }
}

export function getPriorityBadgeConfig(priority: string) {
  switch (priority?.toUpperCase()) {
    case "CRITICAL":
      return {
        label: "Kritis",
        bgClass: "bg-rose-100 border-rose-300",
        textClass: "text-rose-800",
      };
    case "HIGH":
      return {
        label: "Tinggi",
        bgClass: "bg-orange-100 border-orange-300",
        textClass: "text-orange-800",
      };
    case "MEDIUM":
      return {
        label: "Sedang",
        bgClass: "bg-amber-100 border-amber-300",
        textClass: "text-amber-800",
      };
    case "LOW":
      return {
        label: "Rendah",
        bgClass: "bg-slate-100 border-slate-300",
        textClass: "text-slate-700",
      };
    default:
      return {
        label: priority || "Unknown",
        bgClass: "bg-slate-100 border-slate-200",
        textClass: "text-slate-600",
      };
  }
}

export function getAllowedStatusTransitions(currentStatus: string): string[] {
  switch (currentStatus?.toUpperCase()) {
    case "OPEN":
      return ["IN_PROGRESS", "CANCELLED"];
    case "IN_PROGRESS":
      return ["PENDING", "RESOLVED", "CANCELLED"];
    case "PENDING":
      return ["IN_PROGRESS", "CANCELLED"];
    case "RESOLVED":
      return ["CLOSED", "IN_PROGRESS"];
    case "CLOSED":
      return ["IN_PROGRESS"];
    case "CANCELLED":
      return [];
    default:
      return [];
  }
}

export function buildCreateTicketPayload(input: any) {
  return {
    requesterEmployeeId: Number(input.requesterEmployeeId),
    reportedAt: input.reportedAt || new Date().toISOString(),
    category: input.category,
    origin: input.origin,
    priority: input.priority,
    title: String(input.title || "").trim(),
    description: String(input.description || "").trim(),
    assetId: input.assetId ? Number(input.assetId) : null,
    isInternal: Boolean(input.isInternal),
  };
}

export function formatDelayMinutes(minutes: number): string {
  if (!minutes || minutes <= 0) return "Tepat waktu";
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes > 0 ? `${hours} jam ${remainingMinutes} mnt` : `${hours} jam`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days} hari ${remainingHours} jam` : `${days} hari`;
}
