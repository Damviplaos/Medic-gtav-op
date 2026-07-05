import LoginPage from './pages/LoginPage';
import QueuePage from './pages/QueuePage';
import SettingsPage from './pages/SettingsPage';
import RolesPage from './pages/RolesPage';
import AccountsPage from './pages/AccountsPage';
import DashboardPage from './pages/DashboardPage';
import OverviewDashboard from './pages/OverviewDashboard';
import WarningsPage from './pages/WarningsPage';
import PromotionPage from './pages/PromotionPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'หน้าหลัก', path: '/', element: <QueuePage />, public: false },
  { name: 'เข้าสู่ระบบ', path: '/login', element: <LoginPage />, public: true },
  { name: 'Dashboard', path: '/dashboard', element: <DashboardPage />, public: false },
  { name: 'ภาพรวม', path: '/overview', element: <OverviewDashboard />, public: false },
  { name: 'คุณสมบัติสอบเลื่อนยศ', path: '/promotion', element: <PromotionPage />, public: false },
  { name: 'จัดการบัญชี', path: '/accounts', element: <AccountsPage />, public: false },
  { name: 'จัดการยศ', path: '/roles', element: <RolesPage />, public: false },
  { name: 'ใบเตือน', path: '/warnings', element: <WarningsPage />, public: false },
  { name: 'ตั้งค่า', path: '/settings', element: <SettingsPage />, public: false },
];
