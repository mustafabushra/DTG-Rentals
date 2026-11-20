/**
 * صفحة الخط الزمني الكاملة. للمالك: أحداثه هو. للموظف: ?ownerId=... لمالك محدد.
 */
import { PageHint } from '../components/ui/PageHint';
import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { AppHeader } from '../components/ui/AppHeader';
import { OwnerTimeline } from '../components/owners/OwnerTimeline';
import { useApp } from '../context/AppProvider';
import { useAppTheme } from '../hooks/useAppTheme';

export default function OwnerTimelineScreen() {
  const { colors } = useAppTheme();
  const { ownerId: param } = useLocalSearchParams<{ ownerId?: string }>();
  const { owners, currentUser, isOwner, previewing, previewOwnerId } = useApp() as any;
  const ownerMode = isOwner || previewing;
  const ownerId: string | undefined = ownerMode ? (previewing ? previewOwnerId : currentUser?.ownerId) : param;
  const name = owners?.find((o: any) => o.id === ownerId)?.name;
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader title={ownerMode ? 'الخط الزمني' : `الخط الزمني${name ? ` — ${name}` : ''}`} showBack={!ownerMode} />
      <PageHint text="كل اللي صار في عقاراتك بالترتيب: دفعات، عقود، صيانة، مصاريف." />
      <ScrollView contentContainerStyle={styles.content}>
        <OwnerTimeline ownerId={ownerId} title="كل الأحداث" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, width: '100%', maxWidth: 820, alignSelf: 'center' },
});
