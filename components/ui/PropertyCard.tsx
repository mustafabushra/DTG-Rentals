import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, useWindowDimensions } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Theme } from '../../constants/Theme';
import type { PropertyPhoto } from '../../context/AppProvider';
import { useAppTheme } from '../../hooks/useAppTheme';

interface PropertyCardProps {
  property: {
    id: string;
    name: string;
    type: string;
    address?: string;
    location?: string;
    city?: string;
    totalUnits: number;
    status?: string;
  };
  photos?: PropertyPhoto[];
  rentedCount?: number;
  vacantCount?: number;
  onDelete?: () => void;
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
const TYPE_COLORS: Record<string, [string, string]> = {
  apartment: ['#1E3A5F', '#2E86AB'],
  villa:     ['#1B4332', '#40916C'],
  office:    ['#3D0066', '#7B2FBE'],
  shop:      ['#7A0000', '#C62828'],
  building:  ['#1A237E', '#3949AB'],
  tower:     ['#0D47A1', '#1565C0'],
  land:      ['#33691E', '#558B2F'],
};

export function PropertyCard({ property, photos = [], rentedCount = 0, vacantCount = 0, onDelete }: PropertyCardProps) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();

  const location = property.address ?? property.location ?? '';
  const city     = property.city ?? '';
  const mainPhoto = photos.find(p => p.isMain) ?? photos[0];
  const photoUri  = mainPhoto?.uri;
  const total     = property.totalUnits;
  const occupancy = total > 0 ? Math.round((rentedCount / total) * 100) : 0;
  const typeLabel = TYPE_LABELS[property.type] ?? property.type;
  const typeIcon  = TYPE_ICONS[property.type] ?? 'home-outline';
  const [bgFrom]  = TYPE_COLORS[property.type] ?? ['#1E3A5F', '#2E86AB'];

  // Responsive image height: 44% of card width (card = screen - 32px margin)
  const imageHeight = Math.round((width - 32) * 0.44);

  const occupancyColor =
    occupancy >= 80 ? colors.success :
    occupancy >= 50 ? colors.warning :
    colors.danger;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, Theme.shadow.md]}
      onPress={() => router.push(`/property/${property.id}` as any)}
      activeOpacity={0.88}
    >
      {/* ── Image / Placeholder ── */}
      <View style={[styles.imageWrap, { height: imageHeight }]}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: bgFrom }]}>
            <Ionicons name={typeIcon as any} size={48} color="rgba(255,255,255,0.35)" />
          </View>
        )}

        {/* Type badge — top right */}
        <View style={[styles.typeBadge, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
          <Ionicons name={typeIcon as any} size={11} color="#fff" />
          <Text style={styles.typeBadgeText}>{typeLabel}</Text>
        </View>

        {/* Occupancy pill — top left */}
        <View style={[styles.occupancyBadge, { backgroundColor: occupancyColor }]}>
          <Text style={styles.occupancyText}>{occupancy}%</Text>
        </View>

        {/* Delete button — bottom left */}
        {onDelete && (
          <TouchableOpacity
            style={styles.deleteOverlay}
            onPress={e => { (e as any).stopPropagation?.(); onDelete(); }}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Ionicons name="trash-outline" size={15} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Gradient overlay */}
        <View style={styles.gradientOverlay} pointerEvents="none" />

        {/* Name + location overlay — bottom */}
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.overlayName} numberOfLines={1}>{property.name}</Text>
          {(location || city) && (
            <View style={styles.overlayLocation}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.8)" />
              <Text style={styles.overlayLocationText} numberOfLines={1}>
                {[location, city].filter(Boolean).join('، ')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Stats row ── */}
      <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
        <StatBox value={rentedCount} label="مؤجرة" color={colors.success} icon="key-outline" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <StatBox value={vacantCount} label="شاغرة" color={colors.warning} icon="home-outline" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <StatBox value={total} label="إجمالي" color={colors.text} icon="grid-outline" />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {/* Occupancy bar */}
        <View style={styles.occupancyBox}>
          <View style={styles.occupancyBarWrap}>
            <View style={[styles.occupancyBarFill, { width: `${occupancy}%` as any, backgroundColor: occupancyColor }]} />
          </View>
          <Text style={[styles.occupancyLabel, { color: occupancyColor }]}>إشغال {occupancy}%</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatBox({ value, label, color, icon }: { value: number; label: string; color: string; icon: string }) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon as any} size={13} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Theme.radius.xl,
    borderWidth: 1,
    marginHorizontal: Theme.spacing.base,
    marginBottom: 12,
    overflow: 'hidden',
  },
  imageWrap: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 20,
  },
  // We use a semi-transparent dark bar instead of LinearGradient
  overlayName: {
    color: '#FFFFFF',
    fontSize: Theme.fontSize.lg,
    fontWeight: Theme.fontWeight.bold,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    textAlign: 'right',
  },
  overlayLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  overlayLocationText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: Theme.fontSize.xs,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  typeBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  typeBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  occupancyBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: Theme.radius.full,
  },
  occupancyText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  deleteOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    backgroundColor: 'rgba(200,30,30,0.75)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statValue: {
    fontSize: Theme.fontSize.base,
    fontWeight: Theme.fontWeight.bold,
    lineHeight: 18,
  },
  statLabel: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  divider: {
    width: 1,
    height: 28,
    marginHorizontal: 4,
  },
  occupancyBox: {
    flex: 1.4,
    alignItems: 'center',
    gap: 4,
  },
  occupancyBarWrap: {
    width: '85%',
    height: 5,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 99,
    overflow: 'hidden',
  },
  occupancyBarFill: {
    height: '100%',
    borderRadius: 99,
  },
  occupancyLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
});
