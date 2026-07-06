// Hook สำหรับตรวจสิทธิ์ผู้ใช้งาน (รองรับหลายยศแบบ Discord)
import { useAuth } from '@/contexts/AuthContext';
import type { Permission } from '@/types/index';

export function usePermissions() {
  const { profile } = useAuth();
  const roles = profile?.roles ?? (profile?.role ? [profile.role] : []);

  // คืน true ถ้ายศใดยศหนึ่งมีสิทธิ์นั้น
  const can = (permission: Permission): boolean => {
    if (!roles.length) return false;
    return roles.some(r => !!r[permission]);
  };

  const isAdmin = roles.some(r => r.name === 'admin') || !!profile?.is_superadmin;
  const isDirector = roles.some(r => r.name === 'ผอ') || isAdmin;
  // ยศหลักสำหรับ display
  const role = roles[0];

  return { can, isAdmin, isDirector, role, roles };
}
