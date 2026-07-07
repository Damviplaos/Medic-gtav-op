import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import LoginPage from './pages/LoginPage';
import QueuePage from './pages/QueuePage';
import DashboardPage from './pages/DashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import RoleManagementPage from './pages/RoleManagementPage';
import UserManagementPage from './pages/UserManagementPage';
import SettingsPage from './pages/SettingsPage';
import InactivityPage from './pages/InactivityPage';
import ProtectedRoute from './components/common/ProtectedRoute';
import MainLayout from './components/layouts/MainLayout';
import type { SystemRole } from './types/types';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

function Protected({ children, roles }: { children: ReactNode; roles?: SystemRole[] }) {
  return (
    <ProtectedRoute requiredRoles={roles}>
      <MainLayout>{children}</MainLayout>
    </ProtectedRoute>
  );
}

export const routes: RouteConfig[] = [
  { name: 'Home', path: '/', element: <Navigate to="/queue" replace />, public: true },
  { name: 'Login', path: '/login', element: <LoginPage />, public: true },
  { name: 'Queue', path: '/queue', element: <Protected><QueuePage /></Protected> },
  { name: 'Dashboard', path: '/dashboard', element: <Protected><DashboardPage /></Protected> },
  { name: 'Admin Dashboard', path: '/admin/dashboard', element: <Protected roles={['super_admin', 'admin']}><AdminDashboardPage /></Protected> },
  { name: 'Role Management', path: '/admin/roles', element: <Protected roles={['super_admin', 'admin']}><RoleManagementPage /></Protected> },
  { name: 'User Management', path: '/admin/users', element: <Protected roles={['super_admin', 'admin']}><UserManagementPage /></Protected> },
  { name: 'Inactivity', path: '/admin/inactivity', element: <Protected roles={['super_admin', 'admin']}><InactivityPage /></Protected> },
  { name: 'Settings', path: '/settings', element: <Protected><SettingsPage /></Protected> },
];
