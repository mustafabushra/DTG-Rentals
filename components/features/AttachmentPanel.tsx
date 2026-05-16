/**
 * AttachmentPanel — Document management panel.
 * Supports: JPG, PNG, PDF — unlimited attachments.
 * Displays: file name, file type badge, upload date, size, category.
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import {
  lightColors, darkColors, spacing, fontSize, fontWeight, radius,
} from '../../constants/DesignTokens';
import { Modal }      from '../ui/Modal';
import { Button }     from '../ui/Button';
import { Input }      from '../ui/Input';
import { FileViewer } from './FileViewer';
import { useAttachments } from '../../features/attachments/useAttachments';
import { FileService }    from '../../domain/services/FileService';
import type { FileCategory, Attachment } from '../../domain/models';
import { useAppTheme } from '../../hooks/useAppTheme';

// ─── Inline Date Picker ───────────────────────────────────────────────────────

interface DatePickerProps {
  value: string;           // 'YYYY-MM-DD' or ''
  onChange: (v: string) => void;
  colors: Record<string, string>;
}

function InlineDatePicker({ value, onChange, colors }: DatePickerProps) {
  const today = new Date();
  const parsed = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);

  const [y, setY] = useState(parsed ? parsed.getFullYear()  : today.getFullYear());
  const [m, setM] = useState(parsed ? parsed.getMonth() + 1 : today.getMonth() + 1);
  const [d, setD] = useState(parsed ? parsed.getDate()      : today.getDate());

  const MONTHS = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                  'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

  const daysInMonth = new Date(y, m, 0).getDate();
  const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

  const apply = (ny: number, nm: number, nd: number) => {
    const safeD = clamp(nd, 1, new Date(ny, nm, 0).getDate());
    const pad = (n: number) => String(n).padStart(2, '0');
    onChange(`${ny}-${pad(nm)}-${pad(safeD)}`);
    setY(ny); setM(nm); setD(safeD);
  };

  const clear = () => { onChange(''); setOpen(false); };

  const displayLabel = value
    ? `${d} ${MONTHS[m - 1]} ${y}`
    : 'اختر تاريخ انتهاء الصلاحية';

  return (
    <View>
      {/* Trigger row */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        style={[dpStyles.trigger, {
          backgroundColor: colors.card,
          borderColor: open ? colors.primary : (value ? colors.primary : colors.border),
          borderWidth: open || value ? 2 : 1,
        }]}
        activeOpacity={0.8}
      >
        <View style={[dpStyles.calIcon, { backgroundColor: value ? colors.primary : colors.primarySubtle }]}>
          <Ionicons name="calendar-outline" size={18} color={value ? '#FFF' : colors.primary} />
        </View>
        <Text style={[dpStyles.triggerText, { color: value ? colors.text : colors.textMuted, flex: 1 }]}>
          {value ? `${d} ${MONTHS[m - 1]} ${y}` : 'اختر تاريخاً…'}
        </Text>
        {value ? (
          <TouchableOpacity onPress={clear} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={[dpStyles.clearBtn, { backgroundColor: colors.dangerSubtle }]}>
            <Ionicons name="close" size={14} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        )}
      </TouchableOpacity>

      {/* Expanded picker */}
      {open && (
        <View style={[dpStyles.pickerBox, { backgroundColor: colors.background, borderColor: colors.primary + '40' }]}>
          {/* Row: day | month | year */}
          <View style={dpStyles.spinnerRow}>

            {/* Day */}
            <View style={dpStyles.spinnerCol}>
              <TouchableOpacity onPress={() => apply(y, m, d + 1)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerVal, { color: colors.text }]}>{String(d).padStart(2, '0')}</Text>
              <TouchableOpacity onPress={() => apply(y, m, d - 1)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerLabel, { color: colors.textMuted }]}>يوم</Text>
            </View>

            <View style={[dpStyles.divider, { backgroundColor: colors.border }]} />

            {/* Month */}
            <View style={dpStyles.spinnerCol}>
              <TouchableOpacity onPress={() => apply(y, m < 12 ? m + 1 : 1, d)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerVal, { color: colors.text, fontSize: 13 }]}>{MONTHS[m - 1]}</Text>
              <TouchableOpacity onPress={() => apply(y, m > 1 ? m - 1 : 12, d)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerLabel, { color: colors.textMuted }]}>شهر</Text>
            </View>

            <View style={[dpStyles.divider, { backgroundColor: colors.border }]} />

            {/* Year */}
            <View style={dpStyles.spinnerCol}>
              <TouchableOpacity onPress={() => apply(y + 1, m, d)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▲</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerVal, { color: colors.text }]}>{y}</Text>
              <TouchableOpacity onPress={() => apply(y - 1, m, d)} style={dpStyles.arrow}>
                <Text style={[dpStyles.arrowText, { color: colors.primary }]}>▼</Text>
              </TouchableOpacity>
              <Text style={[dpStyles.spinnerLabel, { color: colors.textMuted }]}>سنة</Text>
            </View>

          </View>

          {/* Confirm button */}
          <TouchableOpacity
            onPress={() => setOpen(false)}
            style={[dpStyles.confirmBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={dpStyles.confirmText}>تأكيد التاريخ</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const dpStyles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11,
  },
  calIcon:    { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  triggerText:{ fontSize: 14 },
  clearBtn:   { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  pickerBox: {
    marginTop: 8, borderWidth: 1.5, borderRadius: 12, padding: 16, gap: 14,
  },
  spinnerRow:   { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  spinnerCol:   { alignItems: 'center', gap: 6, flex: 1 },
  divider:      { width: 1, height: 80, alignSelf: 'center' },
  arrow:        { padding: 6 },
  arrowText:    { fontSize: 18, fontWeight: '700' },
  spinnerVal:   { fontSize: 22, fontWeight: '700', minWidth: 44, textAlign: 'center' },
  spinnerLabel: { fontSize: 11, marginTop: 2 },
  confirmBtn:   { borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  confirmText:  { color: '#FFF', fontSize: 14, fontWeight: '600' },
});

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: FileCategory; label: string }[] = [
  { value: 'contract',    label: 'عقد'    },
  { value: 'id',          label: 'هوية'   },
  { value: 'property',    label: 'عقار'   },
  { value: 'payment',     label: 'دفعة'   },
  { value: 'maintenance', label: 'صيانة'  },
  { value: 'other',       label: 'أخرى'  },
];

const TYPE_CONFIG: Record<Attachment['type'], { icon: string; label: string; color: string }> = {
  image: { icon: 'image-outline',         label: 'صورة', color: '#2E86C1' },
  pdf:   { icon: 'document-text-outline', label: 'PDF',  color: '#E74C3C' },
  doc:   { icon: 'document-outline',      label: 'مستند',color: '#8E44AD' },
  other: { icon: 'attach-outline',        label: 'ملف',  color: '#7F8C8D' },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingFile = {
  name: string;
  uri: string;
  mimeType: string;
  size?: number;
};

interface AttachmentPanelProps {
  entityType: string;
  entityId:   string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AttachmentPanel({ entityType, entityId }: AttachmentPanelProps) {
  const { colors } = useAppTheme();

  const { attachments, add, remove, formatSize, expiryColor } =
    useAttachments(entityType, entityId);

  const [showModal,       setShowModal]       = useState(false);
  const [showPickerMenu,  setShowPickerMenu]  = useState(false);
  const [deleteTarget,    setDeleteTarget]    = useState<Attachment | null>(null);
  const [pending,         setPending]         = useState<PendingFile | null>(null);
  const [customName,      setCustomName]      = useState('');
  const [category,        setCategory]        = useState<FileCategory>('other');
  const [expiry,          setExpiry]          = useState('');
  const [notes,           setNotes]           = useState('');
  const [error,           setError]           = useState<string | null>(null);
  const [viewing,         setViewing]         = useState<Attachment | null>(null);
  const [saving,          setSaving]          = useState(false);

  // ── Pickers ──────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('إذن مطلوب', 'يرجى الذهاب إلى الإعدادات والسماح للتطبيق بالوصول إلى مكتبة الصور.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images' as ImagePicker.MediaType,
      quality: 0.85,
      exif: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    openModal({
      name:     asset.uri.split('/').pop() ?? 'image.jpg',
      uri:      asset.uri,
      mimeType: asset.mimeType ?? 'image/jpeg',
      size:     asset.fileSize,
    });
  };

  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/jpeg', 'image/png'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    openModal({
      name:     asset.name,
      uri:      asset.uri,
      mimeType: asset.mimeType ?? 'application/pdf',
      size:     asset.size,
    });
  };

  const openModal = (file: PendingFile) => {
    const validationError = FileService.validate(file);
    if (validationError) { Alert.alert('خطأ في الملف', validationError); return; }
    setPending(file);
    // Pre-fill name with the original filename (without extension for cleanliness)
    const baseName = file.name.replace(/\.[^/.]+$/, '');
    setCustomName(baseName);
    setError(null);
    setShowModal(true);
  };

  // ── Picker selector ──────────────────────────────────────────────────────

  const showPickerOptions = () => {
    if (Platform.OS === 'web') {
      // On web, use document picker directly (supports images + PDF)
      pickDocument();
    } else {
      setShowPickerMenu(true);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!pending || saving) return;
    const finalName = customName.trim() || pending.name;
    setSaving(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      add({
        ...pending,
        name: finalName,
        category,
        expiryDate: expiry || undefined,
        notes: notes || undefined,
      });
      closeModal();
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setPending(null);
    setCustomName('');
    setExpiry('');
    setNotes('');
    setCategory('other');
    setError(null);
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const confirmDelete = (att: Attachment) => {
    if (Platform.OS === 'web') {
      setDeleteTarget(att);
    } else {
      Alert.alert('حذف الملف', `هل تريد حذف "${att.name}"؟`, [
        { text: 'إلغاء',  style: 'cancel' },
        { text: 'حذف',    style: 'destructive', onPress: () => remove(att.id) },
      ]);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const fileType = pending ? FileService.typeFromMime(pending.mimeType) : 'other';

  return (
    <View>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          المرفقات {attachments.length > 0 ? `(${attachments.length})` : ''}
        </Text>
        <Button
          label="إضافة مرفق"
          onPress={showPickerOptions}
          size="sm"
          icon="cloud-upload-outline"
          variant="outline"
        />
      </View>

      {/* ── Empty state ── */}
      {attachments.length === 0 ? (
        <TouchableOpacity
          onPress={showPickerOptions}
          style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}
          activeOpacity={0.7}
        >
          <View style={[styles.emptyIcon, { backgroundColor: colors.primarySubtle }]}>
            <Ionicons name="cloud-upload-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>لا توجد مرفقات</Text>
          <Text style={[styles.emptyHint,  { color: colors.textMuted }]}>
            اضغط لإضافة JPG أو PNG أو PDF
          </Text>
        </TouchableOpacity>
      ) : (

        /* ── File cards ── */
        attachments.map(att => {
          const cfg = TYPE_CONFIG[att.type];
          return (
            <View
              key={att.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              {/* Icon */}
              <View style={[styles.fileIconBox, { backgroundColor: `${cfg.color}18` }]}>
                <Ionicons name={cfg.icon as any} size={24} color={cfg.color} />
              </View>

              {/* Info */}
              <View style={styles.cardBody}>
                {/* Row 1 — name + type badge */}
                <View style={styles.cardRow}>
                  <View style={[styles.typeBadge, { backgroundColor: `${cfg.color}18` }]}>
                    <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {att.name}
                  </Text>
                </View>

                {/* Row 2 — date + size + category */}
                <View style={styles.cardMeta}>
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {FileService.categoryLabel(att.category)}
                  </Text>
                  {att.size ? (
                    <Text style={[styles.metaText, { color: colors.textMuted }]}>
                      {formatSize(att.size)}
                    </Text>
                  ) : null}
                  <Text style={[styles.metaText, { color: colors.textMuted }]}>
                    {att.uploadedAt.split('T')[0]}
                  </Text>
                </View>

                {/* Row 3 — expiry (optional) */}
                {att.expiryDate ? (
                  <Text style={[styles.expiryText, { color: expiryColor(att.expiryStatus) }]}>
                    {att.expiryStatus === 'expired'       ? '⚠ منتهية — ' :
                     att.expiryStatus === 'expiring_soon' ? '⏳ تنتهي قريباً — ' : '✓ صالحة حتى — '}
                    {att.expiryDate}
                  </Text>
                ) : null}
              </View>

              {/* Actions: view + delete */}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  onPress={() => setViewing(att)}
                  style={[styles.viewBtn, { backgroundColor: colors.primarySubtle }]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="eye-outline" size={15} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmDelete(att)}
                  style={[styles.viewBtn, { backgroundColor: colors.dangerSubtle }]}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.danger} />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* ── File viewer ── */}
      <FileViewer attachment={viewing} onClose={() => setViewing(null)} />

      {/* ── Upload modal ── */}
      <Modal
        visible={showModal}
        onClose={closeModal}
        title="تفاصيل المرفق"
        size="lg"
        scrollable
        footer={
          <TouchableOpacity
            onPress={handleSave}
            disabled={!pending || saving}
            style={[
              styles.saveBtn,
              { backgroundColor: !pending || saving ? colors.border : colors.primary },
            ]}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : null}
            <Text style={[
              styles.saveBtnText,
              { color: !pending || saving ? colors.textMuted : '#FFF' },
            ]}>
              {saving ? 'جارٍ الحفظ…' : 'حفظ المرفق'}
            </Text>
          </TouchableOpacity>
        }
      >
        {/* ── File type banner ── */}
        {pending && (
          <View style={[styles.fileBanner, { backgroundColor: `${TYPE_CONFIG[fileType].color}14`, borderColor: `${TYPE_CONFIG[fileType].color}40` }]}>
            <View style={[styles.fileBannerIcon, { backgroundColor: `${TYPE_CONFIG[fileType].color}22` }]}>
              <Ionicons name={TYPE_CONFIG[fileType].icon as any} size={32} color={TYPE_CONFIG[fileType].color} />
            </View>
            <View style={styles.fileBannerInfo}>
              <Text style={[styles.fileBannerOrigName, { color: colors.textMuted }]} numberOfLines={1}>
                {pending.name}
              </Text>
              <View style={styles.fileBannerRow}>
                <View style={[styles.typeBadge, { backgroundColor: `${TYPE_CONFIG[fileType].color}22` }]}>
                  <Text style={[styles.typeBadgeText, { color: TYPE_CONFIG[fileType].color }]}>
                    {TYPE_CONFIG[fileType].label}
                  </Text>
                </View>
                {pending.size ? (
                  <View style={[styles.typeBadge, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.typeBadgeText, { color: colors.textSecondary }]}>
                      {formatSize(pending.size)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        )}

        {/* Validation error */}
        {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}

        {/* ── Section: اسم المرفق ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="pencil-outline" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>اسم المرفق</Text>
          </View>
          <Input
            value={customName}
            onChangeText={setCustomName}
            placeholder="مثال: هوية المستأجر، عقد 2025..."
            icon="document-text-outline"
          />
        </View>

        {/* ── Section: التصنيف ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="grid-outline" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>التصنيف</Text>
          </View>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => (
              <TouchableOpacity
                key={cat.value}
                onPress={() => setCategory(cat.value)}
                style={[
                  styles.categoryPill,
                  {
                    backgroundColor: category === cat.value ? colors.primary : colors.card,
                    borderColor:     category === cat.value ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{
                  color:      category === cat.value ? '#FFF' : colors.text,
                  fontSize:   fontSize.sm,
                  fontWeight: fontWeight.medium,
                }}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Section: تاريخ الانتهاء ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar-outline" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>تاريخ انتهاء الصلاحية</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.optionalText, { color: colors.textMuted }]}>اختياري</Text>
            </View>
          </View>
          <InlineDatePicker value={expiry} onChange={setExpiry} colors={colors} />
        </View>

        {/* ── Section: ملاحظات ── */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={16} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>ملاحظات</Text>
            <View style={[styles.optionalBadge, { backgroundColor: colors.card }]}>
              <Text style={[styles.optionalText, { color: colors.textMuted }]}>اختياري</Text>
            </View>
          </View>
          <Input
            value={notes}
            onChangeText={setNotes}
            placeholder="أضف ملاحظة عن هذا الملف..."
            multiline
            numberOfLines={3}
            icon="create-outline"
          />
        </View>
      </Modal>

      {/* ── Picker menu (non-web only, web uses document picker directly) ── */}
      <Modal
        visible={showPickerMenu}
        onClose={() => setShowPickerMenu(false)}
        title="إضافة مرفق"
        size="sm"
      >
        <View style={{ gap: spacing[3], paddingBottom: spacing[2] }}>
          <TouchableOpacity
            style={[styles.pickerOption, { backgroundColor: colors.primarySubtle, borderColor: colors.primary + '40' }]}
            onPress={() => { setShowPickerMenu(false); setTimeout(pickImage, 200); }}
            activeOpacity={0.8}
          >
            <Ionicons name="image-outline" size={22} color={colors.primary} />
            <Text style={[styles.pickerOptionText, { color: colors.primary }]}>صور (JPG / PNG)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pickerOption, { backgroundColor: colors.dangerSubtle, borderColor: colors.danger + '40' }]}
            onPress={() => { setShowPickerMenu(false); setTimeout(pickDocument, 200); }}
            activeOpacity={0.8}
          >
            <Ionicons name="document-text-outline" size={22} color={colors.danger} />
            <Text style={[styles.pickerOptionText, { color: colors.danger }]}>ملف PDF</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* ── Delete confirm (web) ── */}
      <Modal
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="حذف الملف"
        size="sm"
      >
        <View style={{ gap: spacing[4], paddingBottom: spacing[2] }}>
          <Text style={{ color: colors.text, textAlign: 'right', fontSize: fontSize.base }}>
            هل تريد حذف "{deleteTarget?.name}"؟
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, backgroundColor: colors.danger }]}
              onPress={() => { if (deleteTarget) remove(deleteTarget.id); setDeleteTarget(null); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveBtnText, { color: '#FFF' }]}>حذف</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => setDeleteTarget(null)}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveBtnText, { color: colors.text }]}>إلغاء</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing[3],
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'right' },

  // Empty state
  emptyBox: {
    borderRadius: radius.xl,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: spacing[8],
    alignItems: 'center',
    gap: spacing[2],
  },
  emptyIcon:  { width: 56, height: 56, borderRadius: radius.xl, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, textAlign: 'center' },
  emptyHint:  { fontSize: fontSize.sm, textAlign: 'center' },

  // File card
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing[2],
    gap: spacing[3],
  },
  fileIconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  cardBody: { flex: 1, gap: spacing[1] },
  cardRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardName: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1 },

  // Type badge
  typeBadge:     { paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  typeBadgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.bold },

  // Meta row
  cardMeta: { flexDirection: 'row', gap: spacing[3], alignItems: 'center' },
  metaText: { fontSize: fontSize.xs },

  // Expiry
  expiryText: { fontSize: fontSize.xs, fontWeight: fontWeight.medium },

  // Action buttons (view + delete)
  cardActions: { flexShrink: 0, gap: spacing[2] },
  viewBtn: { width: 30, height: 30, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },

  // Upload modal — file banner
  fileBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.xl,
    borderWidth: 1.5,
    marginBottom: spacing[1],
  },
  fileBannerIcon: {
    width: 56, height: 56, borderRadius: radius.xl,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  fileBannerInfo:    { flex: 1, gap: spacing[2] },
  fileBannerOrigName:{ fontSize: fontSize.xs },
  fileBannerRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },

  // Sections
  section: {
    borderRadius: radius.xl,
    borderWidth: 1,
    padding: spacing[3],
    gap: spacing[2],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  sectionTitle: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, flex: 1, textAlign: 'right' },
  optionalBadge:{ paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full },
  optionalText: { fontSize: fontSize.xs },

  errorText:    { fontSize: fontSize.sm },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryPill: { paddingHorizontal: spacing[3], paddingVertical: spacing[1] + 1, borderRadius: radius.full, borderWidth: 1 },

  // Save button with loading state
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingVertical: spacing[4],
    borderRadius: radius.lg,
  },
  saveBtnText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[4], borderRadius: radius.lg, borderWidth: 1,
  },
  pickerOptionText: { fontSize: fontSize.base, fontWeight: fontWeight.semibold },
});
