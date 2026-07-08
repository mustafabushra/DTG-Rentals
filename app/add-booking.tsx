import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { useApp } from '../context/AppProvider';
import { FormInput } from '../components/forms/FormInput';
import { FormSelect } from '../components/forms/FormSelect';
import { FormDatePicker } from '../components/forms/FormDatePicker';
import { FormContainer } from '../components/ui/FormContainer';
import { useAppTheme } from '../hooks/useAppTheme';
import { Booking, formatCurrency } from '../data/mockData';
import { BookingService } from '../domain/services/BookingService';

export default function AddBookingScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { unitId: presetUnitId } = useLocalSearchParams<{ unitId?: string }>();
  const { units, properties, bookings, addBooking } = useApp();

  // بيوت المصيف فقط قابلة للحجز
  const nightlyUnits = useMemo(
    () => units.filter(u => u.rentalModel === 'nightly'),
    [units],
  );

  const [form, setForm] = useState({
    unitId: (presetUnitId as string) || '',
    guestName: '', guestPhone: '',
    checkIn: '', checkOut: '',
    nightlyRate: '', paidAmount: '', notes: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const selectedUnit = units.find(u => u.id === form.unitId);
  const property     = selectedUnit ? properties.find(p => p.id === selectedUnit.propertyId) : null;
  const currency     = selectedUnit?.currency ?? property?.currency ?? 'SAR';

  const nights = BookingService.nights(form.checkIn, form.checkOut);
  const total  = BookingService.computeTotal(nights, Number(form.nightlyRate) || 0);

  const unitOptions = nightlyUnits.map(u => {
    const p = properties.find(pr => pr.id === u.propertyId);
    return { label: `${p?.name ?? 'عقار'} — وحدة ${u.number}`, value: u.id };
  });

  const set = (key: string) => (val: string) => {
    setForm(f => {
      const next = { ...f, [key]: val };
      if (key === 'unitId') {
        const u = units.find(x => x.id === val);
        if (u?.nightlyRate && !f.nightlyRate) next.nightlyRate = String(u.nightlyRate);
      }
      return next;
    });
    if (errors[key]) setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  const handleSave = () => {
    const validationErrors = BookingService.validate(
      {
        unitId: form.unitId,
        guestName: form.guestName,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        nightlyRate: Number(form.nightlyRate) || 0,
      },
      bookings,
    );
    if (Object.keys(validationErrors).length > 0) { setErrors(validationErrors); return; }
    if (!selectedUnit || !property) return;

    const rate = Number(form.nightlyRate);
    const paid = Number(form.paidAmount) || 0;
    const booking: Booking = {
      id: `bk${Date.now()}`,
      unitId: form.unitId,
      propertyId: selectedUnit.propertyId,
      ...(selectedUnit.ownerId ? { ownerId: selectedUnit.ownerId } : {}),
      guestName: form.guestName.trim(),
      ...(form.guestPhone.trim() ? { guestPhone: form.guestPhone.trim() } : {}),
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      nights,
      nightlyRate: rate,
      totalAmount: total,
      paidAmount: Math.min(paid, total),
      status: 'confirmed',
      ...(currency ? { currency } : {}),
      ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      createdAt: new Date().toISOString(),
    };
    addBooking(booking);
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>حجز جديد</Text>
        <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
          <Text style={styles.saveText}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <FormContainer><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {nightlyUnits.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="moon-outline" size={30} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              لا توجد وحدات مصيف. فعّل "نوع التأجير: يومي" على وحدة أولاً لإضافة الحجوزات.
            </Text>
          </View>
        ) : (
          <>
            <FormSelect label="الوحدة (بيت مصيف)" value={form.unitId} options={unitOptions} onSelect={set('unitId')} required placeholder="اختر الوحدة..." error={errors.unitId} />
            <FormInput label="اسم الضيف" value={form.guestName} onChangeText={set('guestName')} placeholder="اسم النزيل" required icon="person-outline" error={errors.guestName} />
            <FormInput label="هاتف الضيف (اختياري)" value={form.guestPhone} onChangeText={set('guestPhone')} placeholder="05xxxxxxxx" keyboardType="phone-pad" icon="call-outline" />
            <FormDatePicker label="تاريخ الوصول" value={form.checkIn} onChange={set('checkIn')} required error={errors.checkIn} />
            <FormDatePicker label="تاريخ المغادرة" value={form.checkOut} onChange={set('checkOut')} required error={errors.checkOut} minDate={form.checkIn} />
            <FormInput label={`سعر الليلة (${currency})`} value={form.nightlyRate} onChangeText={set('nightlyRate')} placeholder="مثال: 450" keyboardType="number-pad" required icon="moon-outline" error={errors.nightlyRate} />
            <FormInput label={`المبلغ المحصّل (${currency})`} value={form.paidAmount} onChangeText={set('paidAmount')} placeholder="0" keyboardType="number-pad" icon="cash-outline" />
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
            </View>
          </>
        )}
      </ScrollView></FormContainer>
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
  emptyBox: { alignItems: 'center', gap: 10, padding: 24, borderRadius: Theme.radius.lg, borderWidth: 1 },
  emptyText: { fontSize: Theme.fontSize.sm, textAlign: 'center', lineHeight: 20 },
  summary: { padding: Theme.spacing.md, borderRadius: Theme.radius.lg, borderWidth: 1, gap: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: Theme.fontSize.md },
  summaryVal: { fontSize: Theme.fontSize.md, fontWeight: Theme.fontWeight.semibold },
  summaryTotal: { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
});
