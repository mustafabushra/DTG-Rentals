/**
 * Script: تحديث العقارات بإضافة cityId بناءً على اسم المدينة في حقل location
 * 
 * الاستخدام:
 * 1. تأكد من وجود ملف .env.local مع بيانات Firebase
 * 2. شغل: node update-properties-cities.mjs
 * 
 * هذا السكربت:
 * - يقرأ جميع العقارات من Firestore
 * - يستخرج اسم المدينة من حقل location
 * - يطابقها مع المدن الموجودة
 * - يحدث كل عقار بـ cityId
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import * as dotenv from 'dotenv';

// تحميل متغيرات البيئة
dotenv.config({ path: '.env.local' });

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// دالة لتوحيد أسماء المدن
function normalizeCityName(name) {
  let s = name.trim();
  s = s.replace(/ة$/g, 'ه');
  s = s.replace(/[أإآ]/g, 'ا');
  s = s.replace(/\s+/g, ' ');
  return s;
}

// استخراج اسم المدينة من location
function extractCityFromLocation(location) {
  // عادة الموقع يكون بالصيغة: "المدينة - الحي" أو "المدينة - حي"
  const parts = location.split(' - ');
  if (parts.length > 0) {
    return parts[0].trim();
  }
  return location.trim();
}

async function main() {
  console.log('🔄 بدء تحديث العقارات مع المدن...\n');

  try {
    // 1. قراءة جميع المدن
    const citiesRef = collection(db, 'orgs', 'main', 'cities');
    const citiesSnapshot = await getDocs(citiesRef);
    const cities = citiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`📊 تم العثور على ${cities.length} مدينة:`);
    cities.forEach(city => {
      console.log(`   - ${city.displayName || city.name} (${city.id})`);
    });

    // إنشاء خريطة: اسم موحد → cityId
    const cityMap = new Map();
    cities.forEach(city => {
      const normalized = normalizeCityName(city.name);
      cityMap.set(normalized, city.id);
      if (city.displayName) {
        const displayNormalized = normalizeCityName(city.displayName);
        cityMap.set(displayNormalized, city.id);
      }
    });

    // 2. قراءة جميع العقارات
    const propertiesRef = collection(db, 'orgs', 'main', 'properties');
    const propertiesSnapshot = await getDocs(propertiesRef);
    const properties = propertiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    console.log(`\n🏢 تم العثور على ${properties.length} عقار`);

    // 3. تحديث كل عقار
    let updated = 0;
    let skipped = 0;
    const updates = [];

    for (const property of properties) {
      // تخطي العقارات التي لها cityId بالفعل
      if (property.cityId) {
        skipped++;
        continue;
      }

      // محاولة استخراج المدينة من location
      const location = property.location || property.city || '';
      if (!location) {
        console.log(`   ⚠️  ${property.name}: لا يوجد حقل location أو city`);
        continue;
      }

      const cityName = extractCityFromLocation(location);
      const normalizedCity = normalizeCityName(cityName);
      const cityId = cityMap.get(normalizedCity);

      if (cityId) {
        // تحديث العقار
        const propertyRef = doc(db, 'orgs', 'main', 'properties', property.id);
        await updateDoc(propertyRef, { cityId });
        
        console.log(`   ✅ ${property.name} → ${cityName} (${cityId})`);
        updated++;
        updates.push({
          id: property.id,
          name: property.name,
          cityId,
          cityName
        });
      } else {
        console.log(`   ⚠️  ${property.name}: لم يتم العثور على مدينة مطابقة لـ "${cityName}"`);
      }
    }

    // 4. ملخص
    console.log('\n' + '='.repeat(60));
    console.log('📈 ملخص التحديث:');
    console.log(`   ✅ تم تحديث: ${updated} عقار`);
    console.log(`   ⏭️  تم تخطيه: ${skipped} عقار (لديه cityId بالفعل)`);
    console.log(`   📊 إجمالي العقارات: ${properties.length}`);
    console.log('='.repeat(60));

    if (updates.length > 0) {
      console.log('\n📋 قائمة العقارات المحدثة:');
      updates.forEach(u => {
        console.log(`   • ${u.name} → ${u.cityName}`);
      });
    }

    console.log('\n✅ تم الانتهاء من التحديث بنجاح!');
    console.log('💡 يمكنك الآن فتح التطبيق وستظهر الإحصائيات الجغرافية بشكل صحيح.');

  } catch (error) {
    console.error('\n❌ خطأ أثناء التحديث:', error);
    process.exit(1);
  }
}

main().catch(console.error);