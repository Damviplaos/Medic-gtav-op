// Hook สำหรับตรวจสิทธิ์ผู้ใช้งาน
import { useAuth } from '@/contexts/AuthContext';
import type { Permission } from '@/types/index';

export function usePermissions() {
  const { profile } = useAuth();
  const role = profile?.role;

  const can = (permission: Permission): boolean => {
    if (!role) return false;
    return !!role[permission];
  };

  const isAdmin = role?.name === 'admin';
  const isDirector = role?.name === 'ผอ' || isAdmin;

  return { can, isAdmin, isDirector, role };
}
