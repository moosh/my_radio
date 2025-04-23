import React, { useEffect, useRef } from 'react';

interface RingSet {
  rings: Ring[];
  centerX: number;
  centerY: number;
  baseHue: number;
  scale: number;
}

interface Ring {
  points: Point[];
  radius: number;
  rotationSpeed: number;
  colorGroup: number;
  hueOffset: number;
}

interface Point {
  angle: number;
  radius: number;
  baseRadius: number;
  color: string;
}

interface VectorArt2Props {
  audioElement: HTMLAudioElement | null;
}

const VectorArt2: React.FC<VectorArt2Props> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringSetsRef = useRef<RingSet[]>([]);
  const animationFrameRef = useRef<number>();
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]); // Four frequency ranges

  // Set up audio monitoring (same as before)
  useEffect(() => {
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      if (audioElement.paused) {
        audioLevelRef.current = [0, 0, 0, 0];
      } else {
        const time = Date.now() / 1000;
        audioLevelRef.current = [
          Math.abs(Math.sin(time * 1.0) * 0.4 + Math.sin(time * 2.1) * 0.6),
          Math.abs(Math.sin(time * 3.2) * 0.5 + Math.sin(time * 4.3) * 0.5),
          Math.abs(Math.sin(time * 5.4) * 0.6 + Math.sin(time * 6.5) * 0.4),
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

    // Initialize multiple ring sets
    const numSets = 3; // Number of ring sets
    const numRingsPerSet = 4; // Rings per set
    const pointsPerRing = 60; // Reduced points for better performance

    ringSetsRef.current = Array.from({ length: numSets }, () => {
      // Random position within canvas, avoiding edges
      const margin = Math.min(canvas.offsetWidth, canvas.offsetHeight) * 0.2;
      const centerX = margin + Math.random() * (canvas.offsetWidth - 2 * margin);
      const centerY = margin + Math.random() * (canvas.offsetHeight - 2 * margin);
      const baseHue = Math.random() * 360; // Random base hue for this set
      const scale = 0.3 + Math.random() * 0.4; // Random size scale between 0.3 and 0.7

      const rings = Array.from({ length: numRingsPerSet }, (_, ringIndex) => {
        const radius = (Math.min(canvas.offsetWidth, canvas.offsetHeight) * scale * (ringIndex + 1)) / numRingsPerSet;
        const hueOffset = (Math.random() - 0.5) * 20; // Slight random hue variation

        const points = Array.from({ length: pointsPerRing }, (_, pointIndex) => {
          const angle = (pointIndex / pointsPerRing) * Math.PI * 2;
          const ringHue = (baseHue + ringIndex * 90 + hueOffset) % 360;
          return {
            angle,
            radius: radius,
            baseRadius: radius,
            color: getColor(ringHue)
          };
        });

        return {
          points,
          radius,
          rotationSpeed: (0.0005 + Math.random() * 0.001) * (ringIndex + 1), // Random speed
          colorGroup: ringIndex,
          hueOffset
        };
      });

      return {
        rings,
        centerX,
        centerY,
        baseHue,
        scale
      };
    });

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update and draw all ring sets
      ringSetsRef.current.forEach(ringSet => {
        ringSet.rings.forEach((ring) => {
          const audioLevel = audioLevelRef.current[ring.colorGroup];
          
          // Update points
          ring.points.forEach((point) => {
            // Rotate points with randomized speed
            point.angle += ring.rotationSpeed * (1 + audioLevel * 2);
            
            // Pulse radius based on audio
            const pulseFactor = 1 + audioLevel * 0.3;
            point.radius = point.baseRadius * pulseFactor;

            // Calculate position relative to ring set center
            const x = ringSet.centerX + Math.cos(point.angle) * point.radius;
            const y = ringSet.centerY + Math.sin(point.angle) * point.radius;

            // Draw point with glow
            ctx.beginPath();
            const glowRadius = 1.5 + audioLevel * 2;
            ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(
              x, y, 0,
              x, y, glowRadius
            );
            gradient.addColorStop(0, point.color);
            gradient.addColorStop(1, 'rgba(18, 18, 18, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();

            // Draw point core
            ctx.beginPath();
            ctx.arc(x, y, 0.8, 0, Math.PI * 2);
            ctx.fillStyle = point.color;
            ctx.fill();
          });

          // Draw connections between adjacent points
          ctx.beginPath();
          ring.points.forEach((point, i) => {
            const nextPoint = ring.points[(i + 1) % ring.points.length];
            const x1 = ringSet.centerX + Math.cos(point.angle) * point.radius;
            const y1 = ringSet.centerY + Math.sin(point.angle) * point.radius;
            const x2 = ringSet.centerX + Math.cos(nextPoint.angle) * nextPoint.radius;
            const y2 = ringSet.centerY + Math.sin(nextPoint.angle) * nextPoint.radius;

            if (i === 0) {
              ctx.moveTo(x1, y1);
            }
            ctx.lineTo(x2, y2);
          });
          ctx.closePath();
          const ringHue = (ringSet.baseHue + ring.colorGroup * 90 + ring.hueOffset) % 360;
          ctx.strokeStyle = `hsla(${ringHue}, 80%, 70%, ${0.1 + audioLevelRef.current[ring.colorGroup] * 0.2})`;
          ctx.stroke();
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

export { VectorArt2 }; 