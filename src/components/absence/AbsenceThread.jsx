import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const QUICK_REPLIES = [
  'Feel better soon!',
  'Please provide a doctor\'s note.',
  'Can you clarify how long the absence will be?',
  'This seems to be happening frequently. Please contact us.',
];

export default function AbsenceThread({ messages = [], onSend, role = 'studio', senderName = 'Studio', isSending = false }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  };

  const handleQuick = (msg) => {
    onSend(msg);
  };

  return (
    <div className="space-y-3">
      <p className="font-caps text-[10px] uppercase tracking-[0.1em] text-warm-gray">Messages</p>

      {/* Thread */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No messages yet.</p>
        )}
        {messages.map((m, i) => {
          const isStudio = m.from === 'studio';
          return (
            <div key={i} className={`flex ${isStudio ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-3 py-2 ${isStudio ? 'bg-primary/10 text-foreground' : 'bg-secondary text-foreground'}`}>
                <p className="text-xs leading-relaxed">{m.text}</p>
                <p className={`text-[11px] mt-1 font-caps tracking-[0.08em] ${isStudio ? 'text-primary/60 text-right' : 'text-warm-gray'}`}>
                  {m.sender_name} · {m.timestamp ? format(parseISO(m.timestamp), 'MMM d, h:mm a') : ''}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick replies (studio only) */}
      {role === 'studio' && (
        <div className="flex flex-wrap gap-1">
          {QUICK_REPLIES.map(q => (
            <button
              key={q}
              onClick={() => handleQuick(q)}
              disabled={isSending}
              className="text-[11px] font-caps uppercase tracking-[0.08em] border border-border px-2 py-1 rounded hover:border-primary/40 hover:text-foreground text-warm-gray transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Compose */}
      <div className="flex gap-2">
        <textarea
          className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm text-foreground min-h-[60px] resize-none"
          placeholder={role === 'studio' ? 'Send a message to the family…' : 'Reply to the studio…'}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || isSending}
          className="self-end shrink-0"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}