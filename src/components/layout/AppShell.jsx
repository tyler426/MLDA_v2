import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { CalendarDays, Clock, Settings, Music, Trophy, Home, Mail, User, LogOut, Users, Sparkles } from 'lucide-react';

// Spotlight mobile shell — phone-centered column + bottom tab bar.
// Primary tabs match the design (5 each); secondary features (Month, Absences,
// Calendar Sync) are reached from inside the "You"/Settings screens.
const parentNav = [
  { label: 'Home', path: '/today', icon: Home },
  { label: 'Schedule', path: '/week', icon: CalendarDays },
  { label: 'Compete', path: '/pieces', icon: Trophy },
  { label: 'Inbox', path: '/notifications', icon: Mail },
  { label: 'You', path: '/settings', icon: User },
];

const dancerNav = [
  { label: 'Today', path: '/dancer/today', icon: Clock },
  { label: 'Week', path: '/dancer/week', icon: CalendarDays },
  { label: 'Pieces', path: '/dancer/pieces', icon: Music },
  { label: 'Profile', path: '/dancer/settings', icon: User },
];

const teacherNav = [
  { label: 'Today', path: '/teacher/today', icon: Clock },
  { label: 'Schedule', path: '/teacher/week', icon: CalendarDays },
  { label: 'Dancers', path: '/teacher/dancers', icon: Users },
  { label: 'Pieces', path: '/teacher/pieces', icon: Music },
  { label: 'Privates', path: '/teacher/privates', icon: Sparkles },
  { label: 'Settings', path: '/teacher/settings', icon: Settings },
];

export default function AppShell({ role }) {
  const location = useLocation();
  const { logout } = useAuth();
  const nav = role === 'teacher' ? teacherNav : role === 'dancer' ? dancerNav : parentNav;

  return (
    <div className="mx-auto w-full max-w-[440px] min-h-screen flex flex-col relative shadow-[0_0_80px_-20px_rgba(0,0,0,0.8)]">
      {/* Slim brand bar */}
      <header className="flex-none flex items-center justify-between px-5 py-3">
        <span className="font-serif text-[18px] font-semibold text-gold">MLDA</span>
        <button onClick={() => logout()} className="flex items-center gap-1.5 text-muted-2 hover:text-foreground transition-colors">
          <span className="font-caps text-[9px] uppercase tracking-[0.2em]">Sign out</span>
          <LogOut className="w-[15px] h-[15px]" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-50 border-t border-border"
        style={{ background: 'rgba(14,13,12,.94)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-start justify-around px-2 pt-3 pb-2">
          {nav.map(({ label, path, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link key={path} to={path}
                className={`flex flex-col items-center gap-1.5 px-1.5 transition-colors ${isActive ? 'text-teal-bright' : 'text-muted-2 hover:text-muted-foreground'}`}
              >
                <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2 : 1.6} />
                <span className="text-[9.5px] tracking-[0.02em]">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
