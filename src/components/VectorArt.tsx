import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseVx: number;
  baseVy: number;
  radius: number;
  color: string;
  hue: number;
}

interface VectorArtProps {
  audioElement: HTMLAudioElement | null;
}

const VectorArt: React.FC<VectorArtProps> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animationFrameRef = useRef<number>();
  const hueRef = useRef(200); // Starting hue for blue theme
  const audioLevelRef = useRef(0);

  // Set up audio monitoring
  useEffect(() => {
    if (!audioElement) return;

    console.log('Setting up audio monitoring...');

    const handleTimeUpdate = () => {
      if (audioElement.paused) {
        audioLevelRef.current = 0;
      } else {
        // Generate a pseudo-level based on time to create movement
        const time = Date.now() / 1000;
        // Combine multiple frequencies for more interesting movement
        const level = (
          Math.sin(time * 2) * 0.3 + 
          Math.sin(time * 4.3) * 0.3 + 
          Math.sin(time * 8.7) * 0.4
        );
        audioLevelRef.current = Math.abs(level);
        
        if (Math.random() < 0.05) { // Log less frequently
          console.log('Audio level:', audioLevelRef.current);
        }
      }
    };

    // Update more frequently than timeupdate for smoother animation
    const interval = setInterval(handleTimeUpdate, 50);
    audioElement.addEventListener('play', handleTimeUpdate);
    audioElement.addEventListener('pause', handleTimeUpdate);

    return () => {
      clearInterval(interval);
      audioElement.removeEventListener('play', handleTimeUpdate);
      audioElement.removeEventListener('pause', handleTimeUpdate);
    };
  }, [audioElement]);

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

    // Color utilities
    const getColor = (hue: number, saturation = 80, lightness = 70) => {
      return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    };

    // Initialize points
    const numPoints = 40;
    pointsRef.current = Array.from({ length: numPoints }, () => {
      const vx = (Math.random() - 0.5) * 0.3;
      const vy = (Math.random() - 0.5) * 0.3;
      const hue = (hueRef.current + Math.random() * 40 - 20) % 360;
      return {
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx,
        vy,
        baseVx: vx,
        baseVy: vy,
        radius: Math.random() * 1.5 + 0.5,
        color: getColor(hue),
        hue
      };
    });

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Clear canvas with slight fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Get current audio level
      const audioLevel = audioLevelRef.current;

      // Slowly shift base hue
      hueRef.current = (hueRef.current + 0.1) % 360;

      // Update and draw points
      pointsRef.current.forEach((point, index) => {
        // Add audio-based jitter if audio is playing
        if (audioLevel > 0) {
          const normalizedIndex = index / pointsRef.current.length;
          // Create varying jitter amounts based on point position
          const jitterAmount = audioLevel * 15.0 * (1 + Math.sin(normalizedIndex * Math.PI * 2));
          point.vx = point.baseVx + (Math.random() - 0.5) * jitterAmount;
          point.vy = point.baseVy + (Math.random() - 0.5) * jitterAmount;
        } else {
          point.vx = point.baseVx;
          point.vy = point.baseVy;
        }

        // Update position
        point.x += point.vx;
        point.y += point.vy;

        // Bounce off walls with slight randomization
        if (point.x < 0 || point.x > canvas.offsetWidth) {
          point.vx *= -1;
          point.baseVx = point.vx;
          point.vx += (Math.random() - 0.5) * 0.1;
          point.hue = (point.hue + Math.random() * 10 - 5) % 360;
          point.color = getColor(point.hue);
        }
        if (point.y < 0 || point.y > canvas.offsetHeight) {
          point.vy *= -1;
          point.baseVy = point.vy;
          point.vy += (Math.random() - 0.5) * 0.1;
          point.hue = (point.hue + Math.random() * 10 - 5) % 360;
          point.color = getColor(point.hue);
        }

        // Keep speed within bounds
        const maxSpeed = 0.5;
        const speed = Math.hypot(point.vx, point.vy);
        if (speed > maxSpeed) {
          point.vx = (point.vx / speed) * maxSpeed;
          point.vy = (point.vy / speed) * maxSpeed;
        }

        // Draw point with glow effect
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius * 2, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, point.radius * 2
        );
        gradient.addColorStop(0, point.color);
        gradient.addColorStop(1, 'rgba(18, 18, 18, 0)');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw core of point
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
        ctx.fillStyle = point.color;
        ctx.fill();
      });

      // Draw connections with distance-based opacity and color blending
      pointsRef.current.forEach((point, i) => {
        pointsRef.current.slice(i + 1).forEach(otherPoint => {
          const distance = Math.hypot(point.x - otherPoint.x, point.y - otherPoint.y);
          const maxDistance = 120;
          if (distance < maxDistance) {
            const gradient = ctx.createLinearGradient(
              point.x, point.y,
              otherPoint.x, otherPoint.y
            );
            const opacity = 0.2 * (1 - distance / maxDistance);
            gradient.addColorStop(0, point.color.replace(')', `, ${opacity})`).replace('hsl', 'hsla'));
            gradient.addColorStop(1, otherPoint.color.replace(')', `, ${opacity})`).replace('hsl', 'hsla'));
            
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(otherPoint.x, otherPoint.y);
            ctx.strokeStyle = gradient;
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
};

export { VectorArt }; 