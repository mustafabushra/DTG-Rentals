/**
 * AppStore — Centralized state management.
 *
 * Architecture rules:
 *  - UI components call hooks (useProperties, useContracts, etc.)
 *  - Hooks read from and dispatch to this store
 *  - Domain services handle all business logic before state mutations
 *  - Every mutation generates an audit log entry
 */

import React, {
  createContext, useContext, useState, useMemo, useCallback, useEffect,
  type ReactNode,
} from 'react';

import type {
  Owner, Tenant, Property, Unit, Contract, PaymentInstallment,
  MaintenanceRequest, Attachment, AuditLog, Notification, CalendarEvent,
  User, UserPreferences, DashboardKPIs, FilterState, EntityPhoto,
} from '../domain/models';
import { defaultFilter } from '../domain/models';
import { AuditService }          from '../domain/services/AuditService';
import { ContractService }       from '../domain/services/ContractService';
import { PaymentService }        from '../domain/services/PaymentService';
import { FileService }           from '../domain/services/FileService';
import { NotificationService }   from '../domain/services/NotificationService';
import { onAuthChange }          from '../lib/auth';
import { getAll, setOne, updateOne, deleteOne } from '../lib/firestoreService';

// ─── Store Shape ─────────────────────────────────────────────────────────────

interface AppState {
  // Entities
  owners:        Owner[];
  tenants:       Tenant[];
  properties:    Property[];
  units:         Unit[];
  contracts:     Contract[];
  installments:  PaymentInstallment[];
  maintenance:   MaintenanceRequest[];
  attachments:   Attachment[];
  auditLogs:     AuditLog[];
  notifications: Notification[];
  calendarEvents:CalendarEvent[];

  // Session
  currentUser:   User;
  isLoggedIn:    boolean;

  // Computed KPIs (memoized)
  kpis:          DashboardKPIs;

  // ─── Owner actions ──────────────────────────────────────
  addOwner:    (data: Omit<Owner, 'id' | 'createdAt' | 'updatedAt'>) => Owner;
  updateOwner: (id: string, data: Partial<Owner>) => void;
  deleteOwner: (id: string) => void;

  // ─── Tenant actions ─────────────────────────────────────
  addTenant:    (data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>) => Tenant;
  updateTenant: (id: string, data: Partial<Tenant>) => void;
  deleteTenant: (id: string) => void;

  // ─── Property actions ────────────────────────────────────
  addProperty:    (data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => Property;
  updateProperty: (id: string, data: Partial<Property>) => void;
  deleteProperty: (id: string) => void;

  // ─── Unit actions ────────────────────────────────────────
  addUnit:    (data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>) => Unit;
  updateUnit: (id: string, data: Partial<Unit>) => void;
  deleteUnit: (id: string) => void;

  // ─── Contract actions ────────────────────────────────────
  addContract:        (data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>) => Contract;
  updateContract:     (id: string, data: Partial<Contract>) => void;
  cancelContract:     (id: string, reason: string) => void;
  terminateContract:  (id: string, reason: string) => { tenantName: string; tenantPhone: string; tenantEmail: string; terminationDate: string };
  deleteContract:     (id: string) => void;

  // ─── Payment actions ─────────────────────────────────────
  recordPayment:  (installmentId: string, data: { paidDate: string; paymentMethod: string; referenceNumber?: string; notes?: string }) => void;

  // ─── Maintenance actions ─────────────────────────────────
  addMaintenance:    (data: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'updatedAt'>) => MaintenanceRequest;
  updateMaintenance: (id: string, data: Partial<MaintenanceRequest>) => void;
  deleteMaintenance: (id: string) => void;

  // ─── Attachment actions ──────────────────────────────────
  addAttachment:    (data: Parameters<typeof FileService.create>[0]) => Attachment;
  deleteAttachment: (id: string) => void;

  // ─── Photo actions ───────────────────────────────────────
  addPhoto:     (entityType: 'property' | 'unit', entityId: string, uri: string, caption?: string) => EntityPhoto;
  removePhoto:  (entityType: 'property' | 'unit', entityId: string, photoId: string) => void;
  setMainPhoto: (entityType: 'property' | 'unit', entityId: string, photoId: string) => void;

  // ─── Calendar actions ────────────────────────────────────
  deleteCalendarEvent: (id: string) => void;

  // ─── Notification actions ────────────────────────────────
  markNotificationRead:    (id: string) => void;
  markAllNotificationsRead:() => void;

  // ─── Auth actions ────────────────────────────────────────
  login:         (email: string, password: string) => boolean;
  logout:        () => void;
  updateProfile: (data: Partial<User>) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  dataLoading:   boolean;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AppContext = createContext<AppState | null>(null);

// ─── ID Generator ────────────────────────────────────────────────────────────

let _seq = 1000;
function newId(prefix: string): string {
  return `${prefix}_${Date.now()}_${_seq++}`;
}
function now(): string { return new Date().toISOString(); }

// ─── Provider ────────────────────────────────────────────────────────────────

const EMPTY_USER: User = {
  id: '', name: '', email: '', phone: '', role: 'admin',
  preferences: { theme: 'system', language: 'ar', notifications: { contracts: true, payments: true, attachments: true, maintenance: true } },
};

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [owners,         setOwners]        = useState<Owner[]>([]);
  const [tenants,        setTenants]       = useState<Tenant[]>([]);
  const [properties,     setProperties]    = useState<Property[]>([]);
  const [units,          setUnits]         = useState<Unit[]>([]);
  const [contracts,      setContracts]     = useState<Contract[]>([]);
  const [installments,   setInstallments]  = useState<PaymentInstallment[]>([]);
  const [maintenance,    setMaintenance]   = useState<MaintenanceRequest[]>([]);
  const [attachments,    setAttachments]   = useState<Attachment[]>([]);
  const [auditLogs,      setAuditLogs]     = useState<AuditLog[]>([]);
  const [notifications,  setNotifications] = useState<Notification[]>([]);
  const [calendarEvents, setCalendarEvents]= useState<CalendarEvent[]>([]);
  const [currentUser,    setCurrentUser]   = useState<User>(EMPTY_USER);
  const [isLoggedIn,     setIsLoggedIn]    = useState(false);
  const [dataLoading,    setDataLoading]   = useState(true);
  const [userId,         setUserId]        = useState<string | null>(null);

  // ─── تحميل البيانات من Firestore عند تسجيل الدخول ──────────────────────────
  useEffect(() => {
    const unsub = onAuthChange(async (firebaseUser) => {
      if (!firebaseUser) {
        setIsLoggedIn(false);
        setUserId(null);
        setDataLoading(false);
        return;
      }
      setUserId(firebaseUser.uid);
      setIsLoggedIn(true);
      setCurrentUser(prev => ({
        ...prev,
        id:    firebaseUser.uid,
        name:  firebaseUser.displayName ?? 'مستخدم',
        email: firebaseUser.email ?? '',
      }));

      try {
        setDataLoading(true);
        const uid = firebaseUser.uid;
        const [
          ownersData, tenantsData, propertiesData, unitsData,
          contractsData, installmentsData, maintenanceData,
          attachmentsData, auditLogsData, notificationsData, calendarData,
        ] = await Promise.all([
          getAll(uid, 'owners'),
          getAll(uid, 'tenants'),
          getAll(uid, 'properties'),
          getAll(uid, 'units'),
          getAll(uid, 'contracts'),
          getAll(uid, 'installments'),
          getAll(uid, 'maintenance'),
          getAll(uid, 'attachments'),
          getAll(uid, 'auditLogs'),
          getAll(uid, 'notifications'),
          getAll(uid, 'calendarEvents'),
        ]);
        setOwners(ownersData as Owner[]);
        setTenants(tenantsData as Tenant[]);
        setProperties(propertiesData as Property[]);
        setUnits(unitsData as Unit[]);
        setContracts(contractsData as Contract[]);
        setInstallments(installmentsData as PaymentInstallment[]);
        setMaintenance(maintenanceData as MaintenanceRequest[]);
        setAttachments(attachmentsData as Attachment[]);
        setAuditLogs(auditLogsData as AuditLog[]);
        setNotifications(notificationsData as Notification[]);
        setCalendarEvents(calendarData as CalendarEvent[]);
      } catch (e) {
        console.error('Firestore load error:', e);
      } finally {
        setDataLoading(false);
      }
    });
    return unsub;
  }, []);

  // ─── Audit helper ─────────────────────────────────────────────────────────

  const audit = useCallback((
    action: AuditLog['action'],
    entityType: string,
    entityId: string,
    entityLabel: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
  ) => {
    const entry = AuditService.create({
      userId: currentUser.id,
      userName: currentUser.name,
      action, entityType, entityId, entityLabel, before, after,
    });
    setAuditLogs(prev => [entry, ...prev]);
  }, [currentUser]);

  // ─── Computed KPIs ────────────────────────────────────────────────────────

  const kpis = useMemo<DashboardKPIs>(() => {
    const rentedUnits = units.filter(u => u.status === 'rented').length;
    const activeContracts = contracts.filter(c => c.status === 'active');
    const monthlyRevenue  = activeContracts.reduce((s, c) => s + ContractService.monthlyRent(c), 0);
    const annualRevenue   = activeContracts.reduce((s, c) => s + c.annualValue, 0);
    const paidInstalls    = installments.filter(p => p.status === 'paid');
    const totalInstalls   = installments.filter(p => p.status !== 'cancelled');
    const collectionRate  = totalInstalls.length > 0
      ? Math.round((paidInstalls.length / totalInstalls.length) * 100) : 0;
    const overdueList     = installments.filter(p => PaymentService.isOverdue(p));
    const overdueAmount   = overdueList.reduce((s, p) => s + p.amount, 0);
    const openMaint       = maintenance.filter(m => m.status === 'new' || m.status === 'in_progress');
    const expiring        = activeContracts.filter(c => ContractService.isExpiringSoon(c));
    const pendingPayments = installments.filter(p => p.status === 'pending').length;

    return {
      totalProperties:         properties.length,
      totalUnits:              units.length,
      rentedUnits,
      vacantUnits:             units.filter(u => u.status === 'vacant').length,
      monthlyRevenue,
      annualRevenue,
      collectionRate,
      overduePayments:         overdueList.length,
      overdueAmount,
      openMaintenanceRequests: openMaint.length,
      activeContracts:         activeContracts.length,
      expiringContracts:       expiring.length,
      pendingInstallments:     pendingPayments,
    };
  }, [units, contracts, installments, maintenance, properties]);

  // Auto-generate notifications when data changes
  useEffect(() => {
    const contractAlerts = NotificationService.generateContractAlerts(contracts);
    const paymentAlerts  = NotificationService.generatePaymentAlerts(installments);
    const fileAlerts     = NotificationService.generateFileAlerts(
      FileService.syncExpiryStatuses(attachments),
    );
    // Only prepend truly new ones (not already in the list)
    const allNew = [...contractAlerts, ...paymentAlerts, ...fileAlerts];
    if (allNew.length > 0) {
      setNotifications(prev => {
        const existingIds = new Set(prev.map(n => n.entityId + n.type));
        const fresh = allNew.filter(n => !existingIds.has((n.entityId ?? '') + n.type));
        return fresh.length > 0 ? [...fresh, ...prev] : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contracts, installments, attachments]);

  // ─── Owner CRUD ────────────────────────────────────────────────────────────

  // ─── Firestore sync helper ────────────────────────────────────────────────
  const fs = useCallback((col: string, id: string, data: any, op: 'set' | 'update' | 'delete') => {
    if (!userId) return;
    if (op === 'set')    setOne(userId, col, id, data).catch(console.error);
    if (op === 'update') updateOne(userId, col, id, data).catch(console.error);
    if (op === 'delete') deleteOne(userId, col, id).catch(console.error);
  }, [userId]);

  const addOwner = useCallback((data: Omit<Owner, 'id' | 'createdAt' | 'updatedAt'>): Owner => {
    const owner: Owner = { ...data, id: newId('own'), createdAt: now(), updatedAt: now() };
    setOwners(p => [owner, ...p]);
    fs('owners', owner.id, owner, 'set');
    audit('create', 'owner', owner.id, `مالك: ${owner.name}`);
    return owner;
  }, [audit, fs]);

  const updateOwner = useCallback((id: string, data: Partial<Owner>) => {
    setOwners(p => p.map(o => o.id === id ? { ...o, ...data, updatedAt: now() } : o));
    fs('owners', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'owner', id, `مالك: ${data.name ?? id}`);
  }, [audit, fs]);

  const deleteOwner = useCallback((id: string) => {
    const o = owners.find(x => x.id === id);
    setProperties(p => p.map(x => x.ownerId === id ? { ...x, ownerId: '', updatedAt: now() } : x));
    setOwners(p => p.filter(x => x.id !== id));
    fs('owners', id, {}, 'delete');
    audit('delete', 'owner', id, `مالك: ${o?.name ?? id}`);
  }, [owners, audit, fs]);

  // ─── Tenant CRUD ───────────────────────────────────────────────────────────

  const addTenant = useCallback((data: Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'>): Tenant => {
    const tenant: Tenant = { ...data, id: newId('ten'), createdAt: now(), updatedAt: now() };
    setTenants(p => [tenant, ...p]);
    fs('tenants', tenant.id, tenant, 'set');
    audit('create', 'tenant', tenant.id, `مستأجر: ${tenant.name}`);
    return tenant;
  }, [audit, fs]);

  const updateTenant = useCallback((id: string, data: Partial<Tenant>) => {
    setTenants(p => p.map(t => t.id === id ? { ...t, ...data, updatedAt: now() } : t));
    fs('tenants', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'tenant', id, `مستأجر: ${data.name ?? id}`);
  }, [audit, fs]);

  const deleteTenant = useCallback((id: string) => {
    const t = tenants.find(x => x.id === id);
    // Cascade: cancel any active contracts for this tenant, free their units
    const ts = now();
    setContracts(p => p.map(c => c.tenantId === id && c.status === 'active'
      ? { ...c, status: 'cancelled', cancelledAt: ts, cancelledBy: 'system', cancellationReason: 'حذف المستأجر', updatedAt: ts }
      : c,
    ));
    setUnits(p => p.map(u => {
      const hasActiveContract = contracts.some(
        c => c.unitId === u.id && c.tenantId === id && c.status === 'active',
      );
      return hasActiveContract ? { ...u, status: 'vacant', updatedAt: ts } : u;
    }));
    setTenants(p => p.filter(x => x.id !== id));
    fs('tenants', id, {}, 'delete');
    audit('delete', 'tenant', id, `مستأجر: ${t?.name ?? id}`);
  }, [tenants, contracts, audit, fs]);

  // ─── Property CRUD ─────────────────────────────────────────────────────────

  const addProperty = useCallback((data: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>): Property => {
    const prop: Property = { ...data, id: newId('prop'), createdAt: now(), updatedAt: now() };
    setProperties(p => [prop, ...p]);
    fs('properties', prop.id, prop, 'set');
    audit('create', 'property', prop.id, `عقار: ${prop.name}`);
    return prop;
  }, [audit, fs]);

  const updateProperty = useCallback((id: string, data: Partial<Property>) => {
    setProperties(p => p.map(x => x.id === id ? { ...x, ...data, updatedAt: now() } : x));
    fs('properties', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'property', id, `عقار: ${data.name ?? id}`);
  }, [audit, fs]);

  const deleteProperty = useCallback((id: string) => {
    const prop = properties.find(p => p.id === id);
    const ts = now();
    // Cascade: collect units → cancel their contracts → remove installments → remove units
    const propUnitIds = units.filter(u => u.propertyId === id).map(u => u.id);
    const propContractIds = contracts
      .filter(c => propUnitIds.includes(c.unitId))
      .map(c => c.id);
    setInstallments(p => p.filter(i => !propContractIds.includes(i.contractId)));
    setContracts(p => p.filter(c => !propContractIds.includes(c.id)));
    setUnits(p => p.filter(u => u.propertyId !== id));
    setAttachments(p => p.filter(a => !(a.entityType === 'property' && a.entityId === id)));
    setCalendarEvents(p => p.filter(e => !(e.entityType === 'property' && e.entityId === id)));
    setProperties(p => p.filter(x => x.id !== id));
    fs('properties', id, {}, 'delete');
    audit('delete', 'property', id, `عقار: ${prop?.name ?? id}`);
  }, [properties, units, contracts, audit, fs]);

  // ─── Unit CRUD ─────────────────────────────────────────────────────────────

  const addUnit = useCallback((data: Omit<Unit, 'id' | 'createdAt' | 'updatedAt'>): Unit => {
    const unit: Unit = { ...data, id: newId('unt'), createdAt: now(), updatedAt: now() };
    setUnits(p => [unit, ...p]);
    fs('units', unit.id, unit, 'set');
    audit('create', 'unit', unit.id, `وحدة: ${unit.unitNumber}`);
    return unit;
  }, [audit, fs]);

  const updateUnit = useCallback((id: string, data: Partial<Unit>) => {
    setUnits(p => p.map(u => u.id === id ? { ...u, ...data, updatedAt: now() } : u));
    fs('units', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'unit', id, `وحدة: ${data.unitNumber ?? id}`);
  }, [audit, fs]);

  const deleteUnit = useCallback((id: string) => {
    const u = units.find(x => x.id === id);
    // Cascade: cancel active contracts + remove their installments
    const unitContractIds = contracts.filter(c => c.unitId === id).map(c => c.id);
    setInstallments(p => p.filter(i => !unitContractIds.includes(i.contractId)));
    setContracts(p => p.filter(c => c.unitId !== id));
    setAttachments(p => p.filter(a => !(a.entityType === 'unit' && a.entityId === id)));
    setCalendarEvents(p => p.filter(e => !(e.entityType === 'unit' && e.entityId === id)));
    setUnits(p => p.filter(x => x.id !== id));
    fs('units', id, {}, 'delete');
    audit('delete', 'unit', id, `وحدة: ${u?.unitNumber ?? id}`);
  }, [units, contracts, audit, fs]);

  // ─── Contract CRUD ─────────────────────────────────────────────────────────

  const addContract = useCallback((data: Omit<Contract, 'id' | 'createdAt' | 'updatedAt'>): Contract => {
    const contract: Contract = { ...data, id: newId('con'), createdAt: now(), updatedAt: now() };
    setContracts(p => [contract, ...p]);
    // Mark unit as rented
    setUnits(p => p.map(u => u.id === contract.unitId ? { ...u, status: 'rented', updatedAt: now() } : u));
    // Generate installments
    const dates   = ContractService.generateInstallmentDates(contract);
    const amount  = ContractService.installmentAmount(contract);
    const installs: PaymentInstallment[] = dates.map((dueDate, i) => ({
      id:                 newId('inst'),
      contractId:         contract.id,
      installmentNumber:  i + 1,
      dueDate,
      amount,
      status:             'pending',
      createdAt:          now(),
      updatedAt:          now(),
    }));
    setInstallments(p => [...p, ...installs]);
    fs('contracts', contract.id, contract, 'set');
    installs.forEach(i => fs('installments', i.id, i, 'set'));
    audit('create', 'contract', contract.id, `عقد: ${contract.id}`);
    return contract;
  }, [audit, fs]);

  const updateContract = useCallback((id: string, data: Partial<Contract>) => {
    setContracts(p => p.map(c => c.id === id ? { ...c, ...data, updatedAt: now() } : c));
    fs('contracts', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'contract', id, `عقد: ${id}`);
  }, [audit, fs]);

  const cancelContract = useCallback((id: string, reason: string) => {
    const ts = now();
    setContracts(p => p.map(c => c.id === id
      ? { ...c, status: 'cancelled', cancelledAt: ts, cancelledBy: currentUser.id, cancellationReason: reason, updatedAt: ts }
      : c,
    ));
    // Mark related unit as vacant
    const contract = contracts.find(c => c.id === id);
    if (contract) {
      setUnits(p => p.map(u => u.id === contract.unitId ? { ...u, status: 'vacant', updatedAt: ts } : u));
    }
    audit('cancel', 'contract', id, `إلغاء عقد: ${id}`, undefined, { reason });
  }, [contracts, currentUser.id, audit]);

  const terminateContract = useCallback((id: string, reason: string) => {
    const ts   = now();
    const date = ts.split('T')[0];
    const contract = contracts.find(c => c.id === id);
    const tenant   = contract ? tenants.find(t => t.id === contract.tenantId) : null;

    // Update contract status → terminated
    setContracts(p => p.map(c => c.id === id
      ? { ...c, status: 'terminated', cancelledAt: ts, cancelledBy: currentUser.id, cancellationReason: reason, updatedAt: ts }
      : c,
    ));

    // Release unit
    if (contract) {
      setUnits(p => p.map(u => u.id === contract.unitId ? { ...u, status: 'vacant', updatedAt: ts } : u));
    }

    // In-app notification for admin
    const notif = NotificationService.create({
      type:       'system',
      title:      'تم إنهاء العقد',
      body:       `تم إنهاء العقد ${id} بتاريخ ${date} — السبب: ${reason}`,
      entityType: 'contract',
      entityId:   id,
    });
    setNotifications(p => [notif, ...p]);

    // Audit trail
    audit('terminate', 'contract', id, `إنهاء عقد: ${id} — ${reason}`, undefined, { reason, terminatedAt: ts, terminatedBy: currentUser.id });

    return {
      tenantName:      tenant?.name  ?? '—',
      tenantPhone:     tenant?.phone ?? '',
      tenantEmail:     tenant?.email ?? '',
      terminationDate: date,
    };
  }, [contracts, tenants, currentUser.id, audit]);

  const deleteContract = useCallback((id: string) => {
    const toDelete = installments.filter(i => i.contractId === id);
    setContracts(p => p.filter(c => c.id !== id));
    setInstallments(p => p.filter(i => i.contractId !== id));
    fs('contracts', id, {}, 'delete');
    toDelete.forEach(i => fs('installments', i.id, {}, 'delete'));
    audit('delete', 'contract', id, `عقد: ${id}`);
  }, [audit, fs, installments]);

  // ─── Payment ───────────────────────────────────────────────────────────────

  const recordPayment = useCallback((
    installmentId: string,
    data: { paidDate: string; paymentMethod: string; referenceNumber?: string; notes?: string },
  ) => {
    const receiptNumber = PaymentService.generateReceiptNumber();
    setInstallments(p => p.map(i => i.id === installmentId
      ? { ...i, status: 'paid', paidDate: data.paidDate, paymentMethod: data.paymentMethod as any, referenceNumber: data.referenceNumber, notes: data.notes, receiptNumber, updatedAt: now() }
      : i,
    ));
    fs('installments', installmentId, { status: 'paid', paidDate: data.paidDate, paymentMethod: data.paymentMethod, referenceNumber: data.referenceNumber, notes: data.notes, updatedAt: now() }, 'update');
    audit('payment', 'installment', installmentId, `تسجيل دفعة: ${installmentId}`);
  }, [audit, fs]);

  // ─── Maintenance CRUD ──────────────────────────────────────────────────────

  const addMaintenance = useCallback((data: Omit<MaintenanceRequest, 'id' | 'createdAt' | 'updatedAt'>): MaintenanceRequest => {
    const req: MaintenanceRequest = { ...data, id: newId('mnt'), createdAt: now(), updatedAt: now() };
    setMaintenance(p => [req, ...p]);
    fs('maintenance', req.id, req, 'set');
    audit('create', 'maintenance', req.id, `صيانة: ${req.title}`);
    return req;
  }, [audit, fs]);

  const updateMaintenance = useCallback((id: string, data: Partial<MaintenanceRequest>) => {
    setMaintenance(p => p.map(m => m.id === id ? { ...m, ...data, updatedAt: now() } : m));
    fs('maintenance', id, { ...data, updatedAt: now() }, 'update');
    audit('update', 'maintenance', id, `صيانة: ${data.title ?? id}`);
  }, [audit, fs]);

  const deleteMaintenance = useCallback((id: string) => {
    const m = maintenance.find(x => x.id === id);
    setAttachments(p => p.filter(a => !(a.entityType === 'maintenance' && a.entityId === id)));
    setCalendarEvents(p => p.filter(e => !(e.entityType === 'maintenance' && e.entityId === id)));
    setMaintenance(p => p.filter(x => x.id !== id));
    fs('maintenance', id, {}, 'delete');
    audit('delete', 'maintenance', id, `صيانة: ${m?.title ?? id}`);
  }, [maintenance, audit, fs]);

  const deleteCalendarEvent = useCallback((id: string) => {
    const e = calendarEvents.find(x => x.id === id);
    setCalendarEvents(p => p.filter(x => x.id !== id));
    audit('delete', 'calendarEvent', id, `حدث: ${e?.title ?? id}`);
  }, [calendarEvents, audit]);

  // ─── Attachments ───────────────────────────────────────────────────────────

  const addAttachment = useCallback((data: Parameters<typeof FileService.create>[0]): Attachment => {
    const att = FileService.create(data);
    setAttachments(p => [att, ...p]);
    audit('upload', data.entityType, data.entityId, `ملف: ${data.name}`);

    // ── Auto calendar event + notifications when expiry date is set ──────────
    if (data.expiryDate) {
      // Calendar event on the expiry day
      const calEvent: CalendarEvent = {
        id:         newId('cal'),
        title:      `انتهاء صلاحية: ${data.name}`,
        date:       data.expiryDate,
        type:       'file_expiry',
        entityId:   att.id,
        entityType: 'attachment',
        notes:      data.notes,
      };
      setCalendarEvents(p => [calEvent, ...p]);

      // Immediate notification (expiry reminder created)
      const notifNow: Notification = {
        id:         newId('notif'),
        type:       'file_expiry',
        title:      'تم ضبط تذكير انتهاء صلاحية',
        body:       `ملف "${data.name}" — تاريخ الانتهاء: ${data.expiryDate}`,
        entityType: 'attachment',
        entityId:   att.id,
        isRead:     false,
        createdAt:  new Date().toISOString(),
      };
      setNotifications(p => [notifNow, ...p]);

      // Warning notification (30 days before) — only if expiry is in the future
      const expiryMs    = new Date(data.expiryDate).getTime();
      const thirtyDays  = 30 * 24 * 60 * 60 * 1000;
      if (expiryMs - Date.now() > thirtyDays) {
        const warnDate = new Date(expiryMs - thirtyDays).toISOString();
        const notifWarn: Notification = {
          id:         newId('notif'),
          type:       'file_expiry',
          title:      'تنبيه: صلاحية ملف تقترب من الانتهاء',
          body:       `ملف "${data.name}" سينتهي بعد 30 يوم (${data.expiryDate})`,
          entityType: 'attachment',
          entityId:   att.id,
          isRead:     false,
          createdAt:  warnDate,
        };
        setNotifications(p => [notifWarn, ...p]);
      }
    }
    return att;
  }, [audit]);

  const deleteAttachment = useCallback((id: string) => {
    const a = attachments.find(x => x.id === id);
    setAttachments(p => p.filter(a => a.id !== id));
    if (a) audit('delete', 'attachment', id, `ملف: ${a.name}`);
  }, [attachments, audit]);

  // ─── Photos ────────────────────────────────────────────────────────────────

  const addPhoto = useCallback((
    entityType: 'property' | 'unit',
    entityId: string,
    uri: string,
    caption?: string,
  ): EntityPhoto => {
    const photo: EntityPhoto = {
      id:         newId('photo'),
      uri,
      isMain:     false,
      caption,
      uploadedAt: now(),
      uploadedBy: currentUser.name,
    };
    const applyPhoto = (items: any[], setFn: (fn: (p: any[]) => any[]) => void) => {
      setFn(prev => prev.map((item: any) => {
        if (item.id !== entityId) return item;
        const existing: EntityPhoto[] = item.photos ?? [];
        // First photo is auto-set as main
        const newPhoto = { ...photo, isMain: existing.length === 0 };
        return { ...item, photos: [...existing, newPhoto], updatedAt: now() };
      }));
    };
    if (entityType === 'property') applyPhoto(properties, setProperties as any);
    else                           applyPhoto(units, setUnits as any);
    audit('upload', entityType, entityId, `صورة: ${entityId}`);
    return photo;
  }, [properties, units, currentUser.name, audit]);

  const removePhoto = useCallback((
    entityType: 'property' | 'unit',
    entityId: string,
    photoId: string,
  ) => {
    const applyRemove = (setFn: (fn: (p: any[]) => any[]) => void) => {
      setFn(prev => prev.map((item: any) => {
        if (item.id !== entityId) return item;
        const filtered: EntityPhoto[] = (item.photos ?? []).filter((p: EntityPhoto) => p.id !== photoId);
        // If removed photo was main, promote first remaining as main
        const hadMain = (item.photos ?? []).find((p: EntityPhoto) => p.id === photoId)?.isMain;
        const updated = hadMain && filtered.length > 0
          ? filtered.map((p, i) => ({ ...p, isMain: i === 0 }))
          : filtered;
        return { ...item, photos: updated, updatedAt: now() };
      }));
    };
    if (entityType === 'property') applyRemove(setProperties as any);
    else                           applyRemove(setUnits as any);
  }, []);

  const setMainPhoto = useCallback((
    entityType: 'property' | 'unit',
    entityId: string,
    photoId: string,
  ) => {
    const applyMain = (setFn: (fn: (p: any[]) => any[]) => void) => {
      setFn(prev => prev.map((item: any) => {
        if (item.id !== entityId) return item;
        const updated = (item.photos ?? []).map((p: EntityPhoto) => ({ ...p, isMain: p.id === photoId }));
        return { ...item, photos: updated, updatedAt: now() };
      }));
    };
    if (entityType === 'property') applyMain(setProperties as any);
    else                           applyMain(setUnits as any);
  }, []);

  // ─── Notifications ─────────────────────────────────────────────────────────

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(p => p.map(n => n.id === id ? { ...n, isRead: true } : n));
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(p => p.map(n => ({ ...n, isRead: true })));
  }, []);

  // ─── Auth ──────────────────────────────────────────────────────────────────

  const login = useCallback((_email: string, _password: string): boolean => true, []);

  const logout = useCallback(() => {
    import('../lib/auth').then(m => m.logoutUser()).catch(console.error);
    setIsLoggedIn(false);
  }, []);

  const updateProfile = useCallback((data: Partial<User>) => {
    setCurrentUser(p => ({ ...p, ...data }));
    audit('update', 'user', currentUser.id, 'تعديل الملف الشخصي');
  }, [currentUser.id, audit]);

  const updatePreferences = useCallback((prefs: Partial<UserPreferences>) => {
    setCurrentUser(p => ({ ...p, preferences: { ...p.preferences, ...prefs } }));
  }, []);

  // ─── Context Value ─────────────────────────────────────────────────────────

  const value = useMemo<AppState>(() => ({
    owners, tenants, properties, units, contracts, installments,
    maintenance, attachments, auditLogs, notifications, calendarEvents,
    currentUser, isLoggedIn, kpis,
    addOwner, updateOwner, deleteOwner,
    addTenant, updateTenant, deleteTenant,
    addProperty, updateProperty, deleteProperty,
    addUnit, updateUnit, deleteUnit,
    addContract, updateContract, cancelContract, terminateContract, deleteContract,
    recordPayment,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addAttachment, deleteAttachment,
    addPhoto, removePhoto, setMainPhoto,
    deleteCalendarEvent,
    markNotificationRead, markAllNotificationsRead,
    login, logout, updateProfile, updatePreferences, dataLoading,
  }), [
    owners, tenants, properties, units, contracts, installments,
    maintenance, attachments, auditLogs, notifications, calendarEvents,
    currentUser, isLoggedIn, kpis, dataLoading,
    addOwner, updateOwner, deleteOwner,
    addTenant, updateTenant, deleteTenant,
    addProperty, updateProperty, deleteProperty,
    addUnit, updateUnit, deleteUnit,
    addContract, updateContract, cancelContract, terminateContract, deleteContract,
    recordPayment,
    addMaintenance, updateMaintenance, deleteMaintenance,
    addAttachment, deleteAttachment,
    addPhoto, removePhoto, setMainPhoto,
    deleteCalendarEvent,
    markNotificationRead, markAllNotificationsRead,
    login, logout, updateProfile, updatePreferences,
  ]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAppStore(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be used within AppStoreProvider');
  return ctx;
}
