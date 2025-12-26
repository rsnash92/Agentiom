'use client';

import { useState, useEffect } from 'react';
import { CornerBorderBox } from './corner-border-box';

interface TerminalLine {
  text: string;
  color: string;
  prefix?: string;
  prefixColor?: string;
  delay: number; // delay before this line starts typing
}

const TERMINAL_LINES: TerminalLine[] = [
  { text: 'npx agentiom deploy', color: 'text-white', prefix: '$', prefixColor: 'text-orange-500', delay: 0 },
  { text: 'Deployed ✓', color: 'text-green-500', delay: 1500 },
  { text: 'Running on Agentiom Cloud', color: 'text-gray-400', delay: 2200 },
  { text: 'https://my-agent.agentiom.cloud', color: 'text-orange-400', prefix: '→', prefixColor: 'text-orange-500', delay: 2800 },
];

const TYPING_SPEED = 50; // ms per character

export function AnimatedTerminal() {
  const [displayedLines, setDisplayedLines] = useState<{ text: string; complete: boolean }[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentLineIndex >= TERMINAL_LINES.length) {
      setIsComplete(true);
      // Reset and loop after a delay
      const resetTimer = setTimeout(() => {
        setDisplayedLines([]);
        setCurrentLineIndex(0);
        setCurrentCharIndex(0);
        setIsComplete(false);
      }, 4000);
      return () => clearTimeout(resetTimer);
    }

    const currentLine = TERMINAL_LINES[currentLineIndex];

    // Wait for delay before starting this line
    if (currentCharIndex === 0 && displayedLines.length === currentLineIndex) {
      const delayTimer = setTimeout(() => {
        setDisplayedLines((prev) => [...prev, { text: '', complete: false }]);
      }, currentLine.delay - (currentLineIndex > 0 ? TERMINAL_LINES[currentLineIndex - 1].delay : 0));
      return () => clearTimeout(delayTimer);
    }

    // Type characters
    if (displayedLines.length > currentLineIndex && currentCharIndex < currentLine.text.length) {
      const typeTimer = setTimeout(() => {
        setDisplayedLines((prev) => {
          const newLines = [...prev];
          newLines[currentLineIndex] = {
            text: currentLine.text.slice(0, currentCharIndex + 1),
            complete: currentCharIndex + 1 === currentLine.text.length,
          };
          return newLines;
        });
        setCurrentCharIndex((prev) => prev + 1);
      }, TYPING_SPEED);
      return () => clearTimeout(typeTimer);
    }

    // Move to next line
    if (displayedLines[currentLineIndex]?.complete) {
      setCurrentLineIndex((prev) => prev + 1);
      setCurrentCharIndex(0);
    }
  }, [currentLineIndex, currentCharIndex, displayedLines]);

  return (
    <CornerBorderBox className="max-w-lg mx-auto" cornerSize={16}>
      <div className="bg-[#1a1a1a] m-1">
        {/* Terminal header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <button
            onClick={() => navigator.clipboard.writeText('npx agentiom deploy')}
            className="ml-auto text-gray-500 hover:text-gray-300 transition-colors"
            title="Copy to clipboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" strokeWidth="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" strokeWidth="2" />
            </svg>
          </button>
        </div>
        {/* Terminal content */}
        <div className="px-5 py-4 font-mono text-sm text-left min-h-[160px]">
          {displayedLines.map((line, index) => {
            const config = TERMINAL_LINES[index];
            const isCurrentLine = index === currentLineIndex && !isComplete;
            return (
              <div
                key={index}
                className={`flex items-center gap-2 ${index > 0 ? 'mt-1' : ''}`}
              >
                {config.prefix && (
                  <span className={config.prefixColor}>{config.prefix}</span>
                )}
                <span className={config.color}>
                  {line.text}
                  {isCurrentLine && (
                    <span className="animate-pulse text-white">|</span>
                  )}
                </span>
              </div>
            );
          })}
          {isComplete && (
            <span className="animate-pulse text-white inline-block ml-2">|</span>
          )}
        </div>
      </div>
    </CornerBorderBox>
  );
}
