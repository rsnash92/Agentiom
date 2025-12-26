'use client';

import { useEffect, useRef, useCallback } from 'react';

interface Pixel {
  x: number;
  y: number;
}

interface Cluster {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  vx: number;
  vy: number;
}

export function PixelBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixelsRef = useRef<Pixel[]>([]);
  const clustersRef = useRef<Cluster[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>(0);
  const timeRef = useRef(0);

  const GRID_SIZE = 10; // Tight grid spacing
  const DOT_SIZE = 2; // Small uniform dots
  const BASE_COLOR = { r: 40, g: 40, b: 40 }; // Dark gray base dots
  const HIGHLIGHT_COLOR = { r: 255, g: 255, b: 255 }; // White for clusters

  const initPixels = useCallback((canvas: HTMLCanvasElement) => {
    const pixels: Pixel[] = [];
    const cols = Math.ceil(canvas.width / GRID_SIZE) + 2;
    const rows = Math.ceil(canvas.height / GRID_SIZE) + 2;

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        pixels.push({
          x: i * GRID_SIZE,
          y: j * GRID_SIZE,
        });
      }
    }

    return pixels;
  }, []);

  const initClusters = useCallback((canvas: HTMLCanvasElement) => {
    const clusters: Cluster[] = [];
    const numClusters = 15; // More clusters

    for (let i = 0; i < numClusters; i++) {
      // Random speed with direction bias (moving across screen)
      const speed = 0.5 + Math.random() * 1.5;
      const angle = Math.random() * Math.PI * 2;

      clusters.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        radius: 40 + Math.random() * 80,
        intensity: 0.5 + Math.random() * 0.5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
      });
    }

    return clusters;
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    timeRef.current += 0.01;

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mouse = mouseRef.current;
    const mouseRadius = 120;
    const clusters = clustersRef.current;

    // Move clusters across the screen
    clusters.forEach((cluster) => {
      cluster.x += cluster.vx;
      cluster.y += cluster.vy;

      // Wrap around edges for continuous flow
      if (cluster.x < -cluster.radius) cluster.x = canvas.width + cluster.radius;
      if (cluster.x > canvas.width + cluster.radius) cluster.x = -cluster.radius;
      if (cluster.y < -cluster.radius) cluster.y = canvas.height + cluster.radius;
      if (cluster.y > canvas.height + cluster.radius) cluster.y = -cluster.radius;
    });

    // Draw each pixel
    pixelsRef.current.forEach((pixel) => {
      let maxInfluence = 0;

      // Calculate influence from all clusters
      clusters.forEach((cluster) => {
        const dx = pixel.x - cluster.x;
        const dy = pixel.y - cluster.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < cluster.radius) {
          const influence = (1 - distance / cluster.radius) * cluster.intensity;
          maxInfluence = Math.max(maxInfluence, influence);
        }
      });

      // Calculate mouse influence
      const mouseDx = pixel.x - mouse.x;
      const mouseDy = pixel.y - mouse.y;
      const mouseDistance = Math.sqrt(mouseDx * mouseDx + mouseDy * mouseDy);

      if (mouseDistance < mouseRadius) {
        const mouseInfluence = (1 - mouseDistance / mouseRadius) * 0.8;
        maxInfluence = Math.max(maxInfluence, mouseInfluence);
      }

      // Determine color based on influence
      let r, g, b, opacity;

      if (maxInfluence > 0.01) {
        // Blend from gray to white based on influence
        r = Math.round(BASE_COLOR.r + (HIGHLIGHT_COLOR.r - BASE_COLOR.r) * maxInfluence);
        g = Math.round(BASE_COLOR.g + (HIGHLIGHT_COLOR.g - BASE_COLOR.g) * maxInfluence);
        b = Math.round(BASE_COLOR.b + (HIGHLIGHT_COLOR.b - BASE_COLOR.b) * maxInfluence);
        opacity = 0.3 + maxInfluence * 0.7;
      } else {
        // Base gray dots
        r = BASE_COLOR.r;
        g = BASE_COLOR.g;
        b = BASE_COLOR.b;
        opacity = 0.15;
      }

      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${opacity})`;
      ctx.fillRect(pixel.x - DOT_SIZE / 2, pixel.y - DOT_SIZE / 2, DOT_SIZE, DOT_SIZE);
    });

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      pixelsRef.current = initPixels(canvas);
      clustersRef.current = initClusters(canvas);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 };
    };

    // Initial setup
    handleResize();

    // Event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationRef.current);
    };
  }, [initPixels, initClusters, animate]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-auto"
      style={{ background: '#000000' }}
    />
  );
}
