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
import { getFirestore, collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
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
// سجلات أُنشئت في نسخة سابقة من هذا السكربت واستُبدلت بأخرى أدق — تُحذف إن وُجدت
// حتى لا يبقى سجل يتيم مكرّر المعنى في الصفحة.
const OBSOLETE_IDS = ['reliability-sep-2026'];

const UPDATES = [
  // ── 7 سبتمبر 2026 ──────────────────────────────────────────────────────────
  {
    id:      'booking-editing',
    version: 'تحسين',
    date:    '7 سبتمبر 2026',
    title:   'تعديل الحجوزات وحماية نوع التأجير',
    description:
      'صار بإمكانك تعديل أي حجز بعد إنشائه: اسم الضيف، تواريخ الوصول والمغادرة، سعر الليلة، ' +
      'والمبلغ المحصّل — مع كشف تعارض لا يحسب الحجز متعارضاً مع نفسه. ويمكن إعادة تفعيل حجز ملغى ' +
      'بعد إعادة فحص التعارض، لأن لياليه تكون قد تحرّرت وربما حُجزت. ' +
      'وأصبح النظام يمنع تحويل وحدة عليها عقد نشط إلى تأجير يومي، أو وحدة عليها حجز قائم أو قادم ' +
      'إلى تأجير طويل الأجل — مع بيان السبب بدل منع صامت.',
    icon:  'create-outline',
    color: '#8B5CF6',
  },
  {
    id:      'payment-status-fix',
    version: 'إصلاح مهم',
    date:    '7 سبتمبر 2026',
    title:   'الدفعات المؤكَّدة لم تعد ترجع «متأخرة»',
    description:
      'كانت دفعة تؤكّد استلامها أحياناً تعود إلى قائمة المتأخرات بعد تحديث الصفحة، وتبقى كذلك. ' +
      'السبب: تحميل البيانات في الخلفية كان يكتب الحالة القديمة فوق الحالة الجديدة التي حفظتها للتو. ' +
      'أُصلح السبب من جذره: وسم المتأخرات صار لا يمرّ فوق دفعة مسدَّدة أبداً، وأي بيانات واردة من ' +
      'الخادم تُوفَّق مع تعديلاتك بدل أن تستبدلها. ينطبق الآن على كل شاشات التطبيق لا الدفعات وحدها.',
    icon:  'shield-checkmark-outline',
    color: '#C94535',
  },
  {
    id:      'confirm-overdue-button',
    version: 'تحسين',
    date:    '7 سبتمبر 2026',
    title:   'تأكيد الاستلام للدفعات المتأخرة',
    description:
      'زر «تأكيد استلام الدفعة» صار يظهر للدفعات المتأخرة أيضاً لا للمعلّقة فقط. ' +
      'قبل ذلك كان من يفتح دفعة متأخرة من تنبيهات لوحة التحكم يجدها بلا زر تأكيد فيضطر لمسار ' +
      '«تسجيل دفعة» الأطول. فوات الاستحقاق لا يعني أن الدفعة تحتاج مساراً آخر — بل أنها لم تُسدَّد بعد.',
    icon:  'checkmark-circle-outline',
    color: '#2A9D5C',
  },
  {
    id:      'quality-hardening',
    version: 'جودة',
    date:    '7 سبتمبر 2026',
    title:   'تمتين التطبيق من الداخل',
    description:
      'مراجعة شاملة لقاعدة الكود: أُصلحت ألوان مفقودة كانت تجعل أزرار الفلترة بلا خلفية وتمييز ' +
      'حقول الإدخال لا يعمل، وحُذف أكثر من 1400 سطر كود ميت كان يوهم بأنه يعمل، وصُفِّرت 49 مشكلة ' +
      'في سلامة الأنواع. وأُضيفت منظومة اختبارات آلية تعمل قبل كل نشر، فلا يصل خلل إلى التطبيق ' +
      'لمجرد أن البناء نجح.',
    icon:  'construct-outline',
    color: '#2E5580',
  },

  // ── 14 سبتمبر 2026 ─────────────────────────────────────────────────────────
  {
    id:      'collections-center',
    version: 'ميزة جديدة',
    date:    '14 سبتمبر 2026',
    title:   'مركز التحصيل',
    description:
      'شاشة واحدة تجمع كل المستحقات: من تأخّر، وكم، ومنذ متى، ومن ذُكِّر ومتى. ' +
      'لكل مستأجر زر تذكير يفتح واتساب برسالة جاهزة تغطي كل أقساطه المستحقة في رسالة واحدة — ' +
      'لا رسالة لكل قسط. النبرة تتغيّر بين المطالبة بمتأخر والتذكير قبل الاستحقاق، ومفتاح الدولة ' +
      'يُشتق من عملة العقار فيعمل مع كل الدول المدعومة. ' +
      'ويُسجَّل التذكير بعد فتح المراسلة فعلاً، فتعرف من وصلته الرسالة ومن لم تصله بلا إلحاح مكرر.',
    icon:  'megaphone-outline',
    color: '#0F9D58',
  },
  {
    id:      'contract-renewals',
    version: 'ميزة جديدة',
    date:    '14 سبتمبر 2026',
    title:   'تجديد العقود',
    description:
      'شاشة تعرض العقود المنتهية والتي تنتهي خلال 30 أو 60 أو 90 يوماً، مرتّبة بالإلحاح، ' +
      'مع «القيمة المعرّضة» التي قد تخسرها لو لم تُجدَّد. لكل عقد رسالة واتساب جاهزة — استفسار قبل ' +
      'الانتهاء ومتابعة بعده — وتجديد بضغطة واحدة. ' +
      'وصار زر التجديد يظهر قبل انتهاء العقد لا بعده فقط، فلا تُفرَّغ الوحدة بلا داعٍ. ' +
      'وحساب المدة الجديدة صار تقويمياً، فعقد ستة أشهر يُجدَّد ستة أشهر كاملة بلا انزياح أيام.',
    icon:  'refresh-outline',
    color: '#1E88E5',
  },

  // ── 15 سبتمبر 2026 ─────────────────────────────────────────────────────────
  {
    id:      'contract-data-integrity',
    version: 'إصلاح مهم',
    date:    '15 سبتمبر 2026',
    title:   'حماية سجل المدفوعات عند تعديل العقد',
    description:
      'كان تعديل القيمة السنوية أو عدد الأقساط أو تواريخ العقد يحذف كل دفعة غير مسدَّدة — ' +
      'ومنها المتأخرات — فيختفي دَين المستأجر بلا أثر. ' +
      'الآن المدفوعات والمتأخرات المسجَّلة لا تُمسّ إطلاقاً، ويُعاد جدولة الأقساط المستقبلية وحدها. ' +
      'وإذا كانت القيمة الجديدة أقل من الالتزامات المسجَّلة، أو كان التعديل غامضاً، يُرفض الحفظ ' +
      'برسالة تشرح السبب بالأرقام قبل أن يُكتب أي شيء. ' +
      'والتعديل والتجديد صارا يُحفظان كوحدة واحدة: إما أن ينجح كل شيء أو لا يتغيّر شيء. ' +
      'كذلك أصبح «غير المسدَّد» في صفحة العقد يُحسب من الأقساط الفعلية، فلا يظهر رقماً خاطئاً بعد التجديد.',
    icon:  'lock-closed-outline',
    color: '#D4880A',
  },
  {
    id:      'login-redirect-fix',
    version: 'إصلاح',
    date:    '15 سبتمبر 2026',
    title:   'الدخول يعمل من أول ضغطة',
    description:
      'كان الضغط على «دخول» ينجح أحياناً بلا أن ينقلك إلى التطبيق، فتضطر لتحديث الصفحة يدوياً. ' +
      'السبب أن قرار الانتقال كان يُتخذ مرة واحدة، فإن وقع قبل جهوزية الصفحة لم يُعد النظر فيه أبداً. ' +
      'صار القرار يُراجَع تلقائياً حتى ينتقل بك فعلاً.',
    icon:  'log-in-outline',
    color: '#2A9D5C',
  },
  {
    id:      'owner-preview',
    version: 'ميزة جديدة',
    date:    '15 سبتمبر 2026',
    title:   'معاينة بعين المالك',
    description:
      'يستطيع المدير الآن رؤية التطبيق كما يراه أي مالك، بلا استخدام بريده أو كلمة مروره. ' +
      'من صفحة المالك اضغط «عرض التطبيق بعين هذا المالك»، فتُعرض عقاراته ووحداته وعقوده ودفعاته ' +
      'وتقاريره فقط. ' +
      'الوضع **عرض فقط**: أزرار الإضافة والتعديل والحذف معطّلة، حمايةً لسجل التدقيق من تسجيل تعديل ' +
      'باسم المالك لم يقم به. وشريط دائم أعلى الشاشة يذكّرك بالوضع وفيه زر خروج فوري. ' +
      'ويُسجَّل الدخول إلى المعاينة في سجل الإجراءات.',
    icon:  'eye-outline',
    color: '#7B3FA0',
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

  for (const id of OBSOLETE_IDS) {
    if (existing.has(id)) {
      await deleteDoc(doc(db, 'appUpdates', id));
      console.log(`🗑  حذف سجل متقادم  ${id}`);
    }
  }

  console.log(`
💡 ${UPDATES.length} سجلات مُعالَجة — تظهر فوراً في صفحة «آخر التحديثات» عبر onSnapshot.`);
  process.exit(0);
}

main().catch(e => { console.error('❌ خطأ:', e.message || e); process.exit(1); });
