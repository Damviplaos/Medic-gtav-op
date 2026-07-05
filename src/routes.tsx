import LoginPage from './pages/LoginPage';
import QueuePage from './pages/QueuePage';
import SettingsPage from './pages/SettingsPage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** เข้าถึงได้โดยไม่ต้อง login */
  public?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: 'หน้าหลัก',
    path: '/',
    element: <QueuePage />,
    public: true,   // ดูคิวได้โดยไม่ต้อง login; แต่จัดการต้อง login
  },
  {
    name: 'เข้าสู่ระบบ',
    path: '/login',
    element: <LoginPage />,
    public: true,
  },
  {
    name: 'ตั้งค่า',
    path: '/settings',
    element: <SettingsPage />,
    public: false,  // ต้อง login
  },
];
