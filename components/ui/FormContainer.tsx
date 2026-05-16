/**
 * FormContainer — centers and limits form width on wide web screens.
 * Wrap the main ScrollView content in this to get a clean centered form layout.
 */
import React from 'react';
import { Platform, View } from 'react-native';
import { useScreenSize } from '../../hooks/useScreenSize';

const FORM_MAX_W = 640;

interface Props {
  children: React.ReactNode;
}

export function FormContainer({ children }: Props) {
  const { isWide } = useScreenSize();

  if (Platform.OS !== 'web' || !isWide) return <>{children}</>;

  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <View style={{ width: '100%', maxWidth: FORM_MAX_W, flex: 1 }}>
        {children}
      </View>
    </View>
  );
}
