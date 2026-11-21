/**
 * بطاقة "الملكية" في صفحة الوحدة: الملاك بحصصهم كشريط واحد مقسوم، ثم بيانات السند.
 */
import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppProvider';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../../hooks/useAppTheme';
import { formatDate } from '../../data/mockData';
import type { TitleDeed } from '../../domain/models';
import { shareLabel } from '../../domain/services/DeedService';

// درجات كحلي/ذهبي متمايزة لشرائح الحصص
const SLICES = ['#0F2A47', '#B08D4F', '#365A80', '#D4BC8A', '#5A7799', '#76572B', '#8AA1BC', '#E7D8B8'];

/** المستفيد من الإيجار: مين ياخذ الإيجار ويشوف الوحدة — ممكن يختلف عن اللي باسمه الصك */
function Beneficiary({ unitId, canWrite }: { unitId: string; canWrite: boolean }) {
  const { colors } = useAppTheme();
  const { units, properties, owners, updateUnit } = useApp();
  const [open, setOpen] = useState(false);
  const unit = units.find(u => u.id === unitId);
  const prop = properties.find(p => p.id === unit?.propertyId);
  const effId = unit?.ownerId || prop?.ownerId;
  const eff = owners.find(o => o.id === effId);
  const differs = !!unit?.ownerId && unit.ownerId !== prop?.ownerId;
  return (
    <>
      <TouchableOpacity disabled={!canWrite} onPress={() => setOpen(true)}
        style={[styles.benef, { backgroundColor: colors.surface }]}>
        <Ionicons name="wallet-outline" size={18} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.ownerSub, { color: colors.textMuted, marginTop: 0 }]}>المستفيد من الإيجار</Text>
          <Text style={[styles.ownerName, { color: colors.text }]}>{eff?.name ?? 'غير محدد'}</Text>
          {differs && <Text style={[styles.ownerSub, { color: colors.textMuted }]}>مختلف عن مالك العقار ({owners.find(o => o.id === prop?.ownerId)?.name ?? '—'})</Text>}
        </View>
        {canWrite && <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>تغيير</Text>}
      </TouchableOpacity>
      <Modal visible={open} onClose={() => setOpen(false)} title="مين ياخذ إيجار هذي الوحدة؟" scrollable>
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          الإيجار والعقود والدفعات تنحسب له وتظهر عنده. الصك وحصص الملكية ما تتغير.
        </Text>
        {owners.map(o => {
          const on = o.id === effId;
          const isPropOwner = o.id === prop?.ownerId;
          return (
            <TouchableOpacity key={o.id} onPress={() => { updateUnit(unitId, { ownerId: isPropOwner ? '' : o.id } as any); setOpen(false); }}
              style={[styles.pick, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary + '0F' : colors.card }]}>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.primary : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ownerName, { color: colors.text }]}>{o.name}</Text>
                {isPropOwner && <Text style={[styles.ownerSub, { color: colors.textMuted }]}>مالك العقار</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </Modal>
    </>
  );
}

export function OwnershipCard({ unitId, deed, canWrite }: { unitId: string; deed?: TitleDeed; canWrite: boolean }) {
  const { colors } = useAppTheme();
  const edit = () => router.push(`/edit-deed/${unitId}` as any);

  if (!deed || !deed.owners?.length) {
    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>الملكية</Text>
        <Beneficiary unitId={unitId} canWrite={canWrite} />
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          لم تُسجَّل بيانات سند الملكية لهذه الوحدة بعد. سجّلها لتظهر حصص الملاك وبيانات الصك هنا.
        </Text>
        {canWrite && (
          <TouchableOpacity onPress={edit} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
            <Ionicons name="document-attach-outline" size={18} color={colors.textInverse} />
            <Text style={{ color: colors.textInverse, fontSize: 14, fontWeight: '500' }}>إضافة بيانات الملكية</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const rows: [string, string | null | undefined][] = [
    ['الجهة المصدرة', deed.issuer],
    ['رقم الشهادة', deed.certificateNo],
    ['تاريخ الإصدار', deed.issueDate ? formatDate(deed.issueDate) : null],
    ['المبنى', [deed.buildingName, deed.buildingNo ? `مبنى ${deed.buildingNo}` : null].filter(Boolean).join('، ') || null],
    ['المنطقة', deed.community],
    ['رقم الأرض', deed.plotNo],
    ['رقم البلدية', deed.municipalityNo],
    ['رقم العقار', deed.propertyNo],
    ['الطابق', deed.floorNo],
    ['الموقف', deed.parking],
    ['المساحة الداخلية', deed.suiteArea != null ? `${deed.suiteArea} م²` : null],
    ['البلكونة', deed.balconyArea != null ? `${deed.balconyArea} م²` : null],
    ['المساحة المشتركة', deed.commonArea != null ? `${deed.commonArea} م²` : null],
    ['المساحة الكلية', deed.totalArea != null ? `${deed.totalArea} م²${deed.totalAreaSqFt ? ` (${deed.totalAreaSqFt.toLocaleString('en-US')} قدم²)` : ''}` : null],
    ['انتقال الملكية', deed.transferNote],
  ];

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>الملكية</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {deed.mortgaged != null && (
            <View style={[styles.tag, { backgroundColor: deed.mortgaged ? colors.warningSubtle : colors.successSubtle }]}>
              <Text style={{ color: deed.mortgaged ? colors.warning : colors.success, fontSize: 12, fontWeight: '500' }}>
                {deed.mortgaged ? 'مرهون' : 'غير مرهون'}
              </Text>
            </View>
          )}
          {canWrite && (
            <TouchableOpacity onPress={edit} hitSlop={8} accessibilityLabel="تعديل بيانات الملكية">
              <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>تعديل</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Beneficiary unitId={unitId} canWrite={canWrite} />
      <Text style={[styles.ownerSub, { color: colors.textMuted, marginTop: 0 }]}>باسم (حسب الصك)</Text>

      {/* شريط الحصص */}
      <View style={styles.bar}>
        {deed.owners.map((o, i) => (
          <View key={i} style={{ flex: Math.max(o.sharePercent, 0.5), backgroundColor: SLICES[i % SLICES.length] }} />
        ))}
      </View>
      <View style={{ gap: 2 }}>
        {deed.owners.map((o, i) => (
          <TouchableOpacity
            key={i}
            disabled={!o.ownerId}
            onPress={() => o.ownerId && router.push(`/owner/${o.ownerId}` as any)}
            style={[styles.ownerRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
          >
            <View style={[styles.dot, { backgroundColor: SLICES[i % SLICES.length] }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.ownerName, { color: o.ownerId ? colors.primary : colors.text }]} numberOfLines={1}>{o.name}</Text>
              {(o.ownerNumber || o.shareArea) && (
                <Text style={[styles.ownerSub, { color: colors.textMuted }]}>
                  {[o.shareArea ? `${o.shareArea} م²` : null, o.ownerNumber ? `رقم المالك ${o.ownerNumber}` : null].filter(Boolean).join('، ')}
                </Text>
              )}
            </View>
            <Text style={[styles.share, { color: colors.text }]}>{shareLabel(o.sharePercent)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={[styles.details, { borderTopColor: colors.border }]}>
        {rows.filter(([, v]) => !!v).map(([k, v]) => (
          <View key={k} style={styles.kv}>
            <Text style={[styles.k, { color: colors.textMuted }]}>{k}</Text>
            <Text style={[styles.v, { color: colors.text }]}>{v}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'right' },
  empty: { fontSize: 13, lineHeight: 21, textAlign: 'right' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 8, minHeight: 42, paddingHorizontal: 16, alignSelf: 'flex-start' },
  tag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', gap: 2 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  benef: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 10, padding: 12 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 10, padding: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  ownerName: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  ownerSub: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  share: { fontSize: 14, fontWeight: '600' },
  details: { borderTopWidth: 1, paddingTop: 8, flexDirection: 'row', flexWrap: 'wrap' },
  kv: { flexBasis: '50%', flexGrow: 1, paddingVertical: 6, paddingLeft: 12, gap: 2 },
  k: { fontSize: 12, textAlign: 'right' },
  v: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
});
