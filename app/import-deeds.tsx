/**
 * رفع مستندات الوحدات دفعة وحدة (سندات ملكية، مخططات، أي مستند):
 * اختر كل الملفات ← نقرأ السندات تلقائياً ونعرف الوحدة من رقم العقار أو اسم الملف
 * ← تراجع وتعدّل الوحدة لو لزم ← حفظ: بيانات الملكية تتعبّى والملف ينحفظ في مرفقات الوحدة.
 * الملف المكرر (نفس المحتوى) ينكشف وما ينرفع مرتين.
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { AppHeader } from '../components/ui/AppHeader';
import { FormSelect } from '../components/forms/FormSelect';
import { useApp } from '../context/AppProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { toPersistentUri, DOCUMENT_IMAGE } from '../lib/imageUtils';
import { scanDeedFile } from '../lib/deedScanClient';
import { normalizeDeed, deedForStorage, validateDeed, parseNumber, shareLabel } from '../domain/services/DeedService';
import type { TitleDeed } from '../domain/models';

type Kind = 'deed' | 'other';
interface Item {
  key: string;
  name: string;
  size?: number;
  mimeType: string;
  dataUri: string;
  hash: string;
  status: 'reading' | 'ready' | 'error';
  kind: Kind;
  deed?: TitleDeed;
  note?: string;
  unitId: string;
  duplicateOf?: string;
  include: boolean;
  saved?: boolean;
}

/** بصمة سريعة للمحتوى (FNV-1a) — تكشف الملفات المتطابقة حتى لو اسمها مختلف */
function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i += 7) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${s.length}-${(h >>> 0).toString(16)}`;
}

export default function ImportDeedsScreen() {
  const { colors } = useAppTheme();
  const { units, properties, owners, updateUnit, addAttachment, currentUser, canWrite } = useApp();
  const [items, setItems] = useState<Item[]>([]);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const unitLabel = (id: string) => {
    const u = units.find(x => x.id === id); if (!u) return '';
    return `${properties.find(p => p.id === u.propertyId)?.name ?? ''} — وحدة ${u.number}`;
  };
  const unitOptions = [{ label: 'اختر الوحدة...', value: '' }, ...units
    .map(u => ({ label: unitLabel(u.id), value: u.id }))
    .sort((a, b) => a.label.localeCompare(b.label, 'ar'))];

  /** نخمن الوحدة: رقم العقار في السند، وإلا الأرقام في اسم الملف. ونفضّل العقار اللي اسمه يشبه اسم المبنى */
  const guessUnit = (num: string | null | undefined, building?: string | null) => {
    if (!num) return '';
    const hits = units.filter(u => String(u.number).trim() === String(num).trim());
    if (hits.length <= 1) return hits[0]?.id ?? '';
    const b = (building ?? '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
    const scored = hits.map(u => {
      const pn = (properties.find(p => p.id === u.propertyId)?.name ?? '').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '');
      const score = b && pn ? [...new Set(b.match(/[a-z]+\d*|\d+/g) ?? [])].filter(t => pn.includes(t)).length : 0;
      return { u, score };
    }).sort((a, b2) => b2.score - a.score);
    return scored[0].score > 0 && scored[0].score > (scored[1]?.score ?? 0) ? scored[0].u.id : '';
  };
  const numFromName = (n: string) => (n.match(/\d{2,5}/g) ?? []).pop() ?? null;

  const pick = async () => {
    setDone(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], multiple: true, copyToCacheDirectory: true });
    if (res.canceled) return;
    for (const a of res.assets) {
      const key = `${a.name}-${Date.now()}-${Math.random()}`;
      const mime = a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
      setItems(prev => [...prev, { key, name: a.name, size: a.size, mimeType: mime, dataUri: '', hash: '', status: 'reading', kind: 'other', unitId: '', include: true }]);
      (async () => {
        try {
          const dataUri = await toPersistentUri(a.uri, DOCUMENT_IMAGE);
          const hash = fingerprint(dataUri);
          const scan = await scanDeedFile(dataUri.split(',')[1] ?? '', dataUri.match(/data:([^;]+)/)?.[1] ?? mime);
          setItems(prev => {
            const dup = prev.find(p => p.key !== key && p.hash === hash);
            return prev.map(p => {
              // الأصل نفسه مشكوك فيه بعد: نفس المحتوى بأسماء وحدات مختلفة ⇒ ما ندري أي وحدة يخص
              if (dup && p.key === dup.key) return { ...p, duplicateOf: p.duplicateOf ?? a.name, include: false };
              if (p.key !== key) return p;
              if (scan.ok && (scan.raw.owners?.length || scan.raw.propertyNo)) {
                const deed = normalizeDeed(scan.raw, owners);
                return { ...p, dataUri, hash, status: 'ready', kind: 'deed', deed,
                  unitId: guessUnit(deed.propertyNo, deed.buildingName) || guessUnit(numFromName(a.name)),
                  duplicateOf: dup?.name, include: !dup };
              }
              return { ...p, dataUri, hash, status: 'ready', kind: 'other',
                note: scan.ok ? undefined : scan.code === 'NO_KEY' ? scan.message : undefined,
                unitId: guessUnit(numFromName(a.name)), duplicateOf: dup?.name, include: !dup };
            });
          });
        } catch {
          setItems(prev => prev.map(p => p.key === key ? { ...p, status: 'error', include: false } : p));
        }
      })();
    }
  };

  const patch = (key: string, d: Partial<Item>) => setItems(prev => prev.map(p => p.key === key ? { ...p, ...d } : p));

  // ملف "غير سند" محتواه مطابق لملف ثاني بس اسمه لوحدة ثانية ⇒ غالباً مرفوع غلط
  const ready = items.filter(i => i.status === 'ready' && i.include && i.unitId);
  const busy = items.some(i => i.status === 'reading');

  const saveAll = async () => {
    setSaving(true);
    let deeds = 0, files = 0; const errs: string[] = [];
    for (const it of ready) {
      const unit = units.find(u => u.id === it.unitId); if (!unit) continue;
      try {
        if (it.kind === 'deed' && it.deed) {
          const v = validateDeed(it.deed);
          if (!v.errors.length) {
            const stamped = { ...it.deed, updatedAt: new Date().toISOString(), updatedBy: currentUser.name };
            const p: any = { titleDeed: deedForStorage(stamped) };
            if (it.deed.totalArea) p.area = it.deed.totalArea;
            const fl = parseNumber(it.deed.floorNo ?? ''); if (fl != null) p.floor = fl;
            updateUnit(unit.id, p);
            deeds++;
          } else errs.push(`${it.name}: ${v.errors[0]}`);
        }
        await addAttachment({
          entityType: 'unit', entityId: unit.id,
          name: it.kind === 'deed' ? `سند ملكية — وحدة ${unit.number}` : it.name.replace(/\.[a-z]+$/i, ''),
          uri: it.dataUri, mimeType: it.mimeType, size: it.size, category: 'property', uploadedBy: currentUser.name,
        });
        files++;
        patch(it.key, { saved: true, include: false });
      } catch (e: any) { errs.push(`${it.name}: ${e?.message ?? 'تعذّر الحفظ'}`); }
    }
    setSaving(false);
    setDone(`تعبّت بيانات الملكية لـ ${deeds} ${deeds === 1 ? 'وحدة' : 'وحدات'}، وانحفظ ${files} ${files === 1 ? 'ملف' : 'ملفات'} في المرفقات.${errs.length ? `\n\nما انحفظ:\n${errs.join('\n')}` : ''}`);
  };

  if (!canWrite) return <View style={{ flex: 1, backgroundColor: colors.background }}><AppHeader title="رفع مستندات الوحدات" /></View>;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="رفع مستندات الوحدات" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.steps, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {['اختر كل الملفات مرة وحدة (سندات، مخططات، أي مستند)', 'نقرأ السندات ونحدد الوحدة تلقائياً — راجعها', 'اضغط حفظ: الملكية تتعبّى والملفات تنحفظ في مرفقات كل وحدة'].map((t, i) => (
            <View key={i} style={styles.step}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}><Text style={styles.stepNumText}>{i + 1}</Text></View>
              <Text style={[styles.stepText, { color: colors.text }]}>{t}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity onPress={pick} style={[styles.drop, { borderColor: colors.primary, backgroundColor: colors.primary + '08' }]}>
          <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
          <Text style={[styles.dropText, { color: colors.primary }]}>{items.length ? 'إضافة ملفات ثانية' : 'اختر الملفات'}</Text>
          <Text style={[styles.dropSub, { color: colors.textMuted }]}>PDF أو صور — تقدر تختار أكثر من ملف</Text>
        </TouchableOpacity>

        {!!done && (
          <View style={[styles.done, { backgroundColor: colors.successSubtle, borderColor: colors.success + '40' }]}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.doneText, { color: colors.text }]}>{done}</Text>
          </View>
        )}

        {items.map(it => {
          const d = it.deed;
          return (
            <View key={it.key} style={[styles.card, { backgroundColor: colors.card, borderColor: it.duplicateOf ? colors.warning + '80' : colors.border, opacity: it.saved ? 0.55 : 1 }]}>
              <View style={styles.cardHead}>
                <Ionicons name={it.kind === 'deed' ? 'ribbon-outline' : 'document-outline'} size={20} color={it.kind === 'deed' ? colors.primary : colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.fname, { color: colors.text }]} numberOfLines={1}>{it.name}</Text>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {it.status === 'reading' ? 'جاري القراءة...' : it.status === 'error' ? 'تعذّرت قراءة الملف'
                      : it.saved ? 'انحفظ ✓' : it.kind === 'deed' ? 'سند ملكية' : 'مستند (ينحفظ في المرفقات)'}
                    {it.size ? ` · ${(it.size / 1024 / 1024).toFixed(1)} ميجا` : ''}
                  </Text>
                </View>
                {it.status === 'reading' && <ActivityIndicator size="small" color={colors.primary} />}
                {it.status === 'ready' && !it.saved && (
                  <TouchableOpacity onPress={() => patch(it.key, { include: !it.include })}
                    style={[styles.check, { borderColor: it.include ? colors.primary : colors.borderStrong, backgroundColor: it.include ? colors.primary : 'transparent' }]}>
                    {it.include && <Ionicons name="checkmark" size={14} color={colors.textInverse} />}
                  </TouchableOpacity>
                )}
              </View>

              {!!it.duplicateOf && (
                <Text style={[styles.warn, { color: colors.warning }]}>
                  محتوى هذا الملف نفس «{it.duplicateOf}» بالضبط، والأسماء لوحدات مختلفة. يعني نسخة وحدة وحدة انحفظت بأسماء ثانية. افتحه وتأكد لأي وحدة يخص، وعلّمه واختر وحدته — ما بنحفظه إلا إذا علّمته.
                </Text>
              )}
              {!!it.note && <Text style={[styles.warn, { color: colors.textMuted }]}>{it.note}</Text>}

              {d && (
                <View style={[styles.deedBox, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.deedLine, { color: colors.text }]}>
                    {[d.buildingName, d.propertyNo && `رقم ${d.propertyNo}`, d.floorNo && `الدور ${d.floorNo}`].filter(Boolean).join(' · ')}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {[d.totalArea && `${d.totalArea} م²`, d.parking && `موقف ${d.parking}`, d.mortgaged === false ? 'غير مرهون' : d.mortgaged ? 'مرهون' : null, d.issueDate && `صادر ${d.issueDate}`].filter(Boolean).join(' · ')}
                  </Text>
                  {d.owners.map((o, i) => (
                    <Text key={i} style={[styles.meta, { color: colors.textSecondary }]}>
                      {o.ownerId ? '● ' : '○ '}{o.name} — {shareLabel(o.sharePercent)}
                    </Text>
                  ))}
                  {d.owners.some(o => !o.ownerId) && (
                    <Text style={[styles.meta, { color: colors.textMuted }]}>○ = ما لقينا له ملف مالك في النظام (ينحفظ الاسم بس)</Text>
                  )}
                </View>
              )}

              {it.status === 'ready' && !it.saved && (
                <FormSelect label="الوحدة" value={it.unitId} options={unitOptions} onSelect={v => patch(it.key, { unitId: v })} placeholder="اختر الوحدة..." />
              )}
            </View>
          );
        })}
      </ScrollView>

      {items.length > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TouchableOpacity disabled={!ready.length || saving || busy} onPress={saveAll}
            style={[styles.saveBtn, { backgroundColor: ready.length && !busy ? colors.primary : colors.border }]}>
            {saving ? <ActivityIndicator color={colors.textInverse} />
              : <Text style={styles.saveText}>{busy ? 'ننتظر القراءة تخلص...' : `حفظ ${ready.length} ${ready.length === 1 ? 'ملف' : 'ملفات'}`}</Text>}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 40, width: '100%', maxWidth: 760, alignSelf: 'center' },
  steps: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepText: { flex: 1, fontSize: 13, textAlign: 'right' },
  drop: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 14, padding: 22, alignItems: 'center', gap: 6 },
  dropText: { fontSize: 16, fontWeight: '600' },
  dropSub: { fontSize: 12 },
  done: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'flex-start' },
  doneText: { flex: 1, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fname: { fontSize: 14, fontWeight: '600', textAlign: 'right' },
  meta: { fontSize: 12, textAlign: 'right', marginTop: 2 },
  warn: { fontSize: 12, lineHeight: 18, textAlign: 'right' },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  deedBox: { borderRadius: 10, padding: 10, gap: 2 },
  deedLine: { fontSize: 13, fontWeight: '600', textAlign: 'right' },
  footer: { padding: 12, borderTopWidth: 1 },
  saveBtn: { height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
