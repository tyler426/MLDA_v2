import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Lists caregiver logins linked to a household (with their profile).
export function useHouseholdMembers(householdId) {
  return useQuery({
    queryKey: ['householdMembers', householdId],
    enabled: !!householdId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('household_members')
        .select('id, relationship, is_primary, profile_id, profiles(full_name, email)')
        .eq('household_id', householdId)
        .order('is_primary', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
