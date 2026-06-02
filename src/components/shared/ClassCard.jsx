import { Clock, MapPin, User } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ClassCard({ title, startTime, endTime, studioName, teacherName, level, isPulled, pullReason, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`bg-card border border-border rounded-lg p-4 ${isPulled ? 'opacity-60 border-l-2 border-l-gold' : ''} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-body font-medium text-foreground text-sm leading-tight">{title}</h3>
          {level && (
            <span className="inline-block mt-1 font-caps text-[10px] uppercase tracking-[0.15em] text-warm-gray">
              {level}
            </span>
          )}
        </div>
        {isPulled && (
          <span className="shrink-0 font-caps text-[10px] uppercase tracking-[0.12em] text-gold bg-gold/10 px-2 py-0.5 rounded">
            Rehearsal
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          {startTime} – {endTime}
        </span>
        {studioName && (
          <span className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            Studio {studioName}
          </span>
        )}
        {teacherName && (
          <span className="flex items-center gap-1.5">
            <User className="w-3 h-3" />
            {teacherName}
          </span>
        )}
      </div>

      {isPulled && pullReason && (
        <p className="mt-2 text-xs text-gold/80 italic">{pullReason}</p>
      )}
    </motion.div>
  );
}