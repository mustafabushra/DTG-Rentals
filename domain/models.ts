/**
 * domain/models.ts — Canonical type definitions for DTG Rentals.
 * All feature modules import from here.
 */

// ─── Status Types ─────────────────────────────────────────────────────────────

export type ContractStatus    = 'active' | 'expired' | 'cancelled' | 'terminated' | 'pending';
export type PaymentStatus     = 'paid' | 'pending' | 'overdue';
export type MaintenanceStatus = 'new' | 'in_progress' | 'completed' | 'cancelled';
export type UnitStatus        = 'rented' | 'vacant' | 'maintenance' | 'reserved';
export type FilterStatus      = 'all' | ContractStatus | PaymentStatus | MaintenanceStatus | UnitStatus;

export type PropertyType      = 'apartment' | 'villa' | 'office' | 'shop' | 'building' | 'tower';
export type UnitType          = 'studio' | 'apartment' | 'villa' | 'office' | 'shop' | 'floor' | string;
export type PaymentMethod     = 'bank_transfer' | 'cash' | 'check' | 'transfer';
export type MaintenancePriority = 'urgent' | 'high' | 'medium' | 'low';
export type FileCategory      = 'contract' | 'id' | 'invoice' | 'permit' | 'property' | 'payment' | 'maintenance' | 'other';
export type AuditAction       = 'create' | 'update' | 'delete' | 'payment' | 'add' | 'edit';

// ─── Core Entities ────────────────────────────────────────────────────────────

export interface Owner {
  id:           string;
  name:         string;
  phone:        string;
  email:        string;
  nationalId:   string;
  iban?:        string;
  bankAccount?: string;
  propertyIds?: string[];
  avatar?:      string;
  createdAt:    string;
  updatedAt?:   string;
}

export interface Tenant {
  id:           string;
  name:         string;
  phone:        string;
  email:        string;
  nationalId?:  string;
  nationality?: string;
  contractIds?: string[];
  createdAt:    string;
  updatedAt?:   string;
}

export interface Property {
  id:          string;
  name:        string;
  type:        PropertyType;
  address?:    string;
  location?:   string;
  city?:       string;
  floors?:     number;
  totalUnits:  number;
  ownerId:     string;
  status?:     'active' | 'inactive';
  description?: string;
  buildYear?:  number;
  image?:      string;
  photos?:     EntityPhoto[];
  createdAt:   string;
  updatedAt?:  string;
}

export interface Unit {
  id:               string;
  propertyId:       string;
  ownerId?:         string;
  unitNumber?:      string;
  number?:          string;        // legacy alias
  type:             UnitType;
  floor?:           number;
  area?:            number;
  bedrooms?:        number;
  bathrooms?:       number;
  baseRent?:        number;
  monthlyRent?:     number;
  annualRent?:      number;
  status:           UnitStatus;
  description?:     string;
  features?:        string[];
  currentTenantId?: string;
  currentContractId?: string;
  photos?:          EntityPhoto[];
  createdAt:        string;
  updatedAt?:       string;
}

export interface Contract {
  id:                   string;
  contractNumber?:      string;
  propertyId?:          string;
  unitId:               string;
  tenantId:             string;
  startDate:            string;
  endDate:              string;
  annualValue:          number;
  installmentsCount?:   number;
  paymentCycles?:       number;
  status:               ContractStatus;
  notes?:               string;
  cancelledAt?:         string;
  cancelledBy?:         string;
  cancellationReason?:  string;
  terminationReason?:   string;
  terminatedAt?:        string;
  createdAt:            string;
  updatedAt?:           string;
}

export interface PaymentInstallment {
  id:                 string;
  contractId:         string;
  installmentNumber:  number;
  dueDate:            string;
  amount:             number;
  status:             PaymentStatus;
  paidDate?:          string;
  paymentMethod?:     PaymentMethod;
  referenceNumber?:   string;
  receiptNumber?:     string;
  notes?:             string;
  createdAt:          string;
  updatedAt?:         string;
}

// Legacy alias used by AppProvider
export type Payment = PaymentInstallment & {
  method?:            PaymentMethod;
  receiptNumber?:     string;
};

export interface MaintenanceRequest {
  id:             string;
  propertyId:     string;
  unitId?:        string;
  title:          string;
  description?:   string;
  category?:      string;
  priority:       MaintenancePriority;
  status:         MaintenanceStatus;
  reportedBy?:    string;
  assignedTo?:    string;
  technicianName?: string;
  cost?:          number;
  scheduledDate?: string;
  completedDate?: string;
  openedAt?:      string;
  assignedAt?:    string;
  closedAt?:      string;
  createdAt:      string;
  updatedAt?:     string;
}

export type AttachmentFileType = 'image' | 'pdf' | 'doc' | 'other';
export type AttachmentExpiryStatus = 'active' | 'expiring_soon' | 'expired';

export interface Attachment {
  id:             string;
  entityType:     string;
  entityId:       string;
  name:           string;
  uri:            string;
  mimeType?:      string;
  type:           AttachmentFileType;
  size?:          number;
  category?:      FileCategory;
  expiryDate?:    string;
  expiryStatus?:  AttachmentExpiryStatus;
  notes?:         string;
  uploadedAt:     string;
  uploadedBy?:    string;
}

export interface EntityPhoto {
  id:        string;
  uri:       string;
  caption?:  string;
  isMain?:   boolean;
  createdAt: string;
}

export interface AuditLog {
  id:          string;
  userId:      string;
  userName:    string;
  action:      AuditAction;
  entityType:  string;
  entityId:    string;
  entityLabel?: string;
  entityName?:  string;
  details?:    string;
  timestamp:   string;
}

export interface Notification {
  id:           string;
  type:         string;
  title:        string;
  body:         string;
  entityType?:  string;
  entityId?:    string;
  isRead:       boolean;
  createdAt:    string;
}

export interface CalendarEvent {
  id:           string;
  title:        string;
  date:         string;
  type:         string;
  notes?:       string;
  entityId?:    string;
  entityType?:  string;
  description?: string;
  relatedId?:   string;
}

// ─── User & Preferences ───────────────────────────────────────────────────────

export interface UserPreferences {
  theme?:    'light' | 'dark' | 'system';
  language?: string;
  notifications?: {
    contracts?:   boolean;
    payments?:    boolean;
    attachments?: boolean;
    maintenance?: boolean;
  };
}

export interface User {
  id:           string;
  name:         string;
  email:        string;
  phone?:       string;
  role?:        string;
  avatar?:      string;
  preferences?: UserPreferences;
  createdAt?:   string;
  updatedAt?:   string;
}

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

export interface DashboardKPIs {
  totalProperties:    number;
  totalUnits:         number;
  rentedUnits:        number;
  vacantUnits:        number;
  activeContracts:    number;
  expiringContracts:  number;
  overduePayments:    number;
  monthlyRevenue:     number;
  collectionRate:     number;
  totalRevenue?:      number;
  pendingAmount?:     number;
}

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface FilterState {
  status:   string;
  search:   string;
  sortBy:   string;
  sortDir:  'asc' | 'desc';
  dateFrom?: string;
  dateTo?:   string;
}

export const defaultFilter: FilterState = {
  status:  'all',
  search:  '',
  sortBy:  'createdAt',
  sortDir: 'desc',
};

// ─── Receipt (for ReceiptModal) ───────────────────────────────────────────────

export interface Receipt {
  receiptNumber:     string;
  tenantName:        string;
  tenantPhone:       string;
  propertyName:      string;
  unitNumber:        string;
  installmentNumber: number;
  amount:            number;
  paymentMethod:     PaymentMethod;
  referenceNumber?:  string;
  issuedDate:        string;
  issuedBy:          string;
  currency?:         string;
}
