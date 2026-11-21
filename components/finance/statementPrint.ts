/**
 * كشف حساب المالك — صفحة A4 للطباعة أو الحفظ PDF (من نافذة الطباعة).
 */
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import type { OwnerStatement, StatementLine } from '../../domain/services/OwnerStatementService';
import { getCurrency } from '../../utils/currency';
import { formatDate } from '../../data/mockData';

const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (n: number, c: string) => `${(Math.round(n * 100) / 100).toLocaleString('en-US')} ${esc(getCurrency(c).code === 'SAR' ? 'ر.س' : getCurrency(c).code)}`;
function logo(): string { try { return Asset.fromModule(require('../../assets/images/sidebar-logo-dark.png')).uri ?? ''; } catch { return ''; } }

function table(title: string, lines: StatementLine[], empty: string, tone = '#0F2A47') {
  if (!lines.length) return `<h3>${esc(title)}</h3><p class="empty">${esc(empty)}</p>`;
  return `<h3>${esc(title)}</h3><table><thead><tr><th>التاريخ</th><th>البيان</th><th>العقار</th><th class="n">المبلغ</th></tr></thead><tbody>
  ${lines.map(l => `<tr><td>${esc(formatDate(l.date))}</td><td>${esc(l.label)}</td><td>${esc(l.detail)}</td><td class="n" style="color:${tone}">${money(l.amount, l.currency)}</td></tr>`).join('')}
  </tbody></table>`;
}

export function buildStatementHTML(s: OwnerStatement, meta: { ownerName: string; periodLabel: string; from?: string; to?: string }) {
  const range = meta.from && meta.to ? `${formatDate(meta.from)} — ${formatDate(meta.to)}` : 'كل الفترات';
  const lg = logo();
  return `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>كشف حساب ${esc(meta.ownerName)} — ${esc(meta.periodLabel)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
@page{size:A4;margin:14mm}*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;color:#161616;background:#F3F4F6;padding:20px;direction:rtl}
.page{max-width:210mm;margin:0 auto;background:#fff;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden}
.bar{height:8px;background:linear-gradient(90deg,#0F2A47,#0F2A47 70%,#B08D4F)}
.head{display:flex;justify-content:space-between;align-items:center;padding:22px 28px;border-bottom:1px solid #E5E7EB;gap:16px}
.head img{height:54px}.head h1{font-size:22px;color:#0F2A47}.head .sub{font-size:12px;color:#6C737F;margin-top:4px}
.who{text-align:left;font-size:13px;color:#384250;line-height:1.8}.who b{color:#161616;font-size:15px}
.body{padding:20px 28px 28px}
.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:8px}
.box{border:1px solid #E5E7EB;border-radius:10px;padding:12px 14px}.box .l{font-size:12px;color:#6C737F}.box .v{font-size:19px;font-weight:700;margin-top:4px;direction:ltr;unicode-bidi:plaintext;text-align:right}
.box.net{background:#0F2A47;border-color:#0F2A47}.box.net .l{color:#D4BC8A}.box.net .v{color:#fff}
.ov{font-size:12px;color:#B42318;margin:4px 0 6px}
h3{font-size:15px;color:#0F2A47;margin:22px 0 8px;padding-bottom:6px;border-bottom:2px solid #F3ECDD}
table{width:100%;border-collapse:collapse;font-size:12.5px}th{background:#F9FAFB;color:#6C737F;font-weight:600;text-align:right;padding:8px;border-bottom:1px solid #E5E7EB}
td{padding:8px;border-bottom:1px solid #F3F4F6}.n{text-align:left;direction:ltr;unicode-bidi:plaintext;white-space:nowrap;font-weight:600}
.empty{font-size:12px;color:#9DA4AE}
.foot{display:flex;justify-content:space-between;padding:12px 28px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:11px;color:#6C737F}
.actions{max-width:210mm;margin:0 auto 14px;display:flex;gap:8px}.actions button{font-family:inherit;font-size:14px;padding:10px 18px;border-radius:8px;border:1px solid #0F2A47;background:#0F2A47;color:#fff;cursor:pointer}
.actions button.s{background:#fff;color:#0F2A47}
@media print{body{background:#fff;padding:0}.page{border:none;border-radius:0}.actions{display:none}}
</style></head><body>
<div class="actions"><button onclick="window.print()">طباعة / حفظ PDF</button><button class="s" onclick="window.close()">إغلاق</button></div>
<div class="page"><div class="bar"></div>
<div class="head"><div><h1>كشف حساب المالك</h1><div class="sub">${esc(meta.periodLabel)} · ${esc(range)}</div></div>
<div class="who"><b>${esc(meta.ownerName)}</b><br/>صادر ${esc(formatDate(new Date().toISOString().split('T')[0]))}</div>${lg ? `<img src="${esc(lg)}"/>` : ''}</div>
<div class="body">
${s.totals.length ? s.totals.map(t => `<div class="sum">
  <div class="box"><div class="l">الإيجار المحصَّل</div><div class="v">${money(t.income, t.currency)}</div></div>
  <div class="box"><div class="l">المصاريف</div><div class="v">${money(t.expenses, t.currency)}</div></div>
  <div class="box net"><div class="l">الصافي لك</div><div class="v">${money(t.net, t.currency)}</div></div>
</div>${t.overdue > 0 ? `<div class="ov">متأخرات على المستأجرين قيد المتابعة (غير داخلة في الصافي): ${money(t.overdue, t.currency)}</div>` : ''}`).join('') : '<p class="empty">ما في حركة في هذه الفترة.</p>'}
${s.properties.length ? `<h3>حسب العقار</h3><table><thead><tr><th>العقار</th><th class="n">المحصَّل</th><th class="n">المصاريف</th><th class="n">الصافي</th></tr></thead><tbody>
${s.properties.map(p => `<tr><td>${esc(p.name)}</td><td class="n">${money(p.income, p.currency)}</td><td class="n">${money(p.expenses, p.currency)}</td><td class="n">${money(p.net, p.currency)}</td></tr>`).join('')}</tbody></table>` : ''}
${table('الإيجارات المحصَّلة', s.income, 'ما في إيجارات محصَّلة في هذه الفترة.', '#067647')}
${table('المصاريف', s.expenses, 'ما في مصاريف في هذه الفترة.', '#B42318')}
${s.overdue.length ? table('متأخرات قيد المتابعة', s.overdue, '', '#B54708') : ''}
</div>
<div class="foot"><span>مجموعة ظهران التجارية — DTG Rentals</span><span>هذا الكشف صادر من النظام</span></div>
</div></body></html>`;
}

export function printStatement(html: string) {
  if (Platform.OS !== 'web') return;
  const win = window.open('', '_blank', 'width=980,height=760');
  if (!win) { window.alert('اسمح بالنوافذ المنبثقة لعرض الكشف.'); return; }
  win.document.open(); win.document.write(html); win.document.close();
}
