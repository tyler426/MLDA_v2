import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Studio-editable lists (programs/groups + levels). Names change year to year,
// so these live in app_settings and are managed from Admin → Settings.
export function useStudioConfig() {
  return useQuery({
    queryKey: ['studioConfig'],
    queryFn: async () => {
      const { data } = await supabase.from('app_settings').select('programs, levels').eq('id', 1).maybeSingle();
      return {
        programs: Array.isArray(data?.programs) ? data.programs : [],
        levels: Array.isArray(data?.levels) ? data.levels : [],
      };
    },
  });
}
