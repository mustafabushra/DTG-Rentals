export const ADMIN_ROLES   = ['admin', 'مدير عام', 'مدير النظام'];
export const MANAGER_ROLES = ['manager', 'مدير', ...ADMIN_ROLES];
export const VIEWER_ROLES  = ['viewer', 'مشاهد'];
export const OWNER_ROLES   = ['owner', 'مالك'];

export function isAdminRole(role: string): boolean   { return ADMIN_ROLES.includes(role); }
export function canWriteRole(role: string): boolean  { return MANAGER_ROLES.includes(role); }
export function isViewerRole(role: string): boolean  { return VIEWER_ROLES.includes(role) || !canWriteRole(role); }
export function isOwnerRole(role: string): boolean   { return OWNER_ROLES.includes(role); }
