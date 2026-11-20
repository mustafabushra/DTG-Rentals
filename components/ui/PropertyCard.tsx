import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import type { PropertyPhoto } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useApp } from '../../context/AppProvider';

interface PropertyCardProps {
  property: {
    id: string;
    name: string;
    type: string;
    address?: string;
    location?: string;
    city?: string;
    cityId?: string;
    totalUnits: number;
    status?: string;
  };
  photos?: PropertyPhoto[];
  rentedCount?: number;
  vacantCount?: number;
  onDelete?: () => void;
  style?: any;
}

const TYPE_LABELS: Record<string, string> = {
  apartment: 'شقق',
  villa:     'فيلا',
  office:    'مكاتب',
  shop:      'محلات',
  building:  'مبنى',
  tower:     'برج',
  land:      'أرض',
};

const TYPE_ICONS: Record<string, string> = {
  apartment: 'business-outline',
  villa:     'home-outline',
  office:    'briefcase-outline',
  shop:      'storefront-outline',
  building:  'layers-outline',
  tower:     'telescope-outline',
  land:      'map-outline',
};

// Placeholder gradients per type (used when no photo)
// كل الأنواع من عائلة الكحلي — النوع يظهر في الشارة، لا في لون الكرت كله
const TYPE_COLORS: Record<string, [string, string]> = {
  apartment: ['#0F2A47', '#214670'],
  villa:     ['#071729', '#0F2A47'],
  office:    ['#183A60', '#365A80'],
  shop:      ['#0A2038', '#183A60'],
  building:  ['#0F2A47', '#183A60'],
  tower:     ['#071729', '#183A60'],
  land:      ['#214670', '#365A80'],
};

/**
 * بطاقة عقار مضغوطة: صورة مصغّرة، الاسم والموقع، وسطر واحد للوحدات والإشغال.
 * (كانت صورة كبيرة بشريط داكن وأربعة أرقام — صعبة القراءة وتأخذ الشاشة كلها في الجوال)
 */
export function PropertyCard({ property, photos = [], rentedCount = 0, vacantCount = 0, style }: PropertyCardProps) {
  const { colors } = useAppTheme();
  const { cities } = useApp();

  const location = property.address ?? property.location ?? '';
  const cityName = property.cityId
    ? (cities.find(c => c.id === property.cityId)?.displayName ?? cities.find(c => c.id === property.cityId)?.name ?? '')
    : (property as any).city ?? '';
  const mainPhoto = photos.find(p => p.isMain) ?? photos[0];
  const total     = property.totalUnits;
  const occupancy = total > 0 ? Math.round((rentedCount / total) * 100) : 0;
  const typeLabel = TYPE_LABELS[property.type] ?? property.type;
  const typeIcon  = TYPE_ICONS[property.type] ?? 'home-outline';
  const place = [location, cityName].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join('، ');

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={() => router.push(`/property/${property.id}` as any)}
      activeOpacity={0.75}
    >
      {mainPhoto?.uri ? (
        <Image source={{ uri: mainPhoto.uri }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={typeIcon as any} size={24} color={colors.primary} />
        </View>
      )}

      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{property.name}</Text>
        <Text style={[styles.place, { color: colors.textMuted }]} numberOfLines={1}>
          {[typeLabel, place].filter(Boolean).join('، ')}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {total} {total === 1 ? 'وحدة' : 'وحدات'}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>·</Text>
          <Text style={[styles.meta, { color: colors.success }]}>{rentedCount} مؤجرة</Text>
          {vacantCount > 0 && (
            <>
              <Text style={[styles.meta, { color: colors.textMuted }]}>·</Text>
              <Text style={[styles.meta, { color: colors.warning }]}>{vacantCount} شاغرة</Text>
            </>
          )}
        </View>
      </View>

      <View style={[styles.occ, { backgroundColor: colors.surface }]}>
        <Text style={[styles.occVal, { color: colors.text }]}>{occupancy}%</Text>
        <Text style={[styles.occLbl, { color: colors.textMuted }]}>مؤجّر</Text>
      </View>
      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginHorizontal: Theme.spacing.base, marginBottom: Theme.spacing.sm },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  name: { fontSize: 15, fontWeight: '600', textAlign: 'right' },
  place: { fontSize: 12, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  meta: { fontSize: 12, fontWeight: '500' },
  occ: { width: 54, borderRadius: 8, paddingVertical: 6, alignItems: 'center' },
  occVal: { fontSize: 14, fontWeight: '700' },
  occLbl: { fontSize: 10 },
});
