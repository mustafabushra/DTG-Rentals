import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as DocumentPicker from 'expo-document-picker';
import { read, utils } from 'xlsx';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { useAppTheme } from '../hooks/useAppTheme';
import { Property, PropertyType } from '../data/mockData';
import { ConfirmModal } from '../components/ui/Modal';
import { sanitizeText, sanitizeNumber } from '../utils/sanitize';

// ─── الأنواع المقبولة ─────────────────────────────────────────────────────────
const TYPE_MAP: Record<string, PropertyType> = {
  شقة: 'apartment', apartment: 'apartment',
  فيلا: 'villa',    villa: 'villa',
  مبنى: 'building', building: 'building',
  برج: 'tower',     tower: 'tower',
  مكتب: 'office',   office: 'office',
  محل: 'shop',      shop: 'shop',
  أرض: 'land',      land: 'land',
};

const TYPE_LABEL: Record<PropertyType, string> = {
  apartment: 'شقة', villa: 'فيلا', building: 'مبنى',
  tower: 'برج', office: 'مكتب', shop: 'محل', land: 'أرض',
};

interface RowData {
  name: string;
  type: PropertyType | null;
  location: string;
  area: string;
  deedNumber: string;
  ownerName: string;
  ownerId: string | null;
  error: string;
}

// ─── تحميل النموذج ────────────────────────────────────────────────────────────
function buildTemplate(): string {
  return [
    'اسم العقار,نوع العقار,الموقع,المساحة (م²),رقم الصك,المالك',
    'برج الرياض,برج,الرياض - حي العليا,1200,1234567890,محمد العمري',
    'فيلا النخيل,فيلا,جدة - حي الروضة,450,,أحمد الغامدي',
  ].join('\n');
}

export default function BulkImportPropertiesScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { owners, addProperty } = useApp();

  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [imported, setImported] = useState(false);

  const validRows   = rows.filter(r => !r.error);
  const invalidRows = rows.filter(r => r.error);

  // ─── تنظيف وتحقق من صف ─────────────────────────────────────────────────────
  const str = (v: unknown): string => (v == null ? '' : String(v));

  const parseRow = (raw: Record<string, unknown>): RowData => {
    const name       = sanitizeText(str(raw['اسم العقار'] ?? raw['name']));
    const typeRaw    = str(raw['نوع العقار'] ?? raw['type']).trim();
    const location   = sanitizeText(str(raw['الموقع'] ?? raw['location']));
    const area       = str(raw['المساحة (م²)'] ?? raw['المساحة'] ?? raw['area']).trim();
    const deedNumber = str(raw['رقم الصك'] ?? raw['deed']).trim();
    const ownerName  = str(raw['المالك'] ?? raw['owner']).trim();

    const type   = TYPE_MAP[typeRaw] ?? null;
    const owner  = owners.find(o => o.name.trim() === ownerName);
    let error    = '';

    if (!name)      error = 'اسم العقار مطلوب';
    else if (!type) error = `نوع غير معروف: "${typeRaw}"`;
    else if (!location) error = 'الموقع مطلوب';
    else if (!ownerName) error = 'المالك مطلوب';
    else if (!owner) error = `المالك غير موجود: "${ownerName}"`;

    return { name, type, location, area, deedNumber, ownerName, ownerId: owner?.id ?? null, error };
  };

  // ─── تحليل ArrayBuffer → صفوف ───────────────────────────────────────────────
  const parseBuffer = (buffer: ArrayBuffer, name: string) => {
    const wb  = read(buffer, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const raw = utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    setFileName(name);
    setRows(raw.map(parseRow));
    setLoading(false);
  };

  // ─── قراءة الملف ────────────────────────────────────────────────────────────
  const pickFile = async () => {
    setLoading(true);
    setRows([]);
    setFileName('');
    setImported(false);

    if (Platform.OS === 'web') {
      // على الويب نستخدم input[type=file] مباشرةً
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx,.xls,.csv';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) { setLoading(false); return; }
        const buffer = await file.arrayBuffer();
        parseBuffer(buffer, file.name);
      };
      input.oncancel = () => setLoading(false);
      input.click();
      return;
    }

    // على الجوال نستخدم expo-document-picker + fetch
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'text/plain',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) { setLoading(false); return; }
      const asset = result.assets[0];
      const resp  = await fetch(asset.uri);
      const buffer = await resp.arrayBuffer();
      parseBuffer(buffer, asset.name);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  // ─── تنزيل النموذج (ويب فقط) ────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv  = buildTemplate();
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'نموذج_استيراد_عقارات.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ─── الاستيراد ───────────────────────────────────────────────────────────────
  const doImport = () => {
    validRows.forEach((r, i) => {
      const property: Property = {
        id:          `bulk_${Date.now()}_${i}`,
        name:        r.name,
        type:        r.type!,
        location:    r.location,
        floors:      1,
        totalUnits:  0,
        ownerId:     r.ownerId!,
        status:      'active',
        description: '',
        deedNumber:  r.deedNumber || undefined,
        area:        r.area ? Number(r.area) : undefined,
        createdAt:   new Date().toISOString().split('T')[0],
      };
      addProperty(property);
    });
    setShowConfirm(false);
    setImported(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>استيراد عقارات مجمّع</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* إرشادات */}
        <View style={[styles.infoCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.infoTitle, { color: colors.primary }]}>تعليمات الاستيراد</Text>
            <Text style={[styles.infoText, { color: colors.text }]}>
              {'الأعمدة المطلوبة: اسم العقار، نوع العقار، الموقع، المالك\nالأعمدة الاختيارية: المساحة (م²)، رقم الصك\nأنواع مقبولة: شقة، فيلا، مبنى، برج، مكتب، محل، أرض\nاسم المالك يجب أن يطابق اسمه في التطبيق'}
            </Text>
          </View>
        </View>

        {/* تنزيل النموذج */}
        <TouchableOpacity
          style={[styles.templateBtn, { borderColor: colors.primary, backgroundColor: colors.primary + '08' }]}
          onPress={downloadTemplate}
          activeOpacity={0.8}
        >
          <Ionicons name="download-outline" size={18} color={colors.primary} />
          <Text style={[styles.templateText, { color: colors.primary }]}>تنزيل نموذج CSV</Text>
        </TouchableOpacity>

        {/* زر اختيار الملف */}
        <TouchableOpacity
          style={[styles.pickBtn, { backgroundColor: colors.primary }]}
          onPress={pickFile}
          activeOpacity={0.85}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#FFF" />
            : <><Ionicons name="cloud-upload-outline" size={20} color="#FFF" />
               <Text style={styles.pickText}>اختر ملف Excel أو CSV</Text></>
          }
        </TouchableOpacity>

        {fileName ? (
          <Text style={[styles.fileName, { color: colors.textMuted }]}>
            <Ionicons name="document-outline" size={13} /> {fileName}
          </Text>
        ) : null}

        {/* نتائج المراجعة */}
        {rows.length > 0 && (
          <>
            <View style={styles.summaryRow}>
              <View style={[styles.badge, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                <Text style={[styles.badgeText, { color: colors.success }]}>{validRows.length} صالح</Text>
              </View>
              {invalidRows.length > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.danger + '20' }]}>
                  <Ionicons name="close-circle" size={14} color={colors.danger} />
                  <Text style={[styles.badgeText, { color: colors.danger }]}>{invalidRows.length} خطأ</Text>
                </View>
              )}
            </View>

            {/* جدول المراجعة */}
            <View style={[styles.table, { borderColor: colors.border }]}>
              {/* رأس الجدول */}
              <View style={[styles.tableRow, styles.tableHead, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.th, { color: colors.text, flex: 2 }]}>الاسم</Text>
                <Text style={[styles.th, { color: colors.text }]}>النوع</Text>
                <Text style={[styles.th, { color: colors.text }]}>المالك</Text>
                <Text style={[styles.th, { color: colors.text }]}>الحالة</Text>
              </View>

              {rows.map((r, i) => (
                <View
                  key={i}
                  style={[
                    styles.tableRow,
                    { borderTopColor: colors.border, borderTopWidth: i > 0 ? 1 : 0 },
                    r.error ? { backgroundColor: colors.danger + '08' } : {},
                  ]}
                >
                  <Text style={[styles.td, { color: colors.text, flex: 2 }]} numberOfLines={1}>{r.name || '—'}</Text>
                  <Text style={[styles.td, { color: colors.text }]} numberOfLines={1}>
                    {r.type ? TYPE_LABEL[r.type] : '—'}
                  </Text>
                  <Text style={[styles.td, { color: colors.text }]} numberOfLines={1}>{r.ownerName || '—'}</Text>
                  {r.error
                    ? <View style={styles.errorCell}>
                        <Ionicons name="warning-outline" size={13} color={colors.danger} />
                        <Text style={[styles.errorText, { color: colors.danger }]} numberOfLines={2}>{r.error}</Text>
                      </View>
                    : <Ionicons name="checkmark-circle" size={16} color={colors.success} style={{ flex: 1, textAlign: 'center' }} />
                  }
                </View>
              ))}
            </View>

            {/* زر الاستيراد */}
            {validRows.length > 0 && !imported && (
              <TouchableOpacity
                style={[styles.importBtn, { backgroundColor: colors.success }]}
                onPress={() => setShowConfirm(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="checkmark-done-outline" size={20} color="#FFF" />
                <Text style={styles.importText}>استيراد {validRows.length} عقار</Text>
              </TouchableOpacity>
            )}

            {imported && (
              <View style={[styles.successBox, { backgroundColor: colors.success + '15', borderColor: colors.success + '40' }]}>
                <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                <Text style={[styles.successText, { color: colors.success }]}>
                  تم استيراد {validRows.length} عقار بنجاح
                </Text>
                <TouchableOpacity onPress={() => router.back()}>
                  <Text style={[styles.goBack, { color: colors.primary }]}>العودة للعقارات</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <ConfirmModal
        visible={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={doImport}
        title="تأكيد الاستيراد"
        message={`سيتم إضافة ${validRows.length} عقار جديد. البيانات الموجودة لن تتأثر.`}
        confirmLabel="استيراد الآن"
        variant="warning"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 14, paddingHorizontal: Theme.spacing.base,
  },
  headerTitle: { color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  backBtn: { padding: 4 },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },

  infoCard: { flexDirection: 'row', gap: 10, padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1 },
  infoTitle: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold },
  infoText: { fontSize: Theme.fontSize.sm, lineHeight: 22 },

  templateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 10, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  templateText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  pickBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: Theme.radius.lg,
  },
  pickText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  fileName: { textAlign: 'center', fontSize: Theme.fontSize.sm },

  summaryRow: { flexDirection: 'row', gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Theme.radius.full },
  badgeText: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold },

  table: { borderRadius: Theme.radius.lg, borderWidth: 1, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, gap: 6 },
  tableHead: { paddingVertical: 10 },
  th: { flex: 1, fontSize: 11, fontWeight: Theme.fontWeight.bold, textAlign: 'center' },
  td: { flex: 1, fontSize: 11, textAlign: 'center' },
  errorCell: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 3 },
  errorText: { fontSize: 10, flex: 1 },

  importBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 16, borderRadius: Theme.radius.lg,
  },
  importText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },

  successBox: {
    alignItems: 'center', gap: 10, padding: Theme.spacing.lg,
    borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  successText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  goBack: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.semibold, textDecorationLine: 'underline' },
});
