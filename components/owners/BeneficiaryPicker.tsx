/**
 * اختيار الوحدات اللي يستفيد منها مالك (ياخذ إيجارها ويشوفها) حتى لو العقار باسم غيره.
 * الملكية القانونية تبقى في سند الملكية؛ هنا بس "المستفيد".
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal } from '../ui/Modal';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';

export function BeneficiaryPicker({ ownerId, visible, onClose }: { ownerId: string; visible: boolean; onClose: (changed?: number) => void }) {
  const { colors } = useAppTheme();
  const { units, properties, owners, updateUnit } = useApp();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());

  const effOwner = (u: typeof units[0]) => u.ownerId || properties.find(p => p.id === u.propertyId)?.ownerId || '';
  const initial = useMemo(() => new Set(units.filter(u => u.ownerId === ownerId && properties.find(p => p.id === u.propertyId)?.ownerId !== ownerId).map(u => u.id)), [units, properties, ownerId]);
  useEffect(() => { if (visible) { setSel(new Set(initial)); setQ(''); } }, [visible]);

  const groups = useMemo(() => {
    const t = q.trim();
    // عقاراته هو أصلاً له؛ هنا وحدات في عقارات غيره
    return properties
      .filter(p => p.ownerId !== ownerId)
      .map(p => ({ p, list: units.filter(u => u.propertyId === p.id && (!t || p.name.includes(t) || String(u.number).includes(t))) }))
      .filter(g => g.list.length > 0)
      .sort((a, b) => Number(b.list.some(u => sel.has(u.id))) - Number(a.list.some(u => sel.has(u.id))));
  }, [properties, units, q, sel]);

  const toggle = (id: string) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const added = [...sel].filter(id => !initial.has(id));
  const removed = [...initial].filter(id => !sel.has(id));
  const changes = added.length + removed.length;
  const ownerName = (oid: string) => owners.find(o => o.id === oid)?.name ?? '';

  const save = () => {
    added.forEach(id => updateUnit(id, { ownerId }));
    // الوحدة اللي انشالت ترجع لمالك العقار الأصلي
    removed.forEach(id => updateUnit(id, { ownerId: '' } as any));
    onClose(changes);
  };

  return (
    <Modal visible={visible} onClose={() => onClose()} title="الوحدات اللي يستفيد منها" size="lg" scrollable
      footer={
        <TouchableOpacity disabled={!changes} onPress={save}
          style={[styles.save, { backgroundColor: changes ? colors.primary : colors.border }]}>
          <Text style={{ color: colors.textInverse, fontWeight: '600', fontSize: 15 }}>
            {changes ? `حفظ (${sel.size} ${sel.size === 1 ? 'وحدة' : 'وحدات'})` : `محدد ${sel.size}`}
          </Text>
        </TouchableOpacity>
      }>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        علّم الوحدات اللي ياخذ إيجارها، حتى لو مسجّلة باسم شخص ثاني. عقودها ودفعاتها تنحسب له وتظهر عنده. الملكية القانونية تبقى زي ما هي في سند الملكية.
      </Text>
      <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput value={q} onChangeText={setQ} placeholder="ابحث بالعقار أو رقم الوحدة" placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]} textAlign="right" />
      </View>
      {groups.map(({ p, list }) => (
        <View key={p.id} style={[styles.group, { borderColor: colors.border }]}>
          <Text style={[styles.gTitle, { color: colors.text, backgroundColor: colors.surface }]}>{p.name}</Text>
          {list.map((u, i) => {
            const on = sel.has(u.id);
            const cur = effOwner(u);
            const curName = cur && cur !== ownerId ? ownerName(cur) : '';
            const deedNames = (u as any).titleDeed?.owners?.map((o: any) => ownerName(o.ownerId) || o.name).filter(Boolean).join('، ');
            return (
              <TouchableOpacity key={u.id} onPress={() => toggle(u.id)}
                style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }, on && { backgroundColor: colors.primary + '0F' }]}
                accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                <View style={[styles.box, { borderColor: on ? colors.primary : colors.borderStrong, backgroundColor: on ? colors.primary : 'transparent' }]}>
                  {on && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.unit, { color: colors.text }]}>وحدة {u.number}</Text>
                  {(!!curName || !!deedNames) && (
                    <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                      {curName ? `المستفيد الحالي: ${curName}` : ''}{curName && deedNames ? ' · ' : ''}{deedNames ? `باسم: ${deedNames}` : ''}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </Modal>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, textAlign: 'right' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42 },
  input: { flex: 1, minWidth: 0, fontSize: 14, ...({ outlineStyle: 'none' } as any) },
  group: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  gTitle: { fontSize: 13, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 8, textAlign: 'right' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 11 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  unit: { fontSize: 14, fontWeight: '500', textAlign: 'right' },
  meta: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  save: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
