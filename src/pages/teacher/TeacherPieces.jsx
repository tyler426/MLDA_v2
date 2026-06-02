import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Music, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { motion } from 'framer-motion';

function PieceCard({ piece, dancers, pieceCasts, index }) {
  const [expanded, setExpanded] = useState(false);
  const castIds = pieceCasts.filter(pc => pc.piece_id === piece.id).map(pc => pc.dancer_id);
  const cast = castIds.map(id => dancers.find(d => d.id === id)).filter(Boolean);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card border border-border rounded-lg p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 w-8 h-8 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0">
            <Music className="w-4 h-4 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-body font-semibold text-foreground text-sm">{piece.title}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              {piece.level && (
                <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">{piece.level}</span>
              )}
              {piece.season && (
                <span className="text-[10px] text-muted-foreground">{piece.season}</span>
              )}
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> {cast.length} dancer{cast.length !== 1 ? 's' : ''} cast
            </p>
          </div>
        </div>
        {cast.length > 0 && (
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground transition-colors p-1 flex-shrink-0">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && cast.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="font-caps text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-2">Cast</p>
          <div className="flex flex-wrap gap-1">
            {cast.map(d => (
              <span key={d.id} className="bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded font-body">
                {d.first_name} {d.last_name}
                {d.level && <span className="ml-1 text-warm-gray">({d.level})</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function TeacherPieces() {
  const [userEmail, setUserEmail] = useState(null);
  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });

  // Pieces this teacher choreographs
  const myPieces = pieces.filter(p => p.choreographer && teacher && (
    p.choreographer.toLowerCase().includes(teacher.first_name.toLowerCase()) ||
    p.choreographer.toLowerCase().includes(teacher.last_name.toLowerCase())
  ));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[25px] font-semibold mb-4 -tracking-[0.01em]">My pieces</h1>

      {myPieces.length === 0 ? (
        <EmptyState
          message="No pieces assigned yet"
          sub="Pieces where you are listed as choreographer will appear here"
        />
      ) : (
        <div className="space-y-3">
          {myPieces.map((piece, i) => (
            <PieceCard
              key={piece.id}
              piece={piece}
              dancers={dancers}
              pieceCasts={pieceCasts}
              index={i}
            />
          ))}
        </div>
      )}
    </div>
  );
}