import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import { Owner } from '../../data/mockData';
import { DeleteButton } from './DeleteButton';
import { useApp } from '../../context/AppProvider';
import { CurrencyText } from './CurrencyText';
import { useAppTheme } from '../../hooks/useAppTheme';

// لون مميز ثابت لكل مالك بناءً على اسمه
const AVATAR_COLORS = [
  '#2E86C1', '#17A589', '#8E44AD', '#E67E22',
  '#C0392B', '#1ABC9C', '#2980B9', '#D35400',
  '#7D3C98', '#1E8449',
];
function ownerColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// حروف أولى آمنة
function safeInitials(name: string): string {
  return (name ?? '؟')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0] ?? '')
    .join('') || '؟';
}

interface OwnerCardProps {
  owner: Owner;
  onDelete?: () => void;
}

export function OwnerCard({ owner, onDelete }: OwnerCardProps) {
  const { colors } = useAppTheme();
  const { properties, units, contracts } = useApp();

  const color     = ownerColor(owner.name ?? '');
  const initials  = safeInitials(owner.name);

  // إحصائيات المالك — تتضمن الوحدات التي يملكها داخل عقارات غيره (كل وحدة خارجية تُحسب كعقار)
  const propMap = new Map(properties.map(p => [p.id, p]));
  // الوحدات التي يملكها: صراحةً (unit.ownerId) أو بالوراثة من عقار يملكه بالكامل
  const ownerUnits = units.filter(u =>
    u.ownerId ? u.ownerId === owner.id : propMap.get(u.propertyId)?.ownerId === owner.id
  );
  const fullyOwnedProps = properties.filter(p => p.ownerId === owner.id);
  // وحدات يملكها في عقارات غيره → كل واحدة تُحسب "عقاراً" مستقلاً (يطابق شاشة المالك)
  const externalUnits   = ownerUnits.filter(u => propMap.get(u.propertyId)?.ownerId !== owner.id);
  const propertyCount   = fullyOwnedProps.length + externalUnits.length;
  const activeContracts = contracts.filter(c =>
    c.status === 'active' && ownerUnits.find(u => u.id === c.unitId)
  );
  const monthlyRevenue  = activeContracts.reduce((s, c) => s + Math.round(c.annualValue / 12), 0);
  const rentedCount     = ownerUnits.filter(u => u.status === 'rented').length;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.sm]}
      onPress={() => router.push(`/owner/${owner.id}`)}
      activeOpacity={0.88}
    >
      {/* شريط لوني علوي */}
      <View style={[styles.topBar, { backgroundColor: color }]} />

      <View style={styles.body}>
        {/* رأس الكرت */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {onDelete && (
              <DeleteButton variant="icon" onPress={onDelete} />
            )}
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: colors.accent }]}
              onPress={e => { e.stopPropagation(); router.push(`/edit-owner/${owner.id}`); }}
            >
              <Ionicons name="pencil-outline" size={15} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* أفاتار + اسم */}
          <View style={styles.headerRight}>
            <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
              {owner.name}
            </Text>
            <View style={[styles.avatar, { backgroundColor: color }]}>
              <Text style={styles.initials}>{initials}</Text>
            </View>
          </View>
        </View>

        {/* معلومات التواصل */}
        <View style={[styles.contactBox, { backgroundColor: colors.accent, borderColor: colors.border }]}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={e => { e.stopPropagation(); owner.phone && Linking.openURL(`tel:${owner.phone}`); }}
            disabled={!owner.phone}
            activeOpacity={0.7}
          >
            <Text style={[styles.contactText, { color: owner.phone ? colors.text : colors.textMuted }]} numberOfLines={1}>
              {owner.phone || '—'}
            </Text>
            <View style={[styles.contactIcon, { backgroundColor: `${color}20` }]}>
              <Ionicons name="call-outline" size={14} color={color} />
            </View>
          </TouchableOpacity>
          <View style={[styles.contactDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.contactRow}
            onPress={e => { e.stopPropagation(); owner.email && Linking.openURL(`mailto:${owner.email}`); }}
            disabled={!owner.email}
            activeOpacity={0.7}
          >
            <Text style={[styles.contactText, { color: owner.email ? colors.textSecondary : colors.textMuted }]} numberOfLines={1}>
              {owner.email || '—'}
            </Text>
            <View style={[styles.contactIcon, { backgroundColor: `${color}20` }]}>
              <Ionicons name="mail-outline" size={14} color={color} />
            </View>
          </TouchableOpacity>
        </View>

        {/* إحصائيات */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: color }]}>{propertyCount}</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>عقار</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statVal, { color: colors.success }]}>{rentedCount}</Text>
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>مؤجرة</Text>
          </View>
          <View style={[styles.statDiv, { backgroundColor: colors.border }]} />
          <View style={styles.statItem}>
            {monthlyRevenue > 0
              ? <CurrencyText amount={monthlyRevenue} color={colors.primary} size={13} />
              : <Text style={[styles.statVal, { color: colors.textMuted }]}>—</Text>
            }
            <Text style={[styles.statLbl, { color: colors.textMuted }]}>شهرياً</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radius.lg,
    borderWidth: 1,
    marginHorizontal: Theme.spacing.base,
    marginBottom: Theme.spacing.sm,
    overflow: 'hidden',
  },
  topBar: { height: 4 },
  body: { padding: Theme.spacing.md, gap: 10 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },

  avatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  initials: { color: '#FFF', fontSize: 17, fontWeight: '700' },
  name: {
    flex: 1,
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    textAlign: 'right',
  },
  editBtn: {
    width: 30, height: 30, borderRadius: 15,
    justifyContent: 'center', alignItems: 'center',
  },

  contactBox: {
    borderRadius: Theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 0,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    paddingVertical: 5,
  },
  contactIcon: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  contactText: { flex: 1, fontSize: Theme.fontSize.sm, textAlign: 'right' },
  contactDivider: { height: 1 },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDiv:  { width: 1, height: 28, marginHorizontal: 4 },
  statVal:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold },
  statLbl:  { fontSize: 10, textAlign: 'center' },
});
