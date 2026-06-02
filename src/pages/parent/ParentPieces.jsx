import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import { todayDateStr } from '@/lib/scheduleUtils';
import { tzAbbrev } from '@/lib/dateUtils';
import { Shirt, Play, Pause, ChevronRight } from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { toast } from 'sonner';

const STYLE_PALETTE = ['#2c9089', '#7c6fcf', '#c8a464', '#d97a5e', '#5a9bd4', '#cf6f9c'];
function styleColor(s = '') { let n = 0; for (const c of s) n += c.charCodeAt(0); return STYLE_PALETTE[n % STYLE_PALETTE.length]; }
function fmtCallTime(t) { if (!t) return null; const [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`; }

export default function ParentPieces() {
  const { data: household } = useMyHousehold();
  const [tab, setTab] = useState('costumes');
  const [playing, setPlaying] = useState(null);
  const audioRef = useRef(null);

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: costumes = [] } = useQuery({ queryKey: ['costumes'], queryFn: () => base44.entities.Costume.list() });
  const { data: comps = [] } = useQuery({ queryKey: ['competitions'], queryFn: () => base44.entities.CompetitionWeekend.list() });
  const { data: entries = [] } = useQuery({ queryKey: ['compEntries'], queryFn: () => base44.entities.CompetitionEntry.list() });

  const dancerIds = new Set(dancers.map(d => d.id));
  const myPieceIds = new Set(pieceCasts.filter(pc => dancerIds.has(pc.dancer_id)).map(pc => pc.piece_id));
  const myPieces = pieces.filter(p => myPieceIds.has(p.id));
  const myCostumes = costumes.filter(c => dancerIds.has(c.dancer_id));
  const callTimeFor = pid => {
    const e = entries.find(e => e.piece_id === pid);
    if (!e?.call_time) return null;
    const w = comps.find(c => c.id === e.competition_weekend_id);
    const tz = w ? tzAbbrev(w.timezone, w.start_date) : '';
    return `${fmtCallTime(e.call_time)}${tz ? ` ${tz}` : ''}`;
  };

  const upcoming = comps.filter(c => c.start_date && c.start_date >= todayDateStr()).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const nextComp = upcoming[0];
  const compDays = nextComp ? differenceInCalendarDays(parseISO(nextComp.start_date), new Date()) : null;

  const togglePlay = (piece) => {
    if (!piece.music_url) { toast('No mix uploaded yet for this routine.'); return; }
    if (playing === piece.id) { audioRef.current?.pause(); setPlaying(null); return; }
    if (audioRef.current) audioRef.current.pause();
    audioRef.current = new Audio(piece.music_url);
    audioRef.current.play().catch(() => toast.error('Could not play this mix'));
    audioRef.current.onended = () => setPlaying(null);
    setPlaying(piece.id);
  };

  return (
    <div className="animate-[fade_.32s_ease] px-5">
      <div className="pt-1">
        <div className="text-[9.5px] tracking-[0.26em] uppercase text-gold font-semibold">Competition season</div>
        <h1 className="font-serif text-[25px] font-semibold mt-1">{nextComp ? `Road to ${nextComp.name}` : 'Competitions'}</h1>
      </div>

      {/* hero */}
      {nextComp && (
        <div className="mt-4 rounded-2xl border p-5" style={{ borderColor: 'rgba(200,164,100,.32)', background: 'radial-gradient(120% 90% at 80% 0%,rgba(200,164,100,.18),transparent 55%),linear-gradient(180deg,#1b1712,#121110)' }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[9.5px] tracking-[0.26em] uppercase text-gold font-semibold">{nextComp.venue || 'Venue TBA'}</div>
              <div className="font-serif text-[28px] font-semibold mt-1.5 mb-0.5">{nextComp.name}</div>
              <div className="text-[12.5px] text-muted-foreground">{nextComp.start_date}{nextComp.end_date ? ` – ${nextComp.end_date}` : ''}</div>
            </div>
            <div className="text-center">
              <div className="font-serif text-[50px] leading-[0.8] text-gold">{compDays}</div>
              <div className="text-[8.5px] tracking-[0.18em] text-muted-2">DAYS OUT</div>
            </div>
          </div>
          {upcoming.length > 1 && (
            <div className="flex gap-2 mt-4">
              {upcoming.slice(0, 2).map((c, i) => (
                <div key={c.id} className="flex-1 p-2.5 rounded-xl border" style={{ borderColor: i === 0 ? 'rgba(58,168,159,.35)' : 'var(--border)', background: i === 0 ? 'rgba(44,144,137,.16)' : 'transparent' }}>
                  <div className="text-[12px] font-semibold">{c.name}</div>
                  <div className="text-[10.5px] text-muted-2 mt-0.5">{c.start_date}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* segmented */}
      <div className="mt-4 flex gap-1.5 bg-[#1d1a15] border border-border rounded-full p-1">
        {[['costumes', 'Costumes'], ['routines', 'Routines'], ['music', 'Music']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex-1 text-[11.5px] font-semibold py-2 rounded-full transition-colors ${tab === k ? 'bg-primary text-[#06110f]' : 'text-muted-foreground'}`}>{l}</button>
        ))}
      </div>

      <div className="mt-4 pb-2 space-y-2.5">
        {tab === 'costumes' && (myCostumes.length === 0
          ? <Empty msg="No costumes assigned yet." />
          : myCostumes.map(c => (
            <div key={c.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-xl flex items-center justify-center flex-none" style={{ background: '#1d1a15', color: '#c8a464' }}><Shirt className="w-[18px] h-[18px]" /></div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">{c.name || 'Costume'}</div>
                <div className="flex gap-2 mt-1.5">
                  <span className="text-[10.5px] px-2.5 py-0.5 rounded-full" style={{ background: c.paid ? 'rgba(44,144,137,.16)' : 'rgba(217,122,94,.16)', color: c.paid ? '#3aa89f' : '#d97a5e' }}>{c.paid ? 'Paid' : 'Balance due'}</span>
                  <span className="text-[10.5px] px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.06)', color: c.fitted ? '#a89e90' : '#7d756a' }}>{c.fitted ? 'Fitted ✓' : 'Fitting needed'}</span>
                </div>
              </div>
              {!c.paid && c.balance_cents > 0 && (
                <button onClick={() => toast('Online payments are coming soon — please settle at the front desk.')}
                  className="bg-gold text-[#241c0a] rounded-full px-3 py-1.5 text-[11.5px] font-bold flex-none">${(c.balance_cents / 100).toFixed(0)}</button>
              )}
            </div>
          )))}

        {tab === 'routines' && (myPieces.length === 0
          ? <Empty msg="Not cast in any routines yet." />
          : myPieces.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-[7px] h-[7px] rounded-full" style={{ background: styleColor(p.title) }} />
                  <span className="text-[9.5px] tracking-[0.14em] uppercase" style={{ color: styleColor(p.title) }}>{p.level || 'Routine'}</span>
                </div>
                {callTimeFor(p.id) && <span className="text-[11px] px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(200,164,100,.14)', color: '#c8a464' }}>Call {callTimeFor(p.id)}</span>}
              </div>
              <div className="font-serif text-[21px] font-semibold mt-1.5 mb-0.5">"{p.title}"</div>
              <div className="text-[12px] text-muted-foreground">{[p.duration, p.choreographer].filter(Boolean).join(' · ') || 'Details to come'}</div>
            </div>
          )))}

        {tab === 'music' && (myPieces.length === 0
          ? <Empty msg="No routines yet." />
          : myPieces.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-2xl p-3.5 flex items-center gap-3">
              <button onClick={() => togglePlay(p)} className="w-10 h-10 rounded-full flex items-center justify-center flex-none text-[#06110f]" style={{ background: p.music_url ? '#2c9089' : '#3a3630' }}>
                {playing === p.id ? <Pause className="w-[18px] h-[18px]" /> : <Play className="w-[18px] h-[18px]" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold truncate">"{p.title}"</div>
                <div className="text-[11px] text-muted-2 mt-0.5">{p.music_url ? `Final mix · ${p.duration || ''}` : 'Mix not uploaded yet'}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-2" />
            </div>
          )))}
      </div>
    </div>
  );
}

function Empty({ msg }) {
  return <div className="bg-card border border-border rounded-2xl p-6 text-center text-[13px] text-muted-2">{msg}</div>;
}
