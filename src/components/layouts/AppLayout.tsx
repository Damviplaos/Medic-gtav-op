// Layout หลักพร้อม sidebar navigation
import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/use-permissions';
import {
  Stethoscope, Home, BarChart2, Users, Shield,
  AlertTriangle, Settings, LogOut, Menu, X, TrendingUp, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  permission?: () => boolean;
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const { can, isDirector } = usePermissions();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast.success('ออกจากระบบแล้ว');
    navigate('/login');
  };

  const navItems: NavItem[] = [
    { to: '/', label: 'คิว OP', icon: <Home className="w-4 h-4" /> },
    { to: '/dashboard', label: 'Dashboard ของฉัน', icon: <BarChart2 className="w-4 h-4" /> },
    {
      to: '/overview',
      label: 'ภาพรวม',
      icon: <BarChart2 className="w-4 h-4" />,
      permission: () => can('can_view_overview_dashboard') || isDirector,
    },
    // คุณสมบัติสอบเลื่อนยศ — ทุกคนเห็น
    { to: '/promotion', label: 'คุณสมบัติเลื่อนยศ', icon: <TrendingUp className="w-4 h-4" /> },
    {
      to: '/accounts',
      label: 'จัดการบัญชี',
      icon: <Users className="w-4 h-4" />,
      permission: () => can('can_create_account'),
    },
    {
      to: '/roles',
      label: 'จัดการยศ',
      icon: <Shield className="w-4 h-4" />,
      permission: () => can('can_manage_roles'),
    },
    {
      to: '/warnings',
      label: 'ใบเตือน',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    {
      to: '/settings',
      label: 'ตั้งค่า',
      icon: <Settings className="w-4 h-4" />,
      permission: () => can('can_access_settings'),
    },
  ];

  const visibleItems = navItems.filter(item => !item.permission || item.permission());

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Stethoscope className="w-6 h-6 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">ระบบจัดคิวหมอ</p>
            <p className="text-xs text-muted-foreground truncate">GTA V RP</p>
          </div>
        </div>
      </div>

      {/* Profile */}
      {profile && (
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
              style={{ backgroundColor: profile.role?.color ?? '#6B7280' }}
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-sidebar-foreground truncate">{profile.display_name}</p>
              <p className="text-xs truncate" style={{ color: profile.role?.color ?? '#6B7280' }}>
                {profile.role?.name ?? ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {visibleItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                isActive
                  ? 'bg-primary/15 text-primary font-semibold border-r-2 border-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`
            }
          >
            {item.icon}
            <span className="flex-1 min-w-0 truncate">{item.label}</span>
            <ChevronRight className="w-3 h-3 opacity-40" />
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-destructive hover:bg-muted/50 rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          ออกจากระบบ
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 bg-sidebar border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col overflow-x-hidden">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-10 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-muted transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Stethoscope className="w-5 h-5 text-primary shrink-0" />
            <span className="text-sm font-bold text-foreground truncate">ระบบจัดคิวหมอ GTA V RP</span>
          </div>
          {profile && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-white"
              style={{ backgroundColor: profile.role?.color ?? '#6B7280' }}
            >
              {profile.display_name.charAt(0).toUpperCase()}
            </div>
          )}
        </header>

        <main className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
