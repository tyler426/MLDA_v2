import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

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
        
        // Check if admin
        if (user.role === 'admin') {
          setRole('admin');
          setLoading(false);
          return;
        }

        // Check if teacher
        const teachers = await base44.entities.Teacher.filter({ email: user.email });
        if (teachers.length > 0) {
          setRole('teacher');
          setTeacherRecord(teachers[0]);
          setLoading(false);
          return;
        }

        // Check if parent
        const parents = await base44.entities.ParentHousehold.filter({ email: user.email });
        if (parents.length > 0) {
          setRole('parent');
          setParentRecord(parents[0]);
          setLoading(false);
          return;
        }

        // Default to parent if no match found
        setRole('parent');
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