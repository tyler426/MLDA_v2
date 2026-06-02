import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Resolves the dancer record that IS the logged-in student (dancers.profile_id).
export function useMyDancer() {
  return useQuery({
    queryKey: ['myDancer'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('dancers').select('*').eq('profile_id', user.id).limit(1);
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });
}
