import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import SectionLabel from '@/components/shared/SectionLabel';
import EmptyState from '@/components/shared/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { getWeekDates, formatTime, DAY_NAMES } from '@/lib/scheduleUtils';
import { Clock, MapPin, Plus, Music, User, X } from 'lucide-react';

function computeEndTime(startTime, durationHours) {
  if (!startTime || !durationHours) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMins = h * 60 + m + durationHours * 60;
  return `${String(Math.floor(totalMins / 60)).padStart(2, '0')}:${String(totalMins % 60).padStart(2, '0')}`;
}
import { motion } from 'framer-motion';
import BookSpaceDialog from '@/components/teacher/BookSpaceDialog';
import { toast } from 'sonner';

export default function TeacherWeek() {
  const [userEmail, setUserEmail] = useState(null);
  const [showBookSpace, setShowBookSpace] = useState(false);

  useEffect(() => { base44.auth.me().then(u => setUserEmail(u?.email)); }, []);

  const { data: teacher } = useQuery({
    queryKey: ['teacherRecord', userEmail],
    queryFn: () => base44.entities.Teacher.filter({ email: userEmail }),
    enabled: !!userEmail,
    select: d => d[0],
  });

  const { data: allClasses = [] } = useQuery({ queryKey: ['allClasses'], queryFn: () => base44.entities.DanceClass.list() });
  const { data: studios = [] } = useQuery({ queryKey: ['studios'], queryFn: () => base44.entities.Studio.list() });
  const { data: pieces = [] } = useQuery({ queryKey: ['pieces'], queryFn: () => base44.entities.Piece.list() });
  const { data: dancers = [] } = useQuery({ queryKey: ['allDancers'], queryFn: () => base44.entities.Dancer.filter({ archived: false }) });
  const { data: spaceBookings = [] } = useQuery({ queryKey: ['spaceBookings'], queryFn: () => base44.entities.SpaceBooking.list('-date', 100) });

  const qc = useQueryClient();
  const deleteBookingMutation = useMutation({
    mutationFn: (id) => base44.entities.SpaceBooking.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['spaceBookings'] }); toast.success('Booking cancelled'); },
  });

  const weekDates = getWeekDates();

  // Space bookings this week
  const weekDateStrs = weekDates.map(d => format(d, 'yyyy-MM-dd'));
  const myBookingsThisWeek = spaceBookings.filter(b =>
    weekDateStrs.includes(b.date) && (b.teacher_id === teacher?.id || !b.teacher_id)
  );

  return (
    <div className="px-4 pt-2 pb-6 max-w-lg mx-auto">
      <h1 className="font-serif text-[25px] font-semibold mb-4 -tracking-[0.01em]">Teaching this week</h1>

      <Tabs defaultValue="schedule">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="schedule" className="flex-1 font-caps text-[10px] uppercase tracking-[0.1em]">Schedule</TabsTrigger>
          <TabsTrigger value="bookings" className="flex-1 font-caps text-[10px] uppercase tracking-[0.1em]">My Bookings</TabsTrigger>
        </TabsList>

        {/* ── SCHEDULE TAB ── */}
        <TabsContent value="schedule">
          {weekDates.map(date => {
            const dow = date.getDay();
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayClasses = allClasses
              .filter(c => c.teacher_id === teacher?.id && c.day_of_week === dow)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            // SpaceBookings this teacher has on this specific date
            const dayBookings = spaceBookings
              .filter(b => b.date === dateStr && b.teacher_id === teacher?.id)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            const hasAnything = dayClasses.length > 0 || dayBookings.length > 0;

            return (
              <div key={dow} className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className={`font-body font-medium text-sm ${isToday(date) ? 'text-primary' : 'text-foreground'}`}>
                    {DAY_NAMES[dow]}
                  </h3>
                  <span className="text-xs text-muted-foreground">{format(date, 'MMM d')}</span>
                  {isToday(date) && <span className="text-[10px] font-caps uppercase tracking-[0.15em] text-primary">Today</span>}
                </div>
                {!hasAnything ? (
                  <p className="text-xs text-muted-foreground pl-1">No classes</p>
                ) : (
                  <div className="space-y-2">
                    {dayClasses.map(c => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-card border border-border rounded-lg p-3"
                      >
                        <h4 className="font-body text-sm font-medium text-foreground">{c.title}</h4>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(c.start_time)} – {formatTime(c.end_time)}</span>
                          {studios.find(s => s.id === c.studio_id)?.name && (
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studios.find(s => s.id === c.studio_id)?.name}</span>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {dayBookings.map(b => {
                      const studio = studios.find(s => s.id === b.studio_id);
                      const bDancers = (b.dancer_ids || []).map(did => dancers.find(d => d.id === did)).filter(Boolean);
                      const bPieces = (b.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);
                      return (
                        <motion.div
                          key={b.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`bg-card border rounded-lg p-3 ${b.type === 'private' ? 'border-gold/30' : 'border-primary/30'}`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${b.type === 'private' ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'}`}>
                              {b.type === 'private' ? 'Private Lesson' : 'Rehearsal'}
                            </span>
                            <button
                              onClick={() => deleteBookingMutation.mutate(b.id)}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              title="Cancel booking"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-1.5">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)} – {formatTime(computeEndTime(b.start_time, b.duration_hours))}</span>
                            {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                          </div>
                          {bDancers.length > 0 && (
                            <div className="mb-1.5">
                              <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                                <User className="w-2.5 h-2.5" /> {b.type === 'private' ? 'Student(s)' : 'Dancers Called'}
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {bDancers.map(d => (
                                  <span key={d.id} className="bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded">{d.first_name} {d.last_name}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {bPieces.length > 0 && (
                            <div>
                              <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                                <Music className="w-2.5 h-2.5" /> Pieces
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {bPieces.map(p => (
                                  <span key={p.id} className="bg-gold/10 text-gold text-[10px] font-caps uppercase tracking-[0.08em] px-2 py-0.5 rounded">{p.title}</span>
                                ))}
                              </div>
                            </div>
                          )}
                          {b.notes && <p className="mt-1.5 text-[10px] text-muted-foreground italic">{b.notes}</p>}
                          {b.type === 'private' && b.hour_slots?.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {Array.from({ length: Math.ceil(b.duration_hours) }, (_, i) => {
                                const [h, m] = b.start_time.split(':').map(Number);
                                const from = `${String(h + i).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                const to = `${String(h + i + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                                const slot = b.hour_slots.find(s => s.hour_index === i);
                                const dancer = slot ? dancers.find(d => d.id === slot.dancer_id) : null;
                                return (
                                  <div key={i} className="flex items-center gap-2 text-[10px]">
                                    <span className="font-caps uppercase tracking-[0.08em] text-primary w-12">Hr {i + 1}</span>
                                    <span className="text-muted-foreground">{from}–{to}</span>
                                    {dancer ? (
                                      <span className="bg-secondary text-foreground px-2 py-0.5 rounded">{dancer.first_name} {dancer.last_name}</span>
                                    ) : (
                                      <span className="text-muted-foreground italic">open</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* ── MY BOOKINGS TAB ── */}
        <TabsContent value="bookings">
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-muted-foreground">Your booked spaces this week</p>
            <Button size="sm" onClick={() => setShowBookSpace(true)} className="bg-primary hover:bg-primary/90 font-caps text-[10px] uppercase tracking-[0.12em]">
              <Plus className="w-3.5 h-3.5 mr-1" /> Book Space
            </Button>
          </div>

          {myBookingsThisWeek.length === 0 ? (
            <EmptyState message="No spaces booked this week" sub="Use 'Book Space' to reserve a studio" />
          ) : (
            <div className="space-y-3">
              {myBookingsThisWeek
                .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
                .map((b, i) => {
                  const studio = studios.find(s => s.id === b.studio_id);
                  const bPieces = (b.piece_ids || []).map(pid => pieces.find(p => p.id === pid)).filter(Boolean);
                  const bDancers = (b.dancer_ids || []).map(did => dancers.find(d => d.id === did)).filter(Boolean);

                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className={`bg-card border rounded-lg p-3 ${b.type === 'private' ? 'border-gold/30' : 'border-primary/30'}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`font-caps text-[10px] uppercase tracking-[0.15em] px-2 py-0.5 rounded ${
                          b.type === 'private' ? 'bg-gold/10 text-gold' : 'bg-primary/10 text-primary'
                        }`}>
                          {b.type === 'private' ? 'Private Lesson' : 'Rehearsal'}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{format(new Date(b.date + 'T00:00:00'), 'EEE, MMM d')}</span>
                          <button
                            onClick={() => deleteBookingMutation.mutate(b.id)}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            title="Cancel booking"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(b.start_time)} – {formatTime(computeEndTime(b.start_time, b.duration_hours))}</span>
                        {studio && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />Studio {studio.name}</span>}
                      </div>

                      {bDancers.length > 0 && (
                        <div className="mb-2">
                          <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                            <User className="w-2.5 h-2.5" /> {b.type === 'private' ? 'Student(s)' : 'Dancers Called'}
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {bDancers.map(d => (
                              <span key={d.id} className="bg-secondary text-foreground text-[10px] px-2 py-0.5 rounded">
                                {d.first_name} {d.last_name}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {bPieces.length > 0 && (
                        <div>
                          <p className="text-[10px] font-caps uppercase tracking-[0.1em] text-warm-gray mb-1 flex items-center gap-1">
                            <Music className="w-2.5 h-2.5" /> Pieces
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {bPieces.map(p => (
                              <span key={p.id} className="bg-gold/10 text-gold text-[10px] font-caps uppercase tracking-[0.08em] px-2 py-0.5 rounded">
                                {p.title}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {b.notes && <p className="mt-2 text-[10px] text-muted-foreground italic">{b.notes}</p>}

                      {/* Per-hour slot breakdown for private lessons */}
                      {b.type === 'private' && b.hour_slots?.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {Array.from({ length: Math.ceil(b.duration_hours) }, (_, i) => {
                            const [h, m] = b.start_time.split(':').map(Number);
                            const from = `${String(h + i).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            const to = `${String(h + i + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            const slot = b.hour_slots.find(s => s.hour_index === i);
                            const dancer = slot ? dancers.find(d => d.id === slot.dancer_id) : null;
                            return (
                              <div key={i} className="flex items-center gap-2 text-[10px]">
                                <span className="font-caps uppercase tracking-[0.08em] text-primary w-12">Hr {i + 1}</span>
                                <span className="text-muted-foreground">{from}–{to}</span>
                                {dancer ? (
                                  <span className="bg-secondary text-foreground px-2 py-0.5 rounded">{dancer.first_name} {dancer.last_name}</span>
                                ) : (
                                  <span className="text-muted-foreground italic">open</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {b.type !== 'private' && b.duration_hours > 1 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Array.from({ length: b.duration_hours }, (_, i) => {
                            const [h, m] = b.start_time.split(':').map(Number);
                            const from = `${String(h + i).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            const to = `${String(h + i + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                            return (
                              <span key={i} className="text-[9px] bg-border text-muted-foreground px-1.5 py-0.5 rounded font-caps tracking-[0.08em]">
                                Hr {i + 1}: {from}–{to}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <BookSpaceDialog
        open={showBookSpace}
        onClose={() => setShowBookSpace(false)}
        studios={studios}
        pieces={pieces}
        dancers={dancers}
        teacher={teacher}
      />
    </div>
  );
}