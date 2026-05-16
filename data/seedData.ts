/**
 * seedData.ts — Mock data conforming to the new domain models.
 * Used by AppStore. The old mockData.ts is kept for backward compatibility.
 */
import type {
  Owner, Tenant, Property, Unit, Contract, PaymentInstallment,
  MaintenanceRequest, AuditLog, Notification, CalendarEvent, User,
} from '../domain/models';

// ─── User ─────────────────────────────────────────────────────────────────────

export const CURRENT_USER: User = {
  id:    'usr_1',
  name:  'محمد أحمد الإداري',
  email: 'admin@dtgrentals.com',
  phone: '0501234567',
  role:  'مدير النظام',
  preferences: {
    theme:    'system',
    language: 'ar',
    notifications: {
      contracts:    true,
      payments:     true,
      attachments:  true,
      maintenance:  true,
    },
  },
};

// ─── Owners ───────────────────────────────────────────────────────────────────

export const OWNERS: Owner[] = [
  { id: 'o1', name: 'عبدالعزيز بن محمد الرشيد', phone: '0501234567', email: 'abdulaziz@email.com', nationalId: '1023456789', bankAccount: 'SA0380000000608010167519', createdAt: '2022-01-15T00:00:00Z', updatedAt: '2022-01-15T00:00:00Z' },
  { id: 'o2', name: 'فهد بن سعد العتيبي',         phone: '0559876543', email: 'fahad@email.com',     nationalId: '1087654321', bankAccount: 'SA7157000000141892827018', createdAt: '2021-06-20T00:00:00Z', updatedAt: '2021-06-20T00:00:00Z' },
  { id: 'o3', name: 'سلطان بن ناصر القحطاني',     phone: '0533456789', email: 'sultan@email.com',    nationalId: '1034567890', createdAt: '2023-03-10T00:00:00Z', updatedAt: '2023-03-10T00:00:00Z' },
  { id: 'o4', name: 'خالد بن عمر الزهراني',        phone: '0566789012', email: 'khalid@email.com',    nationalId: '1045678901', createdAt: '2020-11-05T00:00:00Z', updatedAt: '2020-11-05T00:00:00Z' },
];

// ─── Tenants ──────────────────────────────────────────────────────────────────

export const TENANTS: Tenant[] = [
  { id: 't1', name: 'أحمد بن علي المنصور',   phone: '0512345678', email: 'ahmed@email.com',   nationality: 'سعودي',  createdAt: '2023-01-10T00:00:00Z', updatedAt: '2023-01-10T00:00:00Z' },
  { id: 't2', name: 'سارة بنت محمد الخالد',  phone: '0523456789', email: 'sara@email.com',    nationality: 'سعودية', createdAt: '2022-05-20T00:00:00Z', updatedAt: '2022-05-20T00:00:00Z' },
  { id: 't3', name: 'يوسف علي الأحمد',       phone: '0534567890', email: 'yousuf@email.com',  nationality: 'كويتي',  createdAt: '2021-09-15T00:00:00Z', updatedAt: '2021-09-15T00:00:00Z' },
  { id: 't4', name: 'منى بنت خالد السعد',    phone: '0545678901', email: 'mona@email.com',    nationality: 'سعودية', createdAt: '2022-11-30T00:00:00Z', updatedAt: '2022-11-30T00:00:00Z' },
  { id: 't5', name: 'عمر بن فيصل الحربي',    phone: '0556789012', email: 'omar@email.com',    nationality: 'سعودي',  createdAt: '2023-04-05T00:00:00Z', updatedAt: '2023-04-05T00:00:00Z' },
  { id: 't6', name: 'نورة بنت سعد القرني',   phone: '0567890123', email: 'noura@email.com',   nationality: 'سعودية', createdAt: '2020-07-22T00:00:00Z', updatedAt: '2020-07-22T00:00:00Z' },
  { id: 't7', name: 'راشد بن ناصر العنزي',   phone: '0578901234', email: 'rashed@email.com',  nationality: 'سعودي',  createdAt: '2021-12-01T00:00:00Z', updatedAt: '2021-12-01T00:00:00Z' },
  { id: 't8', name: 'دانة بنت عمر المطيري',  phone: '0589012345', email: 'dana@email.com',    nationality: 'سعودية', createdAt: '2023-06-18T00:00:00Z', updatedAt: '2023-06-18T00:00:00Z' },
];

// ─── Properties ───────────────────────────────────────────────────────────────

export const PROPERTIES: Property[] = [
  { id: 'p1', name: 'برج الرياض السكني',    type: 'apartment', address: 'حي العليا',     city: 'الرياض',  ownerId: 'o1', totalUnits: 6, floors: 12, buildYear: 2018, createdAt: '2022-01-20T00:00:00Z', updatedAt: '2022-01-20T00:00:00Z' },
  { id: 'p2', name: 'فيلا الملك فهد',        type: 'villa',     address: 'حي الملقا',     city: 'الرياض',  ownerId: 'o1', totalUnits: 3, floors: 3,  buildYear: 2015, createdAt: '2021-08-15T00:00:00Z', updatedAt: '2021-08-15T00:00:00Z' },
  { id: 'p3', name: 'مجمع الأعمال التجاري', type: 'office',    address: 'حي الروضة',     city: 'جدة',     ownerId: 'o2', totalUnits: 4, floors: 8,  buildYear: 2012, createdAt: '2020-03-10T00:00:00Z', updatedAt: '2020-03-10T00:00:00Z' },
  { id: 'p4', name: 'مركز الخليج التجاري',  type: 'shop',      address: 'حي البلد',      city: 'جدة',     ownerId: 'o2', totalUnits: 3, floors: 2,  buildYear: 2010, createdAt: '2019-06-01T00:00:00Z', updatedAt: '2019-06-01T00:00:00Z' },
  { id: 'p5', name: 'أبراج الدمام السكنية', type: 'apartment', address: 'حي الشاطئ',     city: 'الدمام',  ownerId: 'o3', totalUnits: 2, floors: 10, buildYear: 2020, createdAt: '2023-01-05T00:00:00Z', updatedAt: '2023-01-05T00:00:00Z' },
  { id: 'p6', name: 'عمارة المدينة',         type: 'building',  address: 'حي الإسكان',    city: 'المدينة', ownerId: 'o4', totalUnits: 2, floors: 5,  buildYear: 2008, createdAt: '2020-11-10T00:00:00Z', updatedAt: '2020-11-10T00:00:00Z' },
];

// ─── Units ────────────────────────────────────────────────────────────────────

export const UNITS: Unit[] = [
  { id: 'u1',  propertyId: 'p1', unitNumber: '101', type: 'apartment', floor: 1,  area: 120, bedrooms: 3, bathrooms: 2, status: 'rented',      baseRent: 60000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u2',  propertyId: 'p1', unitNumber: '102', type: 'apartment', floor: 1,  area: 95,  bedrooms: 2, bathrooms: 1, status: 'rented',      baseRent: 48000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u3',  propertyId: 'p1', unitNumber: '201', type: 'apartment', floor: 2,  area: 120, bedrooms: 3, bathrooms: 2, status: 'vacant',      baseRent: 60000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2023-11-01T00:00:00Z' },
  { id: 'u4',  propertyId: 'p1', unitNumber: '202', type: 'studio',    floor: 2,  area: 55,  bedrooms: 0, bathrooms: 1, status: 'rented',      baseRent: 28000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u5',  propertyId: 'p1', unitNumber: '301', type: 'apartment', floor: 3,  area: 140, bedrooms: 4, bathrooms: 3, status: 'maintenance', baseRent: 75000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
  { id: 'u6',  propertyId: 'p1', unitNumber: '302', type: 'apartment', floor: 3,  area: 120, bedrooms: 3, bathrooms: 2, status: 'rented',      baseRent: 60000, createdAt: '2022-01-21T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u7',  propertyId: 'p2', unitNumber: 'A',   type: 'villa',     floor: 1,  area: 400, bedrooms: 6, bathrooms: 4, status: 'rented',      baseRent: 150000, createdAt: '2021-08-16T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u8',  propertyId: 'p2', unitNumber: 'B',   type: 'villa',     floor: 1,  area: 380, bedrooms: 5, bathrooms: 3, status: 'vacant',      baseRent: 140000, createdAt: '2021-08-16T00:00:00Z', updatedAt: '2023-12-01T00:00:00Z' },
  { id: 'u9',  propertyId: 'p2', unitNumber: 'C',   type: 'villa',     floor: 1,  area: 360, bedrooms: 5, bathrooms: 3, status: 'rented',      baseRent: 135000, createdAt: '2021-08-16T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u10', propertyId: 'p3', unitNumber: '1A',  type: 'office',    floor: 1,  area: 200, status: 'rented',      baseRent: 80000, createdAt: '2020-03-11T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u11', propertyId: 'p3', unitNumber: '1B',  type: 'office',    floor: 1,  area: 150, status: 'vacant',      baseRent: 60000, createdAt: '2020-03-11T00:00:00Z', updatedAt: '2023-10-01T00:00:00Z' },
  { id: 'u12', propertyId: 'p3', unitNumber: '2A',  type: 'office',    floor: 2,  area: 200, status: 'rented',      baseRent: 85000, createdAt: '2020-03-11T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u13', propertyId: 'p3', unitNumber: '2B',  type: 'office',    floor: 2,  area: 180, status: 'rented',      baseRent: 72000, createdAt: '2020-03-11T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u14', propertyId: 'p4', unitNumber: 'S1',  type: 'shop',      floor: 1,  area: 80,  status: 'rented',      baseRent: 90000, createdAt: '2019-06-02T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u15', propertyId: 'p4', unitNumber: 'S2',  type: 'shop',      floor: 1,  area: 60,  status: 'rented',      baseRent: 72000, createdAt: '2019-06-02T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u16', propertyId: 'p4', unitNumber: 'S3',  type: 'shop',      floor: 1,  area: 100, status: 'vacant',      baseRent: 110000, createdAt: '2019-06-02T00:00:00Z', updatedAt: '2023-09-01T00:00:00Z' },
  { id: 'u17', propertyId: 'p5', unitNumber: 'T1',  type: 'apartment', floor: 5,  area: 130, bedrooms: 3, bathrooms: 2, status: 'rented', baseRent: 65000, createdAt: '2023-01-06T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u18', propertyId: 'p5', unitNumber: 'T2',  type: 'apartment', floor: 8,  area: 130, bedrooms: 3, bathrooms: 2, status: 'vacant', baseRent: 67000, createdAt: '2023-01-06T00:00:00Z', updatedAt: '2023-10-01T00:00:00Z' },
  { id: 'u19', propertyId: 'p6', unitNumber: 'F1',  type: 'floor',     floor: 1,  area: 250, status: 'rented', baseRent: 45000, createdAt: '2020-11-11T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'u20', propertyId: 'p6', unitNumber: 'F2',  type: 'floor',     floor: 2,  area: 250, status: 'rented', baseRent: 45000, createdAt: '2020-11-11T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

// ─── Contracts ────────────────────────────────────────────────────────────────

export const CONTRACTS: Contract[] = [
  { id: 'c1',  propertyId: 'p1', unitId: 'u1',  tenantId: 't1', startDate: '2026-01-01', endDate: '2027-12-31', status: 'active',    annualValue: 60000,  paymentCycles: 4,  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'c2',  propertyId: 'p1', unitId: 'u2',  tenantId: 't2', startDate: '2025-06-01', endDate: '2027-05-31', status: 'active',    annualValue: 48000,  paymentCycles: 2,  createdAt: '2025-06-01T00:00:00Z', updatedAt: '2025-06-01T00:00:00Z' },
  { id: 'c3',  propertyId: 'p1', unitId: 'u4',  tenantId: 't3', startDate: '2026-03-01', endDate: '2027-02-28', status: 'active',    annualValue: 28000,  paymentCycles: 1,  createdAt: '2026-03-01T00:00:00Z', updatedAt: '2026-03-01T00:00:00Z' },
  { id: 'c4',  propertyId: 'p1', unitId: 'u6',  tenantId: 't4', startDate: '2025-09-01', endDate: '2026-08-31', status: 'active',    annualValue: 60000,  paymentCycles: 4,  createdAt: '2025-09-01T00:00:00Z', updatedAt: '2025-09-01T00:00:00Z' },
  { id: 'c5',  propertyId: 'p2', unitId: 'u7',  tenantId: 't5', startDate: '2026-01-01', endDate: '2026-12-31', status: 'active',    annualValue: 150000, paymentCycles: 4,  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
  { id: 'c6',  propertyId: 'p2', unitId: 'u9',  tenantId: 't6', startDate: '2025-01-01', endDate: '2026-12-31', status: 'active',    annualValue: 135000, paymentCycles: 2,  createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'c7',  propertyId: 'p3', unitId: 'u10', tenantId: 't7', startDate: '2025-01-01', endDate: '2026-12-31', status: 'active',    annualValue: 80000,  paymentCycles: 4,  createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'c8',  propertyId: 'p3', unitId: 'u12', tenantId: 't8', startDate: '2025-07-01', endDate: '2027-06-30', status: 'active',    annualValue: 85000,  paymentCycles: 4,  createdAt: '2025-07-01T00:00:00Z', updatedAt: '2025-07-01T00:00:00Z' },
  { id: 'c9',  propertyId: 'p3', unitId: 'u13', tenantId: 't1', startDate: '2025-04-01', endDate: '2027-03-31', status: 'active',    annualValue: 72000,  paymentCycles: 2,  createdAt: '2025-04-01T00:00:00Z', updatedAt: '2025-04-01T00:00:00Z' },
  { id: 'c10', propertyId: 'p4', unitId: 'u14', tenantId: 't2', startDate: '2025-01-01', endDate: '2026-12-31', status: 'active',    annualValue: 90000,  paymentCycles: 4,  createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
];

// ─── Installments (generated from contracts) ─────────────────────────────────

function genInstallments(contract: Contract): PaymentInstallment[] {
  const amount   = Math.round(contract.annualValue / contract.paymentCycles);
  const start    = new Date(contract.startDate);
  const interval = 12 / contract.paymentCycles;
  const installs: PaymentInstallment[] = [];

  for (let i = 0; i < contract.paymentCycles; i++) {
    const d = new Date(start);
    d.setMonth(d.getMonth() + Math.round(i * interval));
    const dueDate = d.toISOString().split('T')[0];
    const isPast  = new Date(dueDate) < new Date();
    const isFirst = i === 0;

    installs.push({
      id:                 `inst_${contract.id}_${i + 1}`,
      contractId:         contract.id,
      installmentNumber:  i + 1,
      dueDate,
      amount,
      status:             isFirst ? 'paid' : isPast ? 'overdue' : 'pending',
      paidDate:           isFirst ? dueDate : undefined,
      paymentMethod:      isFirst ? 'bank_transfer' : undefined,
      receiptNumber:      isFirst ? `RCP-${dueDate.slice(0,7).replace('-','')}-${1000 + i}` : undefined,
      createdAt:          contract.createdAt,
      updatedAt:          contract.createdAt,
    });
  }
  return installs;
}

export const INSTALLMENTS: PaymentInstallment[] = CONTRACTS.flatMap(genInstallments);

// ─── Maintenance ──────────────────────────────────────────────────────────────

export const MAINTENANCE: MaintenanceRequest[] = [
  { id: 'm1', propertyId: 'p1', unitId: 'u5',  title: 'تسرب مياه في الحمام',       description: 'يوجد تسرب مياه من الحنفية الرئيسية',    category: 'plumbing',   priority: 'high',   status: 'in_progress', reportedBy: 'أحمد المنصور',  assignedTo: 'علي الفني',    createdAt: '2024-02-01T00:00:00Z', updatedAt: '2024-02-05T00:00:00Z' },
  { id: 'm2', propertyId: 'p1', unitId: 'u3',  title: 'عطل في المكيف',              description: 'المكيف لا يعمل بشكل صحيح',              category: 'AC',         priority: 'medium', status: 'new',         reportedBy: 'إدارة العقار',                              scheduledDate: '2026-04-20', createdAt: '2026-04-10T00:00:00Z', updatedAt: '2026-04-10T00:00:00Z' },
  { id: 'm3', propertyId: 'p2', unitId: 'u8',  title: 'صيانة المسبح',              description: 'تنظيف وصيانة حوض السباحة',              category: 'pool',       priority: 'low',    status: 'completed',   reportedBy: 'إدارة الفيلا',  assignedTo: 'شركة صيانة',  completedDate: '2024-01-20', createdAt: '2024-01-15T00:00:00Z', updatedAt: '2024-01-20T00:00:00Z' },
  { id: 'm4', propertyId: 'p3', unitId: 'u11', title: 'مشكلة في الإنترنت',         description: 'انقطاع متكرر في خدمة الإنترنت',         category: 'electrical', priority: 'medium', status: 'new',         reportedBy: 'مستأجر الوحدة',                             createdAt: '2024-02-12T00:00:00Z', updatedAt: '2024-02-12T00:00:00Z' },
  { id: 'm5', propertyId: 'p4', unitId: 'u16', title: 'بوابة المدخل معطلة',        description: 'بوابة المدخل الرئيسي لا تفتح آلياً',    category: 'electrical', priority: 'urgent', status: 'in_progress', reportedBy: 'حارس الأمن',    assignedTo: 'فني الكهرباء', scheduledDate: '2026-04-25', createdAt: '2026-04-08T00:00:00Z', updatedAt: '2026-04-09T00:00:00Z' },
  { id: 'm6', propertyId: 'p5', unitId: 'u18', title: 'دهان الجدران',              description: 'إعادة دهان شقة بعد انتهاء عقد المستأجر', category: 'painting',   priority: 'low',    status: 'new',         reportedBy: 'إدارة المبنى',                              createdAt: '2024-02-14T00:00:00Z', updatedAt: '2024-02-14T00:00:00Z' },
  { id: 'm7', propertyId: 'p6', unitId: 'u19', title: 'تشقق في الأرضية',           description: 'تشقق في بلاط الأرضية بالمدخل',          category: 'flooring',   priority: 'medium', status: 'in_progress', reportedBy: 'المستأجر',      assignedTo: 'شركة الأرضيات', createdAt: '2024-01-28T00:00:00Z', updatedAt: '2024-02-01T00:00:00Z' },
  { id: 'm8', propertyId: 'p1', unitId: 'u1',  title: 'استبدال مصابيح الممر',      description: 'المصابيح في الممر الرئيسي محترقة',       category: 'electrical', priority: 'low',    status: 'completed',   reportedBy: 'أحمد المنصور',  completedDate: '2024-01-25', createdAt: '2024-01-22T00:00:00Z', updatedAt: '2024-01-25T00:00:00Z' },
];

// ─── Audit Logs ───────────────────────────────────────────────────────────────

export const AUDIT_LOGS: AuditLog[] = [
  { id: 'al1', userId: 'usr_1', userName: 'محمد الإداري', action: 'create',  entityType: 'contract',    entityId: 'c9',  entityLabel: 'إضافة عقد جديد - وحدة 2B', timestamp: '2024-02-01T09:30:00Z' },
  { id: 'al2', userId: 'usr_1', userName: 'محمد الإداري', action: 'payment', entityType: 'installment', entityId: 'inst_c1_1', entityLabel: 'تسجيل دفعة - عقد c1', timestamp: '2024-01-05T11:00:00Z' },
  { id: 'al3', userId: 'usr_1', userName: 'محمد الإداري', action: 'create',  entityType: 'maintenance', entityId: 'm1',  entityLabel: 'طلب صيانة - تسرب مياه', timestamp: '2024-02-01T14:00:00Z' },
  { id: 'al4', userId: 'usr_1', userName: 'محمد الإداري', action: 'update',  entityType: 'contract',    entityId: 'c4',  entityLabel: 'تعديل عقد - وحدة 302',  timestamp: '2024-01-20T10:15:00Z' },
  { id: 'al5', userId: 'usr_1', userName: 'محمد الإداري', action: 'create',  entityType: 'owner',       entityId: 'o3',  entityLabel: 'إضافة مالك - سلطان القحطاني', timestamp: '2023-03-10T09:00:00Z' },
];

// ─── Notifications ────────────────────────────────────────────────────────────

export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: 'payment_due',     title: 'دفعة متأخرة',                  body: 'دفعة الربع الثاني لعقد c4 متأخرة',           entityType: 'installment', entityId: 'inst_c4_2', isRead: false, createdAt: new Date().toISOString() },
  { id: 'n2', type: 'contract_expiry', title: 'تنبيه انتهاء عقد',             body: 'عقد c5 ينتهي خلال أقل من 90 يوماً',          entityType: 'contract',    entityId: 'c5',       isRead: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'n3', type: 'maintenance',     title: 'طلب صيانة عاجل',               body: 'بوابة المدخل معطلة - مركز الخليج',           entityType: 'maintenance', entityId: 'm5',       isRead: true,  createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'n4', type: 'system',          title: 'مرحباً بك في DTG Rentals',    body: 'تم تسجيل الدخول بنجاح إلى النظام',           isRead: true,  createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
];

// ─── Calendar Events ──────────────────────────────────────────────────────────

export const CALENDAR_EVENTS: CalendarEvent[] = [
  { id: 'ce1', title: 'دفعة ربعية - عقد c5',      date: '2026-04-01', type: 'payment',         entityId: 'inst_c5_2', entityType: 'installment' },
  { id: 'ce2', title: 'انتهاء عقد c5',             date: '2026-12-31', type: 'contract_expiry', entityId: 'c5',        entityType: 'contract' },
  { id: 'ce3', title: 'دفعة سنوية - عقد c3',      date: '2027-03-01', type: 'payment',         entityId: 'inst_c3_1', entityType: 'installment' },
  { id: 'ce4', title: 'صيانة مكيف - وحدة 201',    date: '2026-04-20', type: 'maintenance',     entityId: 'm2',        entityType: 'maintenance' },
  { id: 'ce5', title: 'انتهاء عقد c4',             date: '2026-08-31', type: 'contract_expiry', entityId: 'c4',        entityType: 'contract' },
  { id: 'ce6', title: 'دفعة نصف سنوية - عقد c6', date: '2026-07-01', type: 'payment',         entityId: 'inst_c6_2', entityType: 'installment' },
  { id: 'ce7', title: 'متابعة صيانة بوابة p4',    date: '2026-04-25', type: 'maintenance',     entityId: 'm5',        entityType: 'maintenance' },
  { id: 'ce8', title: 'تجديد عقد c2',             date: '2026-05-15', type: 'contract_expiry', entityId: 'c2',        entityType: 'contract' },
];

// ─── Master Export ────────────────────────────────────────────────────────────

export const MOCK_DATA = {
  currentUser:    CURRENT_USER,
  owners:         OWNERS,
  tenants:        TENANTS,
  properties:     PROPERTIES,
  units:          UNITS,
  contracts:      CONTRACTS,
  installments:   INSTALLMENTS,
  maintenance:    MAINTENANCE,
  attachments:    [],
  auditLogs:      AUDIT_LOGS,
  notifications:  NOTIFICATIONS,
  calendarEvents: CALENDAR_EVENTS,
};
