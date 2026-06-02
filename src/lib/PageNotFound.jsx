import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <span className="font-script text-4xl text-gold mb-4">MLDA</span>
      <h1 className="font-display text-5xl text-foreground mb-2">404</h1>
      <p className="font-serif text-lg italic text-muted-foreground mb-8">
        This page doesn't exist
      </p>
      <Link to="/">
        <Button className="bg-primary hover:bg-primary/90 font-caps text-xs uppercase tracking-[0.15em]">
          Back to Schedule
        </Button>
      </Link>
    </div>
  );
}