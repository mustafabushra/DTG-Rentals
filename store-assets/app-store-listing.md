# DTG Rentals — App Store Listing

## App Name
DTG Rentals — إدارة العقارات

## Subtitle (30 chars max)
نظام إدارة عقارات متكامل

## Promotional Text (170 chars max)
إدارة عقاراتك، عقودك، ومستأجريك بكل سهولة. تتبع الدفعات، الصيانة، والوثائق في مكان واحد آمن.

## Description
**DTG Rentals** هو نظام إدارة عقارات متكامل مصمم لأصحاب العقارات والمديرين في المملكة العربية السعودية.

### المميزات الرئيسية:

🏢 **إدارة العقارات**
- إضافة وتتبع جميع عقاراتك ووحداتها
- عرض نسبة الإشغال والإيرادات لحظياً
- رفع صور العقارات والوثائق

📄 **إدارة العقود**
- إنشاء عقود إيجار رقمية متكاملة
- تنبيهات تلقائية عند اقتراب انتهاء العقود
- جدولة الأقساط وتتبع الدفعات

👥 **إدارة المستأجرين والملاك**
- ملفات شاملة لكل مستأجر ومالك
- إمكانية منح الملاك وصولاً محدوداً لعقاراتهم فقط

💰 **التقارير المالية**
- تقارير الإيرادات والمصروفات
- معدلات التحصيل والمدفوعات المتأخرة

🔧 **إدارة الصيانة**
- تسجيل وتتبع طلبات الصيانة
- تحديث حالة الصيانة خطوة بخطوة

🔒 **الأمان والصلاحيات**
- نظام أدوار متعدد: مدير، مشاهد، مالك
- تشفير كامل للبيانات
- مصادقة آمنة عبر Firebase

### لمن هذا التطبيق؟
- أصحاب العقارات والمجمعات السكنية
- شركات إدارة العقارات
- الوسطاء العقاريين

## Keywords (100 chars)
عقارات,إيجار,مستأجر,عقد,دفعات,صيانة,ملاك,إدارة,سعودية,property,rental,management,landlord

## Support URL
https://dtgrentals.com/support

## Marketing URL
https://dtgrentals.com

## Privacy Policy URL
https://dtgrentals.com/privacy

---

# Privacy Nutrition Labels

## Data Used to Track You
- None

## Data Linked to You
- Email Address (Account creation, authentication)
- Phone Number (Contact information, optional)
- User Content (Property data, documents uploaded by user)

## Data Not Linked to You
- Crash Data (Anonymous crash reports)
- Performance Data (Anonymous app performance metrics)

---

# Age Rating
4+ (No objectionable content)

---

# App Store Screenshots — Required Sizes

## iPhone 6.9" (iPhone 16 Pro Max) — 1320 × 2868
1. Dashboard — KPI cards + quick actions
2. Properties list — Card grid view
3. Contract details — Full contract view
4. Calendar — Event calendar with indicators
5. Dark mode — Settings screen

## iPhone 6.1" (iPhone 16) — 1179 × 2556
Same 5 screenshots, scaled

## iPad 13" — 2064 × 2752
1. Desktop layout with sidebar
2. Property detail with documents
3. Financial reports
4. Contract management
5. User management

---

# QA Checklist — Pre-Submission

## Authentication
- [ ] Login with valid credentials succeeds
- [ ] Login with wrong password shows clear error (Arabic)
- [ ] Password reset email is sent correctly
- [ ] Session persists after app restart
- [ ] Logout clears all sensitive data

## Permissions
- [ ] Camera permission request shows correct Arabic description
- [ ] Photos permission request shows correct Arabic description
- [ ] App works correctly when permissions are denied
- [ ] No permission requested unless needed

## Offline Behavior
- [ ] Offline banner appears within 2 seconds of disconnection
- [ ] App doesn't crash when offline
- [ ] Cached data is shown when offline
- [ ] Actions attempted offline show appropriate message

## Role Permissions
- [ ] Owner sees only their properties/units/contracts
- [ ] Viewer cannot see add/edit/delete buttons
- [ ] Manager can add/edit but not delete
- [ ] Admin has full access

## Arabic/RTL
- [ ] All text is right-aligned
- [ ] Navigation flows RTL
- [ ] Tab bar order is RTL (الرئيسية on right)
- [ ] Dates display correctly in Arabic format
- [ ] No timezone shift in date display (1/5 shows 1 مايو not 30 أبريل)

## Performance
- [ ] App cold launch under 3 seconds on iPhone SE
- [ ] Skeleton loaders appear while data loads
- [ ] Scrolling is smooth (60fps) on all screens
- [ ] No memory warnings during normal use

## Edge Cases
- [ ] Empty state shown when no data exists
- [ ] Long owner/tenant names don't break layout
- [ ] Very large datasets (100+ properties) don't freeze
- [ ] Network timeout shows user-friendly message

## App Store Compliance
- [ ] No mention of competing payment systems
- [ ] No external links that bypass App Store
- [ ] Privacy policy URL is live and accessible
- [ ] App functions without account (or clear explanation why account is required)
- [ ] All placeholder content replaced with real content
