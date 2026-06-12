import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import SignedImage from '@/components/shared/SignedImage';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Uploads an image to the public `photos` bucket and returns its URL via onChange.
export default function PhotoUpload({ value, onChange, label = 'Photo' }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const OK = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'];
    if (!file.type.startsWith('image/') || !OK.includes(ext)) { toast.error('Use a JPG, PNG, or WebP image'); return; }
    if (file.size > 6 * 1024 * 1024) { toast.error('Image too large (max 6 MB)'); return; }
    setBusy(true);
    try {
      const path = `dancers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true });
      if (error) throw error;
      onChange(path); // store the private path; displayed via signed URLs
      toast.success('Photo uploaded');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <span className="text-xs text-muted-foreground mb-1 block">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-16 h-16 rounded-xl bg-secondary border border-border overflow-hidden flex items-center justify-center text-muted-2 flex-none">
          {busy ? <Loader2 className="w-5 h-5 animate-spin" />
            : value ? <SignedImage path={value} className="w-full h-full object-cover" fallback={<Camera className="w-5 h-5" />} />
            : <Camera className="w-5 h-5" />}
        </button>
        <div className="text-[11px] text-muted-2">
          {value ? 'Tap to replace' : 'Tap to upload a photo'}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handle} className="hidden" />
      </div>
    </div>
  );
}
