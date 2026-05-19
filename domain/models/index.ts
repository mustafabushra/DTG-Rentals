/**
 * Domain Models — Single source of truth for all TypeScript interfaces.
 * No business logic here — pure data shapes only.
 */

// ─── Enums / Union Types ──────────────────────────────────────────────────────

export type PropertyType   = 'apartment' | 'villa' | 'office' | 'shop' | 'building' | 'land';
export type UnitType       = 'apartment' | 'studio' | 'office' | 'shop' | 'floor' | 'villa';
export type ContractStatus = 'active' | 'expired' | 'cancelled' | 'pending' | 'terminated';
export type PaymentStatus  = 'paid' | 'pending' | 'overdue' | 'cancelled';
export type MaintenanceStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type MaintenancePriority = 'low' | 'medium' | 'high' | 'urgent';
export type UnitStatus     = 'vacant' | 'rented' | 'maintenance' | 'reserved';
export type AuditAction    = 'create' | 'update' | 'delete' | 'cancel' | 'terminate' | 'upload' | 'payment' | 'login' | 'logout';
export type PaymentMethod  = 'cash' | 'bank_transfer' | 'check' | 'online';
export type FileCategory   = 'contract' | 'id' | 'property' | 'payment' | 'maintenance' | 'other';
export type FilterStatus   = 'all' | 'active' | 'expired' | 'cancelled' | 'paid' | 'overdue' | 'pending' | 'new' | 'in_progress' | 'completed' | 'vacant' | 'rented';
export type NotificationType = 'payment_due' | 'contract_expiry' | 'file_expiry' | 'maintenance' | 'system';
export type CalendarEventType = 'payment' | 'contract_expiry' | 'file_expiry' | 'maintenance';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Owner {
  id: string;
  name: string;
  phone: string;
  email: string;
  nationalId?: string;
  bankAccount?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  name: string;
  phone: string;
  email: string;
  nationalId?: string;
  nationality?: string;
  occupation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  ownerId: string;
  totalUnits: number;
  floors?: number;
  buildYear?: number;
  notes?: string;
  photos?: EntityPhoto[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  propertyId: string;
  unitNumber: string;
  type: UnitType;
  floor?: number;
  area?: number;          // sqm
  bedrooms?: number;
  bathrooms?: number;
  status: UnitStatus;
  baseRent?: number;      // SAR/year
  notes?: string;
  photos?: EntityPhoto[];
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface Contract {
  id: string;
  propertyId: string;
  unitId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  status: ContractStatus;
  annualValue: number;     // SAR
  paymentCycles: number;   // installments per year
  depositAmount?: number;
  depositPaid?: boolean;
  notes?: string;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaymentInstallment {
  id: string;
  contractId: string;
  installmentNumber: number;
  dueDate: string;
  amount: number;
  status: PaymentStatus;
  paidDate?: string;
  paymentMethod?: PaymentMethod;
  referenceNumber?: string;
  receiptNumber?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRequest {
  id: string;
  propertyId: string;
  unitId?: string;
  title: string;
  description: string;
  category: string;        // plumbing, electrical, AC, etc.
  priority: MaintenancePriority;
  status: MaintenanceStatus;
  reportedBy?: string;
  assignedTo?: string;
  estimatedCost?: number;
  actualCost?: number;
  scheduledDate?: string;
  completedDate?: string;
  attachments?: Attachment[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Entity Photo ─────────────────────────────────────────────────────────────

export interface EntityPhoto {
  id: string;
  uri: string;          // local or remote URI
  isMain: boolean;      // shown as thumbnail in cards/lists
  caption?: string;
  uploadedAt: string;
  uploadedBy?: string;
}

export interface Attachment {
  id: string;
  entityType: string;      // 'property' | 'contract' | 'unit' | etc.
  entityId: string;
  name: string;
  type: 'image' | 'pdf' | 'doc' | 'other';
  mimeType: string;
  uri: string;             // local or remote URI
  size?: number;           // bytes
  category: FileCategory;
  expiryDate?: string;     // optional expiry
  expiryStatus?: 'active' | 'expiring_soon' | 'expired';
  uploadedAt: string;
  uploadedBy?: string;
  notes?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  entityLabel: string;     // human-readable description
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  isRead: boolean;
  createdAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;            // YYYY-MM-DD
  type: CalendarEventType;
  entityId: string;
  entityType: string;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'ar' | 'en';
  notifications: {
    contracts: boolean;
    payments: boolean;
    attachments: boolean;
    maintenance: boolean;
  };
}

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  status: FilterStatus;
  search: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  dateFrom?: string;
  dateTo?: string;
  propertyId?: string;
  ownerId?: string;
}

export const defaultFilter: FilterState = {
  status:  'all',
  search:  '',
  sortBy:  'createdAt',
  sortDir: 'desc',
};

// ─── KPI / Analytics ─────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalProperties:        number;
  totalUnits:             number;
  rentedUnits:            number;
  vacantUnits:            number;
  monthlyRevenue:         number;
  annualRevenue:          number;
  collectionRate:         number;     // 0–100
  overduePayments:        number;
  overdueAmount:          number;
  openMaintenanceRequests:number;
  activeContracts:        number;
  expiringContracts:      number;     // within 90 days
  pendingInstallments:    number;
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export interface Receipt {
  receiptNumber: string;
  issuedDate: string;
  tenantName: string;
  tenantPhone: string;
  propertyName: string;
  unitNumber: string;
  contractId: string;
  installmentNumber: number;
  amount: number;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  notes?: string;
  issuedBy: string;
  currency?: string;
}
