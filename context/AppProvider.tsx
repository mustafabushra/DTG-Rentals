import React, { createContext, useContext, useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { Appearance, Alert, Platform, useColorScheme } from 'react-native';
import {
  Owner, Tenant, Unit, Contract, Payment, Maintenance, AuditLog, CalendarEvent,
  ContractStatus, UnitStatus, PropertyType,
} from '../data/mockData';
import { City, Property, Attachment, UnitStructure } from '../domain/models';
import { defaultUnitStructure } from '../data/mockData';
import { onAuthChange, getUserProfile } from '../lib/auth';
import { getAll, getOne, getWhere, where, setOne, updateOne, deleteOne, deleteAll, getActiveOrgId, setActiveOrgId, runContractTransaction } from '../lib/firestoreService';
import {
  SystemSettings, DEFAULT_SYSTEM_SETTINGS, resolvePermissions,
} from '../constants/SystemDefaults';
import { saveCache, loadCache, cacheHasData, clearCache } from '../lib/localCache';
import { FileService } from '../domain/services/FileService';
import type { FileCategory } from '../domain/models';
import { toPersistentUri } from '../lib/imageUtils';
import { uploadFile, attachmentStoragePath, uploadPhoto, photoStoragePath, deleteFile } from '../lib/storageService';

export interface PropertyPhoto {
  id: string;
  uri: string;
  isMain: boolean;
  caption?: string;
  uploadedAt: string;
  storagePath?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';
export interface NotificationPrefs { contracts: boolean; payments: boolean; documents: boolean; maintenance: boolean; }
const RECEIPT_PREFIX = 'RCP';

interface AppState {
  owners: Owner[];
  properties: Property[];
  tenants: Tenant[];
  units: Unit[];
  contracts: Contract[];
  payments: Payment[];
  maintenance: Maintenance[];
  auditLogs: AuditLog[];
  calendarEvents: CalendarEvent[];
  attachments: Attachment[];
  cities: City[];
  isAuthenticated: boolean;
  dataLoading: boolean;
  secondaryLoading: boolean;
  refreshData: () => void;
  currentUser: { id: string; name: string; email: string; phone: string; role: string; ownerId?: string; orgId?: string };
  theme: ThemeMode;
  notificationPrefs: NotificationPrefs;
  propertyPhotos: Record<string, PropertyPhoto[]>;
  unitPhotos:     Record<string, PropertyPhoto[]>;
}

interface AppContextType extends AppState {
  addOwner: (owner: Owner) => void;
  updateOwner: (id: string, data: Partial<Owner>) => void;
  deleteOwner: (id: string) => void;
  addProperty: (property: Property) => void;
  updateProperty: (id: string, data: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addTenant: (tenant: Tenant) => void;
  updateTenant: (id: string, data: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;
  addUnit: (unit: Unit) => void;
  updateUnit: (id: string, data: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;
  addContract: (contract: Contract) => void;
  updateContract: (id: string, data: Partial<Contract>) => void;
  deleteContract: (id: string) => void;
  terminateContract: (id: string, reason: string) => { tenantName: string; tenantPhone: string; tenantEmail: string; terminationDate: string };
  addPayment: (payment: Payment) => void;
  updatePayment: (id: string, data: Partial<Payment>) => void;
  confirmPayment: (id: string) => void;
  cancelPayment: (id: string) => void;
  deletePayment: (id: string) => void;
  addMaintenance: (item: Maintenance) => void;
  updateMaintenance: (id: string, data: Partial<Maintenance>) => void;
  deleteMaintenance: (id: string) => void;
  cancelContract: (id: string, reason: string) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  deleteCalendarEvent: (id: string) => void;
  addAttachment: (data: { entityType: string; entityId: string; name: string; uri: string; mimeType: string; size?: number; category: FileCategory; expiryDate?: string; notes?: string; uploadedBy?: string }) => Promise<Attachment>;
  deleteAttachment: (id: string) => void;
  addPropertyPhoto: (propertyId: string, uri: string) => Promise<void>;
  removePropertyPhoto: (propertyId: string, photoId: string) => void;
  setPropertyMainPhoto: (propertyId: string, photoId: string) => void;
  unitPhotos: Record<string, PropertyPhoto[]>;
  addUnitPhoto: (unitId: string, uri: string) => Promise<void>;
  removeUnitPhoto: (unitId: string, photoId: string) => void;
  setUnitMainPhoto: (unitId: string, photoId: string) => void;
  systemSettings: SystemSettings;
  updateSystemSettings: (patch: Partial<SystemSettings>) => Promise<void>;
  setTheme: (t: ThemeMode) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  resetSystem: () => Promise<void>;
  importBackup: (payload: import('../lib/backupValidator').BackupPayload) => Promise<void>;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  updateProfile: (data: Partial<AppState['currentUser']>) => void;
  kpis: {
    totalProperties: number;
    rentedUnits: number;
    vacantUnits: number;
    monthlyRevenue: number;
    openMaintenanceRequests: number;
    overduePayments: number;
    activeContracts: number;
    pendingPayments: number;
    collectionRate: number;
    rentedByCity?: Record<string, number>;
    rentedUnitsByCity?: Record<string, number>;
    totalUnitsByCity?: Record<string, number>;
    cityDisplayNames?: Record<string, string>;
  };
  canWrite: boolean;
  canDelete: boolean;
  isAdmin: boolean;
  /** هل المستخدم مالك — يرى عقاراته فقط */
  isOwner: boolean;
  /** وحدات يملكها المالك الحالي داخل عقارات مملوكة لأشخاص آخرين (مع اسم العقار الأب) */
  externalOwnedUnits: (Unit & { parentPropertyName?: string })[];
  /** IDs الوحدات التي يملك فيها المالك عقوداً ومدفوعات (لفلترة dropdowns) */
  financialUnitIds: Set<string>;
  /** المظهر المحلول الفعلي بعد تطبيق الإعداد (يستخدم بدل useColorScheme) */
  resolvedScheme: 'light' | 'dark';
  /** إدارة المدن */
  addCity: (city: City) => void;
  updateCity: (id: string, data: Partial<City>) => void;
  deleteCity: (id: string) => void;
  /** إحصائيات المدينة */
  cityStats: Array<{
    cityId: string;
    cityName: string;
    region?: string;
    totalProperties: number;
    rentedProperties: number;
    totalUnits: number;
    rentedUnits: number;
    vacantUnits: number;
    monthlyRevenue: number;
  }>;
  /** تحديث جميع العقارات بإضافة cityId */
  updateAllPropertiesWithCities: () => Promise<{ updated: number; skipped: number }>;
  /** ختم ownerId على البيانات القديمة (مرة واحدة، للمدير) — لتفعيل عزل المالك */
  backfillOwnerIds: () => Promise<{ updated: number }>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [owners, setOwners]               = useState<Owner[]>([]);
  const [properties, setProperties]       = useState<Property[]>([]);
  const [tenants, setTenants]             = useState<Tenant[]>([]);
  const [units, setUnits]                 = useState<Unit[]>([]);
  const [contracts, setContracts]         = useState<Contract[]>([]);
  const [payments, setPayments]           = useState<Payment[]>([]);
  const [maintenance, setMaintenance]     = useState<Maintenance[]>([]);
  const [auditLogs, setAuditLogs]         = useState<AuditLog[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [attachments, setAttachments]       = useState<Attachment[]>([]);
  const [propertyPhotos, setPropertyPhotos] = useState<Record<string, PropertyPhoto[]>>({});
  const [unitPhotos,     setUnitPhotos]     = useState<Record<string, PropertyPhoto[]>>({});
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dataLoading, setDataLoading]     = useState(true);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [userId, setUserId]               = useState<string | null>(null);
  // Tracks whether initial hydration is complete — prevents overwriting cache with empty state
  const hydrated = useRef(false);
  // Guards against concurrent data loads when auth fires multiple times quickly
  const loadingRef = useRef(false);
  // Cancellation token — incremented on every auth change, old async flows check before setState
  const loadGenRef = useRef(0);
  // Tracks pending secondary-load timer so it can be cancelled on re-auth
  const secondaryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const [theme, setThemeState]            = useState<ThemeMode>('system');
  const systemScheme = useColorScheme();
  const resolvedScheme: 'light' | 'dark' = theme === 'system' ? (systemScheme ?? 'light') : theme;
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    contracts: true, payments: true, documents: true, maintenance: true,
  });
  const [currentUser, setCurrentUser] = useState<{
    id: string; name: string; email: string; phone: string; role: string; ownerId?: string; orgId?: string;
  }>({
    id: '', name: 'مدير النظام', email: '', phone: '', role: 'مدير عام',
  });

  // ─── تحميل البيانات من Firestore عند تسجيل الدخول ─────────────────────────
  useEffect(() => {
    console.log('[FIREBASE_INIT] AppProvider mounted — registering auth listener');

    const unsub = onAuthChange(async (firebaseUser) => {
      // Cancel any in-flight secondary timer from a previous auth event
      if (secondaryTimerRef.current) {
        clearTimeout(secondaryTimerRef.current);
        secondaryTimerRef.current = null;
      }

      // Bump generation — any async flow from a prior auth event will bail when it checks gen
      const gen = ++loadGenRef.current;

      console.log('[AUTH_STATE_CHANGED]', firebaseUser ? `uid=${firebaseUser.uid}` : 'signed-out');

      if (!firebaseUser) {
        hydrated.current = false;
        loadingRef.current = false;
        setActiveOrgId(null);
        setIsAuthenticated(false);
        setUserId(null);
        setDataLoading(false);
        setOwners([]); setProperties([]); setTenants([]); setUnits([]);
        setContracts([]); setPayments([]); setMaintenance([]);
        setAuditLogs([]); setCalendarEvents([]); setAttachments([]);
        return;
      }

      // Prevent concurrent loads for the same user (e.g. rapid token refreshes)
      if (loadingRef.current) {
        console.log('[AUTH_STATE_CHANGED] load already in progress — skipping duplicate');
        return;
      }
      loadingRef.current = true;

      setUserId(firebaseUser.uid);
      setIsAuthenticated(true);

      // تحميل بيانات الملف الشخصي من Firestore
      // المؤسسة الافتراضية = uid (للحسابات الجديدة)، وتُستبدل بقيمة البروفايل إن وُجدت
      let resolvedOrgId = firebaseUser.uid;
      // مالك تابع لشركة (role=owner + ownerId) → نحصر استعلاماته على سجلاته فقط
      let scopeOwnerId: string | null = null;
      try {
        const profile = await getUserProfile(firebaseUser.uid);
        if (gen !== loadGenRef.current) return; // stale — newer auth event took over
        // المستخدمون الجدد دائماً لديهم orgId صريح (=uid). غيابه يعني حساباً قديماً
        // أُنشئ قبل تعدد المؤسسات → ينتمي للمؤسسة الأصلية 'main' (لا uid، وإلا استعلم مؤسسة فارغة).
        resolvedOrgId = (profile?.orgId as string) || 'main';
        scopeOwnerId = ((profile?.role === 'owner' || profile?.role === 'مالك') && profile?.ownerId)
          ? (profile.ownerId as string) : null;
        setCurrentUser(prev => ({
          ...prev,
          id:      firebaseUser.uid,
          name:    profile?.name    ?? firebaseUser.displayName ?? 'مستخدم',
          email:   profile?.email   ?? firebaseUser.email ?? '',
          phone:   profile?.phone   ?? '',
          role:    profile?.role    ?? 'مدير عام',
          ownerId: profile?.ownerId ?? undefined,
          orgId:   resolvedOrgId,
        }));
        if (profile?.theme) {
          setThemeState(profile.theme as ThemeMode);
          try { Appearance.setColorScheme(profile.theme === 'system' ? null : profile.theme); } catch {}
        }
        if (profile?.notificationPrefs) {
          setNotificationPrefs(prev => ({ ...prev, ...profile.notificationPrefs }));
        }
      } catch {
        if (gen !== loadGenRef.current) return;
        setCurrentUser(prev => ({
          ...prev,
          id:    firebaseUser.uid,
          name:  firebaseUser.displayName ?? 'مستخدم',
          email: firebaseUser.email ?? '',
          orgId: resolvedOrgId,
        }));
      }
      // ضبط المؤسسة النشطة قبل أي تحميل بيانات — حاسم: كل الاستعلامات تعتمد عليها
      setActiveOrgId(resolvedOrgId);

      // ── دوال جلب تراعي عزل المالك ───────────────────────────────────────────
      // المالك التابع: استعلامات محصورة بـ where('ownerId','==',scopeOwnerId) على المجموعات الحساسة.
      // المدير/المالك المستقل: جلب كامل لمؤسسته.
      const OWNER_SCOPED = new Set(['properties', 'units', 'contracts', 'payments', 'maintenance']);
      const fetchCol = (col: string) =>
        (scopeOwnerId && OWNER_SCOPED.has(col))
          ? getWhere(resolvedOrgId, col, [where('ownerId', '==', scopeOwnerId)])
          : getAll(resolvedOrgId, col);
      const fetchOwners = async () => {
        if (!scopeOwnerId) return getAll(resolvedOrgId, 'owners');
        const own = await getOne(resolvedOrgId, 'owners', scopeOwnerId);
        return own ? [own] : [];
      };

      // ── Hydrate from cache immediately so the UI never shows empty ──────────
      const uid = firebaseUser.uid;
      if (cacheHasData(uid)) {
        const cached = loadCache(uid);
        if (cached.owners?.length)      setOwners(cached.owners as Owner[]);
        if (cached.properties?.length)  setProperties(cached.properties as Property[]);
        if (cached.units?.length)       setUnits(cached.units as Unit[]);
        if (cached.contracts?.length)   setContracts(cached.contracts as Contract[]);
        if (cached.tenants?.length)     setTenants(cached.tenants as Tenant[]);
        if (cached.payments?.length)    setPayments(cached.payments as Payment[]);
        if (cached.maintenance?.length) setMaintenance(cached.maintenance as Maintenance[]);
      if ((cached as any).attachments?.length) setAttachments((cached as any).attachments as Attachment[]);
        console.log('[DATA_LOADED] cache hydrated');
      }

      // ── المرحلة 1: البيانات الأساسية ────────────────────────────────────────
      const loadCritical = async (attempt = 1): Promise<void> => {
        try {
          setDataLoading(true);
          const [
            ownersData, propertiesData, unitsData, contractsData, citiesRaw,
          ] = await Promise.all([
            fetchOwners(),
            fetchCol('properties'),
            fetchCol('units'),
            fetchCol('contracts'),
            getAll(resolvedOrgId, 'cities'),
          ]);

          // Bail if a newer auth event superseded this one
          if (gen !== loadGenRef.current) return;

          // ── معالجة المدن (بما في ذلك البذر التلقائي إن كانت فارغة) ──────────
          let citiesData = citiesRaw;
          if (!citiesData || citiesData.length === 0) {
            console.log('[CITIES] No cities found in critical load, seeding defaults...');
            const defaultCities: City[] = [
              { id: 'city_1', name: 'الرياض', displayName: 'الرياض', region: 'الرياض', createdAt: new Date().toISOString() },
              { id: 'city_2', name: 'جدة', displayName: 'جدة', region: 'مكة المكرمة', createdAt: new Date().toISOString() },
              { id: 'city_3', name: 'الدمام', displayName: 'الدمام', region: 'الشرقية', createdAt: new Date().toISOString() },
              { id: 'city_4', name: 'المدينة المنورة', displayName: 'المدينة المنورة', region: 'المدينة المنورة', createdAt: new Date().toISOString() },
            ];
            for (const city of defaultCities) { await setOne(getActiveOrgId(), 'cities', city.id, city); }
            citiesData = defaultCities;
          }
          const resolvedCities = citiesData as City[];
          setCities(resolvedCities);

          const firestoreHasData = ownersData.length > 0 || propertiesData.length > 0 ||
                                   unitsData.length > 0  || contractsData.length > 0;
          const cached = loadCache(uid);
          const useCache = !firestoreHasData && cacheHasData(uid);

          const resolvedOwners     = useCache ? (cached.owners     as Owner[]    ?? []) : ownersData     as Owner[];
          const resolvedProperties = useCache ? (cached.properties as Property[] ?? []) : propertiesData as Property[];

          setOwners(resolvedOwners);

          const today = new Date().toISOString().split('T')[0];
          const rawContracts = (useCache ? (cached.contracts as Contract[] ?? []) : contractsData as Contract[]);
          const rawUnits     = (useCache ? (cached.units     as Unit[]     ?? []) : unitsData     as Unit[]);

          // ترقية العقارات القديمة — تضيف unitStructure وتنشئ وحدات رئيسية إن لزم
          const { properties: migratedProps, units: migratedUnits } =
            migrateProperties(resolvedProperties, rawUnits);
          const currencyMigratedProps = migratePropertyCurrencies(migratedProps, migratedUnits, rawContracts);
          setProperties(currencyMigratedProps);
          const unitUpdatesMap: Record<string, Partial<Unit>> = {};

          const updatedContracts = rawContracts.map(c => {
            if (c.status === 'active' && c.endDate < today) {
              unitUpdatesMap[c.unitId] = { status: 'vacant', currentTenantId: undefined, currentContractId: undefined };
              updateOne(getActiveOrgId(), 'contracts', c.id, { status: 'expired' }).catch(() => {});
              return { ...c, status: 'expired' as ContractStatus };
            }
            return c;
          });

          // خريطة عقد نشط لكل وحدة — لمزامنة حالة الوحدات بشكل كامل
          const activeContractByUnit = new Map(
            updatedContracts
              .filter(c => c.status === 'active')
              .map(c => [c.unitId, c])
          );

          const finalUnits = migratedUnits.map(u => {
            // أولوية: تحديث الوحدات التي انتهت عقودها (من updatedContracts أعلاه)
            if (unitUpdatesMap[u.id]) {
              console.log(`[UNIT_SYNC] ${u.id} → vacant (expired contract)`);
              return { ...u, ...unitUpdatesMap[u.id] };
            }
            const activeContract = activeContractByUnit.get(u.id);
            if (activeContract) {
              // الوحدة لها عقد نشط → يجب أن تكون مؤجرة
              if (u.status !== 'rented' || u.currentContractId !== activeContract.id) {
                const fix = { status: 'rented' as UnitStatus, currentContractId: activeContract.id, currentTenantId: activeContract.tenantId };
                console.log(`[UNIT_SYNC] ${u.id} → rented (active contract ${activeContract.id})`);
                updateOne(getActiveOrgId(), 'units', u.id, fix).catch(() => {});
                return { ...u, ...fix };
              }
            } else if (u.status === 'rented') {
              // الوحدة مؤجرة لكن لا يوجد عقد نشط → شاغرة
              console.log(`[UNIT_SYNC] ${u.id} → vacant (no active contract)`);
              updateOne(getActiveOrgId(), 'units', u.id, { status: 'vacant', currentTenantId: null, currentContractId: null }).catch(() => {});
              return { ...u, status: 'vacant' as const, currentTenantId: undefined, currentContractId: undefined };
            }
            return u;
          });

          console.log('[UNIT_SYNC] summary', {
            total:  finalUnits.length,
            rented: finalUnits.filter(u => u.status === 'rented').length,
            vacant: finalUnits.filter(u => u.status === 'vacant').length,
          });

          const currencyMigratedUnits = migrateUnitCurrencies(finalUnits, currencyMigratedProps, updatedContracts);
          setContracts(updatedContracts);
          setUnits(currencyMigratedUnits);

          saveCache(uid, {
            owners:     resolvedOwners,
            properties: currencyMigratedProps,
            units:      currencyMigratedUnits,
            contracts:  updatedContracts,
            cities:     resolvedCities,
            attachments: [],
          });
          hydrated.current = true;
          console.log('[DATA_LOADED] critical Firestore data ready', {
            owners: resolvedOwners.length,
            properties: resolvedProperties.length,
            units: finalUnits.length,
            contracts: updatedContracts.length,
            cities: resolvedCities.length,
            fromCache: useCache,
          });
        } catch (e: any) {
          console.error('Firestore load error:', e);
          if (gen !== loadGenRef.current) return;
          if (attempt === 1 && e?.code === 'permission-denied') {
            try { await firebaseUser.getIdToken(true); } catch {}
            await new Promise(r => setTimeout(r, 1000));
            return loadCritical(2);
          }
          if (attempt > 1 || e?.code !== 'permission-denied') {
            const msg = e?.code === 'permission-denied'
              ? 'ليس لديك صلاحية قراءة البيانات. تواصل مع مدير النظام.'
              : e?.code === 'unavailable' || e?.message?.includes('network')
                ? 'تعذّر الاتصال بالخادم. تحقق من الإنترنت وأعد تحميل الصفحة.'
                : 'حدث خطأ أثناء تحميل البيانات. أعد تحميل الصفحة.';
            if (Platform.OS === 'web') window.alert(msg);
            else Alert.alert('خطأ في التحميل', msg);
          }
        } finally {
          if (gen === loadGenRef.current) {
            setDataLoading(false);
            loadingRef.current = false;
            console.log('[UI_READY] dataLoading cleared');
          }
        }
      };

      await loadCritical();

      // ── المرحلة 2: البيانات الثانوية — في الخلفية بعد عرض الواجهة ──────────
      // Store timer ref so it can be cancelled if auth fires again before it runs
      secondaryTimerRef.current = setTimeout(async () => {
        secondaryTimerRef.current = null;
        if (gen !== loadGenRef.current) return; // stale — skip
        try {
          const today = new Date().toISOString().split('T')[0];
          const [tenantsData, paymentsData, maintenanceData, auditData, calendarData, attachmentsData, allPhotosData] = await Promise.all([
            getAll(resolvedOrgId, 'tenants'),
            fetchCol('payments'),
            fetchCol('maintenance'),
            scopeOwnerId ? Promise.resolve([] as any[]) : getAll(resolvedOrgId, 'auditLogs'),
            getAll(resolvedOrgId, 'calendarEvents'),
            getAll(resolvedOrgId, 'attachments'),
            getAll(resolvedOrgId, 'photos'),
          ]);
          if (gen !== loadGenRef.current) return;
          const resolvedTenants     = tenantsData     as Tenant[];
          const resolvedMaintenance = maintenanceData as Maintenance[];
          setTenants(resolvedTenants);
          setMaintenance(resolvedMaintenance);
          const rawPayments = paymentsData as Payment[];
          const updatedPayments = rawPayments.map(p => {
            if (p.status === 'pending' && p.dueDate < today) {
              updateOne(getActiveOrgId(), 'payments', p.id, { status: 'overdue' }).catch(() => {});
              return { ...p, status: 'overdue' as const };
            }
            return p;
          });
          setPayments(updatedPayments);
          console.log('[DATA_LOADED] secondary Firestore data ready', {
            tenants: resolvedTenants.length,
            payments: updatedPayments.length,
            maintenance: resolvedMaintenance.length,
          });

          // Load system settings (feature flags + role permissions)
          getOne(getActiveOrgId(), 'settings', 'system').then(doc => {
            if (doc && gen === loadGenRef.current) {
              setSystemSettings(prev => ({
                modules:            { ...DEFAULT_SYSTEM_SETTINGS.modules, ...(doc.modules ?? {}) },
                permissions:        { ...DEFAULT_SYSTEM_SETTINGS.permissions, ...(doc.permissions ?? {}) },
                currency:           doc.currency ?? 'SAR',
                ownerDataIsolation: doc.ownerDataIsolation ?? true,
              }));
            }
          }).catch(() => {});

      // ── تحميل المدن ────────────────────────────────────────────────────────
      let citiesData = await getAll(getActiveOrgId(), 'cities');
      if (gen !== loadGenRef.current) return;
      
      // إذا لم تكن هناك مدن، أنشئ المدن الافتراضية تلقائياً
      if (!citiesData || citiesData.length === 0) {
        console.log('[CITIES] No cities found, seeding default cities...');
        const defaultCities: City[] = [
          { id: 'city_1', name: 'الرياض', displayName: 'الرياض', region: 'الرياض', createdAt: new Date().toISOString() },
          { id: 'city_2', name: 'جدة', displayName: 'جدة', region: 'مكة المكرمة', createdAt: new Date().toISOString() },
          { id: 'city_3', name: 'الدمام', displayName: 'الدمام', region: 'الشرقية', createdAt: new Date().toISOString() },
          { id: 'city_4', name: 'المدينة المنورة', displayName: 'المدينة المنورة', region: 'المدينة المنورة', createdAt: new Date().toISOString() },
        ];
        
        // حفظ المدن الافتراضية في Firestore
        for (const city of defaultCities) {
          await setOne(getActiveOrgId(), 'cities', city.id, city);
        }
        citiesData = defaultCities;
        console.log('[CITIES] Seeded', defaultCities.length, 'default cities');
      }
      
      const resolvedCities = citiesData as City[];
      setCities(resolvedCities);
      console.log('[DATA_LOADED] cities ready', { count: resolvedCities.length });

      const resolvedAttachments = FileService.syncExpiryStatuses(attachmentsData as Attachment[]);
      setAuditLogs((auditData as AuditLog[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
          setCalendarEvents(calendarData as CalendarEvent[]);
          setAttachments(resolvedAttachments);

          // Group individual photo docs by entityId
          const propPhotosMap: Record<string, PropertyPhoto[]> = {};
          const unitPhotosMap: Record<string, PropertyPhoto[]> = {};
          (allPhotosData as any[]).forEach(d => {
            if (!d.id || !d.entityId || !d.uri) return;
            const photo: PropertyPhoto = {
              id: d.id, uri: d.uri, isMain: d.isMain ?? false,
              uploadedAt: d.uploadedAt ?? '',
              ...(d.caption ? { caption: d.caption } : {}),
            };
            if (d.entityType === 'unit') {
              unitPhotosMap[d.entityId] = [...(unitPhotosMap[d.entityId] ?? []), photo];
            } else {
              propPhotosMap[d.entityId] = [...(propPhotosMap[d.entityId] ?? []), photo];
            }
          });
          setPropertyPhotos(propPhotosMap);
          setUnitPhotos(unitPhotosMap);

          // Save cache only AFTER all secondary state is fully populated
      saveCache(uid, {
        tenants:     resolvedTenants,
        payments:    updatedPayments,
        maintenance: resolvedMaintenance,
        attachments: resolvedAttachments,
        cities:      resolvedCities,
      });
        } catch (e) {
          console.error('Secondary load error:', e);
        } finally {
          if (gen === loadGenRef.current) {
            setSecondaryLoading(false);
            console.log('[UI_READY] secondaryLoading cleared');
          }
        }
      }, 100);
    });

    return () => {
      console.log('[FIREBASE_INIT] AppProvider unmounting — unsubscribing auth listener');
      // Cancel any pending secondary load before unmount
      if (secondaryTimerRef.current) {
        clearTimeout(secondaryTimerRef.current);
        secondaryTimerRef.current = null;
      }
      loadGenRef.current++; // invalidate any in-flight async flows
      loadingRef.current = false;
      unsub();
    };
  }, []);

  // ─── Auto-mark overdue payments whenever the payments list changes ───────────
  // Runs after load and after any mutation (e.g. updateContract regenerating installments).
  // Uses a ref to avoid processing the same payment twice and prevent infinite loops.
  const markedOverdueRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const toMark = payments.filter(
      p => p.status === 'pending' && p.dueDate < today && !markedOverdueRef.current.has(p.id)
    );
    if (toMark.length === 0) return;
    toMark.forEach(p => markedOverdueRef.current.add(p.id));
    const ids = new Set(toMark.map(p => p.id));
    setPayments(prev => prev.map(p => ids.has(p.id) ? { ...p, status: 'overdue' as const } : p));
    toMark.forEach(p => updateOne(getActiveOrgId(), 'payments', p.id, { status: 'overdue' }).catch(() => {}));
    console.log('[PAYMENTS] marked overdue:', toMark.map(p => p.id));
  }, [payments, userId]);

  // ─── Write-through cache: persist state to localStorage after every mutation ─
  // Guards against Firestore write failures (rules, network) causing data loss on re-login.
  // Runs only after initial hydration to avoid overwriting cache with empty state.
  useEffect(() => {
    if (!userId || !hydrated.current) return;
    saveCache(userId, { owners, properties, units, contracts, tenants, payments, maintenance, attachments });
  }, [userId, owners, properties, units, contracts, tenants, payments, maintenance, attachments]);

  // ─── عرض رسالة خطأ للمستخدم (مرة واحدة لكل نوع خطأ لتجنب التكرار) ──────
  const activeAlertRef = useRef(false);
  const showSaveError = useCallback((e: any, op: string) => {
    if (activeAlertRef.current) return;
    activeAlertRef.current = true;

    let title   = 'فشل حفظ البيانات';
    let message = 'تعذّر حفظ التغييرات. يُرجى المحاولة مجدداً.';

    if (e?.code === 'permission-denied' || e?.message?.includes('permission')) {
      title   = 'ليس لديك صلاحية';
      message = 'حسابك لا يملك صلاحية تنفيذ هذه العملية. تواصل مع مدير النظام.';
    } else if (e?.code === 'unavailable' || e?.message?.includes('network') || e?.message?.includes('offline')) {
      title   = 'لا يوجد اتصال';
      message = 'تعذّر الوصول إلى الخادم. تحقق من اتصالك بالإنترنت وأعد المحاولة.';
    } else if (e?.code === 'unauthenticated') {
      title   = 'انتهت جلستك';
      message = 'يُرجى تسجيل الخروج وإعادة الدخول.';
    }

    console.error(`[Firestore] ${op} failed:`, e);

    if (Platform.OS === 'web') {
      window.alert(`${title}\n\n${message}`);
      activeAlertRef.current = false;
    } else {
      Alert.alert(title, message, [{ text: 'حسناً', onPress: () => { activeAlertRef.current = false; } }]);
    }
  }, []);

  // ─── Firestore sync helper (يكتب في مؤسسة المستخدم النشطة) ──────────
  const fs = useCallback((col: string, id: string, data: any, op: 'set' | 'update' | 'delete') => {
    if (!userId) return;
    const _p = resolvePermissions(currentUser.role, systemSettings);
    const writeAllowed  = _p.canAdd || _p.canEdit;
    const deleteAllowed = _p.canDelete;
    if (op === 'delete' && !deleteAllowed) { console.warn('Permission denied: delete'); return; }
    if ((op === 'set' || op === 'update') && !writeAllowed) { console.warn('Permission denied: write'); return; }
    if (op === 'set')    setOne(getActiveOrgId(), col, id, data).catch(e => showSaveError(e, `set ${col}/${id}`));
    if (op === 'update') updateOne(getActiveOrgId(), col, id, data).catch(e => showSaveError(e, `update ${col}/${id}`));
    if (op === 'delete') deleteOne(getActiveOrgId(), col, id).catch(e => showSaveError(e, `delete ${col}/${id}`));
  }, [userId, currentUser.role, showSaveError]);

  // ─── صلاحيات المستخدم الحالي (مستمدة من إعدادات النظام الديناميكية) ────────
  const _perms  = resolvePermissions(currentUser.role, systemSettings);
  const isAdmin   = _perms.canManageUsers;
  const canWrite  = _perms.canAdd || _perms.canEdit;
  const canDelete = _perms.canDelete;
  const isOwner   = currentUser.role === 'owner' || currentUser.role === 'مالك';
  // فلترة بيانات المالك مفعّلة إذا كان المستخدم مالكاً + الإعداد مفعّل + يملك ownerId
  const applyOwnerFilter = isOwner && systemSettings.ownerDataIsolation && !!currentUser.ownerId;

  // ─── فلترة البيانات للمالك (مشروطة بإعداد ownerDataIsolation) ──────────────

  // الوحدات الخارجية المملوكة للمالك — تُحسب كعقارات مستقلة في لوحة التحكم
  // id مسبوق بـ "uasprop_" يميّزها عن العقارات الحقيقية
  const externalOwnedUnits = useMemo(() => {
    if (!applyOwnerFilter) return [] as (Unit & { parentPropertyName?: string })[];
    const oid = currentUser.ownerId;
    if (!oid) return [] as (Unit & { parentPropertyName?: string })[];
    return units
      .filter(u => {
        if (u.ownerId !== oid) return false;
        const prop = properties.find(p => p.id === u.propertyId);
        // عقار الأب ليس ضمن عقارات المالك (مملوك لغيره أو غير مُحمّل) → وحدة خارجية
        return !prop || prop.ownerId !== oid;
      })
      .map(u => ({
        ...u,
        parentPropertyName: properties.find(p => p.id === u.propertyId)?.name,
      }));
  }, [applyOwnerFilter, currentUser.ownerId, units, properties]);

  const visibleProperties = useMemo(() => {
    if (!applyOwnerFilter) return properties;
    const ownedProps = properties.filter(p => p.ownerId === currentUser.ownerId);
    // كل وحدة خارجية تظهر كعقار مستقل في القائمة والإحصائيات
    const synthProps = externalOwnedUnits.map(u => ({
      id: `uasprop_${u.id}`,
      name: `وحدة ${u.number}`,
      location: u.parentPropertyName ?? '',
      type: 'apartment' as PropertyType,
      totalUnits: 1,
      ownerId: currentUser.ownerId!,
      unitStructure: 'single' as const,
      createdAt: new Date().toISOString(),
      _unitId: u.id,
    } as Property & { _unitId: string }));
    return [...ownedProps, ...synthProps];
  }, [applyOwnerFilter, currentUser.ownerId, properties, externalOwnedUnits]);

  const visiblePropertyIds = useMemo(() =>
    new Set(visibleProperties.map(p => p.id)),
  [visibleProperties]);

  const visibleUnits = useMemo(() => {
    if (!applyOwnerFilter) return units;
    const oid = currentUser.ownerId;
    if (!oid) return [];
    return units.filter(u => {
      // وحدة مملوكة له مباشرة (في عقاره أو عقار آخر)
      if (u.ownerId === oid) return true;
      // وحدة في عقار مملوك له — تظهر حتى لو كانت لمالك آخر (للعرض فقط)
      const prop = properties.find(p => p.id === u.propertyId);
      return prop?.ownerId === oid;
    });
  }, [applyOwnerFilter, units, currentUser.ownerId, properties]);

  // الوحدات التي يملكها ملياً (للعقود والمدفوعات فقط — تستثني وحدات الآخرين في عقاراته)
  const financialUnitIds = useMemo(() => {
    if (!applyOwnerFilter) return new Set(units.map(u => u.id));
    const oid = currentUser.ownerId;
    if (!oid) return new Set<string>();
    return new Set(
      units.filter(u => {
        if (u.ownerId === oid) return true;
        if (u.ownerId) return false; // وحدة لمالك آخر → لا عقود له عليها
        const prop = properties.find(p => p.id === u.propertyId);
        return prop?.ownerId === oid;
      }).map(u => u.id)
    );
  }, [applyOwnerFilter, units, currentUser.ownerId, properties]);

  const visibleUnitIds = useMemo(() =>
    new Set(visibleUnits.map(u => u.id)),
  [visibleUnits]);

  const visibleContracts = useMemo(() =>
    applyOwnerFilter ? contracts.filter(c => financialUnitIds.has(c.unitId)) : contracts,
  [applyOwnerFilter, contracts, financialUnitIds]);

  const visibleContractIds = useMemo(() =>
    new Set(visibleContracts.map(c => c.id)),
  [visibleContracts]);

  const visiblePayments = useMemo(() =>
    applyOwnerFilter ? payments.filter(p => visibleContractIds.has(p.contractId)) : payments,
  [applyOwnerFilter, payments, visibleContractIds]);

  const visibleMaintenance = useMemo(() =>
    applyOwnerFilter
      ? maintenance.filter(m =>
          visiblePropertyIds.has(m.propertyId) ||
          (m.unitId ? visibleUnitIds.has(m.unitId) : false)
        )
      : maintenance,
  [applyOwnerFilter, maintenance, visiblePropertyIds, visibleUnitIds]);

  const visibleOwners = useMemo(() =>
    applyOwnerFilter ? owners.filter(o => o.id === currentUser.ownerId) : owners,
  [applyOwnerFilter, owners, currentUser.ownerId]);

  const visibleAuditLogs = useMemo(() =>
    applyOwnerFilter ? [] as AuditLog[] : auditLogs,
  [applyOwnerFilter, auditLogs]);

  const visibleTenants = useMemo(() => {
    if (!applyOwnerFilter) return tenants;
    const oid = currentUser.ownerId;
    return tenants.filter(t =>
      // مستأجر مرتبط بعقد للمالك
      visibleContracts.some(c => c.tenantId === t.id) ||
      // أو أضافه المالك مباشرة (بدون عقد بعد)
      (t as any).ownerId === oid
    );
  }, [applyOwnerFilter, tenants, visibleContracts, currentUser.ownerId]);

  const visibleAttachments = useMemo(() => {
    if (!applyOwnerFilter) return attachments;
    const visibleMaintenanceIds = new Set(visibleMaintenance.map(m => m.id));
    const visiblePaymentIds     = new Set(visiblePayments.map(p => p.id));
    return attachments.filter(a => {
      if (a.entityType === 'property')    return visiblePropertyIds.has(a.entityId);
      if (a.entityType === 'unit')        return visibleUnitIds.has(a.entityId);
      if (a.entityType === 'contract')    return visibleContractIds.has(a.entityId);
      if (a.entityType === 'payment')     return visiblePaymentIds.has(a.entityId);
      if (a.entityType === 'maintenance') return visibleMaintenanceIds.has(a.entityId);
      if (a.entityType === 'owner')       return a.entityId === currentUser.ownerId;
      return false;
    });
  }, [applyOwnerFilter, attachments, visiblePropertyIds, visibleUnitIds, visibleContractIds,
      visiblePayments, visibleMaintenance, currentUser.ownerId]);

  // ─── إحصائيات المدن ────────────────────────────────────────────────────────
  const cityStats = useMemo(() => {
    const normCity = (raw: string): string => {
      let s = raw.trim();
      s = s.replace(/ة$/g, 'ه');
      s = s.replace(/[أإآ]/g, 'ا');
      s = s.replace(/\s+/g, ' ');
      return s;
    };

    // خريطة: cityId → إحصائيات
    const statsMap = new Map<string, {
      cityId: string;
      cityName: string;
      region?: string;
      totalProperties: number;
      rentedProperties: number;
      totalUnits: number;
      rentedUnits: number;
      vacantUnits: number;
      monthlyRevenue: number;
    }>();

    // Initialize stats for all known cities
    cities.forEach(city => {
      statsMap.set(city.id, {
        cityId: city.id,
        cityName: city.displayName || city.name,
        region: city.region,
        totalProperties: 0,
        rentedProperties: 0,
        totalUnits: 0,
        rentedUnits: 0,
        vacantUnits: 0,
        monthlyRevenue: 0,
      });
    });

    // Track properties per city (for rentedProperties count)
    const propCityMap = new Map<string, string>(); // propertyId → cityId

    // Count units per city
    visibleUnits.forEach(u => {
      const prop = visibleProperties.find(p => p.id === u.propertyId);
      if (!prop) return;

      let cityId = prop.cityId;
      // Fallback: derive cityId from legacy city text
      if (!cityId && prop.city) {
        const normalized = normCity(prop.city);
        const matchingCity = cities.find(c => normCity(c.name) === normalized || normCity(c.displayName) === normalized);
        if (matchingCity) cityId = matchingCity.id;
      }
      if (!cityId) return;

      propCityMap.set(prop.id, cityId);
      const stats = statsMap.get(cityId);
      if (!stats) return;

      stats.totalUnits += 1;
      if (u.status === 'rented') stats.rentedUnits += 1;
      else if (u.status === 'vacant') stats.vacantUnits += 1;
    });

    // Count properties and revenue per city from active contracts
    const activeContracts = visibleContracts.filter(c => c.status === 'active');
    activeContracts.forEach(c => {
      const unit = visibleUnits.find(u => u.id === c.unitId);
      if (!unit) return;
      const prop = visibleProperties.find(p => p.id === unit.propertyId);
      if (!prop) return;

      let cityId = prop.cityId;
      if (!cityId && prop.city) {
        const normalized = normCity(prop.city);
        const matchingCity = cities.find(c => normCity(c.name) === normalized || normCity(c.displayName) === normalized);
        if (matchingCity) cityId = matchingCity.id;
      }
      if (!cityId) return;

      const stats = statsMap.get(cityId);
      if (!stats) return;

      stats.rentedProperties += 1;
      stats.monthlyRevenue += Math.round(c.annualValue / 12);
    });

    // Count total properties per city
    visibleProperties.forEach(prop => {
      let cityId = prop.cityId;
      if (!cityId && prop.city) {
        const normalized = normCity(prop.city);
        const matchingCity = cities.find(c => normCity(c.name) === normalized || normCity(c.displayName) === normalized);
        if (matchingCity) cityId = matchingCity.id;
      }
      if (!cityId) return;

      const stats = statsMap.get(cityId);
      if (!stats) return;
      stats.totalProperties += 1;
    });

    return Array.from(statsMap.values()).sort((a, b) => b.monthlyRevenue - a.monthlyRevenue);
  }, [cities, visibleProperties, visibleUnits, visibleContracts]);

  const kpis = useMemo(() => {
    const activeContracts = visibleContracts.filter(c => c.status === 'active');
    // Derive rented/vacant from active contracts, not stale unit.status
    const rentedUnitIds = new Set(activeContracts.map(c => c.unitId));
    const rentedUnits = visibleUnits.filter(u => rentedUnitIds.has(u.id)).length;
    const vacantUnits = visibleUnits.length - rentedUnits;
    const monthlyRevenue = activeContracts.reduce((sum, c) => sum + Math.round(c.annualValue / 12), 0);
    const openMaintenanceRequests = visibleMaintenance.filter(m => m.status === 'new' || m.status === 'in_progress').length;
    const overduePayments = visiblePayments.filter(p => p.status === 'overdue').length;
    const pendingPayments = visiblePayments.filter(p => p.status === 'pending').length;
    const paidTotal = visiblePayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + p.amount, 0);
    const totalDue = visiblePayments.reduce((sum, p) => sum + p.amount, 0);
    const collectionRate = totalDue > 0 ? Math.round((paidTotal / totalDue) * 100) : 0;

    // ── Rented properties & units by city ────────────────────────────────
    // دالة لتوحيد أسماء المدن (مكة المكرمة = مكة المكرمه، الشارقة = الشارقہ)
    const normCity = (raw: string): string => {
      let s = raw.trim();
      // توحيد التاء المربوطة (ة) والهاء (ه) في نهاية الكلمة
      s = s.replace(/ة$/g, 'ه');
      // توحيد الألف بأشكالها (أ, إ, آ) إلى (ا)
      s = s.replace(/[أإآ]/g, 'ا');
      // إزالة الـ "ال" التعريفية للتوحيد (اختياري - قد يكون دقيقاً جداً)
      // s = s.replace(/^ال/g, '');
      // إزالة المسافات المتعددة
      s = s.replace(/\s+/g, ' ');
      return s;
    };

    const rentedPropIds = new Set<string>();
    const rentedUnitIdsByCity = new Map<string, number>();
    const rentedPropIdsByCity = new Map<string, Set<string>>();
    const totalUnitsByCity = new Map<string, number>();
    // تخزين الاسم الأصلي (الأكثر شيوعاً) لكل مدينة موحدة
    const originalCityNames = new Map<string, string>();

    // First pass: count ALL units per city (for totalUnitsByCity)
    visibleUnits.forEach(u => {
      const prop = visibleProperties.find(p => p.id === u.propertyId);
      if (!prop) return;
      const rawCity = (prop as any).city || prop.location || 'أخرى';
      const normalized = normCity(rawCity);
      totalUnitsByCity.set(normalized, (totalUnitsByCity.get(normalized) ?? 0) + 1);
      // احتفظ بأول اسم أصلي نصادفه
      if (!originalCityNames.has(normalized)) originalCityNames.set(normalized, rawCity);
    });

    // Second pass: count rented units per city from active contracts
    activeContracts.forEach(c => {
      const unit = visibleUnits.find(u => u.id === c.unitId);
      if (!unit) return;
      const prop = visibleProperties.find(p => p.id === unit.propertyId);
      if (!prop) return;
      const rawCity = (prop as any).city || prop.location || 'أخرى';
      const normalized = normCity(rawCity);

      // Track units
      rentedUnitIdsByCity.set(normalized, (rentedUnitIdsByCity.get(normalized) ?? 0) + 1);

      // Track unique properties
      if (!rentedPropIdsByCity.has(normalized)) {
        rentedPropIdsByCity.set(normalized, new Set());
      }
      rentedPropIdsByCity.get(normalized)!.add(prop.id);
      rentedPropIds.add(prop.id);
      // احتفظ بأول اسم أصلي نصادفه
      if (!originalCityNames.has(normalized)) originalCityNames.set(normalized, rawCity);
    });

    // استخدم الاسم الأصلي الأكثر شيوعاً للعرض بدلاً من الاسم المُطبع
    const getDisplayName = (normalized: string): string => {
      return originalCityNames.get(normalized) ?? normalized;
    };

    const rentedByCity: Record<string, number> = {};
    const rentedUnitsByCity: Record<string, number> = {};
    const totalUnitsByCityObj: Record<string, number> = {};
    const cityDisplayNames: Record<string, string> = {};
    rentedPropIdsByCity.forEach((propSet, city) => {
      rentedByCity[city] = propSet.size;
    });
    rentedUnitIdsByCity.forEach((count, city) => {
      rentedUnitsByCity[city] = count;
    });
    totalUnitsByCity.forEach((count, city) => {
      totalUnitsByCityObj[city] = count;
    });
    originalCityNames.forEach((orig, norm) => {
      cityDisplayNames[norm] = orig;
    });

    return {
      totalProperties: visibleProperties.length,
      rentedUnits,
      vacantUnits,
      monthlyRevenue,
      openMaintenanceRequests,
      overduePayments,
      activeContracts: activeContracts.length,
      pendingPayments,
      collectionRate,
      rentedByCity,
      rentedUnitsByCity,
      totalUnitsByCity: totalUnitsByCityObj,
      cityDisplayNames,
    };
  }, [visibleUnits, visibleContracts, visiblePayments, visibleMaintenance, visibleProperties]);

  // ─── City Management ────────────────────────────────────────────────────────
  const addCity = (city: City) => {
    setCities(prev => [...prev, city]);
    fs('cities', city.id, city, 'set');

    // ✅ Auto-link existing properties that match this city by location name
    const cityName = (city.name || '').toLowerCase().trim();
    const matchingProps = properties.filter(p => {
      if (p.cityId) return false; // already linked
      const loc = (p.location || (p as any).city || '').toLowerCase();
      // Check if location starts with or contains the city name
      return loc.startsWith(cityName) || loc.includes(cityName);
    });
    matchingProps.forEach(p => {
      setProperties(prev => prev.map(pr => pr.id === p.id ? { ...pr, cityId: city.id } : pr));
      fs('properties', p.id, { cityId: city.id }, 'update');
    });
    if (matchingProps.length > 0) {
      console.log(`[CITY] Auto-linked ${matchingProps.length} properties to "${city.displayName || city.name}"`);
    }

    addAuditEntry('add', 'مدينة', city.displayName || city.name, `تم إضافة مدينة جديدة: ${city.displayName || city.name}${matchingProps.length > 0 ? ` (ربط ${matchingProps.length} عقار)` : ''}`);
  };

  const updateCity = (id: string, data: Partial<City>) => {
    setCities(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
    fs('cities', id, data, 'update');
    const city = cities.find(c => c.id === id);
    addAuditEntry('edit', 'مدينة', city?.displayName || id, `تم تعديل بيانات المدينة`);
  };

  const deleteCity = (id: string) => {
    const city = cities.find(c => c.id === id);
    // إزالة cityId من العقارات المرتبطة
    const affectedProps = properties.filter(p => p.cityId === id);
    affectedProps.forEach(p => {
      fs('properties', p.id, { cityId: null }, 'update');
    });
    setProperties(prev => prev.map(p => p.cityId === id ? { ...p, cityId: undefined } : p));
    setCities(prev => prev.filter(c => c.id !== id));
    fs('cities', id, {}, 'delete');
    addAuditEntry('delete', 'مدينة', city?.displayName || id, `تم حذف المدينة وتحرير ${affectedProps.length} عقار`);
  };

  // تحديث جميع العقارات بإضافة cityId بناءً على الموقع
  const updateAllPropertiesWithCities = useCallback(async () => {
    const normCity = (raw: string): string => {
      let s = raw.trim();
      s = s.replace(/ة$/g, 'ه');
      s = s.replace(/[أإآ]/g, 'ا');
      s = s.replace(/\s+/g, ' ');
      return s;
    };

    // خريطة: اسم موحد → cityId
    const cityMap = new Map<string, string>();
    cities.forEach(city => {
      const normalized = normCity(city.name);
      cityMap.set(normalized, city.id);
      if (city.displayName) {
        const displayNormalized = normCity(city.displayName);
        cityMap.set(displayNormalized, city.id);
      }
    });

    let updated = 0;
    let skipped = 0;

    properties.forEach(prop => {
      // تخطي العقارات التي لها cityId بالفعل
      if (prop.cityId) {
        skipped++;
        return;
      }

      // استخراج اسم المدينة من location
      const location = prop.location || (prop as any).city || '';
      if (!location) return;

      const cityName = location.split(' - ')[0].trim();
      const normalizedCity = normCity(cityName);
      const cityId = cityMap.get(normalizedCity);

      if (cityId) {
        // تحديث العقار
        fs('properties', prop.id, { cityId }, 'update');
        setProperties(prev => prev.map(p => p.id === prop.id ? { ...p, cityId } : p));
        updated++;
      }
    });

    return { updated, skipped };
  }, [cities, properties, fs]);

  const addAuditEntry = (action: AuditLog['action'], entityType: string, entityName: string, details: string) => {
    const entry: AuditLog = {
      id: `al${Date.now()}`,
      action,
      entityType,
      entityName,
      userId: userId ?? 'unknown',
      userName: currentUser.name,
      timestamp: new Date().toISOString(),
      details,
    };
    setAuditLogs(prev => [entry, ...prev]);
    fs('auditLogs', entry.id, entry, 'set');
  };

  // ─── Owner ────────────────────────────────────────────────────────────────
  const addOwner = (owner: Owner) => {
    setOwners(prev => [...prev, owner]);
    fs('owners', owner.id, owner, 'set');
    addAuditEntry('add', 'مالك', owner.name, `تم إضافة مالك جديد: ${owner.name}`);
  };
  const updateOwner = (id: string, data: Partial<Owner>) => {
    setOwners(prev => prev.map(o => o.id === id ? { ...o, ...data } : o));
    fs('owners', id, data, 'update');
    const owner = owners.find(o => o.id === id);
    addAuditEntry('edit', 'مالك', owner?.name || id, `تم تعديل بيانات المالك`);
  };
  const deleteOwner = (id: string) => {
    const owner = owners.find(o => o.id === id);
    setOwners(prev => prev.filter(o => o.id !== id));
    fs('owners', id, {}, 'delete');
    addAuditEntry('delete', 'مالك', owner?.name || id, `تم حذف المالك`);
  };

  // ─── Migration: currency للعقارات التي عملتها SAR أو فارغة ─────────────────
  // تستنتج العملة من العقود المرتبطة — لو كل عقوده AED مثلاً → العقار AED
  const migratePropertyCurrencies = useCallback((
    loadedProperties: Property[],
    loadedUnits: Unit[],
    loadedContracts: Contract[],
  ): Property[] => {
    // خريطة: propertyId → مجموعة عملات عقوده
    const propCurrencyMap = new Map<string, Map<string, number>>();
    loadedContracts.forEach(c => {
      if (!c.currency || c.currency === 'SAR') return;
      const unit = loadedUnits.find(u => u.id === c.unitId);
      if (!unit) return;
      const pid = unit.propertyId;
      if (!propCurrencyMap.has(pid)) propCurrencyMap.set(pid, new Map());
      const freq = propCurrencyMap.get(pid)!;
      freq.set(c.currency, (freq.get(c.currency) ?? 0) + 1);
    });

    return loadedProperties.map(p => {
      // لو العقار بالفعل عنده currency محددة → لا نتدخل
      if (p.currency && p.currency !== 'SAR') return p;

      const freq = propCurrencyMap.get(p.id);

      // اختر العملة الأكثر تكراراً في عقوده
      let topCurrency = 'SAR', topCount = 0;
      if (freq && freq.size > 0) {
        freq.forEach((count, cur) => { if (count > topCount) { topCount = count; topCurrency = cur; } });
      }

      // إذا لم تكن currency محددة أصلاً → اكتبها في Firestore (SAR أو ما استُنتج)
      if (!p.currency || p.currency !== topCurrency) {
        updateOne(getActiveOrgId(), 'properties', p.id, { currency: topCurrency }).catch(() => {});
        return { ...p, currency: topCurrency };
      }
      return p;
    });
  }, []);

  // ─── Migration: currency للوحدات القديمة بدون عملة ───────────────────────
  // تورث العملة من العقد النشط → العقار → SAR
  const migrateUnitCurrencies = useCallback((
    loadedUnits: Unit[],
    loadedProperties: Property[],
    loadedContracts: Contract[],
  ): Unit[] => {
    return loadedUnits.map(u => {
      if (u.currency) return u;
      // استنتج من العقد النشط
      const activeContract = loadedContracts.find(c => c.id === u.currentContractId);
      const inherited = activeContract?.currency
        ?? loadedProperties.find(p => p.id === u.propertyId)?.currency
        ?? 'SAR';
      if (inherited && inherited !== u.currency) {
        updateOne(getActiveOrgId(), 'units', u.id, { currency: inherited }).catch(() => {});
        return { ...u, currency: inherited };
      }
      return u;
    });
  }, []);

  // ─── Migration: unitStructure للعقارات القديمة ────────────────────────────
  // تعمل مرة واحدة عند تحميل البيانات — تضيف unitStructure للعقارات التي تفتقر إليه
  // وتنشئ وحدة رئيسية للعقارات الفردية التي ليس لها وحدات بعد
  const migrateProperties = useCallback((
    loadedProperties: Property[],
    loadedUnits: Unit[],
  ): { properties: Property[]; units: Unit[] } => {
    const existingUnitsByProperty = new Map<string, Unit[]>();
    loadedUnits.forEach(u => {
      const list = existingUnitsByProperty.get(u.propertyId) ?? [];
      list.push(u);
      existingUnitsByProperty.set(u.propertyId, list);
    });

    const newUnits: Unit[] = [];
    const migratedProperties = loadedProperties.map(p => {
      // ① إضافة unitStructure إذا لم يكن موجوداً
      const structure: UnitStructure = (p.unitStructure as UnitStructure) ?? defaultUnitStructure(p.type);
      const needsStructureUpdate = !p.unitStructure;

      if (needsStructureUpdate) {
        updateOne(getActiveOrgId(), 'properties', p.id, { unitStructure: structure }).catch(() => {});
      }

      // ② إنشاء وحدة رئيسية للعقارات الفردية بدون وحدات
      if (structure === 'single') {
        const existingUnits = existingUnitsByProperty.get(p.id) ?? [];
        // لا ننشئ وحدة إذا كانت موجودة بالفعل (حتى لو كانت مضافة يدوياً قبل هذا التحديث)
        if (existingUnits.length === 0) {
          const autoUnit: Unit = {
            id:          `u_${p.id}`,
            propertyId:  p.id,
            ...(p.ownerId ? { ownerId: p.ownerId } : {}),
            number:      'رئيسية',
            type:        'apartment_1',
            floor:       1,
            area:        p.area ?? 0,
            monthlyRent: 0,
            annualRent:  0,
            status:      'vacant' as UnitStatus,
            description: '',
            features:    [],
          };
          // تحقق إضافي: لا تنشئ إذا كان ID موجوداً بالفعل في Firestore
          const alreadyExists = loadedUnits.some(u => u.id === autoUnit.id);
          if (!alreadyExists) {
            setOne(getActiveOrgId(), 'units', autoUnit.id, autoUnit).catch(() => {});
            newUnits.push(autoUnit);
          }
        }
      }

      return { ...p, unitStructure: structure };
    });

    return { properties: migratedProperties, units: [...loadedUnits, ...newUnits] };
  }, []);

  // ─── Property ─────────────────────────────────────────────────────────────
  const addProperty = (property: Property) => {
    const structure = property.unitStructure ?? defaultUnitStructure(property.type);
    // لو المستخدم مالك ولم يُحدد ownerId → نربطه بحساب المالك تلقائياً
    const autoOwnerId = isOwner && currentUser.ownerId && !property.ownerId
      ? currentUser.ownerId : property.ownerId;
    // إذا كان هناك cityId، نتحقق من وجوده في قائمة المدن
    let finalCityId = property.cityId;
    if (finalCityId && !cities.find(c => c.id === finalCityId)) {
      finalCityId = undefined;
    }
    const finalProperty = { ...property, unitStructure: structure, ownerId: autoOwnerId, cityId: finalCityId };

    setProperties(prev => [...prev, finalProperty]);
    fs('properties', finalProperty.id, finalProperty, 'set');

    // للعقارات الفردية → ننشئ وحدة رئيسية واحدة تلقائياً مخفية عن المستخدم
    if (structure === 'single') {
      const autoUnit: Unit = {
        id:           `u_${finalProperty.id}`,
        propertyId:   finalProperty.id,
        ...(finalProperty.ownerId ? { ownerId: finalProperty.ownerId } : {}),
        number:       'رئيسية',
        type:         'apartment_1',
        floor:        1,
        area:         finalProperty.area ?? 0,
        monthlyRent:  0,
        annualRent:   0,
        status:       'vacant' as UnitStatus,
        description:  '',
        features:     [],
      };
      setUnits(prev => [...prev, autoUnit]);
      fs('units', autoUnit.id, autoUnit, 'set');
    }

    addAuditEntry('add', 'عقار', finalProperty.name, `تم إضافة عقار جديد: ${finalProperty.name}`);
  };
  const updateProperty = (id: string, data: Partial<Property>) => {
    // إذا كان هناك cityId في البيانات، نتحقق من وجوده
    let finalData = { ...data };
    if (finalData.cityId && !cities.find(c => c.id === finalData.cityId)) {
      finalData.cityId = undefined;
    }
    setProperties(prev => prev.map(p => p.id === id ? { ...p, ...finalData } : p));
    fs('properties', id, finalData, 'update');
    const prop = properties.find(p => p.id === id);
    addAuditEntry('edit', 'عقار', prop?.name || id, `تم تعديل بيانات العقار`);
  };
  const deleteProperty = (id: string) => {
    const prop = properties.find(p => p.id === id);

    // cascade: وحدات → عقود → دفعات معلقة → صيانة
    const propUnits     = units.filter(u => u.propertyId === id);
    const propUnitIds   = new Set(propUnits.map(u => u.id));
    const propContracts = contracts.filter(c => propUnitIds.has(c.unitId));
    const propContractIds = new Set(propContracts.map(c => c.id));

    // حذف الدفعات المعلقة (المدفوعة تبقى للسجل التاريخي)
    payments
      .filter(p => propContractIds.has(p.contractId) && p.status !== 'paid')
      .forEach(p => fs('payments', p.id, {}, 'delete'));

    // إلغاء العقود
    propContracts.forEach(c => fs('contracts', c.id, { status: 'cancelled' }, 'update'));

    // حذف الوحدات والصيانة
    propUnits.forEach(u => fs('units', u.id, {}, 'delete'));
    maintenance.filter(m => m.propertyId === id).forEach(m => fs('maintenance', m.id, {}, 'delete'));

    // تحديث الـ state
    setPayments(prev => prev.filter(p => !propContractIds.has(p.contractId) || p.status === 'paid'));
    setContracts(prev => prev.map(c => propContractIds.has(c.id) ? { ...c, status: 'cancelled' as ContractStatus } : c));
    setUnits(prev => prev.filter(u => u.propertyId !== id));
    setMaintenance(prev => prev.filter(m => m.propertyId !== id));
    setProperties(prev => prev.filter(p => p.id !== id));
    fs('properties', id, {}, 'delete');
    addAuditEntry('delete', 'عقار', prop?.name || id,
      `تم حذف العقار و${propUnits.length} وحدة و${propContracts.length} عقد مرتبط`);
  };

  // ─── Tenant ───────────────────────────────────────────────────────────────
  const addTenant = (tenant: Tenant) => {
    const finalTenant = isOwner && currentUser.ownerId && !(tenant as any).ownerId
      ? { ...tenant, ownerId: currentUser.ownerId }
      : tenant;
    setTenants(prev => [...prev, finalTenant]);
    fs('tenants', finalTenant.id, finalTenant, 'set');
    addAuditEntry('add', 'مستأجر', tenant.name, `تم إضافة مستأجر جديد: ${tenant.name}`);
  };
  const updateTenant = (id: string, data: Partial<Tenant>) => {
    setTenants(prev => prev.map(t => t.id === id ? { ...t, ...data } : t));
    fs('tenants', id, data, 'update');
    const tenant = tenants.find(t => t.id === id);
    addAuditEntry('edit', 'مستأجر', tenant?.name || id, `تم تعديل بيانات المستأجر`);
  };
  const deleteTenant = (id: string) => {
    const tenant = tenants.find(t => t.id === id);

    // cascade: حذف عقوده + دفعاته المعلقة + تحرير وحداته
    const tenantContracts = contracts.filter(c => c.tenantId === id);
    tenantContracts.forEach(c => {
      // حذف الدفعات المعلقة فقط (المدفوعة تبقى كسجل تاريخي)
      payments.filter(p => p.contractId === c.id && p.status !== 'paid')
              .forEach(p => fs('payments', p.id, {}, 'delete'));
      // تحرير الوحدة
      fs('units', c.unitId, { status: 'vacant', currentTenantId: null, currentContractId: null }, 'update');
      // إلغاء العقد (لا حذف — للحفاظ على سجل المدفوعات)
      fs('contracts', c.id, { status: 'cancelled' }, 'update');
    });

    setPayments(prev => prev.filter(p =>
      !tenantContracts.some(c => c.id === p.contractId && p.status !== 'paid')
    ));
    setContracts(prev => prev.map(c =>
      c.tenantId === id ? { ...c, status: 'cancelled' as ContractStatus } : c
    ));
    setUnits(prev => prev.map(u =>
      tenantContracts.some(c => c.unitId === u.id)
        ? { ...u, status: 'vacant' as UnitStatus, currentTenantId: undefined, currentContractId: undefined }
        : u
    ));

    setTenants(prev => prev.filter(t => t.id !== id));
    fs('tenants', id, {}, 'delete');
    addAuditEntry('delete', 'مستأجر', tenant?.name || id, `تم حذف المستأجر وإلغاء ${tenantContracts.length} عقد مرتبط`);
  };

  // ─── Unit ─────────────────────────────────────────────────────────────────
  const addUnit = (unit: Unit) => {
    // نختم ownerId الفعلي دائماً (= مالك الوحدة الصريح أو مالك العقار الأب) ليعمل
    // العزل والاستعلامات المحصورة على السيرفر. الوحدات بلا مالك (عقار للشركة) تبقى بلا ownerId.
    const parentProp = properties.find(p => p.id === unit.propertyId);
    const effectiveOwnerId = unit.ownerId ?? parentProp?.ownerId;
    const finalUnit = effectiveOwnerId ? { ...unit, ownerId: effectiveOwnerId } : unit;
    setUnits(prev => [...prev, finalUnit]);
    fs('units', finalUnit.id, finalUnit, 'set');
    addAuditEntry('add', 'وحدة', `وحدة ${finalUnit.number}`, `تم إضافة وحدة جديدة رقم ${finalUnit.number}`);
  };
  const updateUnit = (id: string, data: Partial<Unit>) => {
    setUnits(prev => prev.map(u => u.id === id ? { ...u, ...data } : u));
    fs('units', id, data, 'update');
    const unit = units.find(u => u.id === id);

    // عند تغيير مالك الوحدة: مرّر المالك الفعّال (مالك الوحدة الصريح أو مالك العقار الأب)
    // إلى عقود/دفعات/صيانة هذه الوحدة — عزل الإيجار يتبع المستفيد على مستوى الوحدة.
    if (data.ownerId !== undefined) {
      const parentProp = properties.find(p => p.id === unit?.propertyId);
      const effOwner = (data.ownerId || parentProp?.ownerId) as string | undefined;
      const unitContractIds = contracts.filter(c => c.unitId === id).map(c => c.id);
      contracts.filter(c => c.unitId === id).forEach(c => fs('contracts', c.id, { ownerId: effOwner }, 'update'));
      setContracts(prev => prev.map(c => c.unitId === id ? { ...c, ownerId: effOwner } as Contract : c));
      payments.filter(p => unitContractIds.includes(p.contractId)).forEach(p => fs('payments', p.id, { ownerId: effOwner }, 'update'));
      setPayments(prev => prev.map(p => unitContractIds.includes(p.contractId) ? { ...p, ownerId: effOwner } as Payment : p));
      maintenance.filter(m => m.unitId === id).forEach(m => fs('maintenance', m.id, { ownerId: effOwner }, 'update'));
      setMaintenance(prev => prev.map(m => m.unitId === id ? { ...m, ownerId: effOwner } as Maintenance : m));
    }

    addAuditEntry('edit', 'وحدة', `وحدة ${unit?.number || id}`, `تم تعديل بيانات الوحدة`);
  };
  const deleteUnit = (id: string) => {
    const unit = units.find(u => u.id === id);
    setUnits(prev => prev.filter(u => u.id !== id));
    fs('units', id, {}, 'delete');
    addAuditEntry('delete', 'وحدة', `وحدة ${unit?.number || id}`, `تم حذف الوحدة`);
  };

  // ─── Contract ─────────────────────────────────────────────────────────────
  const addContract = (contract: Contract) => {
    if (!userId) return;

    // مالك الوحدة (للعزل والاستعلامات المحصورة) — من الوحدة أو من عقارها الأب
    const cUnit = units.find(u => u.id === contract.unitId);
    const contractOwnerId = cUnit?.ownerId ?? properties.find(p => p.id === cUnit?.propertyId)?.ownerId;
    const finalContract = contractOwnerId ? { ...contract, ownerId: contractOwnerId } : contract;

    // ① حساب الوحدة والمستأجر المحدّثين
    const unitPatch: Partial<Unit> = {
      status: 'rented' as UnitStatus,
      currentTenantId: contract.tenantId,
      currentContractId: contract.id,
    };
    const tenant = tenants.find(t => t.id === contract.tenantId);
    const newContractIds = [...(tenant?.contractIds ?? []), contract.id];
    const tenantPatch = { contractIds: newContractIds };

    // ② حساب الأقساط
    const count = contract.installmentsCount;
    const baseAmount = Math.floor(contract.annualValue / count);
    const remainder = contract.annualValue - baseAmount * count;
    const startMs = new Date(contract.startDate).getTime();
    const endMs   = new Date(contract.endDate).getTime();
    const spanMs  = endMs - startMs;
    const installments: Payment[] = Array.from({ length: count }, (_, i) => {
      const dueMs = startMs + Math.round((i / count) * spanMs);
      const amount = i === count - 1 ? baseAmount + remainder : baseAmount;
      return {
        id: `pay_${contract.id}_${i + 1}`,
        receiptNumber: `RCP-PENDING-${i + 1}`,
        contractId: contract.id,
        ...(contractOwnerId ? { ownerId: contractOwnerId } : {}),
        amount,
        dueDate: new Date(dueMs).toISOString().split('T')[0],
        status: 'pending' as const,
        installmentNumber: i + 1,
        ...(contract.currency ? { currency: contract.currency } : {}),
      };
    });

    // ③ تحديث الـ state فوراً (optimistic)
    setContracts(prev => [...prev, finalContract]);
    setUnits(prev => prev.map(u => u.id === contract.unitId ? { ...u, ...unitPatch } : u));
    setTenants(prev => prev.map(t => t.id === contract.tenantId ? { ...t, contractIds: newContractIds } : t));
    setPayments(prev => [...prev, ...installments]);

    // ④ كتابة Firestore كلها في transaction واحدة ذرية
    runContractTransaction({
      orgId:       getActiveOrgId(),
      contract:    finalContract,
      unitId:      contract.unitId,
      unitPatch,
      tenantId:    contract.tenantId,
      tenantPatch,
      payments:    installments.map(p => ({ id: p.id, data: p })),
    }).catch(e => showSaveError(e, 'addContract transaction'));

    addAuditEntry('add', 'عقد', contract.contractNumber, `تم إضافة عقد جديد ${contract.contractNumber}`);
  };

  const updateContract = (id: string, data: Partial<Contract>) => {
    const contract = contracts.find(c => c.id === id);
    if (!contract) return;

    const updatedContract = { ...contract, ...data };
    const today = new Date().toISOString().split('T')[0];

    // Auto-expire / auto-activate based on new endDate
    let finalData = { ...data };
    if (data.endDate) {
      if (data.endDate < today && contract.status === 'active') {
        finalData.status = 'expired';
      } else if (data.endDate >= today && contract.status === 'expired') {
        // تمديد عقد منتهي → يرجع نشطاً تلقائياً
        finalData.status = 'active';
      }
    }

    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...finalData } : c));
    fs('contracts', id, finalData, 'update');

    // Sync unit status based on contract status change
    const newStatus = finalData.status ?? contract.status;
    if (['terminated', 'expired', 'cancelled'].includes(newStatus) && contract.status === 'active') {
      const unitUpdate: Partial<Unit> = { status: 'vacant' as UnitStatus, currentTenantId: undefined, currentContractId: undefined };
      setUnits(prev => prev.map(u => u.id === contract.unitId ? { ...u, ...unitUpdate } : u));
      fs('units', contract.unitId, { status: 'vacant', currentTenantId: null, currentContractId: null }, 'update');
    } else if (newStatus === 'active' && contract.status === 'expired') {
      // عقد رجع نشطاً → الوحدة مؤجرة مجدداً
      setUnits(prev => prev.map(u => u.id === contract.unitId
        ? { ...u, status: 'rented' as UnitStatus, currentTenantId: contract.tenantId, currentContractId: id }
        : u
      ));
      fs('units', contract.unitId, { status: 'rented', currentTenantId: contract.tenantId, currentContractId: id }, 'update');
    }

    // If only currency changed (no financial change), update all pending payments' currency
    const currencyChanged = data.currency !== undefined && data.currency !== contract.currency;
    if (currencyChanged && !(
      (data.annualValue !== undefined && data.annualValue !== contract.annualValue) ||
      (data.installmentsCount !== undefined && data.installmentsCount !== contract.installmentsCount) ||
      (data.startDate !== undefined && data.startDate !== contract.startDate) ||
      (data.endDate   !== undefined && data.endDate   !== contract.endDate)
    )) {
      const pendingIds = payments.filter(p => p.contractId === id && p.status !== 'paid').map(p => p.id);
      setPayments(prev => prev.map(p =>
        p.contractId === id && p.status !== 'paid' ? { ...p, currency: data.currency } : p,
      ));
      pendingIds.forEach(pid => fs('payments', pid, { currency: data.currency }, 'update'));
    }

    // Regenerate pending installments if financial or date fields changed
    // Use Number() coercion to handle Firestore returning numeric fields as strings
    const financialChanged =
      (data as any)._forceRegenerate === true ||
      (data.annualValue       !== undefined && Number(data.annualValue)       !== Number(contract.annualValue))       ||
      (data.installmentsCount !== undefined && Number(data.installmentsCount) !== Number(contract.installmentsCount)) ||
      (data.startDate         !== undefined && data.startDate                 !== contract.startDate)                 ||
      (data.endDate           !== undefined && data.endDate                   !== contract.endDate);

    if (financialChanged) {
      const paidPayments    = payments.filter(p => p.contractId === id && p.status === 'paid');
      const pendingPayments = payments.filter(p => p.contractId === id && p.status !== 'paid');

      // Delete old pending installments
      pendingPayments.forEach(p => fs('payments', p.id, {}, 'delete'));

      const paidTotal       = paidPayments.reduce((s, p) => s + p.amount, 0);
      const newCount        = updatedContract.installmentsCount;
      const paidCount       = paidPayments.length;
      const remainingCount  = Math.max(newCount - paidCount, 1);
      // إذا كان المدفوع أكبر من القيمة الجديدة (تصحيح خطأ إدخال)، نوزع القيمة الجديدة نسبياً
      const remainingValue  = paidTotal < updatedContract.annualValue
        ? updatedContract.annualValue - paidTotal
        : Math.round((updatedContract.annualValue / newCount) * remainingCount);

      // نبدأ توزيع المواعيد من اليوم (أو من startDate إن كان مستقبلياً) حتى endDate
      // هذا يمنع توليد أقساط بتواريخ في الماضي عند تعديل عقد قديم
      const todayMs         = Date.now();
      const startMs         = new Date(updatedContract.startDate).getTime();
      const endMs           = new Date(updatedContract.endDate).getTime();
      const scheduleFromMs  = Math.max(todayMs, startMs); // لا نبدأ من الماضي
      const remainingSpanMs = Math.max(endMs - scheduleFromMs, 0);
      const baseAmt         = Math.floor(remainingValue / remainingCount);
      const remainder       = remainingValue - baseAmt * remainingCount;

      const newInstallments: Payment[] = Array.from({ length: remainingCount }, (_, i) => {
        // توزيع متساوٍ من scheduleFromMs إلى endMs
        const dueMs   = remainingCount === 1
          ? endMs
          : scheduleFromMs + Math.round(((i + 1) / remainingCount) * remainingSpanMs);
        const amount  = i === remainingCount - 1 ? baseAmt + remainder : baseAmt;
        const installmentIndex = paidCount + i;
        const p: Payment = {
          id: `pay_${id}_${installmentIndex + 1}_r${Date.now()}`,
          receiptNumber: `RCP-PENDING-${installmentIndex + 1}`,
          contractId: id,
          ...(updatedContract.ownerId ? { ownerId: updatedContract.ownerId } : {}),
          amount,
          dueDate: new Date(Math.min(dueMs, endMs)).toISOString().split('T')[0],
          status: 'pending',
          installmentNumber: installmentIndex + 1,
          ...(updatedContract.currency ? { currency: updatedContract.currency } : {}),
        };
        fs('payments', p.id, p, 'set');
        return p;
      });

      setPayments(prev => [
        ...prev.filter(p => p.contractId !== id || p.status === 'paid'),
        ...newInstallments,
      ]);

      console.log('[CONTRACT_UPDATE] payments regenerated', {
        contractId: id, paidCount, remainingCount, remainingValue,
        newInstallments: newInstallments.map(p => ({ id: p.id, amount: p.amount, dueDate: p.dueDate })),
      });
    }

    addAuditEntry('edit', 'عقد', contract.contractNumber || id,
      `تم تعديل العقد${financialChanged ? ' (إعادة توليد الأقساط)' : ''}`);
  };

  const deleteContract = (id: string) => {
    const contract = contracts.find(c => c.id === id);
    setContracts(prev => prev.filter(c => c.id !== id));
    // حذف جميع الدفعات (مدفوعة وغير مدفوعة)
    payments.filter(p => p.contractId === id).forEach(p => fs('payments', p.id, {}, 'delete'));
    setPayments(prev => prev.filter(p => p.contractId !== id));
    fs('contracts', id, {}, 'delete');
    // تحرير الوحدة
    if (contract) _releaseUnit(contract);
    // إزالة العقد من Tenant.contractIds
    if (contract?.tenantId) {
      setTenants(prev => prev.map(t =>
        t.id === contract.tenantId
          ? { ...t, contractIds: (t.contractIds ?? []).filter(cid => cid !== id) }
          : t
      ));
      const tenant = tenants.find(t => t.id === contract.tenantId);
      if (tenant) {
        const newIds = (tenant.contractIds ?? []).filter(cid => cid !== id);
        fs('tenants', contract.tenantId, { contractIds: newIds }, 'update');
      }
    }
    addAuditEntry('delete', 'عقد', contract?.contractNumber || id, `تم حذف العقد`);
  };

  // مساعد مشترك: تحرير الوحدة بعد انتهاء/إلغاء العقد
  const _releaseUnit = (contract: Contract) => {
    const unitUpdate: Partial<Unit> = {
      status: 'vacant' as UnitStatus,
      currentTenantId: undefined,
      currentContractId: undefined,
    };
    setUnits(prev => prev.map(u =>
      u.id === contract.unitId ? { ...u, ...unitUpdate } : u,
    ));
    fs('units', contract.unitId, { status: 'vacant', currentTenantId: null, currentContractId: null }, 'update');
  };

  const terminateContract = (id: string, reason: string) => {
    const ts       = new Date().toISOString();
    const date     = ts.split('T')[0];
    const contract = contracts.find(c => c.id === id);
    const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;
    const update = { status: 'terminated' as ContractStatus, cancelledAt: ts, cancelledBy: 'admin', cancellationReason: reason };
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
    fs('contracts', id, update, 'update');
    if (contract) _releaseUnit(contract);
    // إلغاء الأقساط غير المدفوعة (إصلاح: كانت تبقى معلقة بعد إنهاء العقد)
    setPayments(prev => prev.map(p => {
      if (p.contractId === id && (p.status === 'pending' || p.status === 'overdue')) {
        const cancelled = { ...p, status: 'overdue' as const }; // نبقيها overdue كسجل تاريخي
        fs('payments', p.id, { status: 'overdue' }, 'update');
        return cancelled;
      }
      return p;
    }));
    addAuditEntry('delete', 'عقد', contract?.contractNumber || id,
      `إنهاء عقد: ${contract?.contractNumber || id} — السبب: ${reason}`);
    return {
      tenantName:      tenant?.name  ?? '—',
      tenantPhone:     tenant?.phone ?? '',
      tenantEmail:     tenant?.email ?? '',
      terminationDate: date,
    };
  };

  const cancelContract = (id: string, reason: string) => {
    const contract = contracts.find(c => c.id === id);
    const update = { status: 'cancelled' as ContractStatus };
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...update } : c));
    fs('contracts', id, update, 'update');
    if (contract) _releaseUnit(contract);
    // حذف الأقساط غير المدفوعة عند الإلغاء — لأن العقد ملغي ولا يوجد دين
    setPayments(prev => {
      const toDelete = prev.filter(p => p.contractId === id && (p.status === 'pending' || p.status === 'overdue'));
      toDelete.forEach(p => fs('payments', p.id, {}, 'delete'));
      return prev.filter(p => !(p.contractId === id && (p.status === 'pending' || p.status === 'overdue')));
    });
    addAuditEntry('edit', 'عقد', contract?.contractNumber || id, `تم إلغاء العقد — السبب: ${reason}`);
  };

  // ─── Payment ──────────────────────────────────────────────────────────────
  const addPayment = (payment: Payment) => {
    setPayments(prev => [...prev, payment]);
    fs('payments', payment.id, payment, 'set');
    addAuditEntry('add', 'دفعة', payment.receiptNumber, `تم تسجيل دفعة جديدة ${payment.receiptNumber}`);
  };
  const updatePayment = (id: string, data: Partial<Payment>) => {
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    fs('payments', id, data, 'update');
  };
  const confirmPayment = (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const receipt = `${RECEIPT_PREFIX}-${today.replace(/-/g, '')}-${Math.floor(Math.random() * 9000) + 1000}`;
    const update = { status: 'paid' as const, paidDate: today, receiptNumber: receipt };
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    fs('payments', id, update, 'update');
    addAuditEntry('edit', 'دفعة', receipt, `تأكيد استلام الدفعة — المستخدم: ${currentUser.name}`);
  };
  const cancelPayment = (id: string) => {
    const update = { status: 'pending' as const, paidDate: undefined, receiptNumber: '' };
    setPayments(prev => prev.map(p => p.id === id ? { ...p, ...update } : p));
    fs('payments', id, { status: 'pending', paidDate: null, receiptNumber: '' }, 'update');
    addAuditEntry('edit', 'دفعة', id, `إلغاء تأكيد الدفعة — المستخدم: ${currentUser.name}`);
  };
  const deletePayment = (id: string) => {
    const p = payments.find(x => x.id === id);
    setPayments(prev => prev.filter(x => x.id !== id));
    fs('payments', id, {}, 'delete');
    addAuditEntry('delete', 'دفعة', p?.receiptNumber || id, `حذف الدفعة المعلقة`);
  };

  // ─── Maintenance ──────────────────────────────────────────────────────────
  const addMaintenance = (item: Maintenance) => {
    // ختم مالك العقار/الوحدة للعزل
    const mOwnerId = properties.find(p => p.id === item.propertyId)?.ownerId
      ?? units.find(u => u.id === item.unitId)?.ownerId;
    const finalItem = mOwnerId ? { ...item, ownerId: mOwnerId } : item;
    setMaintenance(prev => [...prev, finalItem]);
    fs('maintenance', finalItem.id, finalItem, 'set');
    addAuditEntry('add', 'طلب صيانة', finalItem.title, `تم فتح طلب صيانة جديد: ${finalItem.title}`);
  };
  const updateMaintenance = (id: string, data: Partial<Maintenance>) => {
    setMaintenance(prev => prev.map(m => m.id === id ? { ...m, ...data } : m));
    fs('maintenance', id, data, 'update');
    const item = maintenance.find(m => m.id === id);
    addAuditEntry('edit', 'طلب صيانة', item?.title || id, `تم تحديث طلب الصيانة`);
  };
  const deleteMaintenance = (id: string) => {
    const item = maintenance.find(m => m.id === id);
    setMaintenance(prev => prev.filter(m => m.id !== id));
    fs('maintenance', id, {}, 'delete');
    addAuditEntry('delete', 'طلب صيانة', item?.title || id, `تم حذف طلب الصيانة`);
  };

  // ─── Calendar ─────────────────────────────────────────────────────────────
  const addCalendarEvent = (event: Omit<CalendarEvent, 'id'>) => {
    const newEvent: CalendarEvent = { ...event, id: `ce_${Date.now()}` };
    setCalendarEvents(prev => [...prev, newEvent]);
    fs('calendarEvents', newEvent.id, newEvent, 'set');
    addAuditEntry('add', 'حدث', newEvent.id, `تم إضافة حدث: ${newEvent.title}`);
  };

  const deleteCalendarEvent = (id: string) => {
    setCalendarEvents(prev => prev.filter(e => e.id !== id));
    fs('calendarEvents', id, {}, 'delete');
    addAuditEntry('delete', 'حدث', id, `تم حذف حدث التقويم`);
  };

  // ─── Photos — each photo stored as an independent Firestore document ──────────
  // Collection: orgs/main/photos/{photoId}
  // Document:   { id, entityType, entityId, uri (compressed data URI), isMain, uploadedAt }
  //
  // Why: storing all photos in one doc (propertyPhotos/{id}) hits Firestore's 1 MB
  // document limit with base64 images. Independent docs remove that constraint.

  const _writePhoto = useCallback((photo: PropertyPhoto & { entityType: string; entityId: string }) => {
    if (!userId) return;
    setOne(getActiveOrgId(), 'photos', photo.id, photo).catch(console.error);
  }, [userId]);

  const _deletePhotoDoc = useCallback((photoId: string, storagePath?: string) => {
    if (!userId) return;
    if (storagePath) deleteFile(storagePath).catch(console.error);
    deleteOne(getActiveOrgId(), 'photos', photoId).catch(console.error);
  }, [userId]);

  // Update isMain flag in Firestore for each photo in a list
  const _syncMainFlags = useCallback((photos: (PropertyPhoto & { entityType: string; entityId: string })[]) => {
    if (!userId) return;
    photos.forEach(p => updateOne(getActiveOrgId(), 'photos', p.id, { isMain: p.isMain }).catch(console.error));
  }, [userId]);

  const _addPhoto = useCallback(async (
    entityType: 'property' | 'unit',
    entityId: string,
    rawUri: string,
    setPhotos: React.Dispatch<React.SetStateAction<Record<string, PropertyPhoto[]>>>,
  ): Promise<void> => {
    const photoId = `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // This converts the image to a permanent, compressed Base64 string (~50-150KB)
    // This string is saved directly in Firestore and NEVER expires.
    const uri = await toPersistentUri(rawUri);

    const photo: PropertyPhoto & { entityType: string; entityId: string } = {
      id: photoId, uri, isMain: false,
      uploadedAt: new Date().toISOString().split('T')[0],
      entityType, entityId,
    };

    // Add to local state instantly (optimistic)
    let isFirstPhoto = false;
    setPhotos(prev => {
      const existing = prev[entityId] ?? [];
      isFirstPhoto = existing.length === 0;
      const entry = isFirstPhoto ? { ...photo, isMain: true } : photo;
      return { ...prev, [entityId]: [...existing, entry] };
    });

    // Persist to Firestore — each photo is its own document
    const docPhoto = isFirstPhoto ? { ...photo, isMain: true } : photo;
    _writePhoto(docPhoto);
  }, [userId, _writePhoto]);

  const addPropertyPhoto = useCallback((propertyId: string, uri: string): Promise<void> =>
    _addPhoto('property', propertyId, uri, setPropertyPhotos),
  [_addPhoto]);

  const removePropertyPhoto = useCallback((propertyId: string, photoId: string) => {
    setPropertyPhotos(prev => {
      const existing = prev[propertyId] ?? [];
      const photo = existing.find(p => p.id === photoId);
      const filtered = existing.filter(p => p.id !== photoId);
      const hadMain  = photo?.isMain;
      if (hadMain && filtered.length > 0) {
        filtered[0] = { ...filtered[0], isMain: true };
        updateOne(getActiveOrgId(), 'photos', filtered[0].id, { isMain: true }).catch(console.error);
      }
      _deletePhotoDoc(photoId, photo?.storagePath);
      return { ...prev, [propertyId]: filtered };
    });
  }, [_deletePhotoDoc]);

  const setPropertyMainPhoto = useCallback((propertyId: string, photoId: string) => {
    setPropertyPhotos(prev => {
      const updated = (prev[propertyId] ?? []).map(p => ({ ...p, isMain: p.id === photoId }));
      updated.forEach(p => updateOne(getActiveOrgId(), 'photos', p.id, { isMain: p.isMain }).catch(console.error));
      return { ...prev, [propertyId]: updated };
    });
  }, []);

  const addUnitPhoto = useCallback((unitId: string, uri: string): Promise<void> =>
    _addPhoto('unit', unitId, uri, setUnitPhotos),
  [_addPhoto]);

  const removeUnitPhoto = useCallback((unitId: string, photoId: string) => {
    setUnitPhotos(prev => {
      const existing = prev[unitId] ?? [];
      const photo = existing.find(p => p.id === photoId);
      const filtered = existing.filter(p => p.id !== photoId);
      const hadMain  = photo?.isMain;
      if (hadMain && filtered.length > 0) {
        filtered[0] = { ...filtered[0], isMain: true };
        updateOne(getActiveOrgId(), 'photos', filtered[0].id, { isMain: true }).catch(console.error);
      }
      _deletePhotoDoc(photoId, photo?.storagePath);
      return { ...prev, [unitId]: filtered };
    });
  }, [_deletePhotoDoc]);

  const setUnitMainPhoto = useCallback((unitId: string, photoId: string) => {
    setUnitPhotos(prev => {
      const updated = (prev[unitId] ?? []).map(p => ({ ...p, isMain: p.id === photoId }));
      updated.forEach(p => updateOne(getActiveOrgId(), 'photos', p.id, { isMain: p.isMain }).catch(console.error));
      return { ...prev, [unitId]: updated };
    });
  }, []);

  // ─── Attachments ─────────────────────────────────────────────────────────
  const addAttachment = useCallback(async (data: {
    entityType: string; entityId: string; name: string; uri: string;
    mimeType: string; size?: number; category: FileCategory;
    expiryDate?: string; notes?: string; uploadedBy?: string;
  }): Promise<Attachment> => {
    // المشروع على خطة Spark بلا Firebase Storage → نحفظ الملف داخل مستند Firestore.
    // حد المستند ~1MB كان يُفشل الكتابة بصمت فتختفي الملفات. الحل: نضغط الصور،
    // ونرفض الملف الكبير برسالة واضحة قبل الحفظ، وننتظر تأكيد الكتابة (لا سجل وهمي).
    const org   = getActiveOrgId();
    const isImg = (data.mimeType || '').startsWith('image/');

    // رفض مبكر لغير الصور المتجاوزة الحد (الصور تُضغط، فلا تُرفض بحجمها الخام)
    if (!isImg && data.size && data.size > 650 * 1024) {
      throw new Error('الملف كبير جداً للحفظ (الحد ~650KB لغير الصور). اختر ملفاً أصغر أو صورة.');
    }

    // تحويل لبيانات دائمة base64 (الصور تُضغط داخل toPersistentUri)
    const uri = await toPersistentUri(data.uri);

    // حارس نهائي: لا يتجاوز المستند حد Firestore (~1MB)
    if (uri.length > 950 * 1024) {
      throw new Error('الملف كبير جداً للحفظ بعد المعالجة (الحد ~1MB). اختر ملفاً أصغر.');
    }

    const att = FileService.create({
      ...data,
      uri,
      uploadedBy: data.uploadedBy ?? currentUser.name,
      ...(isOwner && currentUser.ownerId ? { ownerContext: currentUser.ownerId } : {}),
    });

    // حفظ مؤكَّد (await) قبل العرض — فشل الكتابة يُعرض، ولا يبقى سجل وهمي يختفي عند التحديث
    await setOne(org, 'attachments', att.id, att);

    setAttachments(prev => FileService.syncExpiryStatuses([...prev, att]));
    addAuditEntry('add', 'وثيقة', att.name,
      `رفع وثيقة "${att.name}" على ${data.entityType} — ${currentUser.name}`);
    return att;
  }, [userId, currentUser.name, currentUser.ownerId, isOwner]);

  const deleteAttachment = useCallback((id: string) => {
    // ✅ FIX: Also delete the file from Firebase Storage
    const attachment = attachments.find(a => a.id === id);
    if ((attachment as any)?.storagePath) {
      deleteFile((attachment as any).storagePath).catch(err =>
        console.error('[deleteAttachment] Storage delete failed:', err)
      );
    }
    setAttachments(prev => prev.filter(a => a.id !== id));
    fs('attachments', id, {}, 'delete');
  }, [fs, attachments]);

  // ─── Theme & Notifications ────────────────────────────────────────────────
  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    try { Appearance.setColorScheme(t === 'system' ? null : t); } catch {}
    // حفظ في Firestore
    if (userId) {
      import('../lib/auth').then(({ updateUserProfile }) =>
        updateUserProfile(userId, { theme: t }).catch(console.error)
      );
    }
  };
  const setNotificationPref = (key: keyof NotificationPrefs, value: boolean) => {
    setNotificationPrefs(prev => {
      const updated = { ...prev, [key]: value };
      // حفظ في Firestore
      if (userId) {
        import('../lib/auth').then(({ updateUserProfile }) =>
          updateUserProfile(userId, { notificationPrefs: updated }).catch(console.error)
        );
      }
      return updated;
    });
  };

  // ─── System Reset ─────────────────────────────────────────────────────────
  const resetSystem = useCallback(async (): Promise<void> => {
    if (!userId) return;
    // حذف من Firestore (إصلاح: كان يحذف الحالة المحلية فقط والبيانات تعود عند إعادة التشغيل)
    const cols = ['owners','properties','tenants','units','contracts','payments','maintenance','calendarEvents','attachments','propertyPhotos'];
    await Promise.all(cols.map(col => deleteAll(getActiveOrgId(), col).catch(console.error)));
    // مسح الحالة المحلية والكاش
    clearCache(userId);
    setOwners([]); setProperties([]); setTenants([]); setUnits([]);
    setContracts([]); setPayments([]); setMaintenance([]); setCalendarEvents([]);
    setAttachments([]); setPropertyPhotos({});
    const ts = new Date().toISOString();
    const resetLog: AuditLog = {
      id: `al_reset_${Date.now()}`,
      action: 'delete' as AuditLog['action'],
      entityType: 'system',
      entityName: 'SYSTEM_RESET',
      userId: currentUser.email,
      userName: currentUser.name,
      timestamp: ts,
      details: `تصفير كامل للنظام — المستخدم: ${currentUser.name} — التوقيت: ${ts}`,
    };
    setAuditLogs([resetLog]);
    fs('auditLogs', resetLog.id, resetLog, 'set');
  }, [userId, currentUser.name, currentUser.email, fs]);

  // ─── Import Backup ────────────────────────────────────────────────────────
  const sanitizeImportRecord = (col: string, item: any): any => {
    if (!item) return item;
    const s = { ...item };
    if (col === 'contracts') {
      s.annualValue       = Number(s.annualValue)       || 0;
      s.installmentsCount = Number(s.installmentsCount) || 1;
    }
    if (col === 'payments') {
      s.amount            = Number(s.amount)            || 0;
      s.installmentNumber = Number(s.installmentNumber) || 1;
      if (s.status === 'cancelled') s.status = 'pending';
      if (!['paid','pending','overdue'].includes(s.status)) s.status = 'pending';
    }
    if (col === 'units') {
      s.floor    = Number(s.floor) || 0;
      if (!s.number)            s.number   = '—';
      if (!s.propertyId)        s.propertyId = '';
      if (!Array.isArray(s.features)) s.features = [];
    }
    if (col === 'properties') {
      if (!s.name)     s.name     = 'عقار';
      if (!s.location) s.location = s.name;
    }
    if (col === 'owners' || col === 'tenants') {
      if (!s.name)  s.name  = 'بدون اسم';
      if (!s.phone) s.phone = '—';
    }
    if (col === 'maintenance') {
      if (!s.priority) s.priority = 'medium';
      if (!s.title)    s.title    = 'طلب صيانة';
      if (!s.propertyId) s.propertyId = '';
    }
    return s;
  };

  const importBackup = useCallback(async (payload: import('../lib/backupValidator').BackupPayload): Promise<void> => {
    if (!userId) throw new Error('يجب تسجيل الدخول أولاً');
    const cols = ['owners','properties','tenants','units','contracts','payments','maintenance'] as const;

    // Wipe then rewrite each collection in Firestore — collect any write errors
    const deleteErrors: string[] = [];
    await Promise.all(cols.map(col =>
      deleteAll(getActiveOrgId(), col).catch(e => { deleteErrors.push(`حذف ${col}: ${e?.message ?? e}`); })
    ));

    const writeErrors: string[] = [];
    await Promise.all(cols.flatMap(col =>
      (payload.data[col as keyof typeof payload.data] ?? [])
        .filter((item: any) => item?.id)
        .map((item: any) => {
          const sanitized = sanitizeImportRecord(col, item);
          return setOne(getActiveOrgId(), col, sanitized.id, sanitized).catch(e => {
            writeErrors.push(`كتابة ${col}/${sanitized.id}: ${e?.message ?? e}`);
          });
        })
    ));

    if (writeErrors.length > 0) {
      console.error('importBackup write errors:', writeErrors);
      throw new Error(`فشل استيراد بعض السجلات:\n${writeErrors.slice(0, 5).join('\n')}`);
    }

    // Update local state and cache (use sanitized data for consistent types)
    const san = (col: string, arr: any[]) => arr.filter(i => i?.id).map(i => sanitizeImportRecord(col, i));
    const newData = {
      owners:      san('owners',      payload.data.owners      ?? []),
      properties:  san('properties',  payload.data.properties  ?? []),
      tenants:     san('tenants',     payload.data.tenants     ?? []),
      units:       san('units',       payload.data.units       ?? []),
      contracts:   san('contracts',   payload.data.contracts   ?? []),
      payments:    san('payments',    payload.data.payments    ?? []),
      maintenance: san('maintenance', payload.data.maintenance ?? []),
    };
    console.log('[Firestore] Backup imported into Firestore', {
      owners: newData.owners.length,
      properties: newData.properties.length,
      tenants: newData.tenants.length,
      units: newData.units.length,
      contracts: newData.contracts.length,
      payments: newData.payments.length,
      maintenance: newData.maintenance.length,
    });
    setOwners(newData.owners as Owner[]);
    setProperties(newData.properties as Property[]);
    setTenants(newData.tenants as Tenant[]);
    setUnits(newData.units as Unit[]);
    setContracts(newData.contracts as Contract[]);
    setPayments(newData.payments as Payment[]);
    setMaintenance(newData.maintenance as Maintenance[]);
    saveCache(userId, newData);

    // Audit entry
    const ts = new Date().toISOString();
    const log: AuditLog = {
      id: `al_import_${Date.now()}`,
      action: 'add',
      entityType: 'system',
      entityName: 'BACKUP_RESTORE',
      userId: currentUser.email,
      userName: currentUser.name,
      timestamp: ts,
      details: `استعادة نسخة احتياطية — التوقيت: ${ts} — المستخدم: ${currentUser.name}`,
    };
    setAuditLogs(prev => [log, ...prev]);
    setOne(getActiveOrgId(), 'auditLogs', log.id, log).catch(() => {});
  }, [userId, currentUser.name, currentUser.email]);

  // ─── System Settings ──────────────────────────────────────────────────────
  const updateSystemSettings = useCallback(async (patch: Partial<SystemSettings>) => {
    const updated: SystemSettings = { ...systemSettings, ...patch, updatedAt: new Date().toISOString(), updatedBy: currentUser.id };
    setSystemSettings(updated);
    await setOne(getActiveOrgId(), 'settings', 'system', updated).catch(e => showSaveError(e, 'settings/system'));
    addAuditEntry('edit', 'system', 'إعدادات النظام', 'تم تحديث إعدادات النظام');
  }, [systemSettings, currentUser.id]);

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const login = (_email: string, _password: string): boolean => true;
  const logout = () => {
    console.log('[Auth] Logout session cleared only (data preserved in Firestore and cache)');
    import('../lib/auth').then(m => m.logoutUser()).catch(() => {});
    setIsAuthenticated(false);
  };
  const updateProfile = (data: Partial<AppState['currentUser']>) => {
    setCurrentUser(prev => ({ ...prev, ...data }));
    // استمر في حفظ التغييرات إلى Firestore
    if (userId) {
      const { name, phone, role } = data as any;
      const toSave: Record<string, string> = {};
      if (name  !== undefined) toSave.name  = name;
      if (phone !== undefined) toSave.phone = phone;
      if (role  !== undefined) toSave.role  = role;
      if (Object.keys(toSave).length > 0) {
        import('../lib/auth').then(({ updateUserProfile }) =>
          updateUserProfile(userId, toSave).catch(console.error)
        );
      }
    }
  };

  const refreshData = async () => {
    if (!userId) return;
    const org = getActiveOrgId();
    const sOwner = (currentUser.role === 'owner' || currentUser.role === 'مالك') && currentUser.ownerId ? currentUser.ownerId : null;
    const ownerScoped = new Set(['properties', 'units', 'contracts', 'payments', 'maintenance']);
    const fcol = (col: string) => (sOwner && ownerScoped.has(col)) ? getWhere(org, col, [where('ownerId', '==', sOwner)]) : getAll(org, col);
    const fOwners = async () => { if (!sOwner) return getAll(org, 'owners'); const o = await getOne(org, 'owners', sOwner); return o ? [o] : []; };
    setDataLoading(true);
    try {
      const [
        ownersData, propertiesData, unitsData, contractsData,
        tenantsData, paymentsData, maintenanceData,
      ] = await Promise.all([
        fOwners(),
        fcol('properties'),
        fcol('units'),
        fcol('contracts'),
        getAll(org, 'tenants'),
        fcol('payments'),
        fcol('maintenance'),
      ]);
      const { properties: migratedProps, units: migratedUnits } =
        migrateProperties(propertiesData as Property[], unitsData as Unit[]);
      const currencyMigratedProps = migratePropertyCurrencies(migratedProps, migratedUnits, contractsData as Contract[]);
      const currencyMigratedUnits = migrateUnitCurrencies(migratedUnits, currencyMigratedProps, contractsData as Contract[]);
      setOwners(ownersData as Owner[]);
      setProperties(currencyMigratedProps);
      setUnits(currencyMigratedUnits);
      setContracts(contractsData as Contract[]);
      setTenants(tenantsData as Tenant[]);
      setPayments(paymentsData as Payment[]);
      setMaintenance(maintenanceData as Maintenance[]);

      const [auditData, calendarData, attachmentsData] = await Promise.all([
        sOwner ? Promise.resolve([] as any[]) : getAll(org, 'auditLogs'),
        getAll(org, 'calendarEvents'),
        getAll(org, 'attachments'),
      ]);
      setAuditLogs((auditData as AuditLog[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
      setCalendarEvents(calendarData as CalendarEvent[]);
      setAttachments(attachmentsData as Attachment[]);
    } catch (e) {
      console.error('refreshData error:', e);
    }
    setDataLoading(false);
  };

  // ─── Backfill ownerId على البيانات القديمة (إجراء يدوي للمدير) ─────────────
  // يختم ownerId على الوحدات/العقود/الدفعات/الصيانة الموجودة مسبقاً اعتماداً على
  // سلسلة الملكية (وحدة → عقار). يجب تشغيله مرة واحدة قبل تفعيل عزل المالك الكامل.
  const backfillOwnerIds = useCallback(async (): Promise<{ updated: number }> => {
    if (!isAdmin) throw new Error('هذا الإجراء متاح للمدير فقط');
    const org = getActiveOrgId();
    let updated = 0;

    const propOwner = new Map<string, string | undefined>(properties.map(p => [p.id, p.ownerId || undefined]));
    const unitOwner = new Map<string, string | undefined>();

    // الوحدات: ownerId = مالك الوحدة الصريح أو مالك العقار الأب
    for (const u of units) {
      const eff = u.ownerId || propOwner.get(u.propertyId);
      unitOwner.set(u.id, eff);
      if (eff && u.ownerId !== eff) { await updateOne(org, 'units', u.id, { ownerId: eff }); updated++; }
    }
    // العقود: ownerId = مالك الوحدة
    const contractOwner = new Map<string, string | undefined>();
    for (const c of contracts) {
      const eff = unitOwner.get(c.unitId);
      contractOwner.set(c.id, eff);
      if (eff && (c as any).ownerId !== eff) { await updateOne(org, 'contracts', c.id, { ownerId: eff }); updated++; }
    }
    // الدفعات: ownerId = مالك العقد
    for (const p of payments) {
      const eff = contractOwner.get(p.contractId);
      if (eff && (p as any).ownerId !== eff) { await updateOne(org, 'payments', p.id, { ownerId: eff }); updated++; }
    }
    // الصيانة: ownerId = مالك العقار (أو الوحدة)
    for (const m of maintenance) {
      const eff = propOwner.get(m.propertyId) || (m.unitId ? unitOwner.get(m.unitId) : undefined);
      if (eff && (m as any).ownerId !== eff) { await updateOne(org, 'maintenance', m.id, { ownerId: eff }); updated++; }
    }
    console.log(`[BACKFILL] ownerId stamped on ${updated} documents`);
    return { updated };
  }, [isAdmin, properties, units, contracts, payments, maintenance]);

  return (
    <AppContext.Provider value={{
      owners:      visibleOwners,
      properties:  visibleProperties,
      tenants:     visibleTenants,
      units:       visibleUnits,
      contracts:   visibleContracts,
      payments:    visiblePayments,
      maintenance: visibleMaintenance,
      auditLogs:   visibleAuditLogs,
      calendarEvents, attachments: visibleAttachments, isAuthenticated, dataLoading, secondaryLoading,
      currentUser, kpis,
      canWrite, canDelete, isAdmin, isOwner, resolvedScheme, externalOwnedUnits, financialUnitIds,
      theme, notificationPrefs, propertyPhotos, unitPhotos,
      systemSettings, updateSystemSettings,
      setTheme, setNotificationPref, resetSystem,
      addPropertyPhoto, removePropertyPhoto, setPropertyMainPhoto,
      addUnitPhoto, removeUnitPhoto, setUnitMainPhoto,
      addOwner, updateOwner, deleteOwner,
      addProperty, updateProperty, deleteProperty,
      addTenant, updateTenant, deleteTenant,
      addUnit, updateUnit, deleteUnit,
      addContract, updateContract, deleteContract, terminateContract,
      addPayment, updatePayment, confirmPayment, cancelPayment, deletePayment,
      addMaintenance, updateMaintenance, deleteMaintenance,
      cancelContract, addCalendarEvent, deleteCalendarEvent,
      addAttachment, deleteAttachment,
      login, logout, updateProfile, importBackup, refreshData,
      cities, cityStats,
      addCity, updateCity, deleteCity,
      updateAllPropertiesWithCities,
      backfillOwnerIds,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
