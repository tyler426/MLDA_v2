import { useQuery } from '@tanstack/react-query';
import { signUrl } from '@/lib/storage';

// Resolve a private-bucket path to a signed URL (cached ~50 min, under the 1h expiry).
export function useSignedUrl(bucket, path) {
  const { data } = useQuery({
    queryKey: ['signedUrl', bucket, path],
    enabled: !!path,
    queryFn: () => signUrl(bucket, path),
    staleTime: 50 * 60 * 1000,
  });
  return data ?? null;
}
