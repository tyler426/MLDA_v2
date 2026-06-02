import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/lib/supabaseClient';

// Role now comes straight from the `profiles.role` column (admin | teacher | parent),
// instead of being guessed by matching the user's email against tables.
export function useUserRole() {
  const [role, setRole] = useState(null);
  const [userEmail, setUserEmail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teacherRecord, setTeacherRecord] = useState(null);
  const [parentRecord, setParentRecord] = useState(null);

  useEffect(() => {
    async function determineRole() {
      try {
        const user = await base44.auth.me();
        if (!user) { setLoading(false); return; }

        setUserEmail(user.email);
        setRole(user.role || 'parent');

        if (user.role === 'teacher') {
          // Link the teacher record by profile, falling back to email.
          let { data: teachers } = await supabase
            .from('teachers').select('*').eq('profile_id', user.id);
          if (!teachers?.length) {
            ({ data: teachers } = await supabase
              .from('teachers').select('*').eq('email', user.email));
          }
          setTeacherRecord(teachers?.[0] || null);
        } else if (!user.role || user.role === 'parent') {
          const { data } = await supabase
            .from('household_members')
            .select('households(*)')
            .eq('profile_id', user.id)
            .order('is_primary', { ascending: false })
            .limit(1);
          setParentRecord(data?.[0]?.households || null);
        }

        setLoading(false);
      } catch (e) {
        console.error('Error determining role:', e);
        setLoading(false);
      }
    }
    determineRole();
  }, []);

  return { role, userEmail, loading, teacherRecord, parentRecord };
}
