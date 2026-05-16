import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { RTLTabBar } from '../../components/navigation/RTLTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      // إزالة كل مساحة tab bar على الويب (display:none وحده لا يكفي — RN يضيف paddingBottom)
      {...(Platform.OS === 'web' ? { safeAreaInsets: { bottom: 0 } } : {})}
      screenOptions={{
        headerShown: false,
        tabBarStyle: Platform.OS === 'web' ? { height: 0, minHeight: 0, display: 'none' } : undefined,
      }}
      tabBar={props => <RTLTabBar {...props} />}
    >
      <Tabs.Screen name="index"      options={{ title: 'الرئيسية' }} />
      <Tabs.Screen name="owners"     options={{ title: 'الملاك'   }} />
      <Tabs.Screen name="properties" options={{ title: 'العقارات' }} />
      <Tabs.Screen name="contracts"  options={{ title: 'العقود'   }} />
      <Tabs.Screen name="more"       options={{ title: 'المزيد', href: null }} />
    </Tabs>
  );
}
