import { assetScopePredicate } from '../services/assetOrganizationScope';
import { Request, Response } from 'express';
import { db } from '../db';
import { assets, assetCategories } from '../db/schema/assets';
import { assetCustodians } from '../db/schema/assetCustodians';
import { employees } from '../db/schema/employees';
import { departments } from '../db/schema/master';
import { eq, desc, sql } from 'drizzle-orm';

export interface AssetKpis {
  totalAssets: number;
  assignedAssets: number;
  availableAssets: number;
  maintenanceAssets: number;
  damagedAssets: number;
  assignedPercentage: number;
}

export interface PurchaseTrendItem {
  month: string; // YYYY-MM
  label: string; // e.g. "Agu 2026"
  count: number;
}

export interface DepartmentDistributionItem {
  departmentId: number | null;
  departmentName: string;
  count: number;
  percentage: number;
}

export interface CategoryDistributionItem {
  categoryId: number;
  categoryName: string;
  count: number;
  percentage: number;
}

export interface RecentAssetItem {
  id: number;
  assetCode: string;
  name: string;
  categoryName: string;
  assignedTo: string | null;
  departmentName: string | null;
  status: string;
  condition: string;
  purchaseDate: string | null;
  warrantyExpiry: string | null;
}

export interface AssetDashboardSummaryData {
  kpis: AssetKpis;
  purchaseTrend: PurchaseTrendItem[];
  byDepartment: DepartmentDistributionItem[];
  byCategory: CategoryDistributionItem[];
  recentAssets: RecentAssetItem[];
}

const INDONESIAN_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

export function computeAssetKpis(rows: Array<{ status?: string | null }>): AssetKpis {
  const totalAssets = rows.length;
  let assignedAssets = 0;
  let availableAssets = 0;
  let maintenanceAssets = 0;
  let damagedAssets = 0;

  for (const row of rows) {
    const status = row.status?.trim() || '';
    if (status === 'Assigned') {
      assignedAssets += 1;
    } else if (status === 'Available') {
      availableAssets += 1;
    } else if (status === 'Maintenance') {
      maintenanceAssets += 1;
    } else if (status === 'Damaged' || status === 'Disposed' || status === 'Lost') {
      damagedAssets += 1;
    }
  }

  const assignedPercentage = totalAssets > 0
    ? Number(((assignedAssets / totalAssets) * 100).toFixed(1))
    : 0;

  return {
    totalAssets,
    assignedAssets,
    availableAssets,
    maintenanceAssets,
    damagedAssets,
    assignedPercentage,
  };
}

export function formatPurchaseTrend(
  records: Array<{ date: Date | string | null }>,
  monthsCount = 6,
  referenceDate = new Date()
): PurchaseTrendItem[] {
  const result: PurchaseTrendItem[] = [];
  const countsByMonth = new Map<string, number>();

  const currentYear = referenceDate.getFullYear();
  const currentMonth = referenceDate.getMonth(); // 0-indexed

  // Generate ordered list of month keys (oldest to newest)
  for (let i = monthsCount - 1; i >= 0; i -= 1) {
    const target = new Date(currentYear, currentMonth - i, 1);
    const y = target.getFullYear();
    const m = String(target.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;
    const label = `${INDONESIAN_MONTH_NAMES[target.getMonth()]} ${y}`;
    countsByMonth.set(monthKey, 0);
    result.push({ month: monthKey, label, count: 0 });
  }

  for (const record of records) {
    if (!record.date) continue;
    const d = new Date(record.date);
    if (isNaN(d.getTime())) continue;

    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const monthKey = `${y}-${m}`;

    if (countsByMonth.has(monthKey)) {
      countsByMonth.set(monthKey, (countsByMonth.get(monthKey) || 0) + 1);
    }
  }

  return result.map((item) => ({
    ...item,
    count: countsByMonth.get(item.month) || 0,
  }));
}

export async function getAssetDashboardSummary(req: Request, res: Response) {
  try {
    // 1. Fetch raw assets with joined details
    const rows = await db
      .select({
        id: assets.id,
        assetCode: assets.assetCode,
        name: assets.name,
        status: assets.status,
        condition: assets.condition,
        purchaseDate: assets.purchaseDate,
        createdAt: assets.createdAt,
        warrantyExpiry: assets.warrantyExpiry,
        categoryId: assets.categoryId,
        categoryName: assetCategories.name,
        custodianDisplayName: assetCustodians.displayName,
        custodianUnitText: assetCustodians.unitText,
        employeeFullName: employees.fullName,
        employeeDepartmentId: employees.departmentId,
        departmentId: departments.id,
        departmentName: departments.name,
      })
      .from(assets)
      .leftJoin(assetCategories, eq(assets.categoryId, assetCategories.id))
      .leftJoin(assetCustodians, eq(assets.currentCustodianId, assetCustodians.id))
      .leftJoin(employees, eq(assetCustodians.employeeId, employees.id))
      .leftJoin(departments, eq(employees.departmentId, departments.id))
      .where(assetScopePredicate(req)).orderBy(desc(assets.id));

    // 2. Compute KPIs
    const kpis = computeAssetKpis(rows);

    // 3. Compute Purchase Trend (using purchaseDate, falling back to createdAt)
    const trendRecords = rows.map((r) => ({
      date: r.purchaseDate ?? r.createdAt,
    }));
    const purchaseTrend = formatPurchaseTrend(trendRecords, 6);

    // 4. Compute Department Distribution
    const departmentCounts = new Map<number | null, { name: string; count: number }>();
    let poolCount = 0;

    for (const r of rows) {
      if (r.departmentId && r.departmentName) {
        const cur = departmentCounts.get(r.departmentId) || { name: r.departmentName, count: 0 };
        cur.count += 1;
        departmentCounts.set(r.departmentId, cur);
      } else if (r.custodianUnitText && r.custodianUnitText.trim()) {
        // Fallback to unit text if no formal HR department
        const unitName = r.custodianUnitText.trim();
        // Use negative hash or special bucket for distinct unit text
        const existing = Array.from(departmentCounts.entries()).find(([_, v]) => v.name === unitName);
        if (existing) {
          existing[1].count += 1;
        } else {
          departmentCounts.set(-(departmentCounts.size + 1), { name: unitName, count: 1 });
        }
      } else {
        poolCount += 1;
      }
    }

    const totalCount = rows.length;
    const byDepartment: DepartmentDistributionItem[] = [];

    // Sort departments by count descending
    const sortedDepts = Array.from(departmentCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [deptId, val] of sortedDepts) {
      const percentage = totalCount > 0 ? Number(((val.count / totalCount) * 100).toFixed(1)) : 0;
      byDepartment.push({
        departmentId: deptId && deptId > 0 ? deptId : null,
        departmentName: val.name,
        count: val.count,
        percentage,
      });
    }

    if (poolCount > 0 || byDepartment.length === 0) {
      const percentage = totalCount > 0 ? Number(((poolCount / totalCount) * 100).toFixed(1)) : 0;
      byDepartment.push({
        departmentId: null,
        departmentName: 'Belum Ditetapkan / Pool',
        count: poolCount,
        percentage,
      });
    }

    // 5. Compute Category Distribution
    const categoryCounts = new Map<number, { name: string; count: number }>();
    for (const r of rows) {
      if (r.categoryId && r.categoryName) {
        const cur = categoryCounts.get(r.categoryId) || { name: r.categoryName, count: 0 };
        cur.count += 1;
        categoryCounts.set(r.categoryId, cur);
      }
    }

    const byCategory: CategoryDistributionItem[] = [];
    const sortedCategories = Array.from(categoryCounts.entries()).sort((a, b) => b[1].count - a[1].count);
    for (const [catId, val] of sortedCategories) {
      const percentage = totalCount > 0 ? Number(((val.count / totalCount) * 100).toFixed(1)) : 0;
      byCategory.push({
        categoryId: catId,
        categoryName: val.name,
        count: val.count,
        percentage,
      });
    }

    // 6. Recent Assets (up to 10 latest)
    const recentAssets: RecentAssetItem[] = rows.slice(0, 10).map((r) => ({
      id: r.id,
      assetCode: r.assetCode,
      name: r.name,
      categoryName: r.categoryName || 'Uncategorized',
      assignedTo: r.employeeFullName || r.custodianDisplayName || null,
      departmentName: r.departmentName || r.custodianUnitText || null,
      status: r.status,
      condition: r.condition,
      purchaseDate: r.purchaseDate ? new Date(r.purchaseDate).toISOString() : null,
      warrantyExpiry: r.warrantyExpiry ? new Date(r.warrantyExpiry).toISOString() : null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        kpis,
        purchaseTrend,
        byDepartment,
        byCategory,
        recentAssets,
      },
    });
  } catch (err: any) {
    console.error('Failed to get asset dashboard summary:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve asset dashboard summary',
    });
  }
}
