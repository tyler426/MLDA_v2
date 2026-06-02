import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useMyDancer } from '@/lib/useMyDancer';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Music } from 'lucide-react';

export default function DancerPieces() {
  const { data: dancer } = useMyDancer();

  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: pieceCasts = [] } = useQuery({ queryKey: ['pieceCasts'], queryFn: () => base44.entities.PieceCast.list() });

  const myPieceIds = pieceCasts.filter(pc => pc.dancer_id === dancer?.id).map(pc => pc.piece_id);
  const myPieces = pieces.filter(p => myPieceIds.includes(p.id));

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <div className="pt-4 mb-4"><SectionLabel>My Pieces</SectionLabel></div>

      {myPieces.length === 0 ? (
        <EmptyState message="You're not cast in any pieces yet." />
      ) : (
        <div className="space-y-2">
          {myPieces.map(p => (
            <div key={p.id} className="bg-card border border-border rounded-lg p-4 flex items-start gap-3">
              <Music className="w-4 h-4 text-gold mt-0.5 shrink-0" />
              <div>
                <p className="font-body text-sm font-medium text-foreground">{p.title}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  {p.choreographer && <span className="text-[10px] text-muted-foreground">Choreo: {p.choreographer}</span>}
                  {p.level && <span className="text-[10px] text-gold">{p.level}</span>}
                  {p.season && <span className="text-[10px] text-warm-gray">{p.season}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
