'use client';

const nodes = [
  { emoji: '📊', position: 'top-[15%] left-[25%]', color: 'bg-emerald-500', delay: '0s' },
  { emoji: '🔍', position: 'top-[20%] right-[20%]', color: 'bg-purple-500', delay: '0.5s' },
  { emoji: '💾', position: 'bottom-[30%] left-[15%]', color: 'bg-orange-500', delay: '1s' },
  { emoji: '📧', position: 'bottom-[15%] right-[25%]', color: 'bg-cyan-500', delay: '1.5s' },
  { emoji: '⏰', position: 'top-[45%] left-[10%]', color: 'bg-pink-500', delay: '2s' },
  { emoji: '🌐', position: 'top-[35%] right-[10%]', color: 'bg-yellow-500', delay: '2.5s' },
];

export function NetworkViz() {
  return (
    <div className="bg-[#1e1e2e] border border-gray-700 rounded-xl p-10 flex items-center justify-center relative min-h-[400px] overflow-hidden">
      {/* Center node */}
      <div
        className="network-node w-[72px] h-[72px] bg-primary text-[28px] z-10"
        style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      >
        ⚡
      </div>

      {/* Surrounding nodes */}
      {nodes.map((node, i) => (
        <div
          key={i}
          className={`network-node ${node.color} ${node.position}`}
          style={{ animationDelay: node.delay }}
        >
          {node.emoji}
        </div>
      ))}
    </div>
  );
}
