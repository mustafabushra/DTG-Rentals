import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Platform } from 'react-native';

const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const API_BASE       = 'https://www.googleapis.com/calendar/v3';
const DTG_TAG        = 'dtg-rentals';

// ─── Token storage ────────────────────────────────────────────────────────────

export interface GCalToken {
  accessToken: string;
  expiresAt:   number;
  connected:   boolean;
}

export async function saveToken(uid: string, token: GCalToken) {
  await setDoc(doc(db, 'users', uid), { googleCalendar: token }, { merge: true });
}

export async function loadToken(uid: string): Promise<GCalToken | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data().googleCalendar ?? null) : null;
}

export async function disconnectCalendar(uid: string) {
  await setDoc(doc(db, 'users', uid), { googleCalendar: { connected: false, accessToken: '', expiresAt: 0 } }, { merge: true });
}

// ─── تحميل Google Identity Services ──────────────────────────────────────────

function loadGIS(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') { reject(new Error('web only')); return; }
    if ((window as any).google?.accounts?.oauth2) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload  = () => resolve();
    s.onerror = () => reject(new Error('فشل تحميل Google Identity Services'));
    document.head.appendChild(s);
  });
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

// بناء رابط OAuth redirect للجوال (implicit flow → token في URL hash)
export function buildGoogleOAuthRedirectURL(): string {
  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? '';
  const redirectUri = typeof window !== 'undefined'
    ? `${window.location.origin}/settings`
    : '';
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: 'token',
    scope:         CALENDAR_SCOPE,
    prompt:        'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

// استخراج الـ token من URL hash بعد الرجوع من Google
export function parseOAuthRedirectHash(): { accessToken: string; expiresIn: number } | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const p = new URLSearchParams(hash);
  const accessToken = p.get('access_token');
  if (!accessToken) return null;
  return { accessToken, expiresIn: Number(p.get('expires_in') ?? 3600) };
}

export async function connectGoogleCalendar(uid: string): Promise<GCalToken> {
  if (Platform.OS !== 'web') {
    throw new Error('ربط Google Calendar متاح على الويب فقط حالياً');
  }

  const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('Google Client ID غير مضبوط');

  // الجوال: redirect flow
  if (isMobileBrowser()) {
    window.location.href = buildGoogleOAuthRedirectURL();
    return new Promise(() => {}); // الصفحة ستنتقل — لن يصل لهنا
  }

  // سطح المكتب: popup flow عبر GIS
  await loadGIS();

  return new Promise<GCalToken>((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope:     CALENDAR_SCOPE,
      callback:  async (response: any) => {
        if (response.error) {
          reject(new Error(`Google OAuth error: ${response.error}`));
          return;
        }
        const token: GCalToken = {
          accessToken: response.access_token,
          expiresAt:   Date.now() + (Number(response.expires_in ?? 3600) - 60) * 1000,
          connected:   true,
        };
        await saveToken(uid, token);
        resolve(token);
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

// ─── فحص صلاحية الـ token ─────────────────────────────────────────────────────

function isTokenValid(token: GCalToken | null): token is GCalToken {
  return !!token && token.connected && !!token.accessToken && Date.now() < token.expiresAt;
}

// ─── API calls ────────────────────────────────────────────────────────────────

async function apiCall(method: string, path: string, token: string, body?: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Google Calendar API error: ${res.status}`);
  }

  return method === 'DELETE' ? null : res.json();
}

// ─── بناء كائن الحدث ─────────────────────────────────────────────────────────

function buildEvent(opts: {
  title:       string;
  description: string;
  date:        string; // YYYY-MM-DD
  entityId:    string;
  entityType:  string;
}) {
  return {
    summary:     opts.title,
    description: opts.description,
    start:  { date: opts.date },
    end:    { date: opts.date },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'email',  minutes: 7 * 24 * 60 }, // أسبوع
        { method: 'popup',  minutes: 24 * 60 },      // يوم
        { method: 'popup',  minutes: 60 },            // ساعة
      ],
    },
    extendedProperties: {
      private: {
        source:     DTG_TAG,
        entityId:   opts.entityId,
        entityType: opts.entityType,
      },
    },
  };
}

// ─── إنشاء حدث ───────────────────────────────────────────────────────────────

export async function createCalendarEvent(token: string, opts: Parameters<typeof buildEvent>[0]) {
  return apiCall('POST', '/calendars/primary/events', token, buildEvent(opts));
}

// ─── حذف حدث ─────────────────────────────────────────────────────────────────

export async function deleteCalendarEvent(token: string, eventId: string) {
  return apiCall('DELETE', `/calendars/primary/events/${eventId}`, token);
}

// ─── جلب أحداث DTG الموجودة ──────────────────────────────────────────────────

export async function fetchDTGEvents(token: string): Promise<Array<{ id: string; entityId: string; entityType: string }>> {
  const params = new URLSearchParams({
    privateExtendedProperty: `source=${DTG_TAG}`,
    maxResults: '500',
    singleEvents: 'true',
  });
  const data = await apiCall('GET', `/calendars/primary/events?${params}`, token);
  return (data?.items ?? []).map((e: any) => ({
    id:         e.id,
    entityId:   e.extendedProperties?.private?.entityId ?? '',
    entityType: e.extendedProperties?.private?.entityType ?? '',
  }));
}

// ─── المزامنة الكاملة ─────────────────────────────────────────────────────────

export interface SyncItem {
  entityId:    string;
  entityType:  'contract' | 'payment';
  title:       string;
  description: string;
  date:        string;
}

export async function syncToGoogleCalendar(uid: string, items: SyncItem[]): Promise<{ created: number; skipped: number; error?: string }> {
  const token = await loadToken(uid);

  if (!isTokenValid(token)) {
    return { created: 0, skipped: 0, error: 'token_expired' };
  }

  // جلب الأحداث الموجودة لتفادي التكرار
  const existing = await fetchDTGEvents(token.accessToken);
  const existingIds = new Set(existing.map(e => `${e.entityType}:${e.entityId}`));

  let created = 0;
  let skipped = 0;

  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    if (existingIds.has(key)) {
      skipped++;
      continue;
    }
    await createCalendarEvent(token.accessToken, {
      title:      item.title,
      description: item.description,
      date:        item.date,
      entityId:    item.entityId,
      entityType:  item.entityType,
    });
    created++;
  }

  return { created, skipped };
}

// ─── بناء قائمة الأحداث من بيانات التطبيق ────────────────────────────────────

export function buildSyncItems(opts: {
  contracts: any[];
  payments:  any[];
  tenants:   any[];
  units:     any[];
  properties:any[];
}): SyncItem[] {
  const { contracts, payments, tenants, units, properties } = opts;
  const items: SyncItem[] = [];
  const today = new Date().toISOString().split('T')[0];

  // عقود تنتهي خلال 60 يوم
  contracts
    .filter(c => c.status === 'active' && c.endDate >= today)
    .forEach(c => {
      const unit     = units.find((u: any) => u.id === c.unitId);
      const property = unit ? properties.find((p: any) => p.id === unit.propertyId) : null;
      const tenant   = tenants.find((t: any) => t.id === c.tenantId);
      items.push({
        entityId:    c.id,
        entityType:  'contract',
        title:       `📋 انتهاء عقد — ${tenant?.name ?? c.contractNumber}`,
        description: `العقار: ${property?.name ?? '—'}\nالوحدة: ${unit?.number ?? '—'}\nالمستأجر: ${tenant?.name ?? '—'}\nالقيمة: ${c.annualValue?.toLocaleString('ar-SA')} ﷼ سنوياً`,
        date:        c.endDate,
      });
    });

  // دفعات معلقة أو متأخرة
  payments
    .filter((p: any) => (p.status === 'pending' || p.status === 'overdue') && p.dueDate >= today)
    .forEach((p: any) => {
      const contract = contracts.find((c: any) => c.id === p.contractId);
      const unit     = contract ? units.find((u: any) => u.id === contract.unitId) : null;
      const property = unit ? properties.find((pr: any) => pr.id === unit.propertyId) : null;
      const tenant   = contract ? tenants.find((t: any) => t.id === contract.tenantId) : null;
      items.push({
        entityId:    p.id,
        entityType:  'payment',
        title:       `💰 دفعة — ${tenant?.name ?? '—'} — ${p.amount?.toLocaleString('ar-SA')} ﷼`,
        description: `العقار: ${property?.name ?? '—'}\nالوحدة: ${unit?.number ?? '—'}\nالمستأجر: ${tenant?.name ?? '—'}\nالحالة: ${p.status === 'overdue' ? 'متأخرة ⚠' : 'معلقة'}`,
        date:        p.dueDate,
      });
    });

  return items;
}
