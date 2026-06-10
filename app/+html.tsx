/**
 * +html.tsx — Expo Web HTML root.
 * Sets dir="rtl" so all browser defaults (text direction, scrollbars,
 * flex start/end, writing-mode) are RTL without any CSS overrides.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const ICON = '/assets/assets/images/icon.39a1b62defb82f9452ac85736b10ac99.png';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* ── Viewport: prevents zoom on input focus on iOS ── */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1, user-scalable=no"
        />

        {/* ── PWA / Manifest ── */}
        <link rel="manifest" href="/manifest.json" />

        {/* ── Theme colors ── */}
        <meta name="theme-color" content="#021C36" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#021C36" />
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#021C36" />
        <meta name="msapplication-navbutton-color" content="#021C36" />
        <meta name="msapplication-TileColor" content="#021C36" />
        <meta name="msapplication-TileImage" content={ICON} />

        {/* ── iOS PWA ── */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="DTG Rentals" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />

        {/* Apple touch icons (all required sizes for iOS) */}
        <link rel="apple-touch-icon" href={ICON} />
        <link rel="apple-touch-icon" sizes="57x57"   href={ICON} />
        <link rel="apple-touch-icon" sizes="60x60"   href={ICON} />
        <link rel="apple-touch-icon" sizes="72x72"   href={ICON} />
        <link rel="apple-touch-icon" sizes="76x76"   href={ICON} />
        <link rel="apple-touch-icon" sizes="114x114" href={ICON} />
        <link rel="apple-touch-icon" sizes="120x120" href={ICON} />
        <link rel="apple-touch-icon" sizes="144x144" href={ICON} />
        <link rel="apple-touch-icon" sizes="152x152" href={ICON} />
        <link rel="apple-touch-icon" sizes="180x180" href={ICON} />

        {/* iOS Splash screens — key sizes for common iPhones */}
        <link rel="apple-touch-startup-image" href={ICON} />

        {/* Favicon */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png"    href={ICON} sizes="32x32" />
        <link rel="shortcut icon"            href="/favicon.ico" />

        {/* ── Google Search Console Verification ── */}
        <meta name="google-site-verification" content="F1WsWXgt7IaiN7a8oOClgDjobiAO7NR7-GSZhofjYTQ" />

        {/* ── SEO ── */}
        <meta name="description"   content="نظام إدارة العقارات والإيجارات — DTG Rentals" />
        <meta name="keywords"      content="عقارات, إيجار, عقود, مستأجرين, إدارة عقارات" />
        <meta name="author"        content="DTG" />
        <meta name="robots"        content="noindex, nofollow" />

        {/* ── Open Graph ── */}
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content="https://dtg-rentals.web.app/" />
        <meta property="og:title"       content="DTG Rentals — إدارة العقارات" />
        <meta property="og:description" content="نظام متكامل لإدارة العقارات والإيجارات والعقود والمستأجرين" />
        <meta property="og:image"       content={`https://dtg-rentals.web.app${ICON}`} />
        <meta property="og:locale"      content="ar_SA" />
        <meta property="og:site_name"   content="DTG Rentals" />

        {/* ── Twitter Card ── */}
        <meta name="twitter:card"        content="summary" />
        <meta name="twitter:title"       content="DTG Rentals" />
        <meta name="twitter:description" content="نظام إدارة العقارات والإيجارات" />
        <meta name="twitter:image"       content={`https://dtg-rentals.web.app${ICON}`} />

        {/* ── Styles ── */}
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          /* Load Ionicons from CDN — same file as @expo/vector-icons@15.1.1 */
          @font-face {
            font-family: 'Ionicons';
            src: url('https://unpkg.com/@expo/vector-icons@15.1.1/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf') format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
          }

          /* Safe area: Dynamic Island + notch support */
          html {
            height: -webkit-fill-available;
            height: 100%;
          }
          body {
            height: 100%;
            min-height: -webkit-fill-available;
            /* env() safe-area for notch/Dynamic Island */
            padding-top: env(safe-area-inset-top);
            padding-bottom: env(safe-area-inset-bottom);
            padding-left: env(safe-area-inset-left);
            padding-right: env(safe-area-inset-right);
            overflow: hidden;
            /* Disable pull-to-refresh on iOS Safari */
            overscroll-behavior-y: none;
            -webkit-overflow-scrolling: touch;
            /* Prevent text size adjust on orientation change */
            -webkit-text-size-adjust: 100%;
            text-size-adjust: 100%;
            /* Disable double-tap zoom */
            touch-action: manipulation;
          }
          /* Expo root div */
          #root, [data-reactroot] {
            height: 100%;
            height: 100dvh;
            display: flex;
            flex-direction: column;
            /* Reset body's safe-area padding — handled by the app itself */
            padding: 0;
          }
          /* Remove any bottom space React Navigation tab bar leaves on web */
          [class*="tabBar"], [aria-label="Tab bar"] {
            display: none !important;
            height: 0 !important;
          }
          /* Smooth scrolling for web */
          * { scroll-behavior: smooth; }
          /* Remove tap highlight on mobile */
          * { -webkit-tap-highlight-color: transparent; }
          /* Input zoom prevention — already locked by viewport but belt+suspenders */
          input, select, textarea { font-size: 16px !important; }
        `}} />

        {/* ── Service Worker registration ── */}
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js', { scope: '/' })
                .then(function(reg) {
                  reg.addEventListener('updatefound', function() {
                    var newWorker = reg.installing;
                    if (newWorker) {
                      newWorker.addEventListener('statechange', function() {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                          newWorker.postMessage({ type: 'SKIP_WAITING' });
                        }
                      });
                    }
                  });
                })
                .catch(function(err) { console.warn('SW registration failed:', err); });
            });
          }
        `}} />
      </head>
      <body>
        {/* Static landing page — visible to crawlers before JS loads, hidden once React mounts */}
        <div id="dtg-static-landing" dangerouslySetInnerHTML={{ __html: `
          <style>
            #dtg-static-landing{font-family:Arial,sans-serif;background:#021C36;color:#fff;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px;text-align:center;box-sizing:border-box;}
            #dtg-static-landing h1{color:#C3AF76;font-size:2.2em;margin:0 0 12px;}
            #dtg-static-landing p{font-size:1.05em;max-width:600px;line-height:1.8;margin:0 0 28px;opacity:.85;}
            #dtg-static-landing .features{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;max-width:700px;margin-bottom:32px;}
            #dtg-static-landing .feat{background:rgba(195,175,118,.08);border:1px solid rgba(195,175,118,.2);border-radius:12px;padding:16px 20px;min-width:180px;max-width:220px;font-size:.9em;line-height:1.6;}
            #dtg-static-landing .feat strong{color:#C3AF76;display:block;margin-bottom:4px;}
            #dtg-static-landing a.btn{background:#C3AF76;color:#021C36;padding:14px 36px;border-radius:30px;text-decoration:none;font-weight:700;font-size:1em;display:inline-block;margin-bottom:24px;}
            #dtg-static-landing .links a{color:rgba(195,175,118,.8);margin:0 10px;font-size:.85em;text-decoration:none;}
          </style>
          <h1>DTG Rentals</h1>
          <p>منصة إدارة العقارات والإيجارات الذكية — نظام متكامل يساعد ملاك العقارات وشركات الإدارة على تتبع العقود والمدفوعات والمستأجرين في مكان واحد.</p>
          <div class="features">
            <div class="feat"><strong>إدارة العقارات</strong>إدارة كاملة للعقارات والوحدات السكنية والتجارية</div>
            <div class="feat"><strong>عقود الإيجار</strong>إنشاء العقود وتجديدها وتتبع حالتها بسهولة</div>
            <div class="feat"><strong>الدفعات والإيرادات</strong>تتبع المدفوعات والمتأخرات وتقارير الإيرادات</div>
            <div class="feat"><strong>إدارة المستأجرين</strong>ملفات شاملة لكل مستأجر مع سجل كامل للتعاملات</div>
            <div class="feat"><strong>Google Calendar</strong>مزامنة تلقائية للمواعيد والتذكيرات</div>
            <div class="feat"><strong>التقارير المالية</strong>تقارير تفصيلية وإحصائيات لاتخاذ القرارات</div>
          </div>
          <a class="btn" href="/login">تسجيل الدخول</a>
          <div class="links">
            <a href="/about">عن التطبيق</a>
            <a href="/privacy-policy">سياسة الخصوصية</a>
            <a href="/terms-of-service">شروط الخدمة</a>
          </div>
        ` }} />
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){var el=document.getElementById('dtg-static-landing');if(el)el.style.display='none';})();
        ` }} />
        {children}
      </body>
    </html>
  );
}
