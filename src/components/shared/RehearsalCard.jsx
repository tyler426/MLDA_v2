import { Music, Users, Clock, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { formatTime } from '@/lib/scheduleUtils';

export default function RehearsalCard({ rehearsal, pieces = [], dancers = [], pieceCasts = [], studioName }) {
  const [expanded, setExpanded] = useState(false);

  const calledPieces = (rehearsal.piece_ids || [])
    .map(pid => pieces.find(p => p.id === pid))
    .filter(Boolean);

  // Use explicit dancer_ids if set, otherwise resolve from pieceCasts
  const calledDancerIds = rehearsal.dancer_ids?.length > 0
    ? rehearsal.dancer_ids
    : [...new Set((rehearsal.piece_ids || []).flatMap(pid => pieceCasts.filter(pc => pc.piece_id === pid).map(pc => pc.dancer_id)))];

  const calledDancers = calledDancerIds
    .map(did => dancers.find(d => d.id === did))
    .filter(Boolean);

  return (
    <div className="bg-primary/10 border border-primary/30 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-caps text-[10px] uppercase tracking-[0.15em] text-primary">Rehearsal</span>
            {studioName && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <MapPin className="w-3 h-3" />Studio {studioName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            <span>{formatTime(rehearsal.start_time)} – {formatTime(rehearsal.end_time)}</span>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Piece badges always visible */}
      {calledPieces.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {calledPieces.map(p => (
            <span key={p.id} className="inline-flex items-center gap-1 bg-gold/15 text-gold font-caps text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded">
              <Music className="w-2.5 h-2.5" />{p.title}
            </span>
          ))}
        </div>
      )}

      {/* Expanded: dancer list */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-primary/20">
          {calledDancers.length > 0 ? (
            <div>
              <p className="font-caps text-[11px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                <Users className="w-3 h-3" /> Called ({calledDancers.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {calledDancers.map(d => (
                  <span key={d.id} className="text-[11px] bg-secondary text-foreground px-2 py-0.5 rounded font-body">
                    {d.first_name} {d.last_name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">No specific dancers listed</p>
          )}
          {rehearsal.notes && (
            <p className="mt-2 text-xs text-muted-foreground italic">{rehearsal.notes}</p>
          )}
        </div>
      )}
    </div>
  );
}