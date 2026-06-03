import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import {
  LayoutGrid, CalendarDays, AlertTriangle, Music, FileText, Users, Trophy,
  ClipboardList, GraduationCap, DollarSign, Megaphone, Settings, Search, Bell, Calendar, Tent,
} from 'lucide-react';

// Desktop "command center" shell for the Admin side — Spotlight design system.
const STUDIO_NAV = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutGrid },
  { label: 'Schedule', path: '/admin/schedule', icon: CalendarDays },
  { label: 'Month', path: '/admin/month', icon: Calendar },
  { label: 'Conflicts', path: '/admin/conflicts', icon: AlertTriangle },
  { label: 'Rehearsals', path: '/admin/rehearsals', icon: Music },
  { label: 'Pieces', path: '/admin/pieces', icon: FileText },
  { label: 'Enrollment', path: '/admin/enroll', icon: GraduationCap },
  { label: 'Roster', path: '/admin/roster', icon: Users },
  { label: 'Competitions', path: '/admin/competitions', icon: Trophy },
  { label: 'Camps', path: '/admin/camps', icon: Tent },
  { label: 'Attendance', path: '/admin/attendance', icon: ClipboardList },
];
const OPS_NAV = [
  { label: 'Billing', path: '/admin/billing', icon: DollarSign },
  { label: 'Comms', path: '/admin/comms', icon: Megaphone },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

function initials(name = '') {
  const p = name.trim().split(' ');
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'A';
}

function NavItem({ item, active }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      className={`flex items-center gap-3 px-3 py-2 rounded-[10px] text-[13.5px] transition-colors ${
        active ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      }`}
    >
      <Icon className={`w-[19px] h-[19px] ${active ? 'text-teal-bright' : 'text-muted-2'}`} />
      {item.label}
    </Link>
  );
}

export default function AdminShell() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isActive = (p) => location.pathname === p || (p !== '/admin/dashboard' && location.pathname.startsWith(p));

  return (
    <div className="flex h-screen min-w-[1024px] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-[238px] flex-none bg-[#0d0c0b] border-r border-border flex flex-col px-4 py-5">
        <div className="flex items-center gap-3 px-2 pb-5">
          <div className="w-[38px] h-[38px] rounded-[11px] flex items-center justify-center font-serif font-bold text-[20px] text-[#1a1408]"
            style={{ background: 'linear-gradient(150deg,#c8a464,#9c7a3c)' }}>M</div>
          <div>
            <div className="font-serif text-[17px] font-semibold leading-none">MLDA</div>
            <div className="text-[11px] tracking-[0.24em] uppercase text-muted-2 mt-[3px]">Collective · Admin</div>
          </div>
        </div>

        <div className="text-[11px] tracking-[0.2em] uppercase text-muted-2 px-[10px] pt-2 pb-2">Studio</div>
        <nav className="flex flex-col gap-0.5">
          {STUDIO_NAV.map(item => <NavItem key={item.path} item={item} active={isActive(item.path)} />)}
        </nav>

        <div className="text-[11px] tracking-[0.2em] uppercase text-muted-2 px-[10px] pt-4 pb-2">Operations</div>
        <nav className="flex flex-col gap-0.5">
          {OPS_NAV.map(item => <NavItem key={item.path} item={item} active={isActive(item.path)} />)}
        </nav>

        <button
          onClick={() => logout()}
          className="mt-auto flex items-center gap-2.5 p-[11px] rounded-xl bg-secondary border border-border text-left hover:border-border/80 transition-colors"
        >
          <span className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-serif font-semibold text-[#0a0908] text-[13px] bg-primary">{initials(user?.full_name || user?.email)}</span>
          <span className="flex-1 min-w-0">
            <span className="block text-[12.5px] font-semibold truncate">{user?.full_name || 'Admin'}</span>
            <span className="block text-[10.5px] text-muted-2">Sign out</span>
          </span>
        </button>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex-none border-b border-border flex items-center gap-[18px] px-7 bg-background">
          <div className="flex items-center gap-2.5 bg-secondary border border-border rounded-[30px] px-4 py-2 w-[300px]">
            <Search className="w-4 h-4 text-muted-2" />
            <input
              placeholder="Search dancers, classes, families…"
              className="bg-transparent border-0 outline-none text-[13px] text-foreground placeholder:text-muted-2 flex-1"
            />
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <Link to="/admin/comms" className="w-[38px] h-[38px] rounded-[11px] bg-secondary border border-border text-muted-foreground flex items-center justify-center hover:text-foreground">
              <Megaphone className="w-[17px] h-[17px]" />
            </Link>
            <Link to="/admin/notifications" className="w-[38px] h-[38px] rounded-[11px] bg-secondary border border-border text-muted-foreground flex items-center justify-center relative hover:text-foreground">
              <Bell className="w-[17px] h-[17px]" />
              <span className="absolute top-2 right-[9px] w-[7px] h-[7px] rounded-full bg-coral" />
            </Link>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-7">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
