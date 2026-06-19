/**
 * FilterPanel — Advanced filter panel for properties.
 * Slide-up drawer with compound filters, filter chips, and instant apply.
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import type { PropertyType } from '../../data/mockData';
import type { FileCategory, Property } from '../../domain/models';

const { height: SCREEN_H } = Dimensions.get('window');

export interface ActiveFilters {
  search: string;
  types: (PropertyType | string)[];
  cities: string[];
  statuses: ('rented' | 'vacant')[];
  priceRange: { min: number; max: number };
  bedrooms: number;
  area: number;
  sort: 'newest' | 'revenue' | 'units' | 'name' | 'oldest';
}

export const DEFAULT_FILTERS: ActiveFilters = {
  search: '',
  types: [],
  cities: [],
  statuses: [],
  priceRange: { min: 0, max: 999999 },
  bedrooms: 0,
  area: 0,
  sort: 'newest',
};

interface FilterPanelProps {
  visible: boolean;
  onClose: () => void;
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
}

const TYPES: { value: PropertyType | string; label: string; icon: string }[] = [
  { value: 'apartment', label: 'شقة', icon: 'business-outline' },
  { value: 'villa', label: 'فيلا', icon: 'home-outline' },
  { value: 'building', label: 'مبنى', icon: 'layers-outline' },
  { value: 'tower', label: 'برج', icon: 'telescope-outline' },
  { value: 'office', label: 'مكتب', icon: 'briefcase-outline' },
  { value: 'shop', label: 'محل', icon: 'storefront-outline' },
  { value: 'land', label: 'أرض', icon: 'map-outline' },
];

const SORT_OPTIONS: { value: ActiveFilters['sort']; label: string; icon: string }[] = [
  { value: 'newest', label: 'الأحدث', icon: 'time-outline' },
  { value: 'oldest', label: 'الأقدم', icon: 'time-outline' },
  { value: 'name', label: 'الاسم', icon: 'text-outline' },
  { value: 'revenue', label: 'الأعلى إيراداً', icon: 'cash-outline' },
  { value: 'units', label: 'الأكثر وحدات', icon: 'layers-outline' },
];

export function FilterPanel({ visible, onClose, filters, onChange }: FilterPanelProps) {
  const { colors } = useAppTheme();
  const { cities: contextCities } = useApp();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const [localFilters, setLocalFilters] = useState<ActiveFilters>(filters);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      setLocalFilters(filters);
    }
    prevVisibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const closePanel = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const toggleArray = <T,>(arr: T[], value: T): T[] =>
    arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value];

  const typeLabel = (t: string) => TYPES.find(x => x.value === t)?.label ?? t;
  const statusLabel = (s: string) => {
    const map: Record<string, string> = { rented: 'مؤجر', vacant: 'شاغر' };
    return map[s] ?? s;
  };

  // Filter Chips
  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    localFilters.types.forEach(t => {
      chips.push({
        key: `type_${t}`,
        label: typeLabel(t),
        onRemove: () => setLocalFilters(prev => ({ ...prev, types: prev.types.filter(x => x !== t) })),
      });
    });
    localFilters.cities.forEach(c => {
      const city = contextCities.find(ct => ct.id === c);
      chips.push({
        key: `city_${c}`,
        label: city?.displayName || city?.name || c,
        onRemove: () => setLocalFilters(prev => ({ ...prev, cities: prev.cities.filter(x => x !== c) })),
      });
    });
    localFilters.statuses.forEach(s => {
      chips.push({
        key: `status_${s}`,
        label: statusLabel(s),
        onRemove: () => setLocalFilters(prev => ({ ...prev, statuses: prev.statuses.filter(x => x !== s) })),
      });
    });
    if (localFilters.priceRange.min > 0 || localFilters.priceRange.max < 999999) {
      chips.push({
        key: 'price',
        label: `السعر: ${localFilters.priceRange.min.toLocaleString('ar-SA')} - ${localFilters.priceRange.max.toLocaleString('ar-SA')}`,
        onRemove: () => setLocalFilters(prev => ({ ...prev, priceRange: { min: 0, max: 999999 } })),
      });
    }
    if (localFilters.bedrooms > 0) {
      chips.push({
        key: 'bedrooms',
        label: `≥ ${localFilters.bedrooms} غرف`,
        onRemove: () => setLocalFilters(prev => ({ ...prev, bedrooms: 0 })),
      });
    }
    if (localFilters.area > 0) {
      chips.push({
        key: 'area',
        label: `≥ ${localFilters.area} م²`,
        onRemove: () => setLocalFilters(prev => ({ ...prev, area: 0 })),
      });
    }
    return chips;
  }, [localFilters, contextCities]);

  const hasActiveFilters = localFilters.types.length > 0 || localFilters.cities.length > 0 ||
    localFilters.statuses.length > 0 || localFilters.bedrooms > 0 || localFilters.area > 0 ||
    localFilters.priceRange.min > 0 || localFilters.priceRange.max < 999999 ||
    localFilters.sort !== DEFAULT_FILTERS.sort;

  const handleApply = () => {
    onChange(localFilters);
    closePanel();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={closePanel}>
      <View style={styles.modalWrapper}>
        <Animated.View style={[styles.backdrop, { opacity }]}>
          <TouchableOpacity style={styles.backdropTouch} onPress={closePanel} activeOpacity={1} />
        </Animated.View>
        <Animated.View style={[styles.panel, { transform: [{ translateY: slideY }] }]}>
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.handleRow}>
              <View style={styles.handle} />
            </View>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[styles.title, { color: colors.text }]}>فلترة العقارات</Text>
              <View style={styles.headerActions}>
                {hasActiveFilters && (
                  <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.danger }]} onPress={() => setLocalFilters(DEFAULT_FILTERS)}>
                    <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                    <Text style={[styles.resetText, { color: colors.danger }]}>إعادة ضبط</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={closePanel}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>
            {activeChips.length > 0 && (
              <View style={styles.chipsRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsContent}>
                  {activeChips.map(chip => (
                    <TouchableOpacity key={chip.key} style={[styles.chip, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]} onPress={chip.onRemove}>
                      <Text style={[styles.chipText, { color: colors.primary }]}>{chip.label}</Text>
                      <Ionicons name="close-circle" size={14} color={colors.primary} />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
              {/* Price */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="cash-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>نطاق السعر</Text>
                </View>
                <View style={styles.priceRow}>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, min: Math.max(0, prev.priceRange.min - 500) } }))}>
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <View style={[styles.priceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.priceLabel, { color: colors.textMuted }]}>الحد الأدنى</Text>
                    <Text style={[styles.priceValue, { color: colors.text }]}>{localFilters.priceRange.min.toLocaleString('ar-SA')}</Text>
                  </View>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, min: prev.priceRange.min + 500 } }))}>
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.priceRow}>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, max: Math.max(prev.priceRange.min + 500, prev.priceRange.max - 500) } }))}>
                    <Ionicons name="remove" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <View style={[styles.priceBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <Text style={[styles.priceLabel, { color: colors.textMuted }]}>الحد الأقصى</Text>
                    <Text style={[styles.priceValue, { color: colors.text }]}>{localFilters.priceRange.max.toLocaleString('ar-SA')}</Text>
                  </View>
                  <TouchableOpacity style={[styles.qtyBtn, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, priceRange: { ...prev.priceRange, max: prev.priceRange.max + 500 } }))}>
                    <Ionicons name="add" size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Type */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="business-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>نوع العقار</Text>
                </View>
                <View style={styles.typeGrid}>
                  {TYPES.map(t => {
                    const sel = localFilters.types.includes(t.value);
                    return (
                      <TouchableOpacity key={t.value} style={[styles.typeCard, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, types: toggleArray(prev.types, t.value) }))}>
                        <Ionicons name={t.icon as any} size={20} color={sel ? '#FFF' : colors.textSecondary} />
                        <Text style={[styles.typeLabel, { color: sel ? '#FFF' : colors.text }]}>{t.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {/* City */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="location-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>المدينة</Text>
                </View>
                <View style={styles.chipGrid}>
                  {contextCities.map(city => {
                    const sel = localFilters.cities.includes(city.id);
                    return (
                      <TouchableOpacity key={city.id} style={[styles.filterChip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, cities: toggleArray(prev.cities, city.id) }))}>
                        <Text style={[styles.filterChipText, { color: sel ? '#FFF' : colors.text }]}>{city.displayName || city.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {/* Status */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="trending-up-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>الحالة</Text>
                </View>
                <View style={styles.chipGrid}>
                  {['rented', 'vacant'].map(s => {
                    const sel = localFilters.statuses.includes(s as 'rented' | 'vacant');
                    const icon = s === 'rented' ? 'checkmark-circle-outline' : 'ellipse-outline';
                    return (
                      <TouchableOpacity key={s} style={[styles.filterChip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, statuses: toggleArray(prev.statuses, s as 'rented' | 'vacant') }))}>
                        <Ionicons name={icon as any} size={16} color={sel ? '#FFF' : colors.textSecondary} />
                        <Text style={[styles.filterChipText, { color: sel ? '#FFF' : colors.text }]}>{s === 'rented' ? 'مؤجر' : 'شاغر'}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              {/* Bedrooms */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="bed-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>عدد الغرف</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bedroomsRow}>
                  {[0, 1, 2, 3, 4, 5].map(n => {
                    const sel = localFilters.bedrooms === n;
                    return (
                      <TouchableOpacity key={n} style={[styles.bedroomBtn, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, bedrooms: n === prev.bedrooms ? 0 : n }))}>
                        <Text style={[styles.bedroomText, { color: sel ? '#FFF' : colors.text }]}>{n === 0 ? 'الكل' : `${n}+`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {/* Area */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="resize-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>المساحة</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bedroomsRow}>
                  {[0, 50, 100, 150, 200, 300, 500].map(n => {
                    const sel = localFilters.area === n;
                    return (
                      <TouchableOpacity key={n} style={[styles.bedroomBtn, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, area: n === prev.area ? 0 : n }))}>
                        <Text style={[styles.bedroomText, { color: sel ? '#FFF' : colors.text }]}>{n === 0 ? 'الكل' : `${n}+`}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
              {/* Sort */}
              <View style={styles.section}>
                <View style={styles.sectionTitleRow}>
                  <Ionicons name="swap-vertical-outline" size={16} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>الترتيب</Text>
                </View>
                <View style={styles.chipGrid}>
                  {SORT_OPTIONS.map(opt => {
                    const sel = localFilters.sort === opt.value;
                    return (
                      <TouchableOpacity key={opt.value} style={[styles.filterChip, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]} onPress={() => setLocalFilters(prev => ({ ...prev, sort: opt.value }))}>
                        <Ionicons name={opt.icon as any} size={16} color={sel ? '#FFF' : colors.textSecondary} />
                        <Text style={[styles.filterChipText, { color: sel ? '#FFF' : colors.text }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
            <View style={[styles.footer, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: colors.primary }]} onPress={handleApply}>
                <Ionicons name="funnel-outline" size={20} color="#FFF" />
                <Text style={styles.applyText}>تطبيق الفلاتر ({activeChips.length})</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalWrapper: {
    flex: 1,
    position: 'relative' as 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  } as ViewStyle,
  backdropTouch: {
    flex: 1,
  } as ViewStyle,
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_H * 0.92,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  } as ViewStyle,
  safeArea: {
    flex: 1,
  } as ViewStyle,
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  } as ViewStyle,
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ddd',
  } as ViewStyle,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
  } as ViewStyle,
  title: {
    fontSize: 20,
    fontWeight: '700',
  } as TextStyle,
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  } as ViewStyle,
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  } as ViewStyle,
  resetText: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  chipsRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  } as ViewStyle,
  chipsContent: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  } as ViewStyle,
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  } as ViewStyle,
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  } as ViewStyle,
  section: {
    marginTop: 20,
    gap: 12,
  } as ViewStyle,
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  } as ViewStyle,
  typeCard: {
    width: '30%',
    aspectRatio: 1.2,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  } as ViewStyle,
  typeLabel: {
    fontSize: 12,
    fontWeight: '600',
  } as TextStyle,
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  } as ViewStyle,
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  } as ViewStyle,
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
  } as TextStyle,
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  } as ViewStyle,
  qtyBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  priceBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  } as ViewStyle,
  priceLabel: {
    fontSize: 11,
  } as TextStyle,
  priceValue: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  } as TextStyle,
  bedroomsRow: {
    flexDirection: 'row',
    gap: 10,
  } as ViewStyle,
  bedroomBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  } as ViewStyle,
  bedroomText: {
    fontSize: 14,
    fontWeight: '700',
  } as TextStyle,
  footer: {
    padding: 16,
    borderTopWidth: 1,
  } as ViewStyle,
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  } as ViewStyle,
  applyText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  } as TextStyle,
});