import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// Uploads an image to the public `photos` bucket and returns its URL via onChange.
export default function PhotoUpload({ value, onChange, label = 'Photo' }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  const handle = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `dancers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('photos').getPublicUrl(path);
      onChange(data.publicUrl);
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
            : value ? <img src={value} alt="" className="w-full h-full object-cover" />
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
