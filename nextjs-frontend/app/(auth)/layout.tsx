'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, ArrowRightLeft, Link2, Server, Users, Clock, Settings,
  Menu, ChevronDown, LogOut, KeyRound, Shield, Inbox, Award, Rss,
  Activity,
} from 'lucide-react';
import { useAuth, logout } from '@/lib/hooks/use-auth';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/theme-toggle';
import { getVersion } from '@/lib/api/system';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  section?: string;
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: '仪表板', icon: <LayoutDashboard className="h-4 w-4" /> },
  // GOST
  { path: '/forward', label: '转发管理', icon: <ArrowRightLeft className="h-4 w-4" />, section: 'GOST' },
  { path: '/tunnel', label: '隧道管理', icon: <Link2 className="h-4 w-4" />, adminOnly: true, section: 'GOST' },
  { path: '/limit', label: '限速规则', icon: <Clock className="h-4 w-4" />, adminOnly: true, section: 'GOST' },
  // Xray
  { path: '/xray/inbound', label: '入站管理', icon: <Inbox className="h-4 w-4" />, section: 'Xray' },
  { path: '/xray/certificate', label: '证书管理', icon: <Award className="h-4 w-4" />, section: 'Xray' },
  { path: '/xray/subscription', label: '订阅管理', icon: <Rss className="h-4 w-4" />, section: 'Xray' },
  // System
  { path: '/node', label: '节点管理', icon: <Server className="h-4 w-4" />, adminOnly: true, section: '系统' },
  { path: '/user', label: '用户管理', icon: <Users className="h-4 w-4" />, adminOnly: true, section: '系统' },
  { path: '/monitor', label: '状态监控', icon: <Activity className="h-4 w-4" />, adminOnly: true, section: '系统' },
  { path: '/config', label: '系统配置', icon: <Settings className="h-4 w-4" />, adminOnly: true, section: '系统' },
];

function SidebarContent({ pathname, isAdmin, gostEnabled, xrayEnabled, onNavigate, version }: {
  pathname: string;
  isAdmin: boolean;
  gostEnabled: boolean;
  xrayEnabled: boolean;
  onNavigate: (path: string) => void;
  version: string;
}) {
  const filtered = navItems.filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.section === 'GOST' && !isAdmin && !gostEnabled) return false;
    if (item.section === 'Xray' && !isAdmin && !xrayEnabled) return false;
    return true;
  });
  let lastSection = '';

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4">
        <div className="flex items-center gap-2">
          <Shield className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-sm font-bold">Flux Panel</h1>
            <p className="text-xs text-muted-foreground">{version}</p>
          </div>
        </div>
      </div>
      <Separator />
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {filtered.map((item) => {
          const showSection = item.section && item.section !== lastSection;
          if (item.section) lastSection = item.section;
          const isActive = pathname === item.path;

          return (
            <div key={item.path}>
              {showSection && (
                <p className="px-3 pt-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {item.section}
                </p>
              )}
              <Link
                href={item.path}
                prefetch={false}
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>
      <div className="px-4 py-3 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by{' '}
          <a href="https://github.com/0xNetuser/flux-panel" target="_blank" rel="noopener noreferrer"
            className="hover:text-foreground transition-colors">flux-panel</a>
        </p>
      </div>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isAdmin, username, gostEnabled, xrayEnabled, loading } = useAuth();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panelVersion, setPanelVersion] = useState('');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
    }
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    getVersion().then((v) => setPanelVersion(v ? `v${v}` : ''));
  }, []);

  if (loading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  const handleNavigate = (_path: string) => {
    setSheetOpen(false);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <aside className="w-64 border-r bg-card flex-shrink-0">
          <SidebarContent pathname={pathname} isAdmin={isAdmin} gostEnabled={gostEnabled} xrayEnabled={xrayEnabled} onNavigate={handleNavigate} version={panelVersion} />
        </aside>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            {isMobile && (
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <SidebarContent pathname={pathname} isAdmin={isAdmin} gostEnabled={gostEnabled} xrayEnabled={xrayEnabled} onNavigate={handleNavigate} version={panelVersion} />
                </SheetContent>
              </Sheet>
            )}
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1">
                  {username}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push('/change-password')}>
                <KeyRound className="mr-2 h-4 w-4" />
                修改密码
              </DropdownMenuItem>
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                退出登录
              </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
