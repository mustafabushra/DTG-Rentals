/**
 * بيانات الملكية لوحدة: سند الملكية + الملاك بحصصهم.
 * يمكن تعبئتها بقراءة ملف السند (PDF أو صورة) ثم مراجعتها قبل الحفظ.
 */
import { Toggle } from '../../components/ui/Toggle';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormDatePicker } from '../../components/forms/FormDatePicker';
import { FormContainer } from '../../components/ui/FormContainer';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useScreenSize } from '../../hooks/useScreenSize';
import { toPersistentUri } from '../../lib/imageUtils';
import { scanDeedFile } from '../../lib/deedScanClient';
import type { DeedOwner, TitleDeed } from '../../domain/models';
import {
  normalizeDeed, computeShares, sharesTotal, validateDeed, deedForStorage, parseNumber, shareLabel,
} from '../../domain/services/DeedService';

type Text_ = string;
interface OwnerRow { name: Text_; ownerNumber: Text_; shareArea: Text_; sharePercent: Text_; ownerId: Text_ }
type Form = Record<
  'issuer' | 'certificateNo' | 'issueDate' | 'mortgage' | 'mortgageNote' | 'propertyType' | 'community' | 'plotNo'
  | 'municipalityNo' | 'buildingNo' | 'buildingName' | 'propertyNo' | 'floorNo' | 'parking' | 'suiteArea'
  | 'balconyArea' | 'commonArea' | 'totalArea' | 'totalAreaSqFt' | 'transferNote', string>;

const s = (v: unknown) => (v == null ? '' : String(v));

function toForm(d?: TitleDeed): { form: Form; owners: OwnerRow[] } {
  return {
    form: {
      issuer: s(d?.issuer), certificateNo: s(d?.certificateNo), issueDate: s(d?.issueDate),
      mortgage: d?.mortgaged == null ? '' : d.mortgaged ? 'yes' : 'no', mortgageNote: s(d?.mortgageNote),
      propertyType: s(d?.propertyType), community: s(d?.community), plotNo: s(d?.plotNo),
      municipalityNo: s(d?.municipalityNo), buildingNo: s(d?.buildingNo), buildingName: s(d?.buildingName),
      propertyNo: s(d?.propertyNo), floorNo: s(d?.floorNo), parking: s(d?.parking),
      suiteArea: s(d?.suiteArea), balconyArea: s(d?.balconyArea), commonArea: s(d?.commonArea),
      totalArea: s(d?.totalArea), totalAreaSqFt: s(d?.totalAreaSqFt), transferNote: s(d?.transferNote),
    },
    owners: (d?.owners?.length ? d.owners : [{ name: '', sharePercent: 100 } as DeedOwner]).map(o => ({
      name: s(o.name), ownerNumber: s(o.ownerNumber), shareArea: s(o.shareArea),
      sharePercent: o.sharePercent ? String(o.sharePercent) : '', ownerId: s(o.ownerId),
    })),
  };
}

function fromForm(f: Form, rows: OwnerRow[]): TitleDeed {
  const t = (v: string) => (v.trim() ? v.trim() : null);
  const owners: DeedOwner[] = rows.map(r => ({
    name: r.name.trim(),
    ownerNumber: t(r.ownerNumber),
    shareArea: parseNumber(r.shareArea),
    sharePercent: parseNumber(r.sharePercent) ?? 0,
    ownerId: t(r.ownerId),
  }));
  return {
    issuer: t(f.issuer), certificateNo: t(f.certificateNo), issueDate: t(f.issueDate),
    mortgaged: f.mortgage === '' ? null : f.mortgage === 'yes', mortgageNote: t(f.mortgageNote),
    propertyType: t(f.propertyType), community: t(f.community), plotNo: t(f.plotNo),
    municipalityNo: t(f.municipalityNo), buildingNo: t(f.buildingNo), buildingName: t(f.buildingName),
    propertyNo: t(f.propertyNo), floorNo: t(f.floorNo), parking: t(f.parking),
    suiteArea: parseNumber(f.suiteArea), balconyArea: parseNumber(f.balconyArea), commonArea: parseNumber(f.commonArea),
    totalArea: parseNumber(f.totalArea), totalAreaSqFt: parseNumber(f.totalAreaSqFt), transferNote: t(f.transferNote),
    owners: computeShares(owners),
  };
}

export default function EditDeedScreen() {
  const { unitId } = useLocalSearchParams<{ unitId: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { isWide } = useScreenSize();
  const { units, properties, owners: systemOwners, updateUnit, addAttachment, canWrite, currentUser } = useApp();

  const unit = units.find(u => u.id === unitId);
  const property = properties.find(p => p.id === unit?.propertyId);
  const initial = useMemo(() => toForm(unit?.titleDeed), [unit?.id]);
  const [form, setForm] = useState<Form>(initial.form);
  const [rows, setRows] = useState<OwnerRow[]>(initial.owners);
  // عند فتح الصفحة مباشرة قد تصل بيانات الوحدة بعد أول رسم: نملأ النموذج مرة واحدة حين تصل
  const hydrated = useRef(!!unit);
  useEffect(() => {
    if (hydrated.current || !unit) return;
    hydrated.current = true;
    const init = toForm(unit.titleDeed);
    setForm(init.form);
    setRows(init.owners);
  }, [unit]);
  const [syncUnit, setSyncUnit] = useState(true);
  const [file, setFile] = useState<{ name: string; dataUri: string; mimeType: string; size?: number } | null>(null);
  const [attachFile, setAttachFile] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const deed = useMemo(() => fromForm(form, rows), [form, rows]);
  const { warnings } = validateDeed(deed);
  const total = sharesTotal(deed.owners);
  const ownerOptions = [{ label: 'غير مربوط بمالك في النظام', value: '' }, ...systemOwners.map(o => ({ label: o.name, value: o.id }))];

  const set = (k: keyof Form) => (v: string) => { setForm(f => ({ ...f, [k]: v })); setErrors([]); };
  const setRow = (i: number, k: keyof OwnerRow) => (v: string) => {
    setRows(r => r.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
    setErrors([]);
  };

  const pickAndScan = async () => {
    setScanMsg(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    setScanning(true);
    try {
      const dataUri = await toPersistentUri(a.uri);
      const mime = a.mimeType ?? (dataUri.match(/^data:([^;]+);/)?.[1] ?? 'application/pdf');
      setFile({ name: a.name, dataUri, mimeType: mime, size: a.size });
      const base64 = dataUri.split(',')[1] ?? '';
      const r = await scanDeedFile(base64, mime);
      if (!r.ok) { setScanMsg({ tone: 'err', text: r.message }); return; }
      const d = normalizeDeed(r.raw, systemOwners);
      const next = toForm(d);
      setForm(next.form);
      setRows(next.owners);
      const linked = d.owners.filter(o => o.ownerId).length;
      setScanMsg({
        tone: 'ok',
        text: `قُرئ السند: ${d.owners.length} ${d.owners.length === 1 ? 'مالك' : 'ملاك'}${linked ? `، رُبط ${linked} منهم بسجلات الملاك` : ''}. راجع البيانات ثم احفظ.`,
      });
      if (d.propertyNo && unit?.number && String(d.propertyNo).trim() !== String(unit.number).trim()) {
        setScanMsg({ tone: 'err', text: `تنبيه: رقم العقار في السند ${d.propertyNo} لا يطابق رقم الوحدة ${unit.number}. تأكد أنك اخترت السند الصحيح.` });
      }
    } catch (e: any) {
      setScanMsg({ tone: 'err', text: 'تعذّر قراءة الملف. جرّب ملفاً آخر أو أدخل البيانات يدوياً.' });
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (saving || !unit) return;
    const { errors: errs } = validateDeed(deed);
    if (errs.length) { setErrors(errs); return; }
    setSaving(true);
    const stamped: TitleDeed = { ...deed, updatedAt: new Date().toISOString(), updatedBy: currentUser.name };
    const patch: any = { titleDeed: deedForStorage(stamped) };
    if (syncUnit) {
      if (deed.totalArea) patch.area = deed.totalArea;
      const fl = parseNumber(deed.floorNo ?? '');
      if (fl != null) patch.floor = fl;
    }
    updateUnit(unit.id, patch);
    let attachErr: string | null = null;
    if (file && attachFile) {
      try {
        await addAttachment({
          entityType: 'unit', entityId: unit.id,
          name: `سند ملكية — وحدة ${unit.number}`,
          uri: file.dataUri, mimeType: file.mimeType, size: file.size,
          category: 'property', uploadedBy: currentUser.name,
        });
      } catch (e: any) {
        attachErr = e?.message ?? 'تعذّر إرفاق الملف.';
      }
    }
    setSaving(false);
    if (attachErr) {
      const msg = `حُفظت بيانات الملكية، لكن لم يُرفق الملف: ${attachErr}`;
      Platform.OS === 'web' ? window.alert(msg) : null;
    }
    router.back();
  };

  if (!unit) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (!canWrite) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>ليست لديك صلاحية تعديل بيانات الملكية.</Text>
      </View>
    );
  }

  const grid = isWide ? styles.grid2 : undefined;
  const cell = isWide ? styles.cell2 : undefined;
  // دالة لا مكوّن: تعريف مكوّن داخل الـ render يعيد تركيب الحقول مع كل حرف فيضيع التركيز
  const section = (title: string, children: React.ReactNode) => (
    <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={grid}>{children}</View>
    </View>
  );
  const F = (label: string, k: keyof Form, opts: { placeholder?: string; numeric?: boolean } = {}) => (
    <View style={cell} key={k}>
      <FormInput label={label} value={form[k]} onChangeText={set(k)} placeholder={opts.placeholder ?? ''} keyboardType={opts.numeric ? 'decimal-pad' : 'default'} />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} accessibilityLabel="إغلاق">
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>بيانات الملكية</Text>
          <Text style={[styles.headerSub, { color: colors.textMuted }]}>{property?.name ? `${property.name}، ` : ''}وحدة {unit.number}</Text>
        </View>
        <TouchableOpacity onPress={save} disabled={saving} style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
          {saving ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Text style={[styles.saveTxt, { color: colors.textInverse }]}>حفظ</Text>}
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* قراءة من الملف */}
        <View style={[styles.scanBox, { backgroundColor: colors.primarySubtle, borderColor: colors.border }]}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.scanTitle, { color: colors.text }]}>اقرأ البيانات من ملف السند</Text>
            <Text style={[styles.scanSub, { color: colors.textSecondary }]}>
              {file ? file.name : 'PDF أو صورة. يُرسل الملف إلى Google Gemini لقراءته، ثم تراجع الحقول قبل الحفظ.'}
            </Text>
          </View>
          <TouchableOpacity onPress={pickAndScan} disabled={scanning} style={[styles.scanBtn, { backgroundColor: colors.primary, opacity: scanning ? 0.6 : 1 }]}>
            {scanning ? <ActivityIndicator size="small" color={colors.textInverse} /> : <Ionicons name="document-attach-outline" size={18} color={colors.textInverse} />}
            <Text style={{ color: colors.textInverse, fontSize: 14, fontWeight: '500' }}>{scanning ? 'جارٍ القراءة...' : 'اختر الملف'}</Text>
          </TouchableOpacity>
        </View>
        {scanMsg && (
          <View style={[styles.note, { backgroundColor: scanMsg.tone === 'ok' ? colors.successSubtle : colors.warningSubtle }]}>
            <Ionicons name={scanMsg.tone === 'ok' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={18} color={scanMsg.tone === 'ok' ? colors.success : colors.warning} />
            <Text style={[styles.noteTxt, { color: scanMsg.tone === 'ok' ? colors.success : colors.warning }]}>{scanMsg.text}</Text>
          </View>
        )}

        {/* الملاك */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.ownersHead}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>الملاك وحصصهم</Text>
            <Text style={[styles.total, { color: Math.abs(total - 100) <= 0.1 ? colors.success : colors.danger }]}>المجموع {total}%</Text>
          </View>
          <Text style={[styles.hint, { color: colors.textMuted }]}>اكتب الحصة بالمتر المربع كما في السند وتُحسب النسبة تلقائياً، أو اكتب النسبة مباشرة.</Text>
          {rows.map((r, i) => {
            const pct = deed.owners[i]?.sharePercent ?? 0;
            return (
              <View key={i} style={[styles.ownerRow, { borderColor: colors.border }]}>
                <View style={styles.ownerTop}>
                  <Text style={[styles.ownerIdx, { color: colors.textMuted }]}>المالك {i + 1}{pct ? `، ${shareLabel(pct)}` : ''}</Text>
                  {rows.length > 1 && (
                    <TouchableOpacity onPress={() => setRows(x => x.filter((_, j) => j !== i))} hitSlop={8} accessibilityLabel="حذف المالك">
                      <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={grid}>
                  <View style={cell}><FormInput label="الاسم كما في السند" value={r.name} onChangeText={setRow(i, 'name')} placeholder="الاسم الكامل" required /></View>
                  <View style={cell}><FormSelect label="مربوط بسجل مالك" value={r.ownerId} options={ownerOptions} onSelect={setRow(i, 'ownerId')} /></View>
                  <View style={cell}><FormInput label="الحصة (م²)" value={r.shareArea} onChangeText={setRow(i, 'shareArea')} placeholder="مثال: 37.16" keyboardType="decimal-pad" /></View>
                  <View style={cell}><FormInput label="أو النسبة %" value={r.shareArea ? String(pct) : r.sharePercent} onChangeText={setRow(i, 'sharePercent')} placeholder="مثال: 50" keyboardType="decimal-pad" editable={!r.shareArea} /></View>
                  <View style={cell}><FormInput label="رقم المالك لدى الجهة" value={r.ownerNumber} onChangeText={setRow(i, 'ownerNumber')} placeholder="اختياري" /></View>
                </View>
              </View>
            );
          })}
          <TouchableOpacity onPress={() => setRows(x => [...x, { name: '', ownerNumber: '', shareArea: '', sharePercent: '', ownerId: '' }])} style={[styles.addOwner, { borderColor: colors.borderStrong }]}>
            <Ionicons name="add" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '500' }}>إضافة مالك</Text>
          </TouchableOpacity>
        </View>

        {section("بيانات السند", <>
          {F('الجهة المصدرة', 'issuer', { placeholder: 'دائرة الأراضي والأملاك - دبي' })}
          {F('رقم الشهادة / الصك', 'certificateNo')}
          <View style={cell}><FormDatePicker label="تاريخ الإصدار" value={form.issueDate} onChange={set('issueDate')} /></View>
          <View style={cell}><FormSelect label="حالة الرهن" value={form.mortgage} options={[{ label: 'غير محدد', value: '' }, { label: 'غير مرهون', value: 'no' }, { label: 'مرهون', value: 'yes' }]} onSelect={set('mortgage')} /></View>
          {form.mortgage === 'yes' && F('تفاصيل الرهن', 'mortgageNote', { placeholder: 'الجهة المرتهنة' })}
          {F('سبب انتقال الملكية', 'transferNote', { placeholder: 'مثال: إرث بموجب أمر محكمة رقم...' })}
        </>)}

        {section("الموقع", <>
          {F('نوع العقار', 'propertyType', { placeholder: 'شقة سكنية' })}
          {F('المنطقة', 'community')}
          {F('اسم المبنى', 'buildingName')}
          {F('رقم المبنى', 'buildingNo')}
          {F('رقم الأرض', 'plotNo')}
          {F('رقم البلدية', 'municipalityNo')}
          {F('رقم العقار', 'propertyNo')}
          {F('الطابق', 'floorNo', { numeric: true })}
          {F('الموقف', 'parking')}
        </>)}

        {section("المساحات (م²)", <>
          {F('المساحة الداخلية', 'suiteArea', { numeric: true })}
          {F('البلكونة', 'balconyArea', { numeric: true })}
          {F('المساحة المشتركة', 'commonArea', { numeric: true })}
          {F('المساحة الكلية', 'totalArea', { numeric: true })}
          {F('المساحة بالقدم المربع', 'totalAreaSqFt', { numeric: true })}
        </>)}

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}>
          <View style={styles.switchRow}>
            <Text style={[styles.switchTxt, { color: colors.text }]}>تحديث مساحة الوحدة وطابقها من السند</Text>
            <Toggle value={syncUnit} onValueChange={setSyncUnit} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
          </View>
          {file && (
            <View style={styles.switchRow}>
              <Text style={[styles.switchTxt, { color: colors.text }]}>إرفاق ملف السند بمرفقات الوحدة</Text>
              <Toggle value={attachFile} onValueChange={setAttachFile} trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFF" />
            </View>
          )}
        </View>

        {[...errors.map(t => ({ t, e: true })), ...warnings.map(t => ({ t, e: false }))].map(({ t, e }) => (
          <View key={t} style={[styles.note, { backgroundColor: e ? colors.dangerSubtle : colors.warningSubtle }]}>
            <Ionicons name="alert-circle-outline" size={18} color={e ? colors.danger : colors.warning} />
            <Text style={[styles.noteTxt, { color: e ? colors.danger : colors.warning }]}>{t}</Text>
          </View>
        ))}
      </ScrollView></FormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, paddingHorizontal: Theme.spacing.base, borderBottomWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: '600', textAlign: 'right' },
  headerSub: { fontSize: 12, textAlign: 'right' },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  saveBtn: { paddingHorizontal: 18, minHeight: 38, minWidth: 70, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  saveTxt: { fontSize: 15, fontWeight: '500' },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.md, paddingBottom: 60 },
  scanBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 16, flexWrap: 'wrap' },
  scanTitle: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  scanSub: { fontSize: 13, textAlign: 'right', lineHeight: 20 },
  scanBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, paddingHorizontal: 16, minHeight: 42 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderRadius: 8, padding: 12 },
  noteTxt: { flex: 1, fontSize: 13, lineHeight: 20, textAlign: 'right' },
  section: { borderWidth: 1, borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', textAlign: 'right', marginBottom: 4 },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell2: { flexBasis: '48%', flexGrow: 1 },
  ownersHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  total: { fontSize: 14, fontWeight: '600' },
  hint: { fontSize: 12, textAlign: 'right', lineHeight: 18 },
  ownerRow: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 10 },
  ownerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ownerIdx: { fontSize: 13, fontWeight: '500' },
  addOwner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderRadius: 10, minHeight: 44 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  switchTxt: { flex: 1, fontSize: 14, textAlign: 'right' },
});
