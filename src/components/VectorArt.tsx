import { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

export function VectorArt() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Initialize points
    const numPoints = 30;
    pointsRef.current = Array.from({ length: numPoints }, () => ({
      x: Math.random() * canvas.offsetWidth,
      y: Math.random() * canvas.offsetHeight,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      radius: Math.random() * 1.5 + 0.5
    }));

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Clear canvas with slight fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update and draw points
      pointsRef.current.forEach(point => {
        // Update position
        point.x += point.vx;
        point.y += point.vy;

        // Bounce off walls with slight randomization
        if (point.x < 0 || point.x > canvas.offsetWidth) {
          point.vx *= -1;
          point.vx += (Math.random() - 0.5) * 0.1;
        }
        if (point.y < 0 || point.y > canvas.offsetHeight) {
          point.vy *= -1;
          point.vy += (Math.random() - 0.5) * 0.1;
        }

        // Keep speed within bounds
        const maxSpeed = 0.5;
        const speed = Math.hypot(point.vx, point.vy);
        if (speed > maxSpeed) {
          point.vx = (point.vx / speed) * maxSpeed;
          point.vy = (point.vy / speed) * maxSpeed;
        }

        // Draw point
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fillStyle = '#90CAF9';
        ctx.fill();
      });

      // Draw connections with distance-based opacity
      ctx.beginPath();
      pointsRef.current.forEach((point, i) => {
        pointsRef.current.slice(i + 1).forEach(otherPoint => {
          const distance = Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y);
          const maxDistance = 120;
          if (distance < maxDistance) {
            // Opacity based on distance
            const opacity = 0.2 * (1 - distance / maxDistance);
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(otherPoint.x, otherPoint.y);
            ctx.strokeStyle = `rgba(144, 202, 249, ${opacity})`;
            ctx.stroke();
          }
        });
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block'
      }}
    />
  );
} 