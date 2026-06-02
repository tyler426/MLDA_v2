import { signUrl } from '@/lib/storage';
import { toast } from 'sonner';

// Opens a private-bucket document via a short-lived signed URL (no public exposure).
export default function SignedDocLink({ path, bucket = 'uploads', className, children }) {
  if (!path) return null;
  const open = async (e) => {
    e.preventDefault();
    const url = await signUrl(bucket, path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('Could not open document');
  };
  return <a href="#" onClick={open} className={className}>{children}</a>;
}
