/**
 * PWAInstallPrompt — "Add to Home Screen" onboarding modal + floating button.
 *
 * iOS:     animated step-by-step Safari instructions.
 * Android: direct install via beforeinstallprompt API.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Platform, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { usePWAInstall } from '../../hooks/usePWAInstall';

// ─── Colour tokens ────────────────────────────────────────────────────────────
const C = {
  navy:       '#021C36',
  navyLight:  '#0D2D4A',
  gold:       '#C3AF76',
  goldDim:    'rgba(195,175,118,0.15)',
  white:      '#FFFFFF',
  offWhite:   '#F5F3EE',
  textDark:   '#1A1A2E',
  textMuted:  'rgba(255,255,255,0.60)',
  overlay:    'rgba(2,28,54,0.75)',
};

// ─── Entry point (web-only guard) ─────────────────────────────────────────────
export function PWAInstallPrompt() {
  if (Platform.OS !== 'web') return null;
  return <PWAInstallPromptInner />;
}

function PWAInstallPromptInner() {
  const { installState, platform, showModal, showFloating, openModal, closeModal, triggerInstall } =
    usePWAInstall();

  if (installState === 'installed' || installState === 'unsupported') return null;

  return (
    <>
      {showModal && (
        <InstallModal
          platform={platform}
          onClose={() => closeModal(false)}
          onDismissPermanently={() => closeModal(true)}
          onInstall={triggerInstall}
        />
      )}
      {showFloating && !showModal && (
        <FloatingButton onPress={openModal} />
      )}
    </>
  );
}

// ─── Backdrop + sliding sheet ─────────────────────────────────────────────────
function InstallModal({
  platform, onClose, onDismissPermanently, onInstall,
}: {
  platform: 'ios' | 'android' | 'other';
  onClose: () => void;
  onDismissPermanently: () => void;
  onInstall: () => Promise<boolean>;
}) {
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslate  = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.spring(sheetTranslate,  { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }),
    ]).start();
  }, []);

  const dismiss = (permanent: boolean) => {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(sheetTranslate,  { toValue: 600, duration: 260, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => (permanent ? onDismissPermanently() : onClose()));
  };

  return (
    <View style={s.root} pointerEvents="box-none">
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={() => dismiss(false)} activeOpacity={1} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
        {/* Drag handle */}
        <View style={s.handle} />

        {/* Close button */}
        <TouchableOpacity style={s.closeBtn} onPress={() => dismiss(false)}>
          <Ionicons name="close" size={20} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* App identity row */}
        <AppIdentity />

        {/* Benefits */}
        <BenefitsList />

        {/* Platform-specific install section */}
        <View style={s.divider} />
        {platform === 'ios'     && <IOSSteps />}
        {platform === 'android' && <AndroidInstall onInstall={onInstall} />}

        {/* Footer */}
        <TouchableOpacity onPress={() => dismiss(true)} style={s.laterBtn}>
          <Text style={s.laterText}>ليس الآن</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── App identity ─────────────────────────────────────────────────────────────
function AppIdentity() {
  return (
    <View style={s.identityRow}>
      <View style={s.appIconWrap}>
        <Text style={s.appIconEmoji}>🏢</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.appName}>DTG Rentals</Text>
        <Text style={s.appSub}>dtg-rentals.web.app</Text>
      </View>
      <View style={s.installBadge}>
        <Text style={s.installBadgeText}>مجاناً</Text>
      </View>
    </View>
  );
}

// ─── Benefits ─────────────────────────────────────────────────────────────────
const BENEFITS = [
  { icon: 'flash-outline',          text: 'وصول فوري من الشاشة الرئيسية' },
  { icon: 'phone-portrait-outline', text: 'تجربة تشبه التطبيق الأصلي'     },
  { icon: 'cloud-offline-outline',  text: 'يعمل بشكل جزئي بدون إنترنت'   },
  { icon: 'notifications-outline',  text: 'إشعارات وتحديثات سريعة'        },
];

function BenefitsList() {
  return (
    <View style={s.benefits}>
      {BENEFITS.map((b, i) => (
        <View key={i} style={s.benefitRow}>
          <View style={s.benefitIcon}>
            <Ionicons name={b.icon as any} size={17} color={C.gold} />
          </View>
          <Text style={s.benefitText}>{b.text}</Text>
        </View>
      ))}
    </View>
  );
}

// ─── iOS step-by-step ─────────────────────────────────────────────────────────
const IOS_STEPS = [
  {
    icon:  'share-outline',
    label: 'اضغط زر المشاركة',
    hint:  'الزر الموجود في شريط Safari السفلي',
    color: '#4A90E2',
  },
  {
    icon:  'add-square-outline',
    label: 'اختر "إضافة إلى الشاشة الرئيسية"',
    hint:  'مرّر القائمة للأسفل وابحث عن هذا الخيار',
    color: C.gold,
  },
  {
    icon:  'checkmark-circle-outline',
    label: 'اضغط "إضافة"',
    hint:  'التطبيق سيظهر على شاشتك الرئيسية فوراً',
    color: '#27AE60',
  },
];

function IOSSteps() {
  const [active, setActive] = useState(0);
  // Auto-advance steps
  useEffect(() => {
    if (active >= IOS_STEPS.length - 1) return;
    const t = setTimeout(() => setActive(p => p + 1), 2200);
    return () => clearTimeout(t);
  }, [active]);

  const stepAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    stepAnim.setValue(0);
    Animated.spring(stepAnim, { toValue: 1, tension: 80, friction: 9, useNativeDriver: true }).start();
  }, [active]);

  const step = IOS_STEPS[active];

  return (
    <View style={s.iosWrap}>
      <Text style={s.sectionLabel}>طريقة التثبيت على iPhone</Text>

      {/* Step dots */}
      <View style={s.stepDots}>
        {IOS_STEPS.map((_, i) => (
          <TouchableOpacity key={i} onPress={() => setActive(i)}>
            <View style={[s.dot, i === active && s.dotActive, { backgroundColor: i === active ? step.color : 'rgba(255,255,255,0.2)' }]} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Active step card */}
      <Animated.View
        style={[
          s.stepCard,
          { borderColor: step.color + '44' },
          {
            opacity:   stepAnim,
            transform: [{ scale: stepAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          },
        ]}
      >
        <View style={[s.stepIconCircle, { backgroundColor: step.color + '22', borderColor: step.color + '55' }]}>
          <Ionicons name={step.icon as any} size={32} color={step.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={s.stepNumRow}>
            <View style={[s.stepNumBadge, { backgroundColor: step.color }]}>
              <Text style={s.stepNumText}>{active + 1}</Text>
            </View>
            <Text style={s.stepLabel}>{step.label}</Text>
          </View>
          <Text style={s.stepHint}>{step.hint}</Text>
        </View>
      </Animated.View>

      {/* All steps list (collapsed) */}
      <View style={s.stepsList}>
        {IOS_STEPS.map((st, i) => (
          <TouchableOpacity key={i} style={s.stepsListRow} onPress={() => setActive(i)}>
            <View style={[s.stepsListNum, i <= active && { backgroundColor: st.color }]}>
              {i < active
                ? <Ionicons name="checkmark" size={11} color="#fff" />
                : <Text style={[s.stepsListNumText, i === active && { color: st.color }]}>{i + 1}</Text>
              }
            </View>
            <Text style={[s.stepsListText, i === active && { color: '#fff', fontWeight: '600' }]}>
              {st.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* iOS share arrow hint */}
      <View style={s.iosArrowHint}>
        <Ionicons name="arrow-down-outline" size={14} color={C.gold} />
        <Text style={s.iosArrowText}>انظر إلى أسفل الشاشة في Safari</Text>
      </View>
    </View>
  );
}

// ─── Android install ──────────────────────────────────────────────────────────
function AndroidInstall({ onInstall }: { onInstall: () => Promise<boolean> }) {
  const [loading, setLoading] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.03, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const handleInstall = async () => {
    setLoading(true);
    await onInstall();
    setLoading(false);
  };

  return (
    <View style={s.androidWrap}>
      <Text style={s.sectionLabel}>تثبيت التطبيق على Android</Text>
      <Text style={s.androidDesc}>
        اضغط الزر أدناه لتثبيت التطبيق مباشرةً على هاتفك — بدون متجر تطبيقات، بدون إنترنت لاحقاً.
      </Text>

      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <TouchableOpacity
          style={[s.androidBtn, loading && { opacity: 0.6 }]}
          onPress={handleInstall}
          disabled={loading}
          activeOpacity={0.85}
        >
          <Ionicons name="download-outline" size={22} color={C.navy} style={{ marginLeft: 8 }} />
          <Text style={s.androidBtnText}>{loading ? 'جارٍ التثبيت…' : 'تثبيت التطبيق الآن'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <View style={s.androidFeatures}>
        {['سريع', 'آمن', 'مجاني'].map(f => (
          <View key={f} style={s.featureChip}>
            <Text style={s.featureChipText}>{f}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Floating button ──────────────────────────────────────────────────────────
function FloatingButton({ onPress }: { onPress: () => void }) {
  const slideAnim = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }).start();
  }, []);

  return (
    <Animated.View style={[s.floatingWrap, { transform: [{ translateY: slideAnim }] }]}>
      <TouchableOpacity style={s.floatingBtn} onPress={onPress} activeOpacity={0.88}>
        <Ionicons name="download-outline" size={16} color={C.navy} />
        <Text style={s.floatingText}>ثبّت التطبيق</Text>
        <Ionicons name="chevron-up-outline" size={14} color={C.navy} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Layout
  root: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.overlay,
  },
  sheet: {
    backgroundColor: C.navy,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 32,
    shadowOffset: { width: 0, height: -8 }, elevation: 24,
    maxHeight: '92%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 20,
  },
  closeBtn: {
    position: 'absolute', top: 20, left: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Identity
  identityRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 14, marginBottom: 20,
  },
  appIconWrap: {
    width: 60, height: 60, borderRadius: 14,
    backgroundColor: C.navyLight,
    borderWidth: 1, borderColor: 'rgba(195,175,118,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  appIconEmoji:  { fontSize: 30 },
  appName:       { fontSize: 20, fontWeight: '700', color: C.white },
  appSub:        { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  installBadge:  {
    backgroundColor: C.goldDim, borderWidth: 1, borderColor: C.gold,
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  installBadgeText: { color: C.gold, fontSize: 12, fontWeight: '700' },

  // Benefits
  benefits: { gap: 10, marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitIcon: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: C.goldDim, alignItems: 'center', justifyContent: 'center',
  },
  benefitText: { color: 'rgba(255,255,255,0.80)', fontSize: 14, flex: 1 },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },

  sectionLabel: {
    color: C.gold, fontSize: 13, fontWeight: '700',
    letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase',
  },

  // iOS
  iosWrap: { gap: 14 },
  stepDots: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotActive: { width: 24 },

  stepCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16, padding: 16,
  },
  stepIconCircle: {
    width: 64, height: 64, borderRadius: 18,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  stepNumRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  stepNumBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  stepNumText:  { color: C.navy, fontWeight: '800', fontSize: 12 },
  stepLabel:    { color: C.white, fontWeight: '700', fontSize: 14, flex: 1 },
  stepHint:     { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 18 },

  stepsList: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12, padding: 4, gap: 2,
  },
  stepsListRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  stepsListNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  stepsListNumText: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700' },
  stepsListText:    { color: 'rgba(255,255,255,0.55)', fontSize: 13 },

  iosArrowHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.goldDim, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'center',
  },
  iosArrowText: { color: C.gold, fontSize: 12, fontWeight: '600' },

  // Android
  androidWrap: { gap: 14 },
  androidDesc: { color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 21 },
  androidBtn: {
    backgroundColor: C.gold,
    borderRadius: 16, paddingVertical: 17,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: C.gold, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  androidBtnText: { color: C.navy, fontWeight: '800', fontSize: 17 },
  androidFeatures: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  featureChip: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5,
  },
  featureChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },

  // Dismiss
  laterBtn: { alignItems: 'center', paddingVertical: 14, marginTop: 4 },
  laterText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },

  // Floating
  floatingWrap: {
    position: 'absolute', bottom: 24, alignSelf: 'center',
    zIndex: 9998,
  },
  floatingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.gold, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 12,
    shadowColor: C.gold, shadowOpacity: 0.45, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  floatingText: { color: C.navy, fontWeight: '700', fontSize: 14 },
});
