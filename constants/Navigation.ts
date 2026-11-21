/**
 * هيكل التنقل — مصدر واحد للقائمة الجانبية وتبويبات الأقسام.
 *
 * الموظفون: 8 أقسام بدل ~25 صفحة؛ الصفحات المتشابهة صارت تبويبات داخل قسم واحد،
 * والأدوات النادرة (المدن، التقويم، المساعد، السجلات...) انتقلت إلى الإعدادات.
 * الملاك: 4 أقسام بلغة بسيطة.
 */
import type { ModuleFlags } from './SystemDefaults';

export type NavItem = {
  icon: string;
  label: string;
  route: string;
  /** مسارات تُعتبر داخل هذا القسم (لإبراز العنصر النشط) */
  matches: string[];
  moduleKey?: keyof ModuleFlags | null;
  badge?: 'overdue' | 'alerts';
};

export const STAFF_NAV: NavItem[] = [
  { icon: 'grid-outline', label: 'الرئيسية', route: '/(tabs)/', matches: [] },
  { icon: 'business-outline', label: 'العقارات', route: '/(tabs)/properties', matches: ['/properties', '/units', '/property/', '/unit/', '/add-property', '/add-unit', '/edit-property', '/edit-unit', '/edit-deed'], moduleKey: 'properties' },
  { icon: 'people-outline', label: 'الملاك', route: '/(tabs)/owners', matches: ['/owners', '/owner/', '/add-owner', '/edit-owner', '/owner-timeline'], moduleKey: 'owners' },
  { icon: 'document-text-outline', label: 'العقود والمستأجرون', route: '/(tabs)/contracts', matches: ['/contracts', '/contract/', '/tenants', '/tenant/', '/renewals', '/add-contract', '/edit-contract', '/add-tenant', '/edit-tenant', '/scan-contract', '/transfer-tenant'], moduleKey: 'contracts' },
  { icon: 'cash-outline', label: 'التحصيل', route: '/collections', matches: ['/collections', '/payments', '/payment/', '/ledger', '/record-payment', '/payment-log', '/cheques'], moduleKey: 'payments', badge: 'overdue' },
  { icon: 'wallet-outline', label: 'المصاريف', route: '/expenses', matches: ['/expenses', '/expense/', '/office-expenses', '/vouchers', '/voucher/', '/add-expense'], moduleKey: 'finance' },
  { icon: 'construct-outline', label: 'الصيانة', route: '/maintenance', matches: ['/maintenance', '/add-maintenance'], moduleKey: 'maintenance' },
  { icon: 'bar-chart-outline', label: 'التقارير', route: '/financial-reports', matches: ['/financial-reports', '/reports'], moduleKey: 'reports' },
];

export const OWNER_NAV: NavItem[] = [
  { icon: 'grid-outline', label: 'الرئيسية', route: '/(tabs)/', matches: [] },
  { icon: 'business-outline', label: 'عقاراتي', route: '/(tabs)/properties', matches: ['/properties', '/units', '/property/', '/unit/'] },
  { icon: 'stats-chart-outline', label: 'الدخل والمصاريف', route: '/owner-statement', matches: ['/owner-statement'] },
  { icon: 'git-commit-outline', label: 'الخط الزمني', route: '/owner-timeline', matches: ['/owner-timeline'] },
  { icon: 'folder-open-outline', label: 'المستندات', route: '/attachments', matches: ['/attachments'] },
];

/** عناصر صغيرة أسفل القائمة للجميع */
export const FOOTER_NAV: NavItem[] = [
  { icon: 'notifications-outline', label: 'الإشعارات', route: '/notifications', matches: ['/notifications'], badge: 'alerts' },
  { icon: 'settings-outline', label: 'الإعدادات والأدوات', route: '/settings', matches: ['/settings', '/cities', '/calendar', '/assistant', '/audit-log', '/updates', '/backup', '/user-management', '/system-settings', '/action-log'] },
];

/** تبويبات داخل القسم الواحد */
export type HubKey = 'properties' | 'contracts' | 'collections' | 'expenses';
export const HUBS: Record<HubKey, { label: string; route: string; match: string; hint: string }[]> = {
  properties: [
    { label: 'العقارات', route: '/(tabs)/properties', match: '/properties', hint: 'عقاراتك. اضغط على أي عقار تشوف وحداته وعقوده ومصاريفه.' },
    { label: 'الوحدات', route: '/units', match: '/units', hint: 'كل الوحدات وحالتها: مؤجرة، شاغرة، أو تحت الصيانة.' },
  ],
  contracts: [
    { label: 'العقود', route: '/(tabs)/contracts', match: '/contracts', hint: 'عقود الإيجار وتواريخها وقيمتها. اضغط على العقد تشوف أقساطه.' },
    { label: 'المستأجرون', route: '/tenants', match: '/tenants', hint: 'المستأجرون وأرقامهم وعقودهم، ومين عليه متأخرات.' },
    { label: 'التجديد', route: '/renewals', match: '/renewals', hint: 'العقود اللي انتهت أو قربت تنتهي. جدّدها أو ذكّر المستأجر بالواتساب.' },
  ],
  collections: [
    { label: 'المتابعة', route: '/collections', match: '/collections', hint: 'الإيجارات المتأخرة والقريبة. ذكّر المستأجر بضغطة، أو سجّل الدفعة إذا وصلت.' },
    { label: 'كل الدفعات', route: '/payments', match: '/payments', hint: 'كل دفعات الإيجار: المدفوعة والمتأخرة والقادمة.' },
    { label: 'الشيكات', route: '/cheques', match: '/cheques', hint: 'كل شيك وين وصل: في الخزنة، في البنك، انصرف، أو ارتد. اضغط على البطاقات فوق للتصفية.' },
    { label: 'حسب العقد', route: '/ledger', match: '/ledger', hint: 'دفعات كل عقد مجمّعة: كم انحصّل منه وكم باقي.' },
  ],
  expenses: [
    { label: 'مصاريف العقارات', route: '/expenses', match: '/expenses', hint: 'اللي انصرف على العقارات: صيانة، كهرباء، حراسة، نظافة.' },
    { label: 'مصاريف المكتب', route: '/office-expenses', match: '/office-expenses', hint: 'مصاريف تشغيل المكتب نفسه، منفصلة عن العقارات.' },
    { label: 'السندات', route: '/vouchers', match: '/vouchers', hint: 'سندات القبض والصرف. اضغط على أي سند لطباعته.' },
  ],
};

export function isNavActive(item: NavItem, pathname: string): boolean {
  if (item.route === '/(tabs)/') return pathname === '/' || pathname === '/(tabs)' || pathname === '/(tabs)/';
  return item.matches.some(m => pathname === m || pathname.startsWith(m.endsWith('/') ? m : m + '/') || pathname === m.replace(/\/$/, ''))
    || pathname.startsWith(item.route.replace('/(tabs)', ''));
}
