import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/lib/useUserRole';

export default function RoleRedirect() {
  const { role, loading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (role === 'admin') navigate('/admin/schedule', { replace: true });
    else if (role === 'teacher') navigate('/teacher/today', { replace: true });
    else navigate('/today', { replace: true });
  }, [role, loading, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <span className="font-script text-3xl text-gold">MLDA</span>
        <div className="mt-4 w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}