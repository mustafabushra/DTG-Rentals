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

import { useSmartNotifications, SmartNotif, Urgency, formatArabicDate } from '../hooks/useSmartNotifications';

// ─── Config ───────────────────────────────────────────────────────────────────

const URGENCY_CFG: Record<Urgency, { color: string; bg: string; icon: string; label: string }> = {
  critical: { color: '#D92D20', bg: '#FEF3F2', icon: 'alert-circle-outline',       label: 'عاجل'    },
  warning:  { color: '#DC6803', bg: '#FFFAEB', icon: 'warning-outline',             label: 'تنبيه'   },
  info:     { color: '#1570EF', bg: '#EFF8FF', icon: 'information-circle-outline',  label: 'تذكير'   },
  success:  { color: '#079455', bg: '#ECFDF3', icon: 'checkmark-circle-outline',    label: 'مكتمل'   },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationsScreen() {
  const { colors } = useAppTheme();

  // ── التنبيهات من البيانات الحية، وحالة "مقروء" محفوظة في الحساب ───────────
  const { notifications, unreadCount, isRead, markRead: markIds } = useSmartNotifications();
  const markAllRead  = () => markIds(notifications.map(n => n.id));
  const markRead     = (id: string) => markIds([id]);

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
        <View style={styles.groupHeader}>
          <View style={[styles.groupDot, { backgroundColor: cfg.color }]} />
          <Text style={[styles.groupTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.groupCount, { color: colors.textMuted }]}>{items.length}</Text>
        </View>

        {/* Notifications */}
        <ResponsiveGrid>{items.map(n => {
          const read = isRead(n.id);
          return (
            <TouchableOpacity
              key={n.id}
              style={[
                styles.notifCard,
                {
                  backgroundColor: colors.card,
                  borderColor:     colors.border,
                },
              ]}
              onPress={() => { markRead(n.id); if (n.route) router.push(n.route as any); }}
              activeOpacity={0.82}
            >
              {/* Icon */}
              <View style={[styles.notifIcon, { backgroundColor: read ? colors.surface : cfg.bg }]}>
                <Ionicons name={cfg.icon as any} size={22} color={read ? colors.textMuted : cfg.color} />
              </View>

              {/* Content */}
              <View style={styles.notifContent}>
                <Text style={[
                  styles.notifTitle,
                  { color: colors.text, fontWeight: read ? '400' : fontWeight.bold as any },
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
                </View>
              </View>

              {/* Unread dot */}
              {!read && <View style={[styles.unreadDot, { backgroundColor: cfg.color }]} />}

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
        showBack={false}
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
                  <View key={key} style={[styles.summaryStat, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.summaryCount, { color: cfg.color }]}>{count}</Text>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>{cfg.label}</Text>
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
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: 4, paddingTop: spacing[2] },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupHeaderContent: { flex: 1 },
  groupTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, textAlign: 'right' },
  groupCount: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },

  notifCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing[3], borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing[2],
  },
  notifIcon:    { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
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
