import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  hue: number;
  colorGroup: number; // Add color group for frequency mapping
}

interface VectorArtProps {
  audioElement: HTMLAudioElement | null;
}

const VectorArt: React.FC<VectorArtProps> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const animationFrameRef = useRef<number>();
  const hueRef = useRef(200); // Starting hue for blue theme
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]); // Four frequency ranges

  // Set up audio monitoring
  useEffect(() => {
    if (!audioElement) return;

    console.log('Setting up audio monitoring...');

    const handleTimeUpdate = () => {
      if (audioElement.paused) {
        audioLevelRef.current = [0, 0, 0, 0];
      } else {
        const time = Date.now() / 1000;
        
        // Generate four different frequency ranges
        // Low, mid-low, mid-high, and high frequencies
        audioLevelRef.current = [
          // Low frequency (slow oscillation)
          Math.abs(Math.sin(time * 1.0) * 0.4 + Math.sin(time * 2.1) * 0.6),
          // Mid-low frequency
          Math.abs(Math.sin(time * 3.2) * 0.5 + Math.sin(time * 4.3) * 0.5),
          // Mid-high frequency
          Math.abs(Math.sin(time * 5.4) * 0.6 + Math.sin(time * 6.5) * 0.4),
          // High frequency (fast oscillation)
          Math.abs(Math.sin(time * 7.6) * 0.3 + Math.sin(time * 8.7) * 0.7)
        ];
      }
    };

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

    // Initialize points with color groups
    const numPoints = 90; 
    const pointsPerGroup = numPoints / 4;
    pointsRef.current = Array.from({ length: numPoints }, (_, index) => {
      const colorGroup = Math.floor(index / pointsPerGroup);
      const groupHue = (hueRef.current + colorGroup * 90) % 360; // Spread colors evenly
      return {
        x: Math.random() * canvas.offsetWidth,
        y: Math.random() * canvas.offsetHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 1.0 + 0.3, // Slightly smaller points due to increased count
        color: getColor(groupHue),
        hue: groupHue,
        colorGroup
      };
    });

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Clear canvas with slight fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Slowly shift base hue
      hueRef.current = (hueRef.current + 0.1) % 360;

      // Update and draw points
      pointsRef.current.forEach((point) => {
        // Add random movement
        point.vx += (Math.random() - 0.5) * 0.1;
        point.vy += (Math.random() - 0.5) * 0.1;

        // Add frequency-based movement
        const jitterGain = 30.0; 
        const jitterGroupGain = 0.0;
        const audioLevel = audioLevelRef.current[point.colorGroup];
        if (audioLevel > 0) {
          // Scale jitter based on frequency range
          const jitterScale = jitterGain * (1 + (point.colorGroup * jitterGroupGain)); // Higher frequencies get more movement
          const jitterAmount = audioLevel * jitterScale;
          point.vx += (Math.random() - 0.5) * jitterAmount;
          point.vy += (Math.random() - 0.5) * jitterAmount;
        }

        // Update position
        point.x += point.vx;
        point.y += point.vy;

        // Enforce strict boundary checking and repositioning
        if (point.x < 0) {
          point.x = 0;
          point.vx = Math.abs(point.vx); // Force positive velocity
        } else if (point.x > canvas.offsetWidth) {
          point.x = canvas.offsetWidth;
          point.vx = -Math.abs(point.vx); // Force negative velocity
        }
        
        if (point.y < 0) {
          point.y = 0;
          point.vy = Math.abs(point.vy); // Force positive velocity
        } else if (point.y > canvas.offsetHeight) {
          point.y = canvas.offsetHeight;
          point.vy = -Math.abs(point.vy); // Force negative velocity
        }

        // Add small random velocity changes after boundary collision
        if (point.x === 0 || point.x === canvas.offsetWidth) {
          point.vx += (Math.random() - 0.5) * 0.1;
        }
        if (point.y === 0 || point.y === canvas.offsetHeight) {
          point.vy += (Math.random() - 0.5) * 0.1;
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

      // Draw connections only between points of the same color group
      pointsRef.current.forEach((point, i) => {
        pointsRef.current.slice(i + 1).forEach(otherPoint => {
          // Only connect points in the same frequency group
          if (point.colorGroup === otherPoint.colorGroup) {
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

export { VectorArt }; 