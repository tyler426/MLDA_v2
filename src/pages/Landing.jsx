import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { motion } from 'framer-motion';

export default function Landing() {
  const [email, setEmail] = useState('');

  const handleSignIn = (e) => {
    e.preventDefault();
    base44.auth.redirectToLogin();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6">
      {/* Background grain is handled by CSS */}
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="w-full max-w-sm text-center"
      >
        {/* Wordmark */}
        <div className="mb-12">
          <h1 className="font-script text-5xl text-gold mb-1">MLDA</h1>
          <p className="font-caps text-sm uppercase tracking-[0.3em] text-foreground">Collective</p>
        </div>

        {/* Tagline */}
        <p className="font-serif text-lg italic text-muted-foreground mb-10">
          Your dancer's schedule,<br />always in your pocket.
        </p>

        {/* Sign-in */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-caps text-xs uppercase tracking-[0.15em] py-6"
          >
            Sign In
          </Button>
        </form>

        {/* Divider */}
        <div className="mt-16 mx-auto w-16 h-px bg-border" />

        {/* Brand values */}
        <p className="mt-6 font-caps text-[10px] uppercase tracking-[0.25em] text-warm-gray leading-relaxed">
          Lead &nbsp;·&nbsp; Support &nbsp;·&nbsp; Uplift &nbsp;·&nbsp; Inspire
        </p>
      </motion.div>
    </div>
  );
}