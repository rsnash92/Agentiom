'use client';

interface CommandCardProps {
  command: string;
  description: string;
}

export function CommandCard({ command, description }: CommandCardProps) {
  return (
    <div className="bg-gray-900 text-gray-100 p-4 rounded font-mono">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-emerald-400">$</span>
        <code className="text-sm">{command}</code>
      </div>
      <p className="text-xs text-gray-400">{description}</p>
    </div>
  );
}
