import { Outlet, Link, useLocation } from 'react-router-dom';
import { CalendarDays, Clock, Bell, Settings, LayoutGrid, Users, Music, Trophy, FileText, AlertTriangle, Calendar, ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const parentNav = [
  { label: 'Today', path: '/today', icon: Clock },
  { label: 'Week', path: '/week', icon: CalendarDays },
  { label: 'Month', path: '/month', icon: Calendar },
  { label: 'Pieces', path: '/pieces', icon: Music },
  { label: 'Alerts', path: '/notifications', icon: Bell },
  { label: 'Absences', path: '/absences', icon: ClipboardList },
  { label: 'Settings', path: '/settings', icon: Settings },
];

const dancerNav = [
  { label: 'Today', path: '/dancer/today', icon: Clock },
  { label: 'Week', path: '/dancer/week', icon: CalendarDays },
  { label: 'Pieces', path: '/dancer/pieces', icon: Music },
  { label: 'Profile', path: '/dancer/settings', icon: Settings },
];

const teacherNav = [
  { label: 'Today', path: '/teacher/today', icon: Clock },
  { label: 'Week', path: '/teacher/week', icon: CalendarDays },
  { label: 'Month', path: '/teacher/month', icon: Calendar },
  { label: 'Pieces', path: '/teacher/pieces', icon: Music },
  { label: 'Comps', path: '/teacher/competitions', icon: Trophy },
  { label: 'Attend.', path: '/teacher/attendance', icon: ClipboardList },
  { label: 'Settings', path: '/teacher/settings', icon: Settings },
];

const adminNav = [
  { label: 'Schedule', path: '/admin/schedule', icon: LayoutGrid },
  { label: 'Month', path: '/admin/month', icon: Calendar },
  { label: 'Conflicts', path: '/admin/conflicts', icon: AlertTriangle },
  { label: 'Rehearsals', path: '/admin/rehearsals', icon: Music },
  { label: 'Pieces', path: '/admin/pieces', icon: FileText },
  { label: 'Roster', path: '/admin/roster', icon: Users },
  { label: 'Comps', path: '/admin/competitions', icon: Trophy },
  { label: 'Attend.', path: '/admin/attendance', icon: ClipboardList },
  { label: 'Settings', path: '/admin/settings', icon: Settings },
];

export default function AppShell({ role }) {
  const location = useLocation();
  const nav = role === 'admin' ? adminNav : role === 'teacher' ? teacherNav : role === 'dancer' ? dancerNav : parentNav;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-script text-xl text-gold">MLDA</span>
          <span className="font-caps text-[10px] uppercase tracking-[0.2em] text-warm-gray">Collective</span>
        </div>
        <button 
          onClick={() => base44.auth.logout()}
          className="font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray hover:text-foreground transition-colors"
        >
          Sign Out
        </button>
      </header>

      {/* Main content */}
      <main className="flex-1 pb-20 overflow-y-auto">
        <Outlet />
      </main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-md border-t border-border">
        <div className="flex items-center justify-around px-2 py-2 max-w-lg mx-auto">
          {nav.map(({ label, path, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-caps text-[9px] uppercase tracking-[0.1em]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}