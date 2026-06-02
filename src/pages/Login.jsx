import { useState } from 'react';
import { supabase, IS_DEMO } from '@/lib/supabaseClient';
import { DEMO_USERS } from '@/api/demo/seed';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Email + password, with a magic-link fallback. Replaces Base44's hosted login.
export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState('password'); // 'password' | 'magic'
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const signInPassword = async (e) => {
    e.preventDefault();
    setLoading(true); setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setStatus({ type: 'error', msg: error.message });
    else window.location.href = '/';
  };

  const sendMagicLink = async (e) => {
    e.preventDefault();
    setLoading(true); setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setStatus({ type: 'error', msg: error.message });
    else setStatus({ type: 'ok', msg: 'Check your email for a sign-in link.' });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="font-script text-4xl text-gold">MLDA</span>
          <div className="font-caps text-[10px] uppercase tracking-[0.2em] text-warm-gray mt-1">Collective</div>
        </div>

        {IS_DEMO && (
          <div className="mb-6 space-y-2">
            <p className="text-center font-caps text-[10px] uppercase tracking-[0.15em] text-gold">Demo — tap a role</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_USERS.map(u => (
                <Button key={u.id} variant="outline" className="font-caps text-[10px] uppercase tracking-[0.1em]"
                  onClick={async () => { await supabase.auth.signInWithPassword({ email: u.email }); window.location.href = '/'; }}>
                  {u.role}
                </Button>
              ))}
            </div>
            <p className="text-center text-[10px] text-warm-gray pt-1">or use the form below</p>
          </div>
        )}

        <form onSubmit={mode === 'password' ? signInPassword : sendMagicLink} className="space-y-3">
          <Input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required />
          {mode === 'password' && (
            <Input type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required />
          )}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? '…' : mode === 'password' ? 'Sign In' : 'Send Magic Link'}
          </Button>
        </form>

        {status && (
          <p className={`text-sm mt-3 text-center ${status.type === 'error' ? 'text-red-500' : 'text-green-600'}`}>
            {status.msg}
          </p>
        )}

        <button
          onClick={() => { setMode(mode === 'password' ? 'magic' : 'password'); setStatus(null); }}
          className="w-full text-xs text-warm-gray hover:text-foreground mt-4 text-center"
        >
          {mode === 'password' ? 'Sign in with a magic link instead' : 'Use a password instead'}
        </button>
      </div>
    </div>
  );
}
