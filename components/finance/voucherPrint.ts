/**
 * طباعة السندات — صفحة HTML مستقلة بخط IBM Plex Sans Arabic وتنسيق RTL كامل،
 * تُفتح في نافذة جديدة وتطبع (أو تُحفظ PDF من نافذة الطباعة).
 */
import { Platform, Alert } from 'react-native';
import { Asset } from 'expo-asset';
import type { Voucher } from '../../domain/models';
import { VOUCHER_LABEL, PAYMENT_METHOD_LABELS } from '../../domain/services/FinanceService';
import { getCurrency } from '../../utils/currency';
import { formatDate } from '../../data/mockData';

const esc = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const money = (n: number) => (Math.round((n || 0) * 100) / 100)
  .toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 3 });

function logoUrl(): string {
  try {
    return Asset.fromModule(require('../../assets/images/sidebar-logo-dark.png')).uri ?? '';
  } catch { return ''; }
}

export function buildVoucherHTML(v: Voucher, extra: { propertyName?: string; unitNumber?: string } = {}): string {
  const isReceipt = v.type === 'receipt';
  const cur = getCurrency(v.currency);
  const curLabel = cur.code === 'SAR' ? 'ريال سعودي' : `${cur.label}`;
  const partyLabel = isReceipt ? 'استلمنا من السيد/السادة' : 'صرفنا إلى السيد/السادة';
  const method = v.paymentMethod ? PAYMENT_METHOD_LABELS[v.paymentMethod] ?? v.paymentMethod : '—';
  const cancelled = v.status === 'cancelled';
  const issued = new Date().toLocaleString('ar-SA-u-nu-latn');
  const logo = logoUrl();

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(VOUCHER_LABEL[v.type])} ${esc(v.number)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A5 landscape; margin: 10mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans Arabic', Tahoma, sans-serif; background: #F3F4F6; color: #161616; direction: rtl; padding: 24px; }
  .page { position: relative; max-width: 210mm; margin: 0 auto; background: #fff; border: 1px solid #D2D6DB; border-radius: 16px; overflow: hidden; }
  .bar { height: 8px; background: #1B8354; }
  .head { display: flex; align-items: center; justify-content: space-between; padding: 20px 28px 16px; border-bottom: 1px solid #E5E7EB; gap: 16px; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand img { height: 52px; width: auto; }
  .brand .name { font-size: 16px; font-weight: 700; }
  .brand .sub { font-size: 11px; color: #6C737F; margin-top: 2px; }
  .title { text-align: center; }
  .title h1 { font-size: 24px; font-weight: 700; color: ${isReceipt ? '#1B8354' : '#B42318'}; }
  .title .en { font-size: 11px; color: #6C737F; letter-spacing: .5px; }
  .meta { display: grid; gap: 6px; min-width: 170px; }
  .meta .box { border: 1px solid #D2D6DB; border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
  .meta .box span:first-child { color: #6C737F; }
  .meta .box b { font-weight: 600; direction: ltr; unicode-bidi: plaintext; }
  .body { padding: 18px 28px 8px; display: grid; gap: 12px; }
  .amount { display: flex; align-items: stretch; gap: 12px; }
  .amount .num { border: 2px solid ${isReceipt ? '#1B8354' : '#B42318'}; border-radius: 8px; padding: 8px 16px; min-width: 190px; text-align: center; }
  .amount .num .v { font-size: 26px; font-weight: 700; direction: ltr; unicode-bidi: plaintext; }
  .amount .num .c { font-size: 12px; color: #6C737F; }
  .amount .words { flex: 1; background: ${isReceipt ? '#F3FCF6' : '#FEF3F2'}; border-radius: 8px; padding: 10px 14px; display: flex; flex-direction: column; justify-content: center; }
  .amount .words .l { font-size: 11px; color: #6C737F; margin-bottom: 2px; }
  .amount .words .t { font-size: 15px; font-weight: 600; line-height: 1.7; }
  .row { display: flex; gap: 10px; align-items: baseline; border-bottom: 1px dashed #D2D6DB; padding: 8px 0; font-size: 14px; }
  .row .l { color: #6C737F; min-width: 150px; }
  .row .v { flex: 1; font-weight: 600; line-height: 1.7; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
  .sign { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; padding: 18px 28px 22px; }
  .sign div { text-align: center; font-size: 12px; color: #384250; }
  .sign div::before { content: ''; display: block; height: 40px; border-bottom: 1px solid #9DA4AE; margin-bottom: 6px; }
  .foot { display: flex; justify-content: space-between; padding: 10px 28px; background: #F9FAFB; border-top: 1px solid #E5E7EB; font-size: 11px; color: #6C737F; }
  .void { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; pointer-events: none; }
  .void span { transform: rotate(-18deg); font-size: 110px; font-weight: 700; color: rgba(217,45,32,.14); border: 8px solid rgba(217,45,32,.14); border-radius: 16px; padding: 0 40px; }
  .void-note { margin: 0 28px 12px; background: #FEF3F2; border: 1px solid #FECDCA; color: #B42318; border-radius: 6px; padding: 8px 12px; font-size: 12px; }
  .actions { max-width: 210mm; margin: 0 auto 16px; display: flex; gap: 8px; justify-content: flex-start; }
  .actions button { font-family: inherit; font-size: 14px; border-radius: 4px; padding: 8px 18px; cursor: pointer; border: 1px solid #D2D6DB; background: #fff; }
  .actions button.primary { background: #1B8354; border-color: #1B8354; color: #fff; }
  @media print {
    body { background: #fff; padding: 0; }
    .page { border: none; border-radius: 0; }
    .actions { display: none; }
  }
</style>
</head>
<body>
<div class="actions">
  <button class="primary" onclick="window.print()">طباعة / حفظ PDF</button>
  <button onclick="window.close()">إغلاق</button>
</div>
<div class="page">
  <div class="bar"></div>
  <div class="head">
    <div class="brand">
      ${logo ? `<img src="${esc(logo)}" alt="" loading="eager" onerror="this.style.display='none'"/>` : ''}
      <div>
        <div class="name">مجموعة ظهران التجارية</div>
        <div class="sub">إدارة الأملاك</div>
      </div>
    </div>
    <div class="title">
      <h1>${esc(VOUCHER_LABEL[v.type])}</h1>
      <div class="en">${isReceipt ? 'RECEIPT VOUCHER' : 'PAYMENT VOUCHER'}</div>
    </div>
    <div class="meta">
      <div class="box"><span>رقم السند</span><b>${esc(v.number)}</b></div>
      <div class="box"><span>التاريخ</span><b>${esc(formatDate(v.date))}</b></div>
    </div>
  </div>

  <div class="body">
    <div class="amount">
      <div class="num"><div class="v">${esc(money(v.amount))}</div><div class="c">${esc(curLabel)}</div></div>
      <div class="words"><div class="l">المبلغ كتابةً</div><div class="t">${esc(v.amountInWords)}</div></div>
    </div>
    <div class="row"><span class="l">${partyLabel}</span><span class="v">${esc(v.partyName)}</span></div>
    <div class="row"><span class="l">وذلك عن</span><span class="v">${esc(v.description)}</span></div>
    <div class="grid2">
      <div class="row"><span class="l">طريقة الدفع</span><span class="v">${esc(method)}</span></div>
      <div class="row"><span class="l">رقم المرجع / الشيك</span><span class="v">${esc(v.referenceNumber || '—')}</span></div>
      ${extra.propertyName ? `<div class="row"><span class="l">العقار</span><span class="v">${esc(extra.propertyName)}</span></div>` : ''}
      ${extra.unitNumber ? `<div class="row"><span class="l">الوحدة</span><span class="v">${esc(extra.unitNumber)}</span></div>` : ''}
    </div>
  </div>

  ${cancelled ? `<div class="void-note">ملغي بتاريخ ${esc(formatDate((v.cancelledAt ?? '').slice(0, 10)))}${v.cancelledBy ? ` بواسطة ${esc(v.cancelledBy)}` : ''} — السبب: ${esc(v.cancelReason ?? '—')}</div>` : ''}

  <div class="sign">
    <div>${isReceipt ? 'المستلم' : 'المستلم (المستفيد)'}</div>
    <div>المحاسب</div>
    <div>المدير المعتمد</div>
  </div>
  <div class="foot">
    <span>أُصدر بواسطة: ${esc(v.issuedBy)}</span>
    <span>تاريخ الطباعة: ${esc(issued)}</span>
  </div>
  ${cancelled ? '<div class="void"><span>ملغي</span></div>' : ''}
</div>
</body>
</html>`;
}

/**
 * يفتح نافذة الطباعة فوراً (داخل نقرة المستخدم) — المتصفح يحجب النوافذ المفتوحة
 * بعد await. استعملها قبل أي انتظار، ثم مرّر النافذة إلى printVoucher.
 */
export function openPrintWindow(): Window | null {
  if (Platform.OS !== 'web') return null;
  const win = window.open('', '_blank', 'width=960,height=720');
  if (win) win.document.write('<p dir="rtl" style="font-family:Tahoma;padding:24px;color:#6C737F">جارٍ تجهيز السند...</p>');
  return win;
}

export function printVoucher(v: Voucher, extra?: { propertyName?: string; unitNumber?: string }, preopened?: Window | null) {
  if (Platform.OS !== 'web') {
    Alert.alert(VOUCHER_LABEL[v.type], `رقم السند: ${v.number}\nالطباعة متاحة من نسخة الويب.`);
    return;
  }
  const win = preopened ?? window.open('', '_blank', 'width=960,height=720');
  if (!win) { window.alert('اسمح بالنوافذ المنبثقة لطباعة السند.'); return; }
  win.document.open();
  win.document.write(buildVoucherHTML(v, extra));
  win.document.close();
}
