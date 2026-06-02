import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Layout
import AppShell from '@/components/layout/AppShell';
import AdminShell from '@/components/layout/AdminShell';

// Pages
import Login from '@/pages/Login';
import RoleRedirect from '@/pages/RoleRedirect';

// Parent pages
import ParentToday from '@/pages/parent/ParentToday';
import ParentWeek from '@/pages/parent/ParentWeek';
import CalendarSync from '@/pages/parent/CalendarSync';
import Notifications from '@/pages/parent/Notifications';
import ParentSettings from '@/pages/parent/ParentSettings';
import ParentPieces from '@/pages/parent/ParentPieces';
import ParentAbsence from '@/pages/parent/ParentAbsence';

// Dancer (student) pages
import DancerToday from '@/pages/dancer/DancerToday';
import DancerWeek from '@/pages/dancer/DancerWeek';
import DancerPieces from '@/pages/dancer/DancerPieces';
import DancerSettings from '@/pages/dancer/DancerSettings';

// Teacher pages
import TeacherToday from '@/pages/teacher/TeacherToday.jsx';
import TeacherWeek from '@/pages/teacher/TeacherWeek.jsx';
import TeacherCompetitions from '@/pages/teacher/TeacherCompetitions';
import TeacherPieces from '@/pages/teacher/TeacherPieces';
import TeacherCalendarSync from '@/pages/teacher/TeacherCalendarSync';
import TeacherSettings from '@/pages/teacher/TeacherSettings';
import TeacherAttendance from '@/pages/teacher/TeacherAttendance';

// Admin pages
import AdminSchedule from '@/pages/admin/AdminSchedule';
import AdminRehearsals from '@/pages/admin/AdminRehearsals';
import AdminPieces from '@/pages/admin/AdminPieces';
import AdminRoster from '@/pages/admin/AdminRoster';
import AdminCompetitions from '@/pages/admin/AdminCompetitions';
import AdminNotifications from '@/pages/admin/AdminNotifications';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminConflicts from '@/pages/admin/AdminConflicts';
import AdminBulkEnroll from '@/pages/admin/AdminBulkEnroll';
import AdminDigest from '@/pages/admin/AdminDigest';
import AdminAttendance from '@/pages/admin/AdminAttendance';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminBilling from '@/pages/admin/AdminBilling';
import AdminComms from '@/pages/admin/AdminComms';
import MonthlyCalendar from '@/pages/MonthlyCalendar';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="text-center">
          <span className="font-script text-3xl text-gold">MLDA</span>
          <div className="mt-4 w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // Not signed in → show the login screen (Base44's hosted login is gone).
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<RoleRedirect />} />
      {/* Role redirect */}
      <Route path="/" element={<RoleRedirect />} />

      {/* Parent routes */}
      <Route element={<AppShell role="parent" />}>
        <Route path="/today" element={<ParentToday />} />
        <Route path="/week" element={<ParentWeek />} />
        <Route path="/month" element={<MonthlyCalendar role="parent" />} />
        <Route path="/calendar-sync" element={<CalendarSync />} />
        <Route path="/pieces" element={<ParentPieces />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/absences" element={<ParentAbsence />} />
        <Route path="/settings" element={<ParentSettings />} />
      </Route>

      {/* Dancer (student) routes */}
      <Route element={<AppShell role="dancer" />}>
        <Route path="/dancer/today" element={<DancerToday />} />
        <Route path="/dancer/week" element={<DancerWeek />} />
        <Route path="/dancer/pieces" element={<DancerPieces />} />
        <Route path="/dancer/settings" element={<DancerSettings />} />
      </Route>

      {/* Teacher routes */}
      <Route element={<AppShell role="teacher" />}>
        <Route path="/teacher/today" element={<TeacherToday />} />
        <Route path="/teacher/week" element={<TeacherWeek />} />
        <Route path="/teacher/month" element={<MonthlyCalendar role="teacher" />} />
        <Route path="/teacher/pieces" element={<TeacherPieces />} />
        <Route path="/teacher/competitions" element={<TeacherCompetitions />} />
        <Route path="/teacher/calendar-sync" element={<TeacherCalendarSync />} />
        <Route path="/teacher/attendance" element={<TeacherAttendance />} />
        <Route path="/teacher/settings" element={<TeacherSettings />} />
      </Route>

      {/* Admin routes — desktop command center */}
      <Route element={<AdminShell />}>
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/admin/billing" element={<AdminBilling />} />
        <Route path="/admin/comms" element={<AdminComms />} />
        <Route path="/admin/schedule" element={<AdminSchedule />} />
        <Route path="/admin/month" element={<MonthlyCalendar role="admin" />} />
        <Route path="/admin/rehearsals" element={<AdminRehearsals />} />
        <Route path="/admin/pieces" element={<AdminPieces />} />
        <Route path="/admin/roster" element={<AdminRoster />} />
        <Route path="/admin/competitions" element={<AdminCompetitions />} />
        <Route path="/admin/notifications" element={<AdminNotifications />} />
        <Route path="/admin/settings" element={<AdminSettings />} />
        <Route path="/admin/conflicts" element={<AdminConflicts />} />
        <Route path="/admin/enroll" element={<AdminBulkEnroll />} />
        <Route path="/admin/digest" element={<AdminDigest />} />
        <Route path="/admin/attendance" element={<AdminAttendance />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App