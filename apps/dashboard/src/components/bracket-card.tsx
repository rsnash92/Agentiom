'use client';

interface BracketCardProps {
  children: React.ReactNode;
  className?: string;
}

export function BracketCard({ children, className = '' }: BracketCardProps) {
  return (
    <div className={`bracket-card p-6 ${className}`}>
      {children}
    </div>
  );
}
