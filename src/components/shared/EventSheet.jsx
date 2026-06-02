import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { formatTime } from '@/lib/scheduleUtils';
import { X, Clock, MapPin, Music, Users } from 'lucide-react';

function endFromDuration(start, hours) {
  if (!start || !hours) return '';
  const [h, m] = start.split(':').map(Number);
  const t = h * 60 + m + Math.round(hours * 60);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

// Detail sheet for any scheduleable event that isn't a regular class:
// rehearsal blocks and space bookings (rehearsal / private). Read-only.
export default function EventSheet({ event, kind = 'rehearsal', onClose }) {
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ['teachers'], queryFn: () => base44.entities.Teacher.list() });

  if (!event) return null;
  const isPrivate = kind === 'booking' && event.type === 'private';
  const accent = isPrivate ? '#c8a464' : '#3aa89f';
  const heading = kind === 'rehearsal' ? 'Rehearsal' : isPrivate ? 'Private lesson' : 'Rehearsal booking';

  const studio = studios.find(s => s.id === event.studio_id);
  const teacher = teachers.find(t => t.id === event.teacher_id);
  const end = event.end_time || endFromDuration(event.start_time, event.duration_hours);
  const eventPieces = (event.piece_ids || []).map(id => pieces.find(p => p.id === id)).filter(Boolean);
  const eventDancers = (event.dancer_ids || []).map(id => dancers.find(d => d.id === id)).filter(Boolean);

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center" style={{ background: 'rgba(0,0,0,.55)' }} onClick={onClose}>
      <div className="w-full max-w-[440px] bg-card border border-border border-b-0 rounded-t-[28px] p-5 pb-7 max-h-[86%] overflow-y-auto animate-[fade_.25s_ease]" onClick={e => e.stopPropagation()}>
        <div className="w-9 h-1 rounded-full bg-border mx-auto mb-3" />
        <div className="flex items-start justify-between">
          <div>
            <span className="text-[9.5px] tracking-[0.14em] uppercase font-semibold" style={{ color: accent }}>{heading}</span>
            <div className="font-serif text-[26px] font-semibold mt-1.5">
              {eventPieces.length === 1 ? `"${eventPieces[0].title}"` : eventPieces.length > 1 ? `${eventPieces.length} routines` : heading}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2.5 my-4">
          <div className="bg-secondary rounded-xl p-3">
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 flex items-center gap-1"><Clock className="w-3 h-3" />Time</div>
            <div className="font-serif text-[17px] mt-1">{formatTime(event.start_time)}{end ? `–${formatTime(end)}` : ''}</div>
          </div>
          <div className="bg-secondary rounded-xl p-3">
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 flex items-center gap-1"><MapPin className="w-3 h-3" />Studio</div>
            <div className="font-serif text-[17px] mt-1">{studio ? studio.name : '—'}</div>
          </div>
        </div>

        {eventPieces.length > 0 && (
          <>
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 mb-2 flex items-center gap-1"><Music className="w-3 h-3" />{kind === 'rehearsal' ? 'Pieces being called' : 'Routines'}</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {eventPieces.map(p => <span key={p.id} className="text-[12px] px-2.5 py-1 rounded-full" style={{ background: 'rgba(200,164,100,.12)', color: '#c8a464' }}>{p.title}{p.level ? ` · ${p.level}` : ''}</span>)}
            </div>
          </>
        )}

        {eventDancers.length > 0 && (
          <>
            <div className="text-[9.5px] tracking-[0.14em] uppercase text-muted-2 mb-2 flex items-center gap-1"><Users className="w-3 h-3" />{isPrivate ? 'Student(s)' : 'Dancers called'}</div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {eventDancers.map(d => <span key={d.id} className="text-[12px] px-2.5 py-1 rounded-full bg-secondary text-muted-foreground">{d.first_name} {d.last_name}</span>)}
            </div>
          </>
        )}

        {teacher && <div className="text-[12.5px] text-muted-foreground mb-1">With {teacher.first_name} {teacher.last_name}</div>}
        {event.notes && <div className="text-[12.5px] text-muted-2 italic mt-1">{event.notes}</div>}
      </div>
    </div>
  );
}
