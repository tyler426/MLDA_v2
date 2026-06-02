import { motion } from 'framer-motion';

export default function PickupTimeHero({ time, dancerName }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="text-center py-8"
    >
      <p className="font-caps text-[10px] uppercase tracking-[0.25em] text-warm-gray mb-2">
        {dancerName ? `Pickup for ${dancerName}` : 'Pickup Time'}
      </p>
      <h1 className="font-display text-6xl sm:text-7xl text-foreground leading-none">
        PICKUP {time || '—'}
      </h1>
      <div className="mt-3 mx-auto w-12 h-px bg-gold/40" />
    </motion.div>
  );
}