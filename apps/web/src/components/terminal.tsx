'use client';

import { useState } from 'react';
import { CopyIcon } from './icons';

interface CommandLineProps {
  command: string;
}

export function CommandLine({ command }: CommandLineProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-100 border border-gray-200 px-5 py-4 font-mono text-sm text-gray-700 flex justify-between items-center mb-2">
      <span>
        <span className="text-primary mr-2">▸</span>
        {command}
      </span>
      <button
        onClick={handleCopy}
        className="text-gray-400 hover:text-primary transition-colors p-1"
        title="Copy to clipboard"
      >
        {copied ? (
          <span className="text-xs text-primary">Copied!</span>
        ) : (
          <CopyIcon />
        )}
      </button>
    </div>
  );
}

interface TerminalProps {
  lines: Array<{ prompt?: boolean; text: string; status?: boolean }>;
  showCursor?: boolean;
}

export function Terminal({ lines, showCursor = true }: TerminalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = lines
      .filter((l) => l.prompt)
      .map((l) => l.text)
      .join('\n');
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-[#1e1e2e] border-2 border-primary p-5 relative">
      <div className="flex gap-1.5 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
        <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
        <div className="w-2.5 h-2.5 rounded-full bg-gray-600" />
      </div>

      <button
        onClick={handleCopy}
        className="absolute top-4 right-4 text-gray-500 hover:text-primary transition-colors"
        title="Copy to clipboard"
      >
        {copied ? (
          <span className="text-xs text-primary">Copied!</span>
        ) : (
          <CopyIcon />
        )}
      </button>

      <div className="font-mono text-sm">
        {lines.map((line, i) => (
          <div key={i} className="mb-1">
            {line.prompt && <span className="text-primary">$ </span>}
            <span className={line.status ? 'text-primary' : 'text-gray-200'}>
              {line.text}
            </span>
            {showCursor && i === lines.length - 1 && (
              <span className="terminal-cursor" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
