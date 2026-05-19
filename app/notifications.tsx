import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../constants/DesignTokens';
import { useAppTheme } from '../hooks/useAppTheme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Urgency = 'critical' | 'warning' | 'info' | 'success';

interface SmartNotif {
  id:       string;
  type:     string;
  urgency:  Urgency;
  title:    string;
  body:     string;
  date:     string;
  route?:   string;
  isRead:   boolean;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const URGENCY_CFG: Record<Urgency, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#E74C3C', bg: '#FDEDEC', icon: 'alert-circle-outline',       label: 'عاجل'    },
  warning:  { color: '#F39C12', bg: '#FEF9E7', icon: 'warning-outline',             label: 'تنبيه'   },
  info:     { color: '#2E86C1', bg: '#EBF5FB', icon: 'information-circle-outline',  label: 'تذكير'   },
  success:  { color: '#27AE60', bg: '#E8F8F0', icon: 'checkmark-circle-outline',    label: 'مكتمل'   },
};

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}
function formatArabicDate(iso: string) {
  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTHS[Number(m)-1]} ${y}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { colors } = useAppTheme();

  const { contracts, payments: installments, maintenance, attachments, notificationPrefs } = useApp();
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  // ── Build smart notifications from ALL live data ───────────────────────────
  const notifications = useMemo((): SmartNotif[] => {
    const list: SmartNotif[] = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Overdue payments
    if (notificationPrefs.payments) installments
      .filter(p => p.status === 'overdue')
      .forEach(p => {
        const days = Math.abs(daysFromNow(p.dueDate));
        list.push({
          id:      `overdue_${p.id}`,
          type:    'payment',
          urgency: 'critical',
          title:   'دفعة متأخرة',
          body:    `مبلغ ${p.amount.toLocaleString('en-US')} ﷼ — متأخرة ${days} يوم`,
          date:    p.dueDate,
          route:   `/payment/${p.id}`,
          isRead:  false,
        });
      });

    // 2. Payments due soon (≤ 7 days)
    if (notificationPrefs.payments) installments
      .filter(p => p.status === 'pending')
      .forEach(p => {
        const d = daysFromNow(p.dueDate);
        if (d < 0 || d > 7) return;
        list.push({
          id:      `due_soon_${p.id}`,
          type:    'payment',
          urgency: d <= 2 ? 'warning' : 'info',
          title:   d === 0 ? 'دفعة مستحقة اليوم' : `دفعة مستحقة خلال ${d} أيام`,
          body:    `مبلغ ${p.amount.toLocaleString('en-US')} ﷼`,
          date:    p.dueDate,
          route:   `/payment/${p.id}`,
          isRead:  false,
        });
      });

    // 3. Expiring contracts (≤ 90 days)
    if (notificationPrefs.contracts) contracts
      .filter(c => c.status === 'active')
      .forEach(c => {
        const d = daysFromNow(c.endDate);
        if (d < 0 || d > 90) return;
        list.push({
          id:      `expiring_${c.id}`,
          type:    'contract',
          urgency: d <= 7 ? 'critical' : d <= 30 ? 'warning' : 'info',
          title:   d <= 7 ? 'عقد ينتهي قريباً جداً' : 'عقد قارب على الانتهاء',
          body:    `${c.contractNumber ?? c.id} — ينتهي ${formatArabicDate(c.endDate)} (خلال ${d} يوم)`,
          date:    c.endDate,
          route:   `/contract/${c.id}`,
          isRead:  false,
        });
      });

    // 4. Expired contracts
    if (notificationPrefs.contracts) contracts
      .filter(c => c.status === 'active' && daysFromNow(c.endDate) < 0)
      .forEach(c => {
        list.push({
          id:      `expired_${c.id}`,
          type:    'contract',
          urgency: 'critical',
          title:   'عقد منتهي الصلاحية',
          body:    `${c.contractNumber ?? c.id} — انتهى ${formatArabicDate(c.endDate)}`,
          date:    c.endDate,
          route:   `/contract/${c.id}`,
          isRead:  false,
        });
      });

    // 5. File / attachment expiry (≤ 60 days or expired)
    if (notificationPrefs.documents) attachments
      .filter(a => a.expiryDate)
      .forEach(a => {
        const d = daysFromNow(a.expiryDate!);
        if (d > 60) return;
        const expired = d < 0;
        list.push({
          id:      `file_${a.id}`,
          type:    'file',
          urgency: expired ? 'critical' : d <= 7 ? 'warning' : 'info',
          title:   expired ? 'ملف منتهي الصلاحية' : `ملف ينتهي خلال ${d} يوم`,
          body:    `"${a.name}" — ${expired ? `انتهى ${formatArabicDate(a.expiryDate!)}` : `ينتهي ${formatArabicDate(a.expiryDate!)}`}`,
          date:    a.expiryDate!,
          isRead:  false,
        });
      });

    // 6. Open maintenance requests
    if (notificationPrefs.maintenance) maintenance
      .filter(m => m.status === 'new')
      .forEach(m => {
        list.push({
          id:      `maint_${m.id}`,
          type:    'maintenance',
          urgency: (m.priority === 'urgent' || m.priority === 'high') ? 'warning' : 'info',
          title:   'طلب صيانة جديد',
          body:    `${m.title} — أولوية: ${m.priority === 'urgent' ? 'عاجل' : m.priority === 'high' ? 'عالية' : 'عادية'}`,
          date:    (m.openedAt ?? (m as any).createdAt ?? new Date().toISOString()).split('T')[0],
          route:   `/maintenance/${m.id}`,
          isRead:  false,
        });
      });

    // Sort: critical first, then by date desc
    const urgencyOrder: Record<Urgency, number> = { critical: 0, warning: 1, info: 2, success: 3 };
    return list.sort((a, b) => {
      const uDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (uDiff !== 0) return uDiff;
      return b.date.localeCompare(a.date);
    });
  }, [contracts, installments, maintenance, attachments, notificationPrefs]);

  const unreadCount  = notifications.filter(n => !readIds.has(n.id)).length;
  const markAllRead  = () => setReadIds(new Set(notifications.map(n => n.id)));
  const markRead     = (id: string) => setReadIds(p => new Set([...p, id]));

  // ── Group by urgency ───────────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const g: Record<Urgency, SmartNotif[]> = { critical: [], warning: [], info: [], success: [] };
    notifications.forEach(n => g[n.urgency].push(n));
    return g;
  }, [notifications]);

  const groupLabels: { key: Urgency; title: string }[] = [
    { key: 'critical', title: 'عاجل — يحتاج إجراء فوري' },
    { key: 'warning',  title: 'تنبيه — قريب من الانتهاء' },
    { key: 'info',     title: 'تذكير — مواعيد قادمة' },
  ];

  const renderGroup = (key: Urgency, title: string) => {
    const items = grouped[key];
    if (items.length === 0) return null;
    const cfg = URGENCY_CFG[key];
    return (
      <View key={key} style={styles.group}>
        {/* Group header */}
        <View style={[styles.groupHeader, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}>
          <Text style={[styles.groupCount, { color: cfg.color }]}>{items.length}</Text>
          <View style={styles.groupHeaderContent}>
            <Text style={[styles.groupTitle, { color: cfg.color }]}>{title}</Text>
          </View>
          <Ionicons name={cfg.icon as any} size={18} color={cfg.color} />
        </View>

        {/* Notifications */}
        <ResponsiveGrid>{items.map(n => {
          const isRead = readIds.has(n.id);
          return (
            <TouchableOpacity
              key={n.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: isRead ? colors.card : colors.background,
                  borderColor:     isRead ? colors.border : cfg.color + '30',
                  borderLeftColor: cfg.color,
                },
              ]}
              onPress={() => { markRead(n.id); if (n.route) router.push(n.route as any); }}
              activeOpacity={0.82}
            >
              {/* Icon */}
              <View style={[styles.notifIcon, { backgroundColor: isRead ? colors.surface : cfg.bg }]}>
                <Ionicons name={cfg.icon as any} size={22} color={isRead ? colors.textMuted : cfg.color} />
              </View>

              {/* Content */}
              <View style={styles.notifContent}>
                <Text style={[
                  styles.notifTitle,
                  { color: colors.text, fontWeight: isRead ? '400' : fontWeight.bold as any },
                ]}>
                  {n.title}
                </Text>
                <Text style={[styles.notifBody, { color: colors.textSecondary }]} numberOfLines={2}>
                  {n.body}
                </Text>
                <View style={styles.notifMeta}>
                  <Text style={[styles.notifDate, { color: colors.textMuted }]}>
                    {formatArabicDate(n.date)}
                  </Text>
                  <View style={[styles.urgencyBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.urgencyBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </View>

              {/* Unread dot */}
              {!isRead && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}

              {/* Arrow if navigable */}
              {n.route && <Ionicons name="chevron-back" size={14} color={colors.textMuted} style={{ flexShrink: 0 }} />}
            </TouchableOpacity>
          );
        })}</ResponsiveGrid>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        title={`الإشعارات${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
        rightText={unreadCount > 0 ? { label: 'قراءة الكل', onPress: markAllRead } : undefined}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {notifications.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
              <Ionicons name="notifications-off-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد إشعارات</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              ستظهر هنا تنبيهات الدفعات والعقود والمرفقات
            </Text>
          </View>
        ) : (
          <View style={styles.groups}>
            {/* Summary bar */}
            <View style={[styles.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {groupLabels.map(({ key }) => {
                const count = grouped[key].length;
                if (count === 0) return null;
                const cfg = URGENCY_CFG[key];
                return (
                  <View key={key} style={[styles.summaryStat, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
                    <Text style={[styles.summaryLabel, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                );
              })}
            </View>

            {groupLabels.map(({ key, title }) => renderGroup(key, title))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  groups:    { padding: spacing[4], gap: spacing[3] },

  summaryBar: {
    flexDirection: 'row', gap: spacing[2],
    borderRadius: radius.xl, borderWidth: 1, padding: spacing[3],
  },
  summaryStat:  { flex: 1, alignItems: 'center', paddingVertical: spacing[2], borderRadius: radius.lg, gap: 2 },
  summaryCount: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  summaryLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  group:       { gap: spacing[2] },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.lg, borderWidth: 1,
  },
  groupHeaderContent: { flex: 1 },
  groupTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: 'right' },
  groupCount: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, minWidth: 28, textAlign: 'center' },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing[3], borderRadius: radius.xl,
    borderWidth: 1, borderLeftWidth: 4,
    gap: spacing[2],
  },
  notifIcon:    { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  notifContent: { flex: 1, gap: 3 },
  notifTitle:   { fontSize: fontSize.sm, textAlign: 'right' },
  notifBody:    { fontSize: fontSize.xs, lineHeight: 18, textAlign: 'right' },
  notifMeta:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  notifDate:    { fontSize: fontSize.xs, textAlign: 'right' },
  urgencyBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  urgencyBadgeText: { fontSize: 10, fontWeight: fontWeight.bold },
  unreadDot:    { width: 8, height: 8, borderRadius: 4, marginTop: 4, flexShrink: 0 },

  empty:      { alignItems: 'center', paddingVertical: 80, gap: spacing[3] },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptyHint:  { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing[8] },
});
