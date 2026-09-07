import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../../constants/Theme';
import { useApp } from '../../context/AppProvider';
import { FormInput } from '../../components/forms/FormInput';
import { FormSelect } from '../../components/forms/FormSelect';
import { FormDatePicker } from '../../components/forms/FormDatePicker';
import { FormContainer } from '../../components/ui/FormContainer';
import { AppHeader } from '../../components/ui/AppHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import { ConfirmModal } from '../../components/ui/Modal';
import { useAppTheme } from '../../hooks/useAppTheme';
import { Booking, formatCurrency } from '../../data/mockData';
import { BookingService } from '../../domain/services/BookingService';

export default function EditBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { units, properties, bookings, updateBooking, deleteBooking, canDelete } = useApp();

  const booking = bookings.find(b => b.id === id);

  // بيوت المصيف فقط قابلة للحجز — مع إبقاء وحدة الحجز الحالية مطروحة دائماً
  const nightlyUnits = useMemo(
    () => units.filter(u => u.rentalModel === 'nightly' || u.id === booking?.unitId),
    [units, booking?.unitId],
  );

  const [form, setForm] = useState({
    unitId: '', guestName: '', guestPhone: '',
    checkIn: '', checkOut: '',
    nightlyRate: '', paidAmount: '', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState(false);

  useEffect(() => {
    if (booking) {
      setForm({
        unitId: booking.unitId,
        guestName: booking.guestName,
        guestPhone: booking.guestPhone || '',
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nightlyRate: String(booking.nightlyRate ?? ''),
        paidAmount: booking.paidAmount ? String(booking.paidAmount) : '',
        notes: booking.notes || '',
      });
    }
  }, [booking?.id]);

  const selectedUnit = units.find(u => u.id === form.unitId);
  const property     = selectedUnit ? properties.find(p => p.id === selectedUnit.propertyId) : null;
  const currency     = selectedUnit?.currency ?? property?.currency ?? booking?.currency ?? 'SAR';

  const nights = BookingService.nights(form.checkIn, form.checkOut);
  const total  = BookingService.computeTotal(nights, Number(form.nightlyRate) || 0);

  const unitOptions = nightlyUnits.map(u => {
    const p = properties.find(pr => pr.id === u.propertyId);
    return { label: `${p?.name ?? 'عقار'} — وحدة ${u.number}`, value: u.id };
  });

  const set = (key: string) => (val: string) => {
    setForm(f => ({ ...f, [key]: val }));
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  if (!booking) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <AppHeader title="تعديل الحجز" />
        <EmptyState icon="moon-outline" title="الحجز غير موجود" />
      </View>
    );
  }

  const cancelled = booking.status === 'cancelled';

  /** التحقق المشترك — يستثني الحجز نفسه من كشف التعارض. */
  const validateForm = () => BookingService.validate(
    {
      unitId: form.unitId,
      guestName: form.guestName,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      nightlyRate: Number(form.nightlyRate) || 0,
      paidAmount: Number(form.paidAmount) || 0,
      totalAmount: total,
    },
    bookings,
    booking.id,
  );

  const handleSave = () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    if (!selectedUnit) return;

    const patch: Partial<Booking> = {
      unitId: form.unitId,
      propertyId: selectedUnit.propertyId,
      ownerId: selectedUnit.ownerId,
      guestName: form.guestName.trim(),
      guestPhone: form.guestPhone.trim() || undefined,
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      nights,
      nightlyRate: Number(form.nightlyRate),
      totalAmount: total,
      paidAmount: Number(form.paidAmount) || 0,
      currency,
      notes: form.notes.trim() || undefined,
    };
    updateBooking(booking.id, patch);
    router.back();
  };

  // إعادة تفعيل حجز ملغى: تُعاد التواريخ للاحتساب، لذا نُعيد فحص التعارض أولاً
  const handleRestore = () => {
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); setConfirmRestore(false); return; }
    updateBooking(booking.id, {
      status: 'confirmed',
      cancelledAt: undefined,
      cancellationReason: undefined,
    });
    setConfirmRestore(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعديل الحجز</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {cancelled && (
          <View style={[styles.banner, { backgroundColor: colors.danger + '14', borderColor: colors.danger + '55' }]}>
            <Ionicons name="close-circle-outline" size={18} color={colors.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerText, { color: colors.danger }]}>
                هذا الحجز ملغي — لا يُحتسب إيراده ولياليه متاحة للحجز.
              </Text>
              <TouchableOpacity onPress={() => setConfirmRestore(true)}>
                <Text style={[styles.bannerAction, { color: colors.secondary }]}>إعادة تفعيل الحجز</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <FormSelect label="الوحدة (بيت مصيف)" value={form.unitId} options={unitOptions} onSelect={set('unitId')} required placeholder="اختر الوحدة..." error={errors.unitId} />
        <FormInput label="اسم الضيف" value={form.guestName} onChangeText={set('guestName')} placeholder="اسم النزيل" required icon="person-outline" error={errors.guestName} />
        <FormInput label="هاتف الضيف (اختياري)" value={form.guestPhone} onChangeText={set('guestPhone')} placeholder="05xxxxxxxx" keyboardType="phone-pad" icon="call-outline" />
        <FormDatePicker label="تاريخ الوصول" value={form.checkIn} onChange={set('checkIn')} required error={errors.checkIn} />
        <FormDatePicker label="تاريخ المغادرة" value={form.checkOut} onChange={set('checkOut')} required error={errors.checkOut} minDate={form.checkIn} />
        <FormInput label={`سعر الليلة (${currency})`} value={form.nightlyRate} onChangeText={set('nightlyRate')} placeholder="مثال: 450" keyboardType="number-pad" required icon="moon-outline" error={errors.nightlyRate} />
        <FormInput label={`المبلغ المحصّل (${currency})`} value={form.paidAmount} onChangeText={set('paidAmount')} placeholder="0" keyboardType="number-pad" icon="cash-outline" error={errors.paidAmount} />
        <FormInput label="ملاحظات (اختياري)" value={form.notes} onChangeText={set('notes')} placeholder="ملاحظات الحجز..." multiline numberOfLines={2} icon="document-text-outline" />

        {/* الإجمالي المحسوب لحظياً */}
        <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>عدد الليالي</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>{nights} ليلة</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>الإجمالي</Text>
            <Text style={[styles.summaryTotal, { color: colors.primary }]}>{formatCurrency(total)} {currency}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>المتبقي</Text>
            <Text style={[styles.summaryVal, { color: colors.warning }]}>
              {formatCurrency(Math.max(0, total - (Number(form.paidAmount) || 0)))} {currency}
            </Text>
          </View>
        </View>

        {canDelete && (
          <TouchableOpacity
            style={[styles.deleteBtn, { borderColor: colors.danger + '55' }]}
            onPress={() => setConfirmDelete(true)}
          >
            <Ionicons name="trash-outline" size={16} color={colors.danger} />
            <Text style={[styles.deleteText, { color: colors.danger }]}>حذف الحجز نهائياً</Text>
          </TouchableOpacity>
        )}
      </ScrollView></FormContainer>

      <ConfirmModal
        visible={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => { setConfirmDelete(false); deleteBooking(booking.id); router.back(); }}
        title="حذف الحجز"
        message="سيُحذف هذا الحجز نهائياً ولن يظهر في السجل. للاحتفاظ بالسجل استخدم الإلغاء بدلاً من الحذف."
        confirmLabel="حذف"
        variant="danger"
      />
      <ConfirmModal
        visible={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        onConfirm={handleRestore}
        title="إعادة تفعيل الحجز"
        message="سيعود الحجز مؤكداً وتُحجز لياليه ويُحتسب إيراده من جديد. هل تريد المتابعة؟"
        confirmLabel="إعادة التفعيل"
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
  saveBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: Theme.radius.full },
  saveText: { color: '#FFF', fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.bold },
  content: { padding: Theme.spacing.base, gap: Theme.spacing.lg, paddingBottom: 48 },
  banner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1,
  },
  bannerText: { fontSize: Theme.fontSize.sm, textAlign: 'right', lineHeight: 20 },
  bannerAction: { fontSize: Theme.fontSize.sm, fontWeight: Theme.fontWeight.bold, textAlign: 'right', marginTop: 6 },
  summary: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Theme.fontSize.md },
  summaryVal: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
  summaryTotal: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: Theme.radius.md, borderWidth: 1,
  },
  deleteText: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
});
