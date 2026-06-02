export default function SectionLabel({ children, className = '' }) {
  return (
    <h2 className={`font-caps text-xs font-light uppercase tracking-[0.2em] text-warm-gray ${className}`}>
      {children}
    </h2>
  );
}