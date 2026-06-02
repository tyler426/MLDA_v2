export default function EmptyState({ message = "Nothing scheduled", sub }) {
  return (
    <div className="text-center py-12">
      <p className="font-serif text-lg italic text-muted-foreground">{message}</p>
      {sub && <p className="mt-2 text-xs text-warm-gray">{sub}</p>}
    </div>
  );
}