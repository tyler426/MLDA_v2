import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyHousehold } from '@/lib/useMyHousehold';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Music, User, ChevronDown } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ParentPieces() {
  const [expandedPiece, setExpandedPiece] = useState(null);
  const [viewMode, setViewMode] = useState('family'); // 'family' or individual dancer
  const { data: household } = useMyHousehold();

  const { data: dancers = [] } = useQuery({
    queryKey: ['dancers', household?.id],
    queryFn: () => base44.entities.Dancer.filter({ parent_household_id: household.id }),
    enabled: !!household?.id,
  });

  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });
  const { data: allDancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.list() });

  const dancerIds = new Set(dancers.map(d => d.id));

  // For each piece, find which of our dancers are cast
  const myPieces = pieces
    .map(piece => {
      const allCast = pieceCasts.filter(pc => pc.piece_id === piece.id);
      const myDancersInPiece = allCast.filter(pc => dancerIds.has(pc.dancer_id)).map(pc => allDancers.find(d => d.id === pc.dancer_id)).filter(Boolean);
      return { piece, myDancersInPiece, totalCast: allCast.length };
    })
    .filter(p => p.myDancersInPiece.length > 0);

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <SectionLabel className="pt-4 mb-4">Our Pieces</SectionLabel>

      {dancers.length === 0 ? (
        <EmptyState message="No dancers linked yet" sub="Ask your studio admin to add your household" />
      ) : myPieces.length === 0 ? (
        <EmptyState message="No pieces assigned yet" sub="Cast lists will appear here once assigned" />
      ) : (
        <>
          {/* View mode toggle */}
          {dancers.length > 1 && (
            <div className="flex items-center gap-2 mb-3">
              <span className="font-caps text-[9px] uppercase tracking-[0.15em] text-muted-foreground">View:</span>
              <button
                onClick={() => setViewMode('family')}
                className={`px-2.5 py-0.5 rounded font-caps text-[9px] uppercase tracking-[0.1em] border transition-colors ${
                  viewMode === 'family'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                Family
              </button>
              <button
                onClick={() => setViewMode('individual')}
                className={`px-2.5 py-0.5 rounded font-caps text-[9px] uppercase tracking-[0.1em] border transition-colors ${
                  viewMode === 'individual'
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-transparent text-muted-foreground border-border hover:text-foreground'
                }`}
              >
                By Dancer
              </button>
            </div>
          )}

          {/* Family view */}
          {viewMode === 'family' && (
            <div className="space-y-3">
              {myPieces.map(({ piece, myDancersInPiece, totalCast }, i) => (
                <motion.div
                  key={piece.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-card border border-border rounded-lg p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-8 h-8 rounded-md bg-gold/10 flex items-center justify-center flex-shrink-0">
                      <Music className="w-4 h-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-body font-semibold text-foreground text-sm">{piece.title}</h3>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {piece.level && (
                          <span className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">{piece.level}</span>
                        )}
                        {piece.choreographer && (
                          <span className="text-[10px] text-muted-foreground italic">Choreo: {piece.choreographer}</span>
                        )}
                        {piece.season && (
                          <span className="text-[10px] text-muted-foreground">{piece.season}</span>
                        )}
                      </div>

                      {/* Our dancers in this piece */}
                      <div className="mt-2.5">
                        <p className="font-caps text-[9px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> Our dancer{myDancersInPiece.length !== 1 ? 's' : ''}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {myDancersInPiece.map(d => (
                            <span key={d.id} className="bg-primary/10 text-primary font-caps text-[10px] uppercase tracking-[0.08em] px-2 py-0.5 rounded">
                              {d.first_name} {d.last_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {totalCast > 0 && (
                        <p className="mt-2 text-[10px] text-muted-foreground">{totalCast} dancer{totalCast !== 1 ? 's' : ''} total in cast</p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Individual dancer view */}
          {viewMode === 'individual' && (
            <div className="space-y-3">
              {dancers.map((dancer, dancerIdx) => {
                const dancerPieces = myPieces.filter(p => p.myDancersInPiece.some(d => d.id === dancer.id));
                return (
                  <div key={dancer.id}>
                    <h3 className="font-body font-semibold text-foreground mb-2">{dancer.first_name} {dancer.last_name}</h3>
                    {dancerPieces.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic pl-2">No pieces assigned</p>
                    ) : (
                      <div className="space-y-2 pl-2">
                        {dancerPieces.map(({ piece, myDancersInPiece, totalCast }, i) => (
                          <motion.button
                            key={piece.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            onClick={() => setExpandedPiece(expandedPiece === piece.id ? null : piece.id)}
                            className="w-full text-left bg-card border border-border rounded-lg p-3 hover:bg-secondary/40 transition-colors"
                          >
                            <div className="flex items-start gap-2">
                              <Music className="w-3.5 h-3.5 text-gold mt-0.5 flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-body font-medium text-foreground text-sm">{piece.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {piece.level && (
                                    <span className="font-caps text-[9px] uppercase tracking-[0.1em] text-warm-gray">{piece.level}</span>
                                  )}
                                  {piece.season && (
                                    <span className="text-[9px] text-muted-foreground">{piece.season}</span>
                                  )}
                                </div>
                              </div>
                              <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${expandedPiece === piece.id ? 'rotate-180' : ''}`} />
                            </div>

                            {expandedPiece === piece.id && (
                              <div className="mt-2 pt-2 border-t border-border/50 space-y-2">
                                {piece.choreographer && (
                                  <p className="text-[9px] text-muted-foreground"><span className="font-caps">Choreo:</span> {piece.choreographer}</p>
                                )}
                                {totalCast > 0 && (
                                  <p className="text-[9px] text-muted-foreground">{totalCast} dancer{totalCast !== 1 ? 's' : ''} total in cast</p>
                                )}
                              </div>
                            )}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}