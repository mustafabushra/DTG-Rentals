// ===========================
// DTG Rentals — Mock Data (Arabic)
// ===========================

export type PropertyType = 'apartment' | 'villa' | 'office' | 'shop' | 'building' | 'tower' | 'land';
export type UnitStructure = 'single' | 'multi';

export const SINGLE_UNIT_TYPES: PropertyType[] = ['apartment', 'office', 'shop', 'land'];

export function defaultUnitStructure(type: PropertyType): UnitStructure {
  return SINGLE_UNIT_TYPES.includes(type) ? 'single' : 'multi';
}
export type PropertyStatus = 'active' | 'inactive';
export type UnitStatus = 'rented' | 'vacant' | 'maintenance' | 'reserved';
export type UnitType = 'studio' | 'apartment_1' | 'apartment_2' | 'apartment_3' | 'apartment_4' | 'villa' | 'office' | 'shop';
export type ContractStatus = 'active' | 'expired' | 'cancelled' | 'terminated';
export type PaymentStatus = 'paid' | 'pending' | 'overdue';
export type PaymentMethod = 'transfer' | 'cash' | 'check';
export type MaintenancePriority = 'urgent' | 'high' | 'medium' | 'low';
export type MaintenanceStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type AuditAction = 'add' | 'edit' | 'delete';
export type CalendarEventType = 'payment' | 'maintenance' | 'contract_expiry' | 'file_expiry' | 'manual';

export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string;
  nationalId: string;
  iban: string;
  propertyIds: string[];
  avatar?: string;
  createdAt: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  location: string;
  floors: number;
  totalUnits: number;
  ownerId: string;
  status: PropertyStatus;
  description: string;
  image?: string;
  currency?: string;        // e.g. 'SAR' | 'AED' | 'EGP'
  deedNumber?: string;      // رقم الصك (اختياري)
  area?: number;            // المساحة بالمتر المربع (اختياري)
  unitStructure?: UnitStructure; // single = وحدة رئيسية تلقائية، multi = وحدات يضيفها المستخدم
  isVirtual?: boolean;
  sourceUnitId?: string;
  sourcePropertyId?: string;
  createdAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  nationalId: string;
  nationality: string;
  contractIds: string[];
  createdAt: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  ownerId?: string;          // optional — owner may differ from property owner
  number: string;
  type: UnitType;
  floor: number;
  area: number;
  monthlyRent: number;
  annualRent: number;
  status: UnitStatus;
  description: string;
  features: string[];
  currency?: string;         // عملة الوحدة — الأولوية: unit > contract > property > system
  currentTenantId?: string;
  currentContractId?: string;
}

export interface Contract {
  id: string;
  contractNumber: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  annualValue: number;
  installmentsCount: number;
  status: ContractStatus;
  currency?: string;   // e.g. 'SAR' | 'AED' | 'EGP' — عملة العقد (الأولوية على عملة العقار)
  notes?: string;
  createdAt: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  contractId: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  method?: PaymentMethod;
  status: PaymentStatus;
  installmentNumber: number;
  referenceNumber?: string;
  notes?: string;
  currency?: string;  // inherited from contract at creation time
}

export interface Maintenance {
  id: string;
  title: string;
  description: string;
  propertyId: string;
  unitId: string;
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  technicianName?: string;
  cost?: number;
  openedAt: string;
  assignedAt?: string;
  closedAt?: string;
  reportedBy: string;
}

export interface AuditLog {
  id: string;
  action: AuditAction;
  entityType: string;
  entityName: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  type: CalendarEventType;
  date: string;
  notes?: string;
  entityId?: string;
  entityType?: string;
  // legacy fields kept for backward compat
  description?: string;
  relatedId?: string;
}

// ===========================
// OWNERS — 4 ملاك
// ===========================
export const mockOwners: Owner[] = [
  {
    id: 'o1',
    name: 'عبدالعزيز بن محمد الرشيد',
    phone: '0501234567',
    email: 'abdulaziz.rashid@email.com',
    nationalId: '1023456789',
    iban: 'SA0380000000608010167519',
    propertyIds: ['p1', 'p2'],
    createdAt: '2022-01-15',
  },
  {
    id: 'o2',
    name: 'فهد بن سعد العتيبي',
    phone: '0559876543',
    email: 'fahad.otaibi@email.com',
    nationalId: '1087654321',
    iban: 'SA7157000000141892827018',
    propertyIds: ['p3', 'p4'],
    createdAt: '2021-06-20',
  },
  {
    id: 'o3',
    name: 'سلطان بن ناصر القحطاني',
    phone: '0533456789',
    email: 'sultan.qahtani@email.com',
    nationalId: '1034567890',
    iban: 'SA4420000001234567891234',
    propertyIds: ['p5'],
    createdAt: '2023-03-10',
  },
  {
    id: 'o4',
    name: 'خالد بن عمر الزهراني',
    phone: '0566789012',
    email: 'khalid.zahrani@email.com',
    nationalId: '1045678901',
    iban: 'SA3660000000609010167519',
    propertyIds: ['p6'],
    createdAt: '2020-11-05',
  },
];

// ===========================
// PROPERTIES — 6 عقارات
// ===========================
export const mockProperties: Property[] = [
  {
    id: 'p1',
    name: 'برج الرياض السكني',
    type: 'apartment',
    location: 'الرياض - حي العليا',
    floors: 12,
    totalUnits: 6,
    ownerId: 'o1',
    status: 'active',
    description: 'برج سكني حديث في قلب حي العليا، يحتوي على وحدات سكنية فاخرة بإطلالات بانورامية',
    createdAt: '2022-01-20',
  },
  {
    id: 'p2',
    name: 'فيلا الملك فهد',
    type: 'villa',
    location: 'الرياض - حي الملقا',
    floors: 3,
    totalUnits: 3,
    ownerId: 'o1',
    status: 'active',
    description: 'فيلا فاخرة في حي الملقا الراقي، مع حديقة خاصة وحوض سباحة',
    createdAt: '2021-08-15',
  },
  {
    id: 'p3',
    name: 'مجمع الأعمال التجاري',
    type: 'office',
    location: 'جدة - حي الروضة',
    floors: 8,
    totalUnits: 4,
    ownerId: 'o2',
    status: 'active',
    description: 'مجمع مكاتب تجارية متكامل الخدمات في منطقة الأعمال بجدة',
    createdAt: '2020-03-10',
  },
  {
    id: 'p4',
    name: 'مركز الخليج التجاري',
    type: 'shop',
    location: 'جدة - حي البلد',
    floors: 2,
    totalUnits: 3,
    ownerId: 'o2',
    status: 'active',
    description: 'مركز تجاري يضم محلات تجارية متنوعة في منطقة البلد التاريخية',
    createdAt: '2019-06-01',
  },
  {
    id: 'p5',
    name: 'أبراج الدمام السكنية',
    type: 'apartment',
    location: 'الدمام - حي الشاطئ',
    floors: 10,
    totalUnits: 2,
    ownerId: 'o3',
    status: 'active',
    description: 'مجمع سكني فاخر بإطلالة على الخليج العربي في الدمام',
    createdAt: '2023-04-05',
  },
  {
    id: 'p6',
    name: 'عمارة المدينة المنورة',
    type: 'apartment',
    location: 'المدينة المنورة - حي قباء',
    floors: 6,
    totalUnits: 2,
    ownerId: 'o4',
    status: 'inactive',
    description: 'عمارة سكنية قرب المسجد النبوي الشريف، مناسبة للعائلات والحجاج',
    createdAt: '2020-01-12',
  },
];

// ===========================
// TENANTS — 8 مستأجرين
// ===========================
export const mockTenants: Tenant[] = [
  {
    id: 't1',
    name: 'محمد بن أحمد السالم',
    phone: '0512345678',
    email: 'm.salem@email.com',
    nationalId: '1056789012',
    nationality: 'سعودي',
    contractIds: ['c1'],
    createdAt: '2022-02-01',
  },
  {
    id: 't2',
    name: 'عمر عبدالله الحربي',
    phone: '0578901234',
    email: 'omar.harbi@email.com',
    nationalId: '1067890123',
    nationality: 'سعودي',
    contractIds: ['c2'],
    createdAt: '2021-09-15',
  },
  {
    id: 't3',
    name: 'أحمد محمد المصري',
    phone: '0543210987',
    email: 'ahmed.masri@email.com',
    nationalId: '2234567890',
    nationality: 'مصري',
    contractIds: ['c3'],
    createdAt: '2022-05-20',
  },
  {
    id: 't4',
    name: 'يوسف إبراهيم الكويتي',
    phone: '0565432109',
    email: 'yousuf.k@email.com',
    nationalId: '2345678901',
    nationality: 'كويتي',
    contractIds: ['c4'],
    createdAt: '2020-11-30',
  },
  {
    id: 't5',
    name: 'سارة عبدالرحمن الغامدي',
    phone: '0556543210',
    email: 'sara.ghamdi@email.com',
    nationalId: '1078901234',
    nationality: 'سعودية',
    contractIds: ['c5'],
    createdAt: '2023-01-10',
  },
  {
    id: 't6',
    name: 'علي حسن الأنصاري',
    phone: '0597654321',
    email: 'ali.ansari@email.com',
    nationalId: '2456789012',
    nationality: 'بحريني',
    contractIds: ['c6'],
    createdAt: '2021-07-25',
  },
  {
    id: 't7',
    name: 'نواف سلمان الشمري',
    phone: '0508765432',
    email: 'nawaf.shamri@email.com',
    nationalId: '1089012345',
    nationality: 'سعودي',
    contractIds: ['c7'],
    createdAt: '2022-08-18',
  },
  {
    id: 't8',
    name: 'فيصل عادل المطيري',
    phone: '0529876543',
    email: 'faisal.mutairi@email.com',
    nationalId: '1090123456',
    nationality: 'سعودي',
    contractIds: ['c8'],
    createdAt: '2023-06-01',
  },
];

// ===========================
// UNITS — 20 وحدة
// ===========================
export const mockUnits: Unit[] = [
  // برج الرياض السكني (p1) — 6 وحدات
  {
    id: 'u1', propertyId: 'p1', number: '101', type: 'apartment_2', floor: 1,
    area: 120, monthlyRent: 4500, annualRent: 54000, status: 'rented',
    description: 'شقة مفروشة بالكامل، إطلالة على الحديقة',
    features: ['مكيف مركزي', 'مطبخ مجهز', 'باركنج', 'أمن 24 ساعة'],
    currentTenantId: 't1', currentContractId: 'c1',
  },
  {
    id: 'u2', propertyId: 'p1', number: '201', type: 'apartment_3', floor: 2,
    area: 155, monthlyRent: 6000, annualRent: 72000, status: 'rented',
    description: 'شقة واسعة مع غرفة خادمة وصالة كبيرة',
    features: ['مكيف مركزي', 'غرفة غسيل', '2 باركنج', 'جاكوزي'],
    currentTenantId: 't2', currentContractId: 'c2',
  },
  {
    id: 'u3', propertyId: 'p1', number: '301', type: 'apartment_2', floor: 3,
    area: 118, monthlyRent: 4200, annualRent: 50400, status: 'vacant',
    description: 'شقة مجددة بالكامل، قريبة من المصعد',
    features: ['مكيف مركزي', 'مطبخ مجهز', 'باركنج'],
  },
  {
    id: 'u4', propertyId: 'p1', number: '401', type: 'apartment_1', floor: 4,
    area: 85, monthlyRent: 3200, annualRent: 38400, status: 'rented',
    description: 'شقة مريحة للعزاب والأزواج بدون أطفال',
    features: ['مكيف مركزي', 'باركنج', 'أمن 24 ساعة'],
    currentTenantId: 't3', currentContractId: 'c3',
  },
  {
    id: 'u5', propertyId: 'p1', number: '501', type: 'apartment_3', floor: 5,
    area: 160, monthlyRent: 6500, annualRent: 78000, status: 'maintenance',
    description: 'شقة بانورامية تحت الصيانة الشاملة',
    features: ['مكيف مركزي', 'غرفة خادمة', 'إطلالة بانورامية'],
  },
  {
    id: 'u6', propertyId: 'p1', number: '601', type: 'apartment_4', floor: 6,
    area: 200, monthlyRent: 9000, annualRent: 108000, status: 'rented',
    description: 'بنتهاوس فاخر بمساحة ضخمة وتراس خاص',
    features: ['مكيف مركزي', 'تراس', 'غرفتي خادمة', '3 باركنج', 'مسبح خاص'],
    currentTenantId: 't4', currentContractId: 'c4',
  },
  // فيلا الملك فهد (p2) — 3 وحدات
  {
    id: 'u7', propertyId: 'p2', number: 'V-A', type: 'villa', floor: 1,
    area: 450, monthlyRent: 18000, annualRent: 216000, status: 'rented',
    description: 'فيلا رئيسية كاملة مع حديقة وحوض سباحة خاص',
    features: ['حوض سباحة', 'حديقة', '4 مواقف سيارات', 'غرفة سائق', 'نظام أمني'],
    currentTenantId: 't5', currentContractId: 'c5',
  },
  {
    id: 'u8', propertyId: 'p2', number: 'V-B', type: 'villa', floor: 1,
    area: 320, monthlyRent: 14000, annualRent: 168000, status: 'rented',
    description: 'فيلا ملحقة بتصميم حديث ومستقلة بالكامل',
    features: ['حديقة صغيرة', '2 مواقف سيارات', 'مطبخ أمريكي'],
    currentTenantId: 't6', currentContractId: 'c6',
  },
  {
    id: 'u9', propertyId: 'p2', number: 'V-C', type: 'apartment_3', floor: 3,
    area: 180, monthlyRent: 8000, annualRent: 96000, status: 'vacant',
    description: 'شقة في الطابق العلوي بإطلالة على الحديقة',
    features: ['تراس', 'مكيف مركزي', 'موقف سيارات'],
  },
  // مجمع الأعمال (p3) — 4 وحدات
  {
    id: 'u10', propertyId: 'p3', number: 'O-101', type: 'office', floor: 1,
    area: 200, monthlyRent: 7500, annualRent: 90000, status: 'rented',
    description: 'مكتب تجاري متكامل في الدور الأرضي',
    features: ['قاعة اجتماعات', 'استقبال', 'مواقف سيارات', 'إنترنت فايبر'],
    currentTenantId: 't7', currentContractId: 'c7',
  },
  {
    id: 'u11', propertyId: 'p3', number: 'O-201', type: 'office', floor: 2,
    area: 350, monthlyRent: 12000, annualRent: 144000, status: 'rented',
    description: 'مكتب واسع مناسب للشركات الكبرى',
    features: ['قاعتا اجتماعات', 'غرفة سيرفر', 'تكييف مركزي', 'أمن 24ساعة'],
    currentTenantId: 't8', currentContractId: 'c8',
  },
  {
    id: 'u12', propertyId: 'p3', number: 'O-301', type: 'office', floor: 3,
    area: 150, monthlyRent: 5500, annualRent: 66000, status: 'vacant',
    description: 'مكتب صغير مناسب للمهن الحرة والشركات الناشئة',
    features: ['مطبخ صغير', 'إنترنت فايبر', 'موقف سيارة'],
  },
  {
    id: 'u13', propertyId: 'p3', number: 'O-401', type: 'office', floor: 4,
    area: 500, monthlyRent: 18000, annualRent: 216000, status: 'maintenance',
    description: 'طابق كامل تحت التجهيز والتشطيب',
    features: ['بانورامية', 'طابق كامل', 'تصميم مفتوح'],
  },
  // مركز الخليج التجاري (p4) — 3 وحدات
  {
    id: 'u14', propertyId: 'p4', number: 'S-01', type: 'shop', floor: 1,
    area: 80, monthlyRent: 8000, annualRent: 96000, status: 'rented',
    description: 'محل تجاري واجهة رئيسية على الشارع',
    features: ['واجهة زجاجية', 'موقف أمام المحل', 'مخزن'],
    currentTenantId: 't1', currentContractId: 'c9',
  },
  {
    id: 'u15', propertyId: 'p4', number: 'S-02', type: 'shop', floor: 1,
    area: 65, monthlyRent: 6500, annualRent: 78000, status: 'vacant',
    description: 'محل تجاري داخلي في المركز',
    features: ['تكييف مركزي', 'أمن مركز التسوق'],
  },
  {
    id: 'u16', propertyId: 'p4', number: 'S-03', type: 'shop', floor: 2,
    area: 120, monthlyRent: 10000, annualRent: 120000, status: 'rented',
    description: 'مطعم كبير في الدور الثاني مع تجهيزات المطبخ',
    features: ['تجهيزات مطبخ', 'شفاط مركزي', 'دورتا مياه'],
    currentTenantId: 't3', currentContractId: 'c10',
  },
  // أبراج الدمام (p5) — 2 وحدات
  {
    id: 'u17', propertyId: 'p5', number: 'D-501', type: 'apartment_3', floor: 5,
    area: 165, monthlyRent: 7000, annualRent: 84000, status: 'rented',
    description: 'شقة فاخرة بإطلالة مباشرة على الخليج',
    features: ['إطلالة بحرية', 'مكيف مركزي', 'غرفة خادمة', 'باركنج مغطى'],
    currentTenantId: 't2', currentContractId: 'c2',
  },
  {
    id: 'u18', propertyId: 'p5', number: 'D-601', type: 'apartment_2', floor: 6,
    area: 130, monthlyRent: 5500, annualRent: 66000, status: 'vacant',
    description: 'شقة حديثة بإطلالة جزئية على البحر',
    features: ['إطلالة بحرية جزئية', 'مكيف مركزي', 'باركنج'],
  },
  // عمارة المدينة (p6) — 2 وحدات
  {
    id: 'u19', propertyId: 'p6', number: 'M-101', type: 'apartment_2', floor: 1,
    area: 100, monthlyRent: 3500, annualRent: 42000, status: 'vacant',
    description: 'شقة قريبة من المسجد النبوي',
    features: ['مكيف سبليت', 'مفروشة جزئياً'],
  },
  {
    id: 'u20', propertyId: 'p6', number: 'M-201', type: 'apartment_1', floor: 2,
    area: 75, monthlyRent: 2800, annualRent: 33600, status: 'vacant',
    description: 'شقة مناسبة للزائرين والحجاج',
    features: ['مكيف سبليت', 'قريب من الخدمات'],
  },
];

// ===========================
// CONTRACTS — 10 عقود
// ===========================
export const mockContracts: Contract[] = [
  {
    id: 'c1', contractNumber: 'CNT-2024-001', unitId: 'u1', tenantId: 't1',
    startDate: '2024-01-01', endDate: '2024-12-31', annualValue: 54000,
    installmentsCount: 4, status: 'active', createdAt: '2023-12-20',
    notes: 'عقد إيجار سكني سنوي، الدفع ربع سنوي',
  },
  {
    id: 'c2', contractNumber: 'CNT-2024-002', unitId: 'u2', tenantId: 't2',
    startDate: '2024-03-01', endDate: '2025-02-28', annualValue: 72000,
    installmentsCount: 12, status: 'active', createdAt: '2024-02-15',
    notes: 'عقد إيجار شهري',
  },
  {
    id: 'c3', contractNumber: 'CNT-2024-003', unitId: 'u4', tenantId: 't3',
    startDate: '2024-06-01', endDate: '2025-05-31', annualValue: 38400,
    installmentsCount: 2, status: 'active', createdAt: '2024-05-20',
  },
  {
    id: 'c4', contractNumber: 'CNT-2023-010', unitId: 'u6', tenantId: 't4',
    startDate: '2023-07-01', endDate: '2024-06-30', annualValue: 108000,
    installmentsCount: 4, status: 'expired', createdAt: '2023-06-25',
    notes: 'عقد منتهي - قيد التجديد',
  },
  {
    id: 'c5', contractNumber: 'CNT-2024-005', unitId: 'u7', tenantId: 't5',
    startDate: '2024-02-01', endDate: '2025-01-31', annualValue: 216000,
    installmentsCount: 12, status: 'active', createdAt: '2024-01-25',
  },
  {
    id: 'c6', contractNumber: 'CNT-2024-006', unitId: 'u8', tenantId: 't6',
    startDate: '2024-01-01', endDate: '2025-12-31', annualValue: 168000,
    installmentsCount: 24, status: 'active', createdAt: '2023-12-28',
  },
  {
    id: 'c7', contractNumber: 'CNT-2024-007', unitId: 'u10', tenantId: 't7',
    startDate: '2024-04-01', endDate: '2026-03-31', annualValue: 90000,
    installmentsCount: 4, status: 'active', createdAt: '2024-03-20',
    notes: 'عقد تجاري لمدة سنتين',
  },
  {
    id: 'c8', contractNumber: 'CNT-2024-008', unitId: 'u11', tenantId: 't8',
    startDate: '2024-05-01', endDate: '2025-04-30', annualValue: 144000,
    installmentsCount: 4, status: 'active', createdAt: '2024-04-25',
  },
  {
    id: 'c9', contractNumber: 'CNT-2023-009', unitId: 'u14', tenantId: 't1',
    startDate: '2023-01-01', endDate: '2023-12-31', annualValue: 96000,
    installmentsCount: 2, status: 'expired', createdAt: '2022-12-15',
    notes: 'عقد منتهي',
  },
  {
    id: 'c10', contractNumber: 'CNT-2024-010', unitId: 'u16', tenantId: 't3',
    startDate: '2024-07-01', endDate: '2025-06-30', annualValue: 120000,
    installmentsCount: 4, status: 'active', createdAt: '2024-06-20',
    notes: 'عقد إيجار مطعم',
  },
];

// ===========================
// PAYMENTS — 30 دفعة
// ===========================
export const mockPayments: Payment[] = [
  // عقد c1 — 4 أقساط
  { id: 'pay1', receiptNumber: 'RCP-0001', contractId: 'c1', amount: 13500, dueDate: '2024-01-01', paidDate: '2023-12-28', method: 'transfer', status: 'paid', installmentNumber: 1, referenceNumber: 'TRF-2312-001' },
  { id: 'pay2', receiptNumber: 'RCP-0002', contractId: 'c1', amount: 13500, dueDate: '2024-04-01', paidDate: '2024-03-30', method: 'check', status: 'paid', installmentNumber: 2, referenceNumber: 'CHK-240330' },
  { id: 'pay3', receiptNumber: 'RCP-0003', contractId: 'c1', amount: 13500, dueDate: '2024-07-01', paidDate: '2024-07-05', method: 'transfer', status: 'paid', installmentNumber: 3 },
  { id: 'pay4', receiptNumber: 'RCP-0004', contractId: 'c1', amount: 13500, dueDate: '2024-10-01', status: 'pending', installmentNumber: 4 },
  // عقد c2 — 5 أقساط (شهري)
  { id: 'pay5', receiptNumber: 'RCP-0005', contractId: 'c2', amount: 6000, dueDate: '2024-03-01', paidDate: '2024-03-01', method: 'transfer', status: 'paid', installmentNumber: 1 },
  { id: 'pay6', receiptNumber: 'RCP-0006', contractId: 'c2', amount: 6000, dueDate: '2024-04-01', paidDate: '2024-04-02', method: 'transfer', status: 'paid', installmentNumber: 2 },
  { id: 'pay7', receiptNumber: 'RCP-0007', contractId: 'c2', amount: 6000, dueDate: '2024-05-01', paidDate: '2024-05-03', method: 'cash', status: 'paid', installmentNumber: 3 },
  { id: 'pay8', receiptNumber: 'RCP-0008', contractId: 'c2', amount: 6000, dueDate: '2024-06-01', paidDate: '2024-06-01', method: 'transfer', status: 'paid', installmentNumber: 4 },
  { id: 'pay9', receiptNumber: 'RCP-0009', contractId: 'c2', amount: 6000, dueDate: '2024-07-01', status: 'overdue', installmentNumber: 5 },
  // عقد c3 — 2 أقساط
  { id: 'pay10', receiptNumber: 'RCP-0010', contractId: 'c3', amount: 19200, dueDate: '2024-06-01', paidDate: '2024-06-01', method: 'check', status: 'paid', installmentNumber: 1 },
  { id: 'pay11', receiptNumber: 'RCP-0011', contractId: 'c3', amount: 19200, dueDate: '2024-12-01', status: 'pending', installmentNumber: 2 },
  // عقد c4 — 4 أقساط
  { id: 'pay12', receiptNumber: 'RCP-0012', contractId: 'c4', amount: 27000, dueDate: '2023-07-01', paidDate: '2023-07-01', method: 'transfer', status: 'paid', installmentNumber: 1 },
  { id: 'pay13', receiptNumber: 'RCP-0013', contractId: 'c4', amount: 27000, dueDate: '2023-10-01', paidDate: '2023-10-05', method: 'transfer', status: 'paid', installmentNumber: 2 },
  { id: 'pay14', receiptNumber: 'RCP-0014', contractId: 'c4', amount: 27000, dueDate: '2024-01-01', paidDate: '2024-01-10', method: 'check', status: 'paid', installmentNumber: 3 },
  { id: 'pay15', receiptNumber: 'RCP-0015', contractId: 'c4', amount: 27000, dueDate: '2024-04-01', status: 'overdue', installmentNumber: 4 },
  // عقد c5 — 3 أقساط
  { id: 'pay16', receiptNumber: 'RCP-0016', contractId: 'c5', amount: 18000, dueDate: '2024-02-01', paidDate: '2024-01-30', method: 'transfer', status: 'paid', installmentNumber: 1 },
  { id: 'pay17', receiptNumber: 'RCP-0017', contractId: 'c5', amount: 18000, dueDate: '2024-06-01', paidDate: '2024-06-02', method: 'transfer', status: 'paid', installmentNumber: 2 },
  { id: 'pay18', receiptNumber: 'RCP-0018', contractId: 'c5', amount: 18000, dueDate: '2024-10-01', status: 'pending', installmentNumber: 3 },
  // عقد c6 — 3 أقساط
  { id: 'pay19', receiptNumber: 'RCP-0019', contractId: 'c6', amount: 7000, dueDate: '2024-01-01', paidDate: '2024-01-01', method: 'transfer', status: 'paid', installmentNumber: 1 },
  { id: 'pay20', receiptNumber: 'RCP-0020', contractId: 'c6', amount: 7000, dueDate: '2024-07-01', paidDate: '2024-07-03', method: 'transfer', status: 'paid', installmentNumber: 2 },
  { id: 'pay21', receiptNumber: 'RCP-0021', contractId: 'c6', amount: 7000, dueDate: '2025-01-01', status: 'pending', installmentNumber: 3 },
  // عقد c7 — 2 أقساط
  { id: 'pay22', receiptNumber: 'RCP-0022', contractId: 'c7', amount: 22500, dueDate: '2024-04-01', paidDate: '2024-04-01', method: 'check', status: 'paid', installmentNumber: 1 },
  { id: 'pay23', receiptNumber: 'RCP-0023', contractId: 'c7', amount: 22500, dueDate: '2024-10-01', status: 'pending', installmentNumber: 2 },
  // عقد c8 — 2 أقساط
  { id: 'pay24', receiptNumber: 'RCP-0024', contractId: 'c8', amount: 36000, dueDate: '2024-05-01', paidDate: '2024-05-01', method: 'transfer', status: 'paid', installmentNumber: 1 },
  { id: 'pay25', receiptNumber: 'RCP-0025', contractId: 'c8', amount: 36000, dueDate: '2024-11-01', status: 'pending', installmentNumber: 2 },
  // عقد c9 — منتهي
  { id: 'pay26', receiptNumber: 'RCP-0026', contractId: 'c9', amount: 48000, dueDate: '2023-01-01', paidDate: '2023-01-01', method: 'check', status: 'paid', installmentNumber: 1 },
  { id: 'pay27', receiptNumber: 'RCP-0027', contractId: 'c9', amount: 48000, dueDate: '2023-07-01', paidDate: '2023-07-01', method: 'transfer', status: 'paid', installmentNumber: 2 },
  // عقد c10 — 2 أقساط
  { id: 'pay28', receiptNumber: 'RCP-0028', contractId: 'c10', amount: 30000, dueDate: '2024-07-01', paidDate: '2024-07-01', method: 'check', status: 'paid', installmentNumber: 1 },
  { id: 'pay29', receiptNumber: 'RCP-0029', contractId: 'c10', amount: 30000, dueDate: '2025-01-01', status: 'pending', installmentNumber: 2 },
  { id: 'pay30', receiptNumber: 'RCP-0030', contractId: 'c2', amount: 6000, dueDate: '2024-08-01', status: 'overdue', installmentNumber: 6 },
];

// ===========================
// MAINTENANCE — 8 طلبات
// ===========================
export const mockMaintenance: Maintenance[] = [
  {
    id: 'm1', title: 'تسريب مياه في الحمام', description: 'يوجد تسريب مياه من أنبوب الصرف تحت المغسلة في الحمام الرئيسي، مما يسبب تلف الأرضية',
    propertyId: 'p1', unitId: 'u1', priority: 'high', status: 'completed',
    technicianName: 'عمر السباك', cost: 850, openedAt: '2024-03-15', assignedAt: '2024-03-16', closedAt: '2024-03-17',
    reportedBy: 'محمد السالم',
  },
  {
    id: 'm2', title: 'عطل في مكيف الصالة', description: 'المكيف المركزي في الصالة لا يعمل بشكل طبيعي، يخرج هواء دافئ فقط مع صوت اهتزاز غير طبيعي',
    propertyId: 'p1', unitId: 'u2', priority: 'high', status: 'in_progress',
    technicianName: 'خالد الكهربائي', cost: 1200, openedAt: '2024-07-10', assignedAt: '2024-07-11',
    reportedBy: 'عمر الحربي',
  },
  {
    id: 'm3', title: 'كسر في زجاج النافذة', description: 'النافذة الرئيسية في غرفة النوم الرئيسية بها شرخ كبير يحتاج إلى استبدال فوري',
    propertyId: 'p1', unitId: 'u4', priority: 'medium', status: 'new',
    reportedBy: 'أحمد المصري', openedAt: '2024-07-20',
  },
  {
    id: 'm4', title: 'إصلاح باب المدخل', description: 'قفل الباب الرئيسي للوحدة به خلل، لا يفتح بسهولة ويحتاج إلى ضغط مبالغ فيه',
    propertyId: 'p2', unitId: 'u7', priority: 'medium', status: 'completed',
    technicianName: 'فهد النجار', cost: 350, openedAt: '2024-05-01', assignedAt: '2024-05-02', closedAt: '2024-05-03',
    reportedBy: 'سارة الغامدي',
  },
  {
    id: 'm5', title: 'صيانة شاملة للمصعد', description: 'المصعد الرئيسي للبرج يحتاج صيانة دورية شاملة وفحص أجهزة السلامة',
    propertyId: 'p1', unitId: 'u1', priority: 'high', status: 'in_progress',
    technicianName: 'شركة أوتيس للمصاعد', cost: 5000, openedAt: '2024-07-01', assignedAt: '2024-07-05',
    reportedBy: 'إدارة العقار',
  },
  {
    id: 'm6', title: 'دهان الجدران الخارجية', description: 'الواجهة الخارجية لمبنى الأعمال تحتاج إلى طلاء جديد بعد تلف الدهان القديم',
    propertyId: 'p3', unitId: 'u10', priority: 'low', status: 'new',
    reportedBy: 'إدارة المجمع', openedAt: '2024-07-15',
  },
  {
    id: 'm7', title: 'إصلاح خط الكهرباء', description: 'انقطاع متكرر في الكهرباء بالطابق الأول من مجمع الأعمال، يؤثر على الوحدات u10 و u11',
    propertyId: 'p3', unitId: 'u10', priority: 'high', status: 'completed',
    technicianName: 'مهندس سعد الكهربائي', cost: 2800, openedAt: '2024-06-20', assignedAt: '2024-06-21', closedAt: '2024-06-25',
    reportedBy: 'نواف الشمري',
  },
  {
    id: 'm8', title: 'صيانة نظام الري في الحديقة', description: 'نظام الري الأوتوماتيكي في حديقة الفيلا يحتاج إلى ضبط ومعالجة تسريب في أنابيب الري',
    propertyId: 'p2', unitId: 'u7', priority: 'low', status: 'new',
    reportedBy: 'سارة الغامدي', openedAt: '2024-07-18',
  },
];

// ===========================
// AUDIT LOGS — 20 سجل
// ===========================
export const mockAuditLogs: AuditLog[] = [
  { id: 'al1', action: 'add', entityType: 'عقد', entityName: 'CNT-2024-010', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-06-20T10:30:00', details: 'تم إضافة عقد إيجار جديد للوحدة S-03 مع المستأجر أحمد المصري' },
  { id: 'al2', action: 'edit', entityType: 'وحدة', entityName: 'برج الرياض - 201', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-06-18T14:15:00', details: 'تم تحديث الإيجار الشهري من 5500 إلى 6000 ريال' },
  { id: 'al3', action: 'add', entityType: 'دفعة', entityName: 'RCP-0028', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-07-01T09:00:00', details: 'تم تسجيل دفعة إيجار بمبلغ 30,000 ريال للعقد CNT-2024-010' },
  { id: 'al4', action: 'add', entityType: 'طلب صيانة', entityName: 'عطل مكيف الصالة', userId: 'user1', userName: 'أحمد المساعد', timestamp: '2024-07-10T11:00:00', details: 'تم تسجيل طلب صيانة جديد بأولوية عالية للوحدة 201' },
  { id: 'al5', action: 'edit', entityType: 'عقد', entityName: 'CNT-2024-002', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-07-05T16:30:00', details: 'تم تغيير حالة الدفعة الخامسة إلى "متأخرة"' },
  { id: 'al6', action: 'add', entityType: 'مستأجر', entityName: 'فيصل المطيري', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-06-01T10:00:00', details: 'تم إضافة مستأجر جديد فيصل عادل المطيري' },
  { id: 'al7', action: 'edit', entityType: 'عقار', entityName: 'عمارة المدينة المنورة', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-05-20T09:30:00', details: 'تم تغيير حالة العقار إلى "غير نشط"' },
  { id: 'al8', action: 'add', entityType: 'عقد', entityName: 'CNT-2024-008', userId: 'user1', userName: 'أحمد المساعد', timestamp: '2024-04-25T14:00:00', details: 'تم إضافة عقد تجاري جديد للمكتب O-201' },
  { id: 'al9', action: 'delete', entityType: 'وحدة', entityName: 'وحدة مؤقتة', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-04-10T11:30:00', details: 'تم حذف وحدة اختبار مؤقتة' },
  { id: 'al10', action: 'edit', entityType: 'مستأجر', entityName: 'عمر الحربي', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-04-01T15:00:00', details: 'تم تحديث رقم الهاتف والبريد الإلكتروني' },
  { id: 'al11', action: 'add', entityType: 'عقار', entityName: 'أبراج الدمام السكنية', userId: 'admin', userName: 'مدير النظام', timestamp: '2023-04-05T10:00:00', details: 'تم إضافة عقار جديد بالدمام تابع للمالك سلطان القحطاني' },
  { id: 'al12', action: 'add', entityType: 'وحدة', entityName: 'D-501', userId: 'admin', userName: 'مدير النظام', timestamp: '2023-04-06T11:00:00', details: 'تم إضافة وحدة D-501 لعقار أبراج الدمام' },
  { id: 'al13', action: 'edit', entityType: 'طلب صيانة', entityName: 'تسريب مياه الحمام', userId: 'user1', userName: 'أحمد المساعد', timestamp: '2024-03-17T16:00:00', details: 'تم إغلاق طلب الصيانة بعد إتمام الإصلاح بتكلفة 850 ريال' },
  { id: 'al14', action: 'add', entityType: 'دفعة', entityName: 'RCP-0022', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-04-01T09:00:00', details: 'تسجيل دفعة مكتب O-101 بمبلغ 22,500 ريال بشيك' },
  { id: 'al15', action: 'edit', entityType: 'مالك', entityName: 'عبدالعزيز الرشيد', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-03-01T10:00:00', details: 'تم تحديث رقم IBAN للمالك' },
  { id: 'al16', action: 'add', entityType: 'عقد', entityName: 'CNT-2024-007', userId: 'user1', userName: 'أحمد المساعد', timestamp: '2024-03-20T14:30:00', details: 'عقد تجاري لمدة سنتين للمكتب O-101' },
  { id: 'al17', action: 'delete', entityType: 'إشعار', entityName: 'إشعارات قديمة', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-02-28T17:00:00', details: 'حذف الإشعارات القديمة لأكثر من 3 أشهر' },
  { id: 'al18', action: 'edit', entityType: 'وحدة', entityName: 'V-A', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-02-10T10:00:00', details: 'تم تحديث قائمة المميزات وزيادة الإيجار الشهري' },
  { id: 'al19', action: 'add', entityType: 'مستأجر', entityName: 'سارة الغامدي', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-01-08T09:00:00', details: 'تم إضافة مستأجرة جديدة سارة عبدالرحمن الغامدي' },
  { id: 'al20', action: 'edit', entityType: 'عقار', entityName: 'مركز الخليج التجاري', userId: 'admin', userName: 'مدير النظام', timestamp: '2024-01-05T11:00:00', details: 'تم تحديث وصف العقار ومعلومات الموقع' },
];

// ===========================
// CALENDAR EVENTS — 15 حدث
// ===========================
export const mockCalendarEvents: CalendarEvent[] = [
  { id: 'ev1', title: 'دفعة CNT-2024-001 مستحقة', type: 'payment', date: '2024-10-01', description: 'القسط الرابع والأخير للعقد CNT-2024-001 - 13,500 ريال', priority: 'high', relatedId: 'pay4' },
  { id: 'ev2', title: 'دفعة CNT-2024-002 متأخرة', type: 'payment', date: '2024-07-01', description: 'القسط الخامس متأخر للعقد CNT-2024-002 - 6,000 ريال', priority: 'high', relatedId: 'pay9' },
  { id: 'ev3', title: 'صيانة مصعد برج الرياض', type: 'maintenance', date: '2024-07-05', description: 'صيانة دورية شاملة للمصعد الرئيسي', priority: 'high', relatedId: 'm5' },
  { id: 'ev4', title: 'انتهاء عقد CNT-2023-010', type: 'contract_expiry', date: '2024-06-30', description: 'انتهاء عقد بنتهاوس الوحدة 601 - يوسف الكويتي', priority: 'high', relatedId: 'c4' },
  { id: 'ev5', title: 'دفعة CNT-2024-005 مستحقة', type: 'payment', date: '2024-10-01', description: 'القسط الثالث لعقد فيلا V-A - 18,000 ريال', priority: 'medium', relatedId: 'pay18' },
  { id: 'ev6', title: 'دفعة CNT-2024-007 مستحقة', type: 'payment', date: '2024-10-01', description: 'القسط الثاني لمكتب O-101 - 22,500 ريال', priority: 'medium', relatedId: 'pay23' },
  { id: 'ev7', title: 'فحص طلب صيانة عطل المكيف', type: 'maintenance', date: '2024-07-15', description: 'متابعة إصلاح مكيف الصالة في الوحدة 201', priority: 'high', relatedId: 'm2' },
  { id: 'ev8', title: 'دفعة CNT-2024-003 مستحقة', type: 'payment', date: '2024-12-01', description: 'القسط الثاني للوحدة 401 - 19,200 ريال', priority: 'medium', relatedId: 'pay11' },
  { id: 'ev9', title: 'انتهاء عقد CNT-2024-001 قريباً', type: 'contract_expiry', date: '2024-12-31', description: 'عقد الوحدة 101 - محمد السالم ينتهي بعد 3 أشهر', priority: 'medium', relatedId: 'c1' },
  { id: 'ev10', title: 'دفعة CNT-2024-008 مستحقة', type: 'payment', date: '2024-11-01', description: 'القسط الثاني لمكتب O-201 - 36,000 ريال', priority: 'medium', relatedId: 'pay25' },
  { id: 'ev11', title: 'صيانة دهان الواجهة', type: 'maintenance', date: '2024-08-01', description: 'بدء أعمال طلاء الواجهة الخارجية لمجمع الأعمال', priority: 'low', relatedId: 'm6' },
  { id: 'ev12', title: 'مراجعة عقد فيلا V-B', type: 'contract_expiry', date: '2025-12-31', description: 'عقد فيلا V-B - علي الأنصاري ينتهي نهاية 2025', priority: 'low', relatedId: 'c6' },
  { id: 'ev13', title: 'دفعة CNT-2024-010 مستحقة', type: 'payment', date: '2025-01-01', description: 'القسط الثاني لمطعم S-03 - 30,000 ريال', priority: 'medium', relatedId: 'pay29' },
  { id: 'ev14', title: 'تجديد عقد الوحدة V-A', type: 'contract_expiry', date: '2025-01-31', description: 'عقد فيلا V-A - سارة الغامدي ينتهي في يناير 2025', priority: 'high', relatedId: 'c5' },
  { id: 'ev15', title: 'صيانة نظام الري', type: 'maintenance', date: '2024-07-25', description: 'إصلاح نظام الري في حديقة فيلا الملك فهد', priority: 'low', relatedId: 'm8' },
];

// ===========================
// Helper Functions
// ===========================
export const getOwnerById = (id: string) => mockOwners.find(o => o.id === id);
export const getPropertyById = (id: string) => mockProperties.find(p => p.id === id);
export const getTenantById = (id: string) => mockTenants.find(t => t.id === id);
export const getUnitById = (id: string) => mockUnits.find(u => u.id === id);
export const getContractById = (id: string) => mockContracts.find(c => c.id === id);
export const getPaymentsByContractId = (contractId: string) => mockPayments.filter(p => p.contractId === contractId);
export const getUnitsByPropertyId = (propertyId: string) => mockUnits.filter(u => u.propertyId === propertyId);
export const getContractsByTenantId = (tenantId: string) => mockContracts.filter(c => c.tenantId === tenantId);
export const getMaintenanceByPropertyId = (propertyId: string) => mockMaintenance.filter(m => m.propertyId === propertyId);

export const getPropertyTypeLabel = (type: PropertyType): string => {
  const labels: Record<PropertyType, string> = {
    apartment: 'شقة', villa: 'فيلا', office: 'مكتب', shop: 'محل', building: 'مبنى', tower: 'برج', land: 'أرض',
  };
  return labels[type];
};

export const getUnitTypeLabel = (type: UnitType): string => {
  const labels: Record<UnitType, string> = {
    studio: 'استوديو', apartment_1: 'شقة غرفة', apartment_2: 'شقة غرفتين',
    apartment_3: 'شقة 3 غرف', apartment_4: 'شقة 4 غرف', villa: 'فيلا',
    office: 'مكتب', shop: 'محل',
  };
  return labels[type];
};

export const formatCurrency = (amount: number | null | undefined): string => {
  if (amount == null || isNaN(amount as number)) return '0';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const ARABIC_MONTHS_LONG = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                            'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// Parse 'YYYY-MM-DD' without timezone shift
export const formatDate = (dateString?: string | null): string => {
  if (!dateString) return '—';
  const parts = dateString.split('-');
  if (parts.length !== 3) return '—';
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12) return '—';
  return `${d} ${ARABIC_MONTHS_LONG[m - 1]} ${y}`;
};
