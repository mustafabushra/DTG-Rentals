import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ResponsiveGrid } from '../components/ui/ResponsiveGrid';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { SearchBar } from '../components/ui/SearchBar';
import { AppHeader } from '../components/ui/AppHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterBar, AUDIT_FILTERS } from '../components/ui/FilterBar';
import { AuditAction } from '../data/mockData';
import { useAppTheme } from '../hooks/useAppTheme';

type Filter = 'all' | AuditAction;

const actionConfig: Record<AuditAction, { label: string; color: string; bg: string; icon: string }> = {
  add:    { label: 'إضافة', color: '#27AE60', bg: '#E8F8F0', icon: 'add-circle-outline' },
  edit:   { label: 'تعديل', color: '#F39C12', bg: '#FEF9E7', icon: 'pencil-outline' },
  delete: { label: 'حذف',   color: '#E74C3C', bg: '#FDEDEC', icon: 'trash-outline' },
};

export default function AuditLogScreen() {
  const { colors } = useAppTheme();
  const { auditLogs } = useApp();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = !search || log.details.includes(search) || log.entityName.includes(search) || log.userName.includes(search);
      const matchFilter = filter === 'all' || log.action === filter;
      return matchSearch && matchFilter;
    });
  }, [auditLogs, search, filter]);

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach(log => {
      const date = (log.timestamp ?? '').split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const formatGroupDate = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (dateStr === today) return 'اليوم';
    if (dateStr === yesterday) return 'الأمس';
    return new Date(dateStr).toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="سجل العمليات" />

      <SearchBar value={search} onChangeText={setSearch} placeholder="ابحث في السجلات..." />

      <FilterBar options={AUDIT_FILTERS} value={filter} onChange={v => setFilter(v as Filter)} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        {grouped.length === 0 ? (
          <EmptyState icon="time-outline" title="لا توجد سجلات" subtitle={search ? 'لا توجد نتائج مطابقة' : 'لا توجد عمليات مسجلة'} />
        ) : grouped.map(([date, logs]) => (
          <View key={date}>
            {/* Date header */}
            <View style={[styles.dateHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.dateText, { color: colors.textSecondary }]}>{formatGroupDate(date)}</Text>
              <View style={[styles.dateLine, { backgroundColor: colors.border }]} />
            </View>

            <ResponsiveGrid>{logs.map(log => {
              const cfg = actionConfig[log.action];
              const isExpanded = expanded === log.id;
              return (
                <TouchableOpacity
                  key={log.id}
                  style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setExpanded(isExpanded ? null : log.id)}
                  activeOpacity={0.85}
                >
                  <View style={styles.logMain}>
                    {/* Action Icon */}
                    <View style={[styles.actionIcon, { backgroundColor: cfg.bg }]}>
                      <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
                    </View>

                    {/* Content */}
                    <View style={styles.logContent}>
                      <View style={styles.logTitleRow}>
                        <View style={[styles.actionBadge, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.actionLabel, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        <Text style={[styles.entityType, { color: colors.text }]}>{log.entityType}</Text>
                        <Text style={[styles.entityName, { color: colors.primary }]} numberOfLines={1}>{log.entityName}</Text>
                      </View>
                      <View style={styles.logMeta}>
                        <Text style={[styles.metaTime, { color: colors.textMuted }]}>
                          {new Date(log.timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        <Text style={[styles.metaUser, { color: colors.textSecondary }]}>{log.userName}</Text>
                      </View>
                    </View>

                    <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                  </View>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <View style={[styles.logDetails, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
                      <Text style={[styles.detailsText, { color: colors.textSecondary }]}>{log.details}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}</ResponsiveGrid>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  dateHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: Theme.spacing.base, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dateLine: { flex: 1, height: 1 },
  dateText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textAlign: 'right' },
  logCard: {
    marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm,
    borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden',
  },
  logMain: { flexDirection: 'row', alignItems: 'center', padding: Theme.spacing.md, gap: 10 },
  actionIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  logContent: { flex: 1, gap: 3 },
  logTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  actionBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Theme.radius.full },
  actionLabel: { fontSize: Theme.fontSize.xs, fontWeight: Theme.fontWeight.bold },
  entityType: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.medium, textAlign: 'right' },
  entityName: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, flex: 1, textAlign: 'right' },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaUser: { fontSize: Theme.fontSize.sm, textAlign: 'right' },
  metaTime: { fontSize: Theme.fontSize.xs },
  logDetails: { padding: Theme.spacing.md, borderTopWidth: 1 },
  detailsText: { fontSize: Theme.fontSize.md, lineHeight: 22, textAlign: 'right' },
});
