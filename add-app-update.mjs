/**
 * Script: إضافة سجل تحديث إلى صفحة "آخر التحديثات" (مجموعة appUpdates)
 *
 * كتابة appUpdates مقصورة على المدير الأعلى (super-admin) في firestore.rules،
 * لذلك يسجّل هذا السكربت الدخول أولاً بحساب المدير الأعلى ثم يكتب المستند.
 *
 * الاستخدام (لا تُخزَّن كلمة المرور في الملف — تُمرَّر لحظة التشغيل):
 *   SUPERADMIN_EMAIL=you@example.com SUPERADMIN_PASSWORD=•••• node add-app-update.mjs
 * أو (البريد الافتراضي مضبوط أدناه):
 *   SUPERADMIN_PASSWORD=•••• node add-app-update.mjs
 *
 * السكربت idempotent: يستخدم معرّف مستند ثابت، فإعادة تشغيله تُحدّث نفس السجل.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// ── معرّف المستند الثابت + محتوى التحديث ──────────────────────────────────────
const UPDATE_ID = 'holiday-homes';
const UPDATE = {
  version:     'ميزة جديدة',
  date:        '8 يوليو 2026',
  title:       'بيوت المصيف (الإيجار اليومي)',
  description:
    'أصبح بإمكانك إدارة الوحدات كبيوت مصيف بالإيجار اليومي. فعّل «نوع التأجير: يومي» على أي وحدة، ' +
    'ثم أضف حجوزات بتواريخ الوصول والمغادرة وسعر الليلة. يُحتسب الإيراد فقط لليالي المحجوزة فعلياً ' +
    '(لا حجز = لا إيراد)، ويظهر منفصلاً عن إيرادات العقود طويلة الأجل في لوحة التحكم والتقارير المالية، ' +
    'مع عرض نسبة الإشغال. يمنع النظام الحجوزات المتعارضة تلقائياً.',
  icon:        'moon-outline',
  color:       '#8B5CF6',
};

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'mustafabushra1779@gmail.com';
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!password) {
    console.error('❌ مطلوب: مرّر كلمة مرور المدير الأعلى عبر SUPERADMIN_PASSWORD');
    console.error('   مثال: SUPERADMIN_PASSWORD=••• node add-app-update.mjs');
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`🔐 تسجيل الدخول بحساب: ${email} ...`);
  await signInWithEmailAndPassword(auth, email, password);
  console.log('✅ تم تسجيل الدخول');

  // ترتيب أعلى من كل السجلات الحالية ليظهر التحديث في القمة (order تنازلي)
  const snap = await getDocs(collection(db, 'appUpdates'));
  let maxOrder = 0;
  snap.forEach(d => { const o = d.data().order; if (typeof o === 'number' && o > maxOrder) maxOrder = o; });
  const order = maxOrder + 1;

  await setDoc(doc(db, 'appUpdates', UPDATE_ID), { ...UPDATE, order }, { merge: true });
  console.log(`✅ تمت إضافة/تحديث السجل "${UPDATE.title}" (order=${order})`);
  console.log('💡 سيظهر فوراً في صفحة «آخر التحديثات» عبر onSnapshot.');
  process.exit(0);
}

main().catch(e => { console.error('❌ خطأ:', e.message || e); process.exit(1); });
