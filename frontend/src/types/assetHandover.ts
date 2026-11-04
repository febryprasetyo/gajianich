export interface AssetHandoverItem {
  id: number;
  handoverId: number;
  itemOrder: number;
  assetId: number | null;
  assetCode?: string | null;
  itemName: string;
  description: string | null;
  createdAt?: string;
}

export interface AssetHandover {
  id: number;
  handoverNumber: string;
  handoverDate: string;
  organizationId: number | null;
  organizationName?: string | null;
  employeeId: number | null;
  recipientName: string;
  recipientAddress: string | null;
  recipientPosition: string | null;
  recipientPhone: string | null;
  itemTypes: string[];
  itemTypesCustom: string | null;
  givenByName: string;
  givenByTitle: string | null;
  givenByUserId: number | null;
  receivedByName: string;
  status: string;
  notes: string | null;
  itemsCount?: number;
  firstItemName?: string | null;
  items?: AssetHandoverItem[];
  createdAt: string;
  updatedAt: string;
}

export interface HandoverStats {
  total: number;
  thisMonth: number;
  withLaptopsOrPc: number;
  activeCount: number;
}

export interface HandoverItemInput {
  itemOrder?: number;
  assetId?: number | null;
  itemName: string;
  description?: string | null;
}

export interface HandoverFormInput {
  handoverDate: string;
  organizationId?: number | null;
  employeeId?: number | null;
  recipientName: string;
  recipientAddress?: string | null;
  recipientPosition?: string | null;
  recipientPhone?: string | null;
  itemTypes: string[];
  itemTypesCustom?: string | null;
  givenByName: string;
  givenByTitle?: string | null;
  givenByUserId?: number | null;
  receivedByName: string;
  status?: string;
  notes?: string | null;
  items: HandoverItemInput[];
}

export interface HandoverListResponse {
  data: AssetHandover[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
