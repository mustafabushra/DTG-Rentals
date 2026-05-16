import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal as RNModal, TextInput, useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { ConfirmModal, AlertModal } from '../components/ui/Modal';
import { useDelete } from '../hooks/useDelete';
import type { CalendarEvent, CalendarEventType } from '../data/mockData';
import { lightColors, darkColors, spacing, fontSize, fontWeight, radius } from '../constants/DesignTokens';
import { useAppTheme } from '../hooks/useAppTheme';

const ARABIC_MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                       'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const ARABIC_DAYS_SHORT = ['أح','إث','ثل','أر','خم','جم','سب'];
const ARABIC_DAYS_FULL  = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];

type ViewMode = 'weekly' | 'monthly' | 'yearly';

const EVENT_CFG: Record<CalendarEventType, { color: string; icon: string; label: string; bg: string }> = {
  payment:         { color: '#2E86C1', icon: 'cash-outline',             label: 'دفعة',          bg: '#EBF5FB' },
  contract_expiry: { color: '#E74C3C', icon: 'document-text-outline',    label: 'انتهاء عقد',    bg: '#FDEDEC' },
  file_expiry:     { color: '#8E44AD', icon: 'document-attach-outline',  label: 'انتهاء مرفق',   bg: '#F5EEF8' },
  maintenance:     { color: '#F39C12', icon: 'construct-outline',        label: 'صيانة',         bg: '#FEF9E7' },
  manual:          { color: '#27AE60', icon: 'calendar-outline',         label: 'حدث يدوي',      bg: '#E8F8F0' },
};

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatArabicDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${ARABIC_MONTHS[Number(m) - 1]} ${y}`;
}

function daysFromNow(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function getWeekStart(iso: string): string {
  const d = new Date(iso);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  return d.toISOString().split('T')[0];
}

function urgencyColor(days: number, fallback: string): string {
  if (days < 0)  return '#E74C3C';
  if (days <= 3) return '#E74C3C';
  if (days <= 7) return '#F39C12';
  if (days <= 14) return '#8E44AD';
  if (days <= 30) return '#2E86C1';
  return fallback;
}

function urgencyLabel(days: number): string {
  if (days < 0)  return `متأخر ${Math.abs(days)} يوم`;
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  return `خلال ${days} يوم`;
}

export default function CalendarScreen() {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const { calendarEvents, contracts, payments: installments, maintenance, attachments, addCalendarEvent } = useApp();

  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const [viewMode,  setViewMode]  = useState<ViewMode>('monthly');
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState(getWeekStart(todayIso));
  const [selected,  setSelected]  = useState<string | null>(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const { pending, blocked, clearBlocked, requestDelete, cancelDelete, confirmDelete } = useDelete();
  const [addDate,   setAddDate]   = useState(todayIso);
  const [addTitle,  setAddTitle]  = useState('');
  const [addType,   setAddType]   = useState<CalendarEventType>('payment');

  // ── Build comprehensive event list ────────────────────────────────────────
  const allEvents = useMemo((): CalendarEvent[] => {
    const events: CalendarEvent[] = [];
    events.push(...calendarEvents);

    contracts.filter(c => c.status === 'active').forEach(c => {
      if (!events.find(e => e.id === `dyn_ce_${c.id}`)) {
        events.push({
          id: `dyn_ce_${c.id}`, title: `انتهاء عقد: ${c.contractNumber ?? c.id}`,
          date: c.endDate, type: 'contract_expiry', entityId: c.id, entityType: 'contract',
          notes: `قيمة العقد السنوية: ${c.annualValue?.toLocaleString('en-US') ?? '—'} ر.س`,
        });
      }
    });

    installments.filter(p => p.status === 'pending' || p.status === 'overdue').forEach(p => {
      if (!events.find(e => e.id === `dyn_pe_${p.id}`)) {
        events.push({
          id: `dyn_pe_${p.id}`, title: `دفعة مستحقة: ${p.amount.toLocaleString('en-US')} ر.س`,
          date: p.dueDate, type: 'payment', entityId: p.id, entityType: 'payment',
          notes: p.status === 'overdue' ? '⚠ متأخرة' : `قسط رقم ${p.installmentNumber}`,
        });
      }
    });

    maintenance.filter(m => m.openedAt && m.status !== 'completed' && m.status !== 'cancelled').forEach(m => {
      if (!events.find(e => e.id === `dyn_me_${m.id}`)) {
        events.push({
          id: `dyn_me_${m.id}`, title: `صيانة: ${m.title}`,
          date: m.openedAt.split('T')[0], type: 'maintenance', entityId: m.id, entityType: 'maintenance',
          notes: m.description,
        });
      }
    });

    attachments.filter(a => a.expiryDate).forEach(a => {
      if (!events.find(e => e.id === `dyn_fe_${a.id}` || e.entityId === a.id)) {
        events.push({
          id: `dyn_fe_${a.id}`, title: `انتهاء صلاحية: ${a.name}`,
          date: a.expiryDate!, type: 'file_expiry', entityId: a.id, entityType: 'attachment',
          notes: `نوع: ${a.category}`,
        });
      }
    });

    const seen = new Set<string>();
    return events.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });
  }, [calendarEvents, contracts, installments, maintenance, attachments]);

  // ── Events indexed by date ────────────────────────────────────────────────
  const allEventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    allEvents.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [allEvents]);

  // ── Upcoming alerts (next 30 days) ────────────────────────────────────────
  const upcomingAlerts = useMemo(() =>
    allEvents.filter(e => { const d = daysFromNow(e.date); return d >= 0 && d <= 30; })
      .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8),
    [allEvents]);

  // ── Navigation helpers ─────────────────────────────────────────────────────
  const prevPeriod = () => {
    if (viewMode === 'monthly') {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
      else setViewMonth(m => m - 1);
    } else if (viewMode === 'weekly') {
      setWeekStart(ws => addDays(ws, -7));
    } else {
      setViewYear(y => y - 1);
    }
  };
  const nextPeriod = () => {
    if (viewMode === 'monthly') {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
      else setViewMonth(m => m + 1);
    } else if (viewMode === 'weekly') {
      setWeekStart(ws => addDays(ws, 7));
    } else {
      setViewYear(y => y + 1);
    }
  };

  const periodTitle = () => {
    if (viewMode === 'monthly') return `${ARABIC_MONTHS[viewMonth]} ${viewYear}`;
    if (viewMode === 'yearly')  return `${viewYear}`;
    const ws = new Date(weekStart);
    const we = new Date(weekStart);
    we.setDate(we.getDate() + 6);
    return `${ws.getDate()} - ${we.getDate()} ${ARABIC_MONTHS[we.getMonth()]} ${we.getFullYear()}`;
  };

  // ── Monthly grid data ──────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const monthPrefix = `${viewYear}-${pad(viewMonth + 1)}`;
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstWeekDay = new Date(viewYear, viewMonth, 1).getDay();
    const flatDays: (number | null)[] = [];
    for (let i = 0; i < firstWeekDay; i++) flatDays.push(null);
    for (let d = 1; d <= daysInMonth; d++) flatDays.push(d);
    while (flatDays.length % 7 !== 0) flatDays.push(null);
    const weeks: (number | null)[][] = [];
    for (let i = 0; i < flatDays.length; i += 7) weeks.push(flatDays.slice(i, i + 7));

    const eventsMap: Record<string, CalendarEvent[]> = {};
    allEvents.filter(e => e.date.startsWith(monthPrefix)).forEach(e => {
      if (!eventsMap[e.date]) eventsMap[e.date] = [];
      eventsMap[e.date].push(e);
    });
    return { weeks, eventsMap, monthPrefix };
  }, [allEvents, viewYear, viewMonth]);

  // ── Shown events for selected day or full period ───────────────────────────
  const shownEvents = useMemo(() => {
    if (selected) return allEventsMap[selected] ?? [];
    if (viewMode === 'monthly') {
      const monthPrefix = `${viewYear}-${pad(viewMonth + 1)}`;
      return allEvents.filter(e => e.date.startsWith(monthPrefix)).sort((a, b) => a.date.localeCompare(b.date));
    }
    if (viewMode === 'weekly') {
      const weekEnd = addDays(weekStart, 6);
      return allEvents.filter(e => e.date >= weekStart && e.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date));
    }
    return allEvents.filter(e => e.date.startsWith(`${viewYear}-`)).sort((a, b) => a.date.localeCompare(b.date));
  }, [selected, viewMode, allEvents, allEventsMap, viewYear, viewMonth, weekStart]);

  // ── Navigate to entity ────────────────────────────────────────────────────
  const navigateTo = (ev: CalendarEvent) => {
    if (ev.entityType === 'contract')    router.push(`/contract/${ev.entityId}` as any);
    else if (ev.entityType === 'payment') router.push(`/payment/${ev.entityId}` as any);
    else if (ev.entityType === 'maintenance') router.push(`/maintenance/${ev.entityId}` as any);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderEventCard = (ev: CalendarEvent, showFullDate = false) => {
    const cfg  = EVENT_CFG[ev.type];
    const days = daysFromNow(ev.date);
    const uc   = urgencyColor(days, colors.textMuted);
    const ul   = urgencyLabel(days);

    return (
      <TouchableOpacity
        key={ev.id}
        onPress={() => navigateTo(ev)}
        activeOpacity={0.82}
        style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: cfg.color }]}
      >
        <View style={[styles.eventIconBox, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
        </View>
        <View style={styles.eventBody}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
          {ev.notes ? <Text style={[styles.eventNotes, { color: colors.textSecondary }]} numberOfLines={1}>{ev.notes}</Text> : null}
          <View style={styles.eventMetaRow}>
            <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
              <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
            </View>
            <Text style={[styles.eventDateText, { color: colors.textMuted }]}>
              {showFullDate ? formatArabicDate(ev.date) : ev.date.split('-').reverse().join('/')}
            </Text>
          </View>
        </View>
        <View style={styles.eventRight}>
          <Text style={[styles.urgencyText, { color: uc }]}>{ul}</Text>
          {!ev.id.startsWith('dyn_') ? (
            <TouchableOpacity onPress={e => { (e as any).stopPropagation?.(); requestDelete({ id: ev.id, entityType: 'calendarEvent', label: ev.title }); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={14} color="#E74C3C" />
            </TouchableOpacity>
          ) : ev.entityType !== 'attachment' ? (
            <Ionicons name="chevron-back" size={14} color={colors.textMuted} />
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const renderTimelineDayRow = (iso: string) => {
    const dayEvents = allEventsMap[iso] ?? [];
    const d = new Date(iso);
    const isToday = iso === todayIso;
    const dayOfWeek = d.getDay();
    const dayNum = d.getDate();

    return (
      <View key={iso} style={styles.tlDayRow}>
        {/* Left: day label */}
        <View style={[styles.tlDayLabel, isToday && { backgroundColor: colors.primary, borderRadius: 10 }]}>
          <Text style={[styles.tlDayNum, { color: isToday ? '#FFF' : colors.text }]}>{dayNum}</Text>
          <Text style={[styles.tlDayName, { color: isToday ? '#FFF' : colors.textMuted }]}>{ARABIC_DAYS_SHORT[dayOfWeek]}</Text>
        </View>

        {/* Connector line */}
        <View style={[styles.tlLine, { backgroundColor: colors.border }]} />

        {/* Right: events */}
        <View style={styles.tlEvents}>
          {dayEvents.length === 0 ? (
            <View style={[styles.tlEmptyDay, { borderColor: colors.border }]}>
              <Text style={[styles.tlEmptyText, { color: colors.textMuted }]}>لا أحداث</Text>
            </View>
          ) : dayEvents.map(ev => {
            const cfg  = EVENT_CFG[ev.type];
            const days = daysFromNow(ev.date);
            const uc   = urgencyColor(days, cfg.color);
            return (
              <TouchableOpacity
                key={ev.id}
                onPress={() => navigateTo(ev)}
                activeOpacity={0.82}
                style={[styles.tlEventChip, { backgroundColor: cfg.bg, borderColor: cfg.color + '60', borderLeftColor: uc }]}
              >
                <Ionicons name={cfg.icon as any} size={13} color={cfg.color} />
                <Text style={[styles.tlEventText, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
                <View style={[styles.tlUrgencyDot, { backgroundColor: uc }]}>
                  <Text style={styles.tlUrgencyDotText}>{days === 0 ? '!' : days < 0 ? `${Math.abs(days)}` : `${days}ي`}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ── Weekly view ────────────────────────────────────────────────────────────
  const renderWeekly = () => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const weekEventCount = days.reduce((n, iso) => n + (allEventsMap[iso]?.length ?? 0), 0);
    return (
      <View style={[styles.viewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.viewCardSubtitle, { color: colors.textMuted }]}>
          {weekEventCount} حدث هذا الأسبوع
        </Text>
        {days.map(iso => renderTimelineDayRow(iso))}
      </View>
    );
  };

  // ── Monthly grid view ──────────────────────────────────────────────────────
  const renderMonthly = () => {
    const { weeks, eventsMap } = monthlyData;
    return (
      <View style={[styles.viewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.dayLabelsRow}>
          {ARABIC_DAYS_SHORT.map(d => (
            <Text key={d} style={[styles.dayLabel, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>
        <View style={styles.daysGrid}>
          {weeks.map((week, wi) => (
            <View key={wi} style={styles.weekRow}>
              {week.map((day, di) => {
                if (!day) return <View key={`e${di}`} style={styles.dayCell} />;
                const iso       = `${viewYear}-${pad(viewMonth + 1)}-${pad(day)}`;
                const dayEvents = eventsMap[iso] ?? [];
                const isToday   = iso === todayIso;
                const isSel     = iso === selected;
                const typesSeen = new Set(dayEvents.map(e => e.type));
                const hasUrgent = dayEvents.some(e => daysFromNow(e.date) <= 7);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
                      isToday && { backgroundColor: colors.primary, borderRadius: 99 },
                      isSel && !isToday && { backgroundColor: colors.primarySubtle, borderRadius: 99, borderWidth: 2, borderColor: colors.primary },
                      hasUrgent && !isToday && !isSel && { borderRadius: 99, borderWidth: 1, borderColor: '#F39C12' },
                    ]}
                    onPress={() => setSelected(iso === selected ? null : iso)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.dayNum, { color: isToday ? '#FFF' : colors.text }]}>{day}</Text>
                    {dayEvents.length > 0 && (
                      <View style={styles.dotsRow}>
                        {[...typesSeen].slice(0, 3).map(type => (
                          <View key={type} style={[styles.dot, { backgroundColor: EVENT_CFG[type].color }]} />
                        ))}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
        {/* Legend */}
        <View style={[styles.legend, { borderTopColor: colors.border }]}>
          {(Object.entries(EVENT_CFG) as [CalendarEventType, typeof EVENT_CFG[CalendarEventType]][]).map(([type, cfg]) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
              <Text style={[styles.legendLabel, { color: colors.textSecondary }]}>{cfg.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // ── Yearly view ────────────────────────────────────────────────────────────
  const renderYearly = () => {
    const months = Array.from({ length: 12 }, (_, m) => {
      const prefix = `${viewYear}-${pad(m + 1)}`;
      const events = allEvents.filter(e => e.date.startsWith(prefix));
      const urgentCount = events.filter(e => { const d = daysFromNow(e.date); return d >= 0 && d <= 7; }).length;
      const overdueCount = events.filter(e => daysFromNow(e.date) < 0).length;
      return { m, prefix, events, urgentCount, overdueCount };
    });

    return (
      <View style={[styles.viewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.yearGrid}>
          {months.map(({ m, events, urgentCount, overdueCount }) => {
            const isCurrentMonth = m === today.getMonth() && viewYear === today.getFullYear();
            const hasBadge = urgentCount > 0 || overdueCount > 0;
            const badgeColor = overdueCount > 0 ? '#E74C3C' : '#F39C12';
            const badgeCount = overdueCount > 0 ? overdueCount : urgentCount;
            return (
              <TouchableOpacity
                key={m}
                onPress={() => { setViewMonth(m); setViewMode('monthly'); setSelected(null); }}
                activeOpacity={0.8}
                style={[
                  styles.yearMonthCell,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                  isCurrentMonth && { borderColor: colors.primary, borderWidth: 2 },
                ]}
              >
                {hasBadge && (
                  <View style={[styles.yearBadge, { backgroundColor: badgeColor }]}>
                    <Text style={styles.yearBadgeText}>{badgeCount}</Text>
                  </View>
                )}
                <Text style={[styles.yearMonthName, { color: isCurrentMonth ? colors.primary : colors.text }]}>
                  {ARABIC_MONTHS[m]}
                </Text>
                <Text style={[styles.yearEventCount, { color: colors.textMuted }]}>
                  {events.length > 0 ? `${events.length} حدث` : 'لا أحداث'}
                </Text>
                {events.length > 0 && (
                  <View style={styles.yearDots}>
                    {[...new Set(events.map(e => e.type))].slice(0, 4).map(type => (
                      <View key={type} style={[styles.dot, { backgroundColor: EVENT_CFG[type].color }]} />
                    ))}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
        {/* Yearly summary */}
        <View style={[styles.yearlySummary, { borderTopColor: colors.border }]}>
          {(() => {
            const yEvents = allEvents.filter(e => e.date.startsWith(`${viewYear}-`));
            const overdue = yEvents.filter(e => daysFromNow(e.date) < 0).length;
            const urgent  = yEvents.filter(e => { const d = daysFromNow(e.date); return d >= 0 && d <= 7; }).length;
            return [
              { label: 'إجمالي', value: yEvents.length, color: colors.text },
              { label: 'متأخر', value: overdue, color: '#E74C3C' },
              { label: 'عاجل ٧ أيام', value: urgent, color: '#F39C12' },
            ].map(s => (
              <View key={s.label} style={styles.yearlySummaryItem}>
                <Text style={[styles.yearlySummaryVal, { color: s.color }]}>{s.value}</Text>
                <Text style={[styles.yearlySummaryLbl, { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            ));
          })()}
        </View>
      </View>
    );
  };

  // ── Urgency legend strip ───────────────────────────────────────────────────
  const renderUrgencyLegend = () => (
    <View style={[styles.urgencyLegend, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.urgencyLegendTitle, { color: colors.textSecondary }]}>مستوى الإلحاح:</Text>
      {[
        { color: '#E74C3C', label: 'متأخر / ٣ أيام' },
        { color: '#F39C12', label: '٧ أيام' },
        { color: '#8E44AD', label: '١٤ يوم' },
        { color: '#2E86C1', label: '٣٠ يوم' },
      ].map(u => (
        <View key={u.label} style={styles.urgencyLegendItem}>
          <View style={[styles.urgencyLegendDot, { backgroundColor: u.color }]} />
          <Text style={[styles.urgencyLegendLabel, { color: colors.textSecondary }]}>{u.label}</Text>
        </View>
      ))}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="التقويم" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

        {/* ── View Mode Selector ──────────────────────────────────────────── */}
        <View style={[styles.modeSelector, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(['weekly', 'monthly', 'yearly'] as ViewMode[]).map(mode => {
            const labels: Record<ViewMode, string> = { weekly: 'أسبوعي', monthly: 'شهري', yearly: 'سنوي' };
            const icons:  Record<ViewMode, string> = { weekly: 'list-outline', monthly: 'grid-outline', yearly: 'calendar-outline' };
            const active  = viewMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                onPress={() => { setViewMode(mode); setSelected(null); }}
                style={[styles.modeBtn, active && { backgroundColor: colors.primary }]}
              >
                <Ionicons name={icons[mode] as any} size={14} color={active ? '#FFF' : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: active ? '#FFF' : colors.textSecondary }]}>
                  {labels[mode]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Upcoming Alerts strip ───────────────────────────────────────── */}
        {upcomingAlerts.length > 0 && (
          <View style={[styles.alertsStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.alertsHeader}>
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={[styles.alertsSeeAll, { color: colors.primary }]}>عرض الكل</Text>
              </TouchableOpacity>
              <View style={styles.alertsTitleRow}>
                <Text style={[styles.alertsTitle, { color: colors.text }]}>مواعيد قادمة · 30 يوم</Text>
                <Ionicons name="time-outline" size={16} color={colors.primary} />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 4 }}>
              {upcomingAlerts.map(ev => {
                const cfg  = EVENT_CFG[ev.type];
                const days = daysFromNow(ev.date);
                const uc   = urgencyColor(days, cfg.color);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[styles.alertChip, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}
                    onPress={() => {
                      if (viewMode === 'monthly') {
                        setSelected(ev.date);
                        setViewYear(Number(ev.date.split('-')[0]));
                        setViewMonth(Number(ev.date.split('-')[1]) - 1);
                      } else if (viewMode === 'weekly') {
                        setWeekStart(getWeekStart(ev.date));
                      } else {
                        setViewYear(Number(ev.date.split('-')[0]));
                        setViewMode('monthly');
                        setSelected(ev.date);
                        setViewMonth(Number(ev.date.split('-')[1]) - 1);
                      }
                    }}
                  >
                    <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                    <Text style={[styles.alertChipTitle, { color: colors.text }]} numberOfLines={1}>{ev.title}</Text>
                    <View style={[styles.alertChipDays, { backgroundColor: uc }]}>
                      <Text style={styles.alertChipDaysText}>
                        {days === 0 ? 'اليوم' : days === 1 ? 'غداً' : `${days}ي`}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Period navigator ────────────────────────────────────────────── */}
        <View style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={nextPeriod} style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={[styles.periodTitle, { color: colors.text }]}>{periodTitle()}</Text>
            {selected && viewMode === 'monthly' && (
              <TouchableOpacity onPress={() => setSelected(null)}>
                <Text style={[styles.clearSel, { color: colors.primary }]}>عرض {ARABIC_MONTHS[viewMonth]} كاملاً ←</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={prevPeriod} style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* ── Main view ───────────────────────────────────────────────────── */}
        <View style={styles.contentWrap}>
          {viewMode === 'weekly'  && renderWeekly()}
          {viewMode === 'monthly' && renderMonthly()}
          {viewMode === 'yearly'  && renderYearly()}
        </View>

        {/* ── Urgency legend ──────────────────────────────────────────────── */}
        {renderUrgencyLegend()}

        {/* ── Events section ──────────────────────────────────────────────── */}
        {viewMode !== 'yearly' && (
          <View style={styles.eventsSection}>
            <View style={styles.eventsSectionHeader}>
              <TouchableOpacity
                onPress={() => setShowAdd(true)}
                style={[styles.addEventBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="add" size={16} color="#FFF" />
                <Text style={styles.addEventBtnText}>إضافة حدث</Text>
              </TouchableOpacity>
              <Text style={[styles.eventsTitle, { color: colors.text }]}>
                {selected
                  ? `أحداث ${formatArabicDate(selected)}`
                  : viewMode === 'monthly'
                    ? `أحداث ${ARABIC_MONTHS[viewMonth]} ${viewYear}`
                    : `أحداث الأسبوع`}
              </Text>
            </View>

            {shownEvents.length === 0 ? (
              <View style={[styles.noEvents, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.noEventsTitle, { color: colors.text }]}>لا توجد أحداث</Text>
                <Text style={[styles.noEventsHint, { color: colors.textMuted }]}>
                  {selected ? 'لا توجد أحداث في هذا اليوم' : 'لا توجد أحداث في هذه الفترة'}
                </Text>
              </View>
            ) : (
              shownEvents.map(ev => renderEventCard(ev, viewMode === 'monthly' && !selected))
            )}
          </View>
        )}

        {/* In yearly mode: show add button separately */}
        {viewMode === 'yearly' && (
          <View style={[styles.eventsSection, { marginTop: 0 }]}>
            <TouchableOpacity
              onPress={() => setShowAdd(true)}
              style={[styles.addEventBtn, { backgroundColor: colors.primary, alignSelf: 'flex-start' }]}
            >
              <Ionicons name="add" size={16} color="#FFF" />
              <Text style={styles.addEventBtnText}>إضافة حدث</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      <ConfirmModal
        visible={!!pending}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="تأكيد الحذف"
        message={`هل أنت متأكد أنك تريد حذف "${pending?.label}"؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="تأكيد الحذف"
        variant="danger"
      />
      <AlertModal
        visible={!!blocked}
        onClose={clearBlocked}
        title="لا يمكن الحذف"
        message={blocked ?? ''}
        variant="warning"
      />

      {/* ── Add Event Modal ─────────────────────────────────────────────────── */}
      <RNModal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.addOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={() => setShowAdd(false)} />
          <View style={[styles.addSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.addHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.addSheetTitle, { color: colors.text }]}>إضافة حدث للتقويم</Text>

            <Text style={[styles.addLabel, { color: colors.textSecondary }]}>عنوان الحدث</Text>
            <TextInput
              value={addTitle}
              onChangeText={setAddTitle}
              placeholder="مثال: اجتماع مع المالك، متابعة صيانة..."
              placeholderTextColor={colors.textMuted}
              style={[styles.addInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            />

            <Text style={[styles.addLabel, { color: colors.textSecondary }]}>التاريخ (YYYY-MM-DD)</Text>
            <TextInput
              value={addDate}
              onChangeText={setAddDate}
              placeholder="2025-06-15"
              placeholderTextColor={colors.textMuted}
              style={[styles.addInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            />

            <Text style={[styles.addLabel, { color: colors.textSecondary }]}>نوع الحدث</Text>
            <View style={styles.addTypeRow}>
              {(Object.entries(EVENT_CFG) as [CalendarEventType, typeof EVENT_CFG[CalendarEventType]][]).map(([type, cfg]) => (
                <TouchableOpacity
                  key={type}
                  onPress={() => setAddType(type)}
                  style={[styles.addTypePill, {
                    backgroundColor: addType === type ? cfg.color : colors.surface,
                    borderColor:     addType === type ? cfg.color : colors.border,
                  }]}
                >
                  <Ionicons name={cfg.icon as any} size={13} color={addType === type ? '#FFF' : cfg.color} />
                  <Text style={{ color: addType === type ? '#FFF' : colors.text, fontSize: 12 }}>{cfg.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.addBtns}>
              <TouchableOpacity
                style={[styles.addCancelBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={[styles.addCancelText, { color: colors.text }]}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.addConfirmBtn, { backgroundColor: addTitle.trim() && /^\d{4}-\d{2}-\d{2}$/.test(addDate) ? colors.primary : colors.border }]}
                disabled={!addTitle.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(addDate)}
                onPress={() => {
                  addCalendarEvent({ title: addTitle.trim(), date: addDate, type: addType });
                  setShowAdd(false);
                  setAddTitle('');
                  setAddDate(todayIso);
                }}
              >
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.addConfirmText}>حفظ الحدث</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </RNModal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentWrap: { maxWidth: 560, alignSelf: 'center', width: '100%' },

  // Mode selector
  modeSelector: {
    flexDirection: 'row', margin: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.xl, borderWidth: 1, padding: 4, gap: 4,
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: 8, borderRadius: radius.lg,
  },
  modeBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  // Alerts strip
  alertsStrip: {
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[3], gap: spacing[2],
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  alertsHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  alertsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  alertsTitle:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
  alertsSeeAll:   { fontSize: fontSize.xs },
  alertChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: radius.lg, borderWidth: 1, maxWidth: 200,
  },
  alertChipTitle:    { fontSize: fontSize.xs, fontWeight: fontWeight.medium, flex: 1 },
  alertChipDays:     { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 2 },
  alertChipDaysText: { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold },

  // Period navigator
  navCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.xl, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12,
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  navBtn:     { padding: 6 },
  periodTitle:{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  clearSel:   { fontSize: fontSize.xs, marginTop: 2 },

  // View card wrapper
  viewCard: {
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.xl, borderWidth: 1,
    padding: spacing[3], paddingBottom: spacing[2],
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  viewCardSubtitle: { fontSize: fontSize.xs, textAlign: 'right', marginBottom: spacing[2] },

  // Monthly grid
  dayLabelsRow: { flexDirection: 'row', paddingBottom: 4 },
  dayLabel:     { flex: 1, textAlign: 'center', fontSize: fontSize.xs, fontWeight: fontWeight.semibold, paddingVertical: 4 },
  daysGrid:     { flexDirection: 'column' },
  weekRow:      { flexDirection: 'row' },
  dayCell:      { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', gap: 2, marginVertical: 1 },
  dayNum:       { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  dotsRow:      { flexDirection: 'row', gap: 2 },
  dot:          { width: 4, height: 4, borderRadius: 2 },

  // Monthly legend
  legend: {
    flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 10,
    marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1,
  },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { fontSize: 10 },

  // Timeline (weekly)
  tlDayRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing[3], gap: 8 },
  tlDayLabel:{ width: 40, alignItems: 'center', paddingVertical: 4 },
  tlDayNum:  { fontSize: fontSize.base, fontWeight: fontWeight.bold },
  tlDayName: { fontSize: 10 },
  tlLine:    { width: 1, marginTop: 8, alignSelf: 'stretch', minHeight: 30 },
  tlEvents:  { flex: 1, gap: 6 },
  tlEmptyDay: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed' },
  tlEmptyText: { fontSize: fontSize.xs, textAlign: 'right' },
  tlEventChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: radius.lg, borderWidth: 1, borderLeftWidth: 3,
  },
  tlEventText:       { flex: 1, fontSize: fontSize.xs, fontWeight: fontWeight.medium, textAlign: 'right' },
  tlUrgencyDot:      { borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2, minWidth: 22, alignItems: 'center' },
  tlUrgencyDotText:  { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold },

  // Yearly grid
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  yearMonthCell: {
    width: '47%', borderRadius: radius.lg, borderWidth: 1,
    padding: spacing[3], gap: 4, position: 'relative',
  },
  yearMonthName:  { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textAlign: 'right' },
  yearEventCount: { fontSize: 11, textAlign: 'right' },
  yearDots:       { flexDirection: 'row', gap: 3, justifyContent: 'flex-end' },
  yearBadge: {
    position: 'absolute', top: 6, left: 6,
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 1, minWidth: 18, alignItems: 'center',
  },
  yearBadgeText: { color: '#FFF', fontSize: 10, fontWeight: fontWeight.bold },
  yearlySummary: {
    flexDirection: 'row', justifyContent: 'space-around',
    marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1,
  },
  yearlySummaryItem: { alignItems: 'center', gap: 2 },
  yearlySummaryVal:  { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  yearlySummaryLbl:  { fontSize: fontSize.xs },

  // Urgency legend
  urgencyLegend: {
    flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.lg, borderWidth: 1, padding: spacing[3],
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  urgencyLegendTitle: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },
  urgencyLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  urgencyLegendDot:   { width: 8, height: 8, borderRadius: 4 },
  urgencyLegendLabel: { fontSize: 10 },

  // Events section
  eventsSection: {
    paddingHorizontal: spacing[4], marginTop: spacing[3],
    maxWidth: 560, alignSelf: 'center', width: '100%',
  },
  eventsSectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: spacing[3],
  },
  eventsTitle:     { fontSize: fontSize.base, fontWeight: fontWeight.bold, textAlign: 'right' },
  addEventBtn:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.lg },
  addEventBtnText: { color: '#FFF', fontSize: fontSize.sm, fontWeight: fontWeight.semibold },

  noEvents: {
    alignItems: 'center', paddingVertical: 40, gap: 8,
    borderRadius: radius.xl, borderWidth: 1, borderStyle: 'dashed',
  },
  noEventsTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  noEventsHint:  { fontSize: fontSize.sm },

  // Event card
  eventCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing[3], borderRadius: radius.xl, borderWidth: 1, borderLeftWidth: 4,
    marginBottom: spacing[2], gap: spacing[2],
  },
  eventIconBox:  { width: 40, height: 40, borderRadius: radius.lg, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  eventBody:     { flex: 1, gap: 4 },
  eventTitle:    { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, textAlign: 'right' },
  eventNotes:    { fontSize: fontSize.xs },
  eventMetaRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  typeBadge:     { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  typeBadgeText: { fontSize: 10, fontWeight: fontWeight.bold },
  eventDateText: { fontSize: fontSize.xs },
  eventRight:    { alignItems: 'flex-start', gap: 4, flexShrink: 0 },
  urgencyText:   { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  // Add event modal
  addOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  addSheet: {
    borderTopLeftRadius: radius['2xl'], borderTopRightRadius: radius['2xl'],
    padding: spacing[5], gap: spacing[3],
  },
  addHandle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing[2] },
  addSheetTitle:  { fontSize: fontSize.xl, fontWeight: fontWeight.bold, textAlign: 'right' },
  addLabel:       { fontSize: fontSize.sm, fontWeight: fontWeight.medium, textAlign: 'right' },
  addInput: {
    borderWidth: 1, borderRadius: radius.lg,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: fontSize.base,
  },
  addTypeRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  addTypePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.lg, borderWidth: 1 },
  addBtns:     { flexDirection: 'row', gap: spacing[3], marginTop: spacing[2] },
  addCancelBtn:  { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1 },
  addCancelText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  addConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg },
  addConfirmText:{ color: '#FFF', fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
