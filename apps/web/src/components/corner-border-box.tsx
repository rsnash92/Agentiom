'use client';

import { ReactNode } from 'react';

interface CornerBorderBoxProps {
  children: ReactNode;
  className?: string;
  cornerSize?: number;
  cornerColor?: string;
}

export function CornerBorderBox({
  children,
  className = '',
  cornerSize = 20,
  cornerColor = 'white',
}: CornerBorderBoxProps) {
  return (
    <div className={`relative ${className}`}>
      {/* Top-left corner */}
      <div
        className="absolute top-0 left-0 pointer-events-none"
        style={{
          width: cornerSize,
          height: cornerSize,
          borderTop: `2px solid ${cornerColor}`,
          borderLeft: `2px solid ${cornerColor}`,
        }}
      />
      {/* Top-right corner */}
      <div
        className="absolute top-0 right-0 pointer-events-none"
        style={{
          width: cornerSize,
          height: cornerSize,
          borderTop: `2px solid ${cornerColor}`,
          borderRight: `2px solid ${cornerColor}`,
        }}
      />
      {/* Bottom-left corner */}
      <div
        className="absolute bottom-0 left-0 pointer-events-none"
        style={{
          width: cornerSize,
          height: cornerSize,
          borderBottom: `2px solid ${cornerColor}`,
          borderLeft: `2px solid ${cornerColor}`,
        }}
      />
      {/* Bottom-right corner */}
      <div
        className="absolute bottom-0 right-0 pointer-events-none"
        style={{
          width: cornerSize,
          height: cornerSize,
          borderBottom: `2px solid ${cornerColor}`,
          borderRight: `2px solid ${cornerColor}`,
        }}
      />
      {children}
    </div>
  );
}
