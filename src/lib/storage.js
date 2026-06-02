import { supabase } from '@/lib/supabaseClient';

// Create a short-lived signed URL for a private-bucket object.
// Accepts a storage path; passes full http(s) URLs through unchanged (legacy/public).
export async function signUrl(bucket, pathOrUrl, expires = 3600) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(pathOrUrl, expires);
  if (error) return null;
  return data?.signedUrl ?? null;
}
