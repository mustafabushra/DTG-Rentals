// ─── Feature Flags & Role Permissions — default values ───────────────────────

export interface ModuleFlags {
  properties:  boolean;
  units:       boolean;
  tenants:     boolean;
  owners:      boolean;
  contracts:   boolean;
  payments:    boolean;
  maintenance: boolean;
  reports:     boolean;
  calendar:    boolean;
  backup:      boolean;
  auditLog:    boolean;
  ledger:      boolean;
}

export interface RolePermissions {
  canView:         boolean;
  canAdd:          boolean;
  canEdit:         boolean;
  canDelete:       boolean;
  canManageUsers:  boolean;
  canAccessReports:boolean;
  canAccessBackup: boolean;
}

export interface SystemSettings {
  modules:            ModuleFlags;
  permissions:        Record<string, RolePermissions>;
  currency:           string;   // e.g. 'SAR'
  ownerDataIsolation: boolean;  // كل مالك يرى بياناته الخاصة فقط
  updatedAt?:         string;
  updatedBy?:         string;
}

export const DEFAULT_MODULES: ModuleFlags = {
  properties:  true,
  units:       true,
  tenants:     true,
  owners:      true,
  contracts:   true,
  payments:    true,
  maintenance: true,
  reports:     true,
  calendar:    true,
  backup:      true,
  auditLog:    true,
  ledger:      true,
};

export const DEFAULT_PERMISSIONS: Record<string, RolePermissions> = {
  admin: {
    canView: true, canAdd: true, canEdit: true, canDelete: true,
    canManageUsers: true, canAccessReports: true, canAccessBackup: true,
  },
  'مدير عام': {
    canView: true, canAdd: true, canEdit: true, canDelete: true,
    canManageUsers: true, canAccessReports: true, canAccessBackup: true,
  },
  manager: {
    canView: true, canAdd: true, canEdit: true, canDelete: false,
    canManageUsers: false, canAccessReports: true, canAccessBackup: false,
  },
  مدير: {
    canView: true, canAdd: true, canEdit: true, canDelete: false,
    canManageUsers: false, canAccessReports: true, canAccessBackup: false,
  },
  viewer: {
    canView: true, canAdd: false, canEdit: false, canDelete: false,
    canManageUsers: false, canAccessReports: false, canAccessBackup: false,
  },
  مشاهد: {
    canView: true, canAdd: false, canEdit: false, canDelete: false,
    canManageUsers: false, canAccessReports: false, canAccessBackup: false,
  },
  owner: {
    canView: true, canAdd: true, canEdit: true, canDelete: false,
    canManageUsers: false, canAccessReports: true, canAccessBackup: false,
  },
  مالك: {
    canView: true, canAdd: true, canEdit: true, canDelete: false,
    canManageUsers: false, canAccessReports: true, canAccessBackup: false,
  },
};

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  modules:            DEFAULT_MODULES,
  permissions:        DEFAULT_PERMISSIONS,
  currency:           'SAR',
  ownerDataIsolation: true,
};

/** Resolve permissions for a role — falls back to defaults for unknown roles */
export function resolvePermissions(
  role: string,
  settings: SystemSettings | null,
): RolePermissions {
  const perms = settings?.permissions ?? DEFAULT_PERMISSIONS;
  return perms[role] ?? DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.viewer;
}

/** Module metadata for display */
export const MODULE_META: Record<keyof ModuleFlags, { icon: string; label: string; description: string }> = {
  properties:  { icon: 'business-outline',      label: 'العقارات',          description: 'إدارة العقارات والأصول' },
  units:       { icon: 'home-outline',           label: 'الوحدات',           description: 'إدارة وحدات العقارات' },
  tenants:     { icon: 'person-outline',         label: 'المستأجرون',        description: 'إدارة بيانات المستأجرين' },
  owners:      { icon: 'people-outline',         label: 'الملاك',            description: 'إدارة ملاك العقارات' },
  contracts:   { icon: 'document-text-outline',  label: 'العقود',            description: 'إدارة عقود الإيجار' },
  payments:    { icon: 'cash-outline',           label: 'الدفعات',           description: 'تتبع وتسجيل الدفعات' },
  maintenance: { icon: 'construct-outline',      label: 'الصيانة',           description: 'طلبات وسجل الصيانة' },
  reports:     { icon: 'bar-chart-outline',      label: 'التقارير المالية',  description: 'التقارير وتحليلات الإيرادات' },
  calendar:    { icon: 'calendar-outline',       label: 'التقويم',           description: 'جدولة المواعيد والأحداث' },
  backup:      { icon: 'cloud-upload-outline',   label: 'النسخ الاحتياطي',  description: 'تصدير واستيراد بيانات النظام' },
  auditLog:    { icon: 'list-outline',           label: 'سجل الإجراءات',    description: 'مراجعة جميع عمليات النظام' },
  ledger:      { icon: 'receipt-outline',        label: 'سجل المدفوعات',    description: 'كشف حساب مفصّل لكل مستأجر' },
};

/** Role metadata for display */
export const ROLE_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  admin:    { label: 'مدير النظام',  icon: 'shield-checkmark-outline', color: '#7B3FA0', bg: '#EAE0F2' },
  'مدير عام': { label: 'مدير عام',  icon: 'shield-checkmark-outline', color: '#7B3FA0', bg: '#EAE0F2' },
  manager:  { label: 'مدير',         icon: 'briefcase-outline',        color: '#2E5580', bg: '#EBF0F6' },
  مدير:     { label: 'مدير',         icon: 'briefcase-outline',        color: '#2E5580', bg: '#EBF0F6' },
  viewer:   { label: 'مشاهد',        icon: 'eye-outline',              color: '#2A9D5C', bg: '#D8F4E6' },
  مشاهد:    { label: 'مشاهد',        icon: 'eye-outline',              color: '#2A9D5C', bg: '#D8F4E6' },
  owner:    { label: 'مالك',          icon: 'home-outline',            color: '#D4880A', bg: '#FDEFD5' },
  مالك:     { label: 'مالك',          icon: 'home-outline',            color: '#D4880A', bg: '#FDEFD5' },
};

export const PERMISSION_ROWS: { key: keyof RolePermissions; label: string; icon: string }[] = [
  { key: 'canView',          label: 'مشاهدة البيانات',      icon: 'eye-outline' },
  { key: 'canAdd',           label: 'إضافة سجلات',          icon: 'add-circle-outline' },
  { key: 'canEdit',          label: 'تعديل السجلات',         icon: 'pencil-outline' },
  { key: 'canDelete',        label: 'حذف السجلات',           icon: 'trash-outline' },
  { key: 'canManageUsers',   label: 'إدارة المستخدمين',      icon: 'people-outline' },
  { key: 'canAccessReports', label: 'الوصول للتقارير',       icon: 'bar-chart-outline' },
  { key: 'canAccessBackup',  label: 'النسخ الاحتياطي',      icon: 'cloud-upload-outline' },
];

export const CANONICAL_ROLES = ['admin', 'manager', 'viewer', 'owner'] as const;
