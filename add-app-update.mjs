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

// ── سجلّ التحديثات ─────────────────────────────────────────────────────────────
// معرّف ثابت لكل سجل ⇒ إعادة التشغيل تُحدّث ولا تُكرّر. الترتيب يُحسب تلقائياً
// بحيث يظهر الأحدث في القمة، ويُضاف فقط ما لم يُنشر بعد.
const UPDATES = [
  {
    id:      'collections-center',
    version: 'ميزة جديدة',
    date:    '15 سبتمبر 2026',
    title:   'مركز التحصيل',
    description:
      'شاشة واحدة تجمع كل المستحقات: من تأخّر، وكم، ومنذ متى، ومن ذُكِّر ومتى. لكل مستأجر زر ' +
      'تذكير يفتح واتساب برسالة جاهزة تغطي كل أقساطه المستحقة في رسالة واحدة — لا رسالة لكل قسط. ' +
      'النبرة تتغيّر بين المطالبة بمتأخر والتذكير قبل الاستحقاق، ومفتاح الدولة يُشتق من عملة العقار. ' +
      'يُسجَّل التذكير بعد فتح المراسلة فعلاً، فتعرف من وصلته الرسالة ومن لم تصله بلا إلحاح مكرر.',
    icon:  'megaphone-outline',
    color: '#0F9D58',
  },
  {
    id:      'contract-renewals',
    version: 'ميزة جديدة',
    date:    '15 سبتمبر 2026',
    title:   'تجديد العقود',
    description:
      'العقود المنتهية والتي تنتهي خلال 30 أو 60 أو 90 يوماً، مرتّبة بالإلحاح، مع «القيمة المعرّضة» ' +
      'التي قد تخسرها لو لم تُجدَّد. لكل عقد رسالة واتساب جاهزة (استفسار قبل الانتهاء ومتابعة بعده) ' +
      'وتجديد بضغطة. وصار زر التجديد يظهر قبل انتهاء العقد لا بعده فقط، فلا تُفرَّغ الوحدة بلا داعٍ.',
    icon:  'refresh-outline',
    color: '#1E88E5',
  },
  {
    id:      'booking-editing',
    version: 'تحسين',
    date:    '15 سبتمبر 2026',
    title:   'تعديل الحجوزات وحماية نوع التأجير',
    description:
      'صار بإمكانك تعديل أي حجز (الضيف، التواريخ، سعر الليلة، المحصّل) وإعادة تفعيل حجز ملغى بعد ' +
      'إعادة فحص التعارض. ويمنع النظام تحويل وحدة عليها عقد نشط إلى تأجير يومي، أو وحدة عليها ' +
      'حجز قائم إلى تأجير طويل الأجل — مع بيان السبب.',
    icon:  'create-outline',
    color: '#8B5CF6',
  },
  {
    id:      'reliability-sep-2026',
    version: 'إصلاحات',
    date:    '15 سبتمبر 2026',
    title:   'موثوقية الدفعات والعقود',
    description:
      'دفعة أكّدت استلامها كانت أحياناً تعود «متأخرة» بعد التحديث — أُصلح السبب الجذري ولن تتكرر. ' +
      'وزر تأكيد الاستلام صار يظهر للدفعات المتأخرة أيضاً فلا تحتاج مسار تسجيل دفعة. ' +
      'وتعديل قيمة عقد لم يعد يمسّ المدفوعات والمتأخرات المسجَّلة إطلاقاً، ويرفض التعديل بسبب واضح ' +
      'إن كانت القيمة الجديدة أقل من الالتزامات المحفوظة. وأُصلح الدخول الذي كان يتطلب تحديث الصفحة.',
    icon:  'shield-checkmark-outline',
    color: '#D4880A',
  },
];

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

  // ترتيب أعلى من كل السجلات الحالية ليظهر الأحدث في القمة (order تنازلي)
  const snap = await getDocs(collection(db, 'appUpdates'));
  const existing = new Map();
  let maxOrder = 0;
  snap.forEach(d => {
    existing.set(d.id, d.data());
    const o = d.data().order;
    if (typeof o === 'number' && o > maxOrder) maxOrder = o;
  });

  let order = maxOrder;
  for (const { id, ...update } of UPDATES) {
    const had = existing.has(id);
    // السجل الجديد يأخذ ترتيباً أعلى؛ الموجود يحتفظ بترتيبه فلا تتبعثر القائمة
    const nextOrder = had ? (existing.get(id).order ?? ++order) : ++order;
    await setDoc(doc(db, 'appUpdates', id), { ...update, order: nextOrder }, { merge: true });
    console.log(`${had ? '↻ تحديث' : '✅ إضافة'}  ${id.padEnd(22)} order=${nextOrder}  ${update.title}`);
  }

  console.log(`
💡 ${UPDATES.length} سجلات مُعالَجة — تظهر فوراً في صفحة «آخر التحديثات» عبر onSnapshot.`);
  process.exit(0);
}

main().catch(e => { console.error('❌ خطأ:', e.message || e); process.exit(1); });
