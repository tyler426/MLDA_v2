import { useSignedUrl } from '@/lib/useSignedUrl';

// Renders an image from a private-bucket path via a signed URL; falls back while
// loading / when there's no photo.
export default function SignedImage({ path, bucket = 'photos', className, alt = '', fallback = null }) {
  const url = useSignedUrl(bucket, path);
  if (!path || !url) return fallback;
  return <img src={url} alt={alt} className={className} />;
}
