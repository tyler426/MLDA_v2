import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Resolves the current caregiver's household via household_members (the new
// multi-login model), replacing the old "match my email to a household" lookup.
// A caregiver in more than one household gets the first; a switcher can be added later.
export function useMyHousehold() {
  return useQuery({
    queryKey: ['myHousehold'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('household_members')
        .select('household_id, households(*)')
        .eq('profile_id', user.id)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data?.[0]?.households ?? null;
    },
  });
}
