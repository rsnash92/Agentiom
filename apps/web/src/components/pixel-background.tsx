'use client';

import { useEffect, useRef } from 'react';

export function PixelBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Create floating pixels
    const pixelCount = 80;
    for (let i = 0; i < pixelCount; i++) {
      const pixel = document.createElement('div');
      pixel.className = 'floating-pixel';
      const size = Math.random() * 4 + 2;
      pixel.style.left = `${Math.random() * 100}%`;
      pixel.style.width = `${size}px`;
      pixel.style.height = `${size}px`;
      pixel.style.animationDuration = `${Math.random() * 8 + 6}s`;
      pixel.style.animationDelay = `${Math.random() * 8}s`;
      pixel.style.opacity = `${Math.random() * 0.2 + 0.05}`;
      container.appendChild(pixel);
    }

    // Create static pixel clusters
    for (let i = 0; i < 30; i++) {
      const cluster = document.createElement('div');
      cluster.style.position = 'absolute';
      cluster.style.left = `${Math.random() * 100}%`;
      cluster.style.top = `${Math.random() * 100}%`;
      cluster.style.width = `${Math.random() * 60 + 20}px`;
      cluster.style.height = `${Math.random() * 60 + 20}px`;
      cluster.style.opacity = `${Math.random() * 0.15 + 0.05}`;

      const dotCount = Math.floor(Math.random() * 12 + 4);
      for (let j = 0; j < dotCount; j++) {
        const dot = document.createElement('div');
        dot.style.position = 'absolute';
        dot.style.left = `${Math.random() * 100}%`;
        dot.style.top = `${Math.random() * 100}%`;
        dot.style.width = '3px';
        dot.style.height = '3px';
        dot.style.background = '#3b82f6';
        cluster.appendChild(dot);
      }

      container.appendChild(cluster);
    }

    return () => {
      container.innerHTML = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
    />
  );
}
