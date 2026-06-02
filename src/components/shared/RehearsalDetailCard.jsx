import { Music, User, Clock, MapPin } from 'lucide-react';
import { formatTime } from '@/lib/scheduleUtils';

/**
 * Displays rehearsal block detail for parents/teachers:
 * date, time, studio, pieces being called, dancers in those pieces.
 */
export default function RehearsalDetailCard({ rehearsal, pieces, dancers, studios }) {
  const studio = studios?.find(s => s.id === rehearsal.studio_id);
  const rPieces = (rehearsal.piece_ids || []).map(pid => pieces?.find(p => p.id === pid)).filter(Boolean);

  // Collect all dancer IDs across pieces (from PieceCast passed in)
  const calledDancers = dancers || [];

  return (
    <div className="bg-gold/5 border border-gold/20 rounded-lg p-3 mt-2">
      <div className="flex items-center gap-1.5 mb-2">
        <Music className="w-3.5 h-3.5 text-gold" />
        <span className="font-caps text-[10px] uppercase tracking-[0.15em] text-gold">Rehearsal</span>
        {studio && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <MapPin className="w-3 h-3" />Studio {studio.name}
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
        <Clock className="w-3 h-3" />
        {formatTime(rehearsal.start_time)} – {formatTime(rehearsal.end_time)}
      </p>

      {rPieces.length > 0 && (
        <div className="mb-2">
          <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1">Numbers</p>
          <div className="flex flex-col gap-1">
            {rPieces.map(p => (
              <div key={p.id} className="flex items-baseline gap-1.5">
                <span className="bg-gold/10 text-gold text-[10px] font-caps uppercase tracking-[0.1em] px-2 py-0.5 rounded">
                  {p.title}
                </span>
                {p.level && <span className="text-[10px] text-muted-foreground">{p.level}</span>}
                {p.choreographer && <span className="text-[10px] text-warm-gray italic">choreo: {p.choreographer}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {calledDancers.length > 0 && (
        <div>
          <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1">Dancers Called</p>
          <div className="flex flex-wrap gap-1">
            {calledDancers.map(d => (
              <span key={d.id} className="flex items-center gap-1 bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded">
                <User className="w-2.5 h-2.5" />{d.first_name} {d.last_name}
              </span>
            ))}
          </div>
        </div>
      )}

      {rehearsal.notes && (
        <p className="mt-2 text-[10px] text-muted-foreground italic">{rehearsal.notes}</p>
      )}
    </div>
  );
}