import React, { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Switch,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { useApp } from '../context/AppProvider';
import {
  MODULE_META, ROLE_META, PERMISSION_ROWS, CANONICAL_ROLES,
  ModuleFlags, RolePermissions, DEFAULT_SYSTEM_SETTINGS, DEFAULT_PERMISSIONS,
} from '../constants/SystemDefaults';
import { useAppTheme } from '../hooks/useAppTheme';

type Tab = 'modules' | 'permissions' | 'general';

const CURRENCY_OPTIONS = [
  { value: 'SAR', label: 'ريال سعودي', symbol: 'ر.س' },
  { value: 'AED', label: 'درهم إماراتي', symbol: 'د.إ' },
  { value: 'USD', label: 'دولار أمريكي', symbol: '$' },
  { value: 'EUR', label: 'يورو', symbol: '€' },
];

export default function SystemSettingsScreen() {
  const { colors } = useAppTheme();
  const { systemSettings, updateSystemSettings, isAdmin } = useApp();
  const [activeTab, setActiveTab] = useState<Tab>('modules');
  const [saving, setSaving] = useState(false);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="إعدادات النظام" />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.noAccess, { color: colors.textMuted }]}>هذه الصفحة للمدير فقط</Text>
        </View>
      </View>
    );
  }

  const showSaved = (key: string) => {
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

  const toggleModule = useCallback(async (key: keyof ModuleFlags, value: boolean) => {
    setSaving(true);
    await updateSystemSettings({
      modules: { ...systemSettings.modules, [key]: value },
    });
    setSaving(false);
    showSaved(`mod_${key}`);
  }, [systemSettings, updateSystemSettings]);

  const togglePermission = useCallback(async (
    role: string, permKey: keyof RolePermissions, value: boolean,
  ) => {
    const current = systemSettings.permissions[role] ?? DEFAULT_PERMISSIONS[role] ?? DEFAULT_PERMISSIONS.viewer;
    const updated = { ...current, [permKey]: value };
    setSaving(true);
    await updateSystemSettings({
      permissions: { ...systemSettings.permissions, [role]: updated },
    });
    setSaving(false);
    showSaved(`perm_${role}_${permKey}`);
  }, [systemSettings, updateSystemSettings]);

  const setCurrency = useCallback(async (currency: string) => {
    setSaving(true);
    await updateSystemSettings({ currency });
    setSaving(false);
    showSaved('currency');
  }, [updateSystemSettings]);

  const resetToDefaults = useCallback(async () => {
    setSaving(true);
    await updateSystemSettings({ modules: DEFAULT_SYSTEM_SETTINGS.modules, permissions: DEFAULT_SYSTEM_SETTINGS.permissions });
    setSaving(false);
    showSaved('reset');
  }, [updateSystemSettings]);

  const modules = systemSettings.modules;
  const permissions = systemSettings.permissions;
  const currency = systemSettings.currency ?? 'SAR';
  const moduleKeys = Object.keys(MODULE_META) as (keyof ModuleFlags)[];
  const enabledCount = moduleKeys.filter(k => modules[k]).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="إعدادات النظام" />

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {([
          { key: 'modules',     label: 'الوحدات',    icon: 'grid-outline' },
          { key: 'permissions', label: 'الصلاحيات',  icon: 'shield-outline' },
          { key: 'general',     label: 'عام',         icon: 'settings-outline' },
        ] as { key: Tab; label: string; icon: string }[]).map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon as any}
              size={16}
              color={activeTab === tab.key ? colors.primary : colors.textMuted}
            />
            <Text style={[styles.tabLabel, { color: activeTab === tab.key ? colors.primary : colors.textMuted }]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── MODULES TAB ── */}
        {activeTab === 'modules' && (
          <>
            {/* Summary bar */}
            <View style={[styles.summaryBar, { backgroundColor: colors.primarySubtle, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                {enabledCount} من {moduleKeys.length} وحدة مفعّلة — تعطيل وحدة يخفيها من القائمة الجانبية
              </Text>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {moduleKeys.map((key, i) => {
                const meta    = MODULE_META[key];
                const enabled = modules[key];
                const isSaved = savedKey === `mod_${key}`;
                return (
                  <View
                    key={key}
                    style={[
                      styles.moduleRow,
                      { borderBottomColor: colors.border },
                      i < moduleKeys.length - 1 && styles.rowBorder,
                    ]}
                  >
                    <View style={[styles.moduleIcon, {
                      backgroundColor: enabled ? `${colors.primary}18` : colors.surface,
                    }]}>
                      <Ionicons
                        name={meta.icon as any}
                        size={20}
                        color={enabled ? colors.primary : colors.textMuted}
                      />
                    </View>
                    <View style={styles.moduleInfo}>
                      <Text style={[styles.moduleLabel, { color: enabled ? colors.text : colors.textMuted }]}>
                        {meta.label}
                      </Text>
                      <Text style={[styles.moduleDesc, { color: colors.textMuted }]} numberOfLines={1}>
                        {meta.description}
                      </Text>
                    </View>
                    {isSaved && (
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginLeft: 8 }} />
                    )}
                    <Switch
                      value={enabled}
                      onValueChange={v => toggleModule(key, v)}
                      trackColor={{ false: colors.border, true: colors.primary }}
                      thumbColor="#FFF"
                    />
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.resetBtn, { borderColor: colors.danger }]}
              onPress={resetToDefaults}
            >
              <Ionicons name="refresh-outline" size={16} color={colors.danger} />
              <Text style={[styles.resetBtnText, { color: colors.danger }]}>إعادة تعيين الإعدادات الافتراضية</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── PERMISSIONS TAB ── */}
        {activeTab === 'permissions' && (
          <>
            <View style={[styles.summaryBar, { backgroundColor: colors.primarySubtle, borderColor: colors.border }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text style={[styles.summaryText, { color: colors.primary }]}>
                تحكم في صلاحيات كل دور — التغييرات تُطبّق فور الحفظ
              </Text>
            </View>

            {CANONICAL_ROLES.map(roleKey => {
              const meta  = ROLE_META[roleKey];
              const perms = permissions[roleKey] ?? DEFAULT_PERMISSIONS[roleKey] ?? DEFAULT_PERMISSIONS.viewer;
              const isAdminRole = roleKey === 'admin';
              return (
                <View key={roleKey} style={[styles.roleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Role header */}
                  <View style={[styles.roleHeader, { backgroundColor: meta?.bg ?? colors.surface }]}>
                    <View style={[styles.roleIconWrap, { backgroundColor: `${meta?.color ?? colors.primary}20` }]}>
                      <Ionicons name={(meta?.icon ?? 'person-outline') as any} size={18} color={meta?.color ?? colors.primary} />
                    </View>
                    <Text style={[styles.roleName, { color: meta?.color ?? colors.text }]}>{meta?.label ?? roleKey}</Text>
                    {isAdminRole && (
                      <View style={[styles.lockBadge, { backgroundColor: `${meta.color}20` }]}>
                        <Ionicons name="lock-closed-outline" size={11} color={meta.color} />
                        <Text style={[styles.lockText, { color: meta.color }]}>محمي</Text>
                      </View>
                    )}
                  </View>

                  {/* Permission rows */}
                  {PERMISSION_ROWS.map((row, i) => {
                    const val    = (perms as any)[row.key] ?? false;
                    const isSaved = savedKey === `perm_${roleKey}_${row.key}`;
                    return (
                      <View
                        key={row.key}
                        style={[
                          styles.permRow,
                          { borderBottomColor: colors.border },
                          i < PERMISSION_ROWS.length - 1 && styles.rowBorder,
                        ]}
                      >
                        <View style={[styles.permIcon, { backgroundColor: val ? `${colors.success}18` : colors.surface }]}>
                          <Ionicons name={row.icon as any} size={15} color={val ? colors.success : colors.textMuted} />
                        </View>
                        <Text style={[styles.permLabel, { color: colors.text }]}>{row.label}</Text>
                        {isSaved && (
                          <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ marginLeft: 6 }} />
                        )}
                        <Switch
                          value={val}
                          onValueChange={v => !isAdminRole && togglePermission(roleKey, row.key, v)}
                          trackColor={{ false: colors.border, true: colors.success }}
                          thumbColor="#FFF"
                          disabled={isAdminRole}
                        />
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </>
        )}

        {/* ── GENERAL TAB ── */}
        {activeTab === 'general' && (
          <>
            {/* ── Owner Data Isolation ── */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted, backgroundColor: colors.surface }]}>
              إعدادات الملاك
            </Text>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.moduleRow}>
                <View style={[styles.moduleIcon, {
                  backgroundColor: systemSettings.ownerDataIsolation
                    ? `${colors.warning}18` : colors.surface,
                }]}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color={systemSettings.ownerDataIsolation ? colors.warning : colors.textMuted}
                  />
                </View>
                <View style={styles.moduleInfo}>
                  <Text style={[styles.moduleLabel, { color: colors.text }]}>عزل بيانات المالك</Text>
                  <Text style={[styles.moduleDesc, { color: colors.textMuted }]}>
                    كل مالك يرى عقاراته ووحداته وعقوده وصيانته فقط
                  </Text>
                </View>
                {savedKey === 'ownerDataIsolation' && (
                  <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginLeft: 8 }} />
                )}
                <Switch
                  value={systemSettings.ownerDataIsolation ?? true}
                  onValueChange={async v => {
                    setSaving(true);
                    await updateSystemSettings({ ownerDataIsolation: v });
                    setSaving(false);
                    showSaved('ownerDataIsolation');
                  }}
                  trackColor={{ false: colors.border, true: colors.warning }}
                  thumbColor="#FFF"
                />
              </View>

              {/* ما يشمله العزل */}
              {(systemSettings.ownerDataIsolation ?? true) && (
                <View style={[styles.isolationInfo, { backgroundColor: `${colors.warning}0D`, borderColor: `${colors.warning}30` }]}>
                  <Text style={[styles.isolationTitle, { color: colors.warning }]}>ما يراه المالك فقط:</Text>
                  {[
                    { icon: 'business-outline',     label: 'العقارات المسجّلة باسمه' },
                    { icon: 'home-outline',          label: 'الوحدات التابعة لعقاراته' },
                    { icon: 'document-text-outline', label: 'العقود المرتبطة بوحداته' },
                    { icon: 'construct-outline',     label: 'طلبات الصيانة الخاصة به' },
                    { icon: 'cash-outline',          label: 'الدفعات المرتبطة بعقوده' },
                  ].map(item => (
                    <View key={item.icon} style={styles.isolationRow}>
                      <Ionicons name={item.icon as any} size={13} color={colors.warning} />
                      <Text style={[styles.isolationText, { color: colors.textSecondary }]}>{item.label}</Text>
                    </View>
                  ))}
                  <View style={[styles.isolationDivider, { backgroundColor: `${colors.warning}30` }]} />
                  <Text style={[styles.isolationHint, { color: colors.textMuted }]}>
                    * يتطلب ربط حساب المالك بسجله عبر "إدارة المستخدمين"
                  </Text>
                </View>
              )}
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textMuted, backgroundColor: colors.surface }]}>
              العملة الافتراضية
            </Text>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {CURRENCY_OPTIONS.map((opt, i) => {
                const selected = currency === opt.value;
                const isSaved  = savedKey === 'currency' && selected;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.currencyRow,
                      { borderBottomColor: colors.border },
                      i < CURRENCY_OPTIONS.length - 1 && styles.rowBorder,
                      selected && { backgroundColor: `${colors.primary}08` },
                    ]}
                    onPress={() => setCurrency(opt.value)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.currencySymbol, {
                      backgroundColor: selected ? `${colors.primary}18` : colors.surface,
                      borderColor: selected ? colors.primary : colors.border,
                    }]}>
                      <Text style={[styles.currencySymbolText, { color: selected ? colors.primary : colors.textMuted }]}>
                        {opt.symbol}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.currencyLabel, { color: selected ? colors.primary : colors.text }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.currencyCode, { color: colors.textMuted }]}>{opt.value}</Text>
                    </View>
                    {selected && (
                      <Ionicons name={isSaved ? 'checkmark-circle' : 'checkmark-circle'} size={20} color={colors.primary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* System info card */}
            <Text style={[styles.sectionTitle, { color: colors.textMuted, backgroundColor: colors.surface }]}>
              معلومات النظام
            </Text>
            <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {[
                { label: 'إصدار التطبيق', value: '1.0.0' },
                { label: 'آخر تحديث للإعدادات', value: systemSettings.updatedAt?.split('T')[0] ?? '—' },
                { label: 'نوع النظام', value: 'إدارة عقارات — DTG' },
              ].map((row, i) => (
                <View
                  key={row.label}
                  style={[
                    styles.infoRow,
                    { borderBottomColor: colors.border },
                    i < 2 && styles.rowBorder,
                  ]}
                >
                  <Text style={[styles.infoValue, { color: colors.textSecondary }]}>{row.value}</Text>
                  <Text style={[styles.infoLabel, { color: colors.text }]}>{row.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  noAccess: { fontSize: Theme.fontSize.lg, textAlign: 'center' },

  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    paddingHorizontal: Theme.spacing.base,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  tabLabel: { fontSize: Theme.fontSize.sm, fontWeight: '600' },

  summaryBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.md, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  summaryText: { flex: 1, fontSize: Theme.fontSize.sm, textAlign: 'right' },

  section: {
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: Theme.fontSize.sm, fontWeight: '600',
    paddingHorizontal: Theme.spacing.base, paddingVertical: 8, textAlign: 'right',
  },
  rowBorder: { borderBottomWidth: 1 },

  // Module row
  moduleRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14, gap: 12,
  },
  moduleIcon: {
    width: 40, height: 40, borderRadius: Theme.radius.md,
    justifyContent: 'center', alignItems: 'center',
  },
  moduleInfo: { flex: 1 },
  moduleLabel: { fontSize: Theme.fontSize.base, fontWeight: '600', textAlign: 'right' },
  moduleDesc:  { fontSize: Theme.fontSize.xs, marginTop: 2, textAlign: 'right' },

  // Role card
  roleCard: {
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  roleHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 12,
  },
  roleIconWrap: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  roleName: { flex: 1, fontSize: Theme.fontSize.base, fontWeight: '700', textAlign: 'right' },
  lockBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99,
  },
  lockText: { fontSize: 10, fontWeight: '700' },

  // Permission row
  permRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 12, gap: 10,
  },
  permIcon: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  permLabel: { flex: 1, fontSize: Theme.fontSize.sm, textAlign: 'right' },

  // Currency
  currencyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14,
  },
  currencySymbol: {
    width: 44, height: 44, borderRadius: 22,
    justifyContent: 'center', alignItems: 'center', borderWidth: 1,
  },
  currencySymbolText: { fontSize: Theme.fontSize.lg, fontWeight: '700' },
  currencyLabel: { fontSize: Theme.fontSize.base, fontWeight: '600', textAlign: 'right' },
  currencyCode:  { fontSize: Theme.fontSize.xs, marginTop: 1, textAlign: 'right' },

  // Info row
  infoRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Theme.spacing.md, paddingVertical: 14,
  },
  infoLabel: { fontSize: Theme.fontSize.sm, fontWeight: '600', textAlign: 'right' },
  infoValue: { fontSize: Theme.fontSize.sm, textAlign: 'left' },

  // Owner isolation
  isolationInfo: {
    marginTop: 12, padding: 12, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  isolationTitle: {
    fontSize: Theme.fontSize.sm, fontWeight: '600' as const, marginBottom: 8, textAlign: 'right' as const,
  },
  isolationRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginBottom: 4 },
  isolationText: { fontSize: Theme.fontSize.xs, flex: 1, textAlign: 'right' as const },
  isolationDivider: { height: 1, marginVertical: 8 },
  isolationHint: { fontSize: Theme.fontSize.xs, textAlign: 'right' as const, fontStyle: 'italic' as const },

  resetBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: Theme.spacing.base, marginTop: Theme.spacing.md,
    paddingVertical: 14, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  resetBtnText: { fontSize: Theme.fontSize.base, fontWeight: '600' },
});
