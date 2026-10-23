export interface DepartmentOption { id: number; code: string; name: string; }
export interface LocationOption { id: number; code: string; name: string; }

export interface EmployeeItem {
  photoUrl?: string | null;
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  phone?: string | null;
  mobilePhone?: string | null;
  secondaryPhone?: string | null;
  departmentId?: number | null;
  locationId?: number | null;
  position?: string | null;
  jobLevel?: string | null;
  status: string;
  employmentStatus?: string | null;
  joinDate?: string | null;
  birthDate?: string | null;
  birthPlace?: string | null;
  age?: string | null;
  gender?: string | null;
  religion?: string | null;
  maritalStatus?: string | null;
  bloodType?: string | null;
  nationalityCode?: string | null;
  nikKtp?: string | null;
  citizenIdAddress?: string | null;
  residentialAddress?: string | null;
  npwp?: string | null;
  npwp16Digit?: string | null;
  ptkpStatus?: string | null;
  employeeTaxStatus?: string | null;
  bankName?: string | null;
  bankAccount?: string | null;
  bankAccountHolder?: string | null;
  bpjsKetenagakerjaan?: string | null;
  bpjsKesehatan?: string | null;
  barcode?: string | null;
  currency?: string | null;
  lengthOfService?: string | null;
  // Joined
  departmentName?: string | null;
  departmentCode?: string | null;
  locationName?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}
