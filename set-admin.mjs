import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyBxvM8zwsGFnKsKjRSko5sLNnYA8XqFLqU',
  authDomain:        'dtg-rentals.firebaseapp.com',
  projectId:         'dtg-rentals',
  storageBucket:     'dtg-rentals.firebasestorage.app',
  messagingSenderId: '644083087896',
  appId:             '1:644083087896:web:d2614e6d597ee6f2b0616d',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const USER_ID = 'z70x4OkpfZcOuYjCbihlOmYx5MB2';

const ref = doc(db, 'users', USER_ID);
const snap = await getDoc(ref);

if (snap.exists()) {
  console.log('المستخدم الحالي:', snap.data());
} else {
  console.log('المستخدم غير موجود، سيتم إنشاء السجل...');
}

await setDoc(ref, { role: 'admin' }, { merge: true });
console.log('✅ تم تعيين المستخدم', USER_ID, 'كـ admin بنجاح.');

process.exit(0);
