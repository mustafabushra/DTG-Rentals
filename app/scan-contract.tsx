/**
 * مسح عقد من صورة — القراءة تقترح، وأنت تؤكّد.
 *
 * لا تُحفظ قيمة بلا عين بشرية: خطأ قراءة صفر واحد يضاعف الإيجار عشر مرات.
 * كل حقل قابل للتعديل، وما يحتاج انتباهاً يُعلَّم: المانع يحجب الحفظ والتنبيه يُنبّه.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { AppHeader } from '../components/ui/AppHeader';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { FormContainer } from '../components/ui/FormContainer';
import { AlertModal } from '../components/ui/Modal';
import { useAppTheme } from '../hooks/useAppTheme';
import { Contract } from '../data/mockData';
import { isScanConfigured, scanContractImage } from '../lib/contractScanClient';
import {
  buildDraft, isReadyToSave,
  type RawExtraction, type ExtractionResult,
} from '../domain/services/ContractExtractionService';

export default function ScanContractScreen() {
  const { colors } = useAppTheme();
  const { tenants, units, properties, addContract, canWrite } = useApp();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [busy, setBusy]         = useState(false);
  const [raw, setRaw]           = useState<RawExtraction | null>(null);
  const [edits, setEdits]       = useState<Record<string, string>>({});
  const [alert, setAlert]       = useState<{ title: string; message: string; variant: 'info' | 'warning' } | null>(null);

  const configured = isScanConfigured();

  // نتيجة القراءة بعد تطبيق تعديلاتك عليها
  const result: ExtractionResult | null = useMemo(() => {
    if (!raw) return null;
    const merged: RawExtraction = { ...raw };
    for (const [k, v] of Object.entries(edits)) {
      (merged as Record<string, unknown>)[k] = v === '' ? null : v;
    }
    return buildDraft(merged, {
      tenants: tenants.map(t => ({ id: t.id, name: t.name, nationalId: t.nationalId, phone: t.phone })),
      units:   units.map(u => ({ id: u.id, number: u.number, propertyId: u.propertyId })),
      properties: properties.map(p => ({ id: p.id, name: p.name })),
    });
  }, [raw, edits, tenants, units, properties]);

  const blocking = result?.issues.filter(i => i.level === 'blocking') ?? [];
  const warnings = result?.issues.filter(i => i.level === 'warning') ?? [];

  const pick = async (from: 'camera' | 'library') => {
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setAlert({ title: 'الإذن مرفوض', message: 'يحتاج المسح إذن الوصول للكاميرا أو الصور.', variant: 'warning' });
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,            // يقلّل الحجم كثيراً بلا أثر محسوس على قراءة النص
      base64: true,
      allowsEditing: false,
    };
    const res = from === 'camera'
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    if (!asset.base64) {
      setAlert({ title: 'تعذّر قراءة الصورة', message: 'أعد المحاولة بصورة أخرى.', variant: 'warning' });
      return;
    }
    setImageUri(asset.uri);
    setRaw(null);
    setEdits({});
    setBusy(true);
    const scan = await scanContractImage(asset.base64, asset.mimeType ?? 'image/jpeg');
    setBusy(false);
    if (scan.ok) setRaw(scan.extraction);
    else setAlert({ title: 'تعذّرت القراءة', message: scan.message, variant: 'warning' });
  };

  const edit = (key: string) => (val: string) => setEdits(e => ({ ...e, [key]: val }));
  const valueOf = (key: keyof RawExtraction) =>
    edits[key] !== undefined ? edits[key] : String(raw?.[key] ?? '');

  const handleSave = () => {
    if (!result || !isReadyToSave(result) || !canWrite) return;
    const d = result.draft;
    if (!d.tenantId || !d.unitId || !d.startDate || !d.endDate || !d.annualValue) return;

    const contract: Contract = {
      id: `ct_scan_${Date.now()}`,
      contractNumber: d.contractNumber || `CNT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
      unitId: d.unitId,
      tenantId: d.tenantId,
      startDate: d.startDate,
      endDate: d.endDate,
      annualValue: d.annualValue,
      installmentsCount: d.installmentsCount ?? 1,
      status: 'active',
      ...(d.currency ? { currency: d.currency } : {}),
      createdAt: new Date().toISOString(),
      notes: 'أُدخل بقراءة صورة العقد ومراجعة بشرية',
    };
    addContract(contract);
    setAlert({
      title: 'تم الحفظ',
      message: `أُضيف العقد ${contract.contractNumber} وجدول أقساطه.`,
      variant: 'info',
    });
  };

  const closeAlert = () => {
    const done = alert?.variant === 'info';
    setAlert(null);
    if (done) router.replace('/(tabs)/contracts');
  };

  // ── الميزة غير مهيّأة: سبب واضح لا خطأ غامض ──
  if (!configured) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppHeader title="مسح عقد" />
        <View style={styles.center}>
          <Ionicons name="construct-outline" size={46} color={colors.textMuted} />
          <Text style={[styles.offTitle, { color: colors.text }]}>القراءة غير مهيّأة بعد</Text>
          <Text style={[styles.offBody, { color: colors.textSecondary }]}>
            قراءة العقود تحتاج نقطة نهاية تحمل مفتاح الخدمة، لأن المفتاح لا يجوز أن يكون
            داخل التطبيق. خطوات النشر في <Text style={styles.mono}>server/README.md</Text>،
            وبعدها اضبط <Text style={styles.mono}>EXPO_PUBLIC_CONTRACT_SCAN_URL</Text>.
          </Text>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border }]}
            onPress={() => router.replace('/add-contract')}
          >
            <Ionicons name="create-outline" size={17} color={colors.primary} />
            <Text style={[styles.secondaryText, { color: colors.primary }]}>إدخال العقد يدوياً</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tenantOptions = (result?.tenantCandidates.length
    ? result.tenantCandidates
    : tenants.map(t => ({ id: t.id, name: t.name }))
  ).map(t => ({ label: t.name, value: t.id }));

  const unitOptions = (result?.unitCandidates.length
    ? result.unitCandidates
    : units.map(u => ({
        id: u.id,
        label: `${properties.find(p => p.id === u.propertyId)?.name ?? 'عقار'} — وحدة ${u.number}`,
      }))
  ).map(u => ({ label: u.label, value: u.id }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title="مسح عقد" />

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        {/* ── اختيار الصورة ── */}
        {!raw && !busy && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>صوّر العقد أو اخترْ صورته</Text>
            <Text style={[styles.cardHint, { color: colors.textMuted }]}>
              صوّره مستوياً بإضاءة جيدة. تُقرأ البيانات وتُعرض لمراجعتك قبل الحفظ — لا يُحفظ شيء تلقائياً.
            </Text>
            <View style={styles.pickRow}>
              <TouchableOpacity
                style={[styles.pickBtn, { backgroundColor: colors.primary }]}
                onPress={() => pick('camera')}
              >
                <Ionicons name="camera-outline" size={19} color="#FFF" />
                <Text style={styles.pickText}>كاميرا</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickBtn, { backgroundColor: colors.inputBg, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => pick('library')}
              >
                <Ionicons name="images-outline" size={19} color={colors.primary} />
                <Text style={[styles.pickText, { color: colors.primary }]}>من الصور</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {busy && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, alignItems: 'center', gap: 12 }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.cardHint, { color: colors.textSecondary, textAlign: 'center' }]}>
              جارٍ قراءة العقد...
            </Text>
          </View>
        )}

        {imageUri && !busy && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
            <TouchableOpacity style={styles.retake} onPress={() => { setRaw(null); setImageUri(null); setEdits({}); }}>
              <Ionicons name="refresh-outline" size={15} color={colors.secondary} />
              <Text style={[styles.retakeText, { color: colors.secondary }]}>صورة أخرى</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── المراجعة ── */}
        {result && (
          <>
            {blocking.length > 0 && (
              <View style={[styles.issues, { backgroundColor: colors.danger + '12', borderColor: colors.danger + '55' }]}>
                <Text style={[styles.issuesTitle, { color: colors.danger }]}>
                  يحتاج تصحيحاً قبل الحفظ ({blocking.length})
                </Text>
                {blocking.map((i, n) => (
                  <Text key={n} style={[styles.issueLine, { color: colors.danger }]}>• {i.message}</Text>
                ))}
              </View>
            )}
            {warnings.length > 0 && (
              <View style={[styles.issues, { backgroundColor: colors.warningSubtle, borderColor: colors.warning }]}>
                <Text style={[styles.issuesTitle, { color: colors.warning }]}>راجِع بعناية</Text>
                {warnings.map((i, n) => (
                  <Text key={n} style={[styles.issueLine, { color: colors.warning }]}>• {i.message}</Text>
                ))}
              </View>
            )}

            <FormInput label="رقم العقد" value={valueOf('contractNumber')} onChangeText={edit('contractNumber')} icon="document-text-outline" />
            <FormSelect label="المستأجر" value={result.draft.tenantId ?? ''} options={tenantOptions}
                        onSelect={v => setEdits(e => ({ ...e, tenantNationalId: tenants.find(t => t.id === v)?.nationalId ?? '', tenantName: tenants.find(t => t.id === v)?.name ?? '' }))}
                        required placeholder="اختر المستأجر..." />
            <FormSelect label="الوحدة" value={result.draft.unitId ?? ''} options={unitOptions}
                        onSelect={v => {
                          const u = units.find(x => x.id === v);
                          setEdits(e => ({
                            ...e,
                            unitNumber: u?.number ?? '',
                            propertyName: properties.find(p => p.id === u?.propertyId)?.name ?? '',
                          }));
                        }}
                        required placeholder="اختر الوحدة..." />
            <FormDatePicker label="تاريخ البداية" value={result.draft.startDate ?? ''} onChange={edit('startDate')} required />
            <FormDatePicker label="تاريخ النهاية" value={result.draft.endDate ?? ''} onChange={edit('endDate')}
                            required minDate={result.draft.startDate} />
            <FormInput label="القيمة السنوية" value={valueOf('annualValue')} onChangeText={edit('annualValue')}
                       keyboardType="number-pad" required icon="cash-outline" />
            <FormSelect label="عدد الأقساط" value={String(result.draft.installmentsCount ?? '')}
                        options={['1', '2', '3', '4', '6', '12'].map(v => ({ label: v === '1' ? 'قسط واحد' : `${v} أقساط`, value: v }))}
                        onSelect={edit('installmentsCount')} required />

            <TouchableOpacity
              style={[styles.saveBtn, {
                backgroundColor: isReadyToSave(result) ? colors.success : colors.inputBg,
                borderColor: isReadyToSave(result) ? colors.success : colors.border,
              }]}
              onPress={handleSave}
              disabled={!isReadyToSave(result) || !canWrite}
            >
              <Ionicons name="checkmark-circle-outline" size={19}
                        color={isReadyToSave(result) ? '#FFF' : colors.textMuted} />
              <Text style={[styles.saveText, { color: isReadyToSave(result) ? '#FFF' : colors.textMuted }]}>
                {isReadyToSave(result) ? 'حفظ العقد' : 'أكمل الحقول المطلوبة'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView></FormContainer>

      <AlertModal visible={!!alert} onClose={closeAlert}
                  title={alert?.title ?? ''} message={alert?.message ?? ''}
                  variant={alert?.variant ?? 'info'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: Theme.spacing.xl },
  offTitle: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  offBody: { fontSize: Theme.fontSize.sm, textAlign: 'center', lineHeight: 22, maxWidth: 380 },
  mono: { fontFamily: 'monospace', fontSize: Theme.fontSize.xs },
  secondaryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 6,
    paddingVertical: 11, paddingHorizontal: 18, borderRadius: Theme.radius.full, borderWidth: 1,
  },
  secondaryText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  card: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 10 },
  cardTitle: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  cardHint: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
  pickRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pickBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 13, borderRadius: Theme.radius.md,
  },
  pickText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  preview: { width: '100%', height: 190, borderRadius: Theme.radius.md },
  retake: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 4 },
  retakeText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },
  issues: { padding: Theme.spacing.md, borderRadius: Theme.radius.md, borderWidth: 1, gap: 5 },
  issuesTitle: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right' },
  issueLine: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: Theme.radius.md, borderWidth: 1, marginTop: 4,
  },
  saveText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
});
