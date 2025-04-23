import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  mass: number;
  charge: number;
  hueOffset: number;
  audioIndex: number;
}

interface FluidField {
  width: number;
  height: number;
  resolution: number;
  cells: Float32Array;
}

interface VectorArt4Props {
  audioElement: HTMLAudioElement | null;
}

const VectorArt4: React.FC<VectorArt4Props> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const fluidFieldRef = useRef<FluidField | null>(null);
  const animationFrameRef = useRef<number>();
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]);
  const baseHueRef = useRef(0);
  const spectrumDataRef = useRef<number[]>(Array(32).fill(0));

  // Set up audio monitoring with spectrum analysis
  useEffect(() => {
    if (!audioElement) return;

    const handleTimeUpdate = () => {
      if (audioElement.paused) {
        audioLevelRef.current = [0, 0, 0, 0];
        spectrumDataRef.current = Array(32).fill(0);
      } else {
        const time = Date.now() / 1000;
        
        // Generate main audio levels
        audioLevelRef.current = [
          Math.abs(Math.sin(time * 1.0) * 0.4 + Math.sin(time * 2.1) * 0.6),
          Math.abs(Math.sin(time * 3.2) * 0.5 + Math.sin(time * 4.3) * 0.5),
          Math.abs(Math.sin(time * 5.4) * 0.6 + Math.sin(time * 6.5) * 0.4),
          Math.abs(Math.sin(time * 7.6) * 0.3 + Math.sin(time * 8.7) * 0.7)
        ];

        // Generate spectrum data
        spectrumDataRef.current = Array(32).fill(0).map((_, i) => {
          const freq = (i + 1) * 1.5;
          return Math.abs(
            Math.sin(time * freq) * 0.3 +
            Math.sin(time * (freq * 1.5)) * 0.4 +
            Math.sin(time * (freq * 2.0)) * 0.3
          );
        });
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

    // Create offscreen canvas for metaball rendering
    offscreenCanvasRef.current = document.createElement('canvas');
    const offscreenCtx = offscreenCanvasRef.current.getContext('2d');
    if (!offscreenCtx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      offscreenCanvasRef.current!.width = canvas.width;
      offscreenCanvasRef.current!.height = canvas.height;

      // Initialize fluid field
      const resolution = 64;
      fluidFieldRef.current = {
        width: resolution,
        height: resolution,
        resolution,
        cells: new Float32Array(resolution * resolution)
      };
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Initialize particles
    const numParticles = 40;
    particlesRef.current = Array.from({ length: numParticles }, (_, i) => {
      const angle = (i / numParticles) * Math.PI * 2;
      const radius = 20 + Math.random() * 30;
      const speed = 0.5 + Math.random() * 1;
      
      return {
        x: canvas.offsetWidth / 2 + Math.cos(angle) * radius,
        y: canvas.offsetHeight / 2 + Math.sin(angle) * radius,
        vx: Math.cos(angle) * speed * 0.5,
        vy: Math.sin(angle) * speed * 0.5,
        radius: 15 + Math.random() * 25,
        baseRadius: 15 + Math.random() * 25,
        mass: 1 + Math.random() * 2,
        charge: Math.random() < 0.5 ? -1 : 1,
        hueOffset: (i * 60 / numParticles) % 120,
        audioIndex: i % 4
      };
    });

    // Animation function
    const animate = () => {
      if (!canvas || !ctx || !offscreenCanvasRef.current || !fluidFieldRef.current) return;

      // Update base hue
      baseHueRef.current = (baseHueRef.current + 0.2) % 360;

      const offscreenCtx = offscreenCanvasRef.current.getContext('2d')!;
      const fluid = fluidFieldRef.current;

      // Clear canvases
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      
      offscreenCtx.clearRect(0, 0, canvas.width, canvas.height);

      // Update fluid field
      for (let i = 0; i < fluid.width; i++) {
        for (let j = 0; j < fluid.height; j++) {
          const idx = i + j * fluid.width;
          fluid.cells[idx] *= 0.99; // Decay
        }
      }

      // Update particles
      particlesRef.current.forEach((particle, index) => {
        // Audio-reactive size with reduced intensity
        const audioLevel = audioLevelRef.current[particle.audioIndex];
        particle.radius = particle.baseRadius * (1 + audioLevel * 1.5);

        // Apply forces with reduced intensity
        let fx = 0;
        let fy = 0;

        // Electromagnetic-like interaction between particles with reduced force
        particlesRef.current.forEach((other, j) => {
          if (index === j) return;

          const dx = other.x - particle.x;
          const dy = other.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 200) {
            const force = (particle.charge * other.charge * 30) / (distance * distance);
            const angle = Math.atan2(dy, dx);
            fx += Math.cos(angle) * force;
            fy += Math.sin(angle) * force;
          }
        });

        // Audio-reactive force field with reduced intensity
        const time = Date.now() / 1000;
        const fieldStrength = 1.5 * (1 + audioLevel);
        fx += Math.sin(particle.y * 0.01 + time) * fieldStrength;
        fy += Math.cos(particle.x * 0.01 + time) * fieldStrength;

        // Update velocity with stronger damping
        particle.vx += fx / particle.mass;
        particle.vy += fy / particle.mass;

        // Increased damping for smoother movement
        particle.vx *= 0.97;
        particle.vy *= 0.97;

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Bounce off edges with audio-reactive bounce
        const bounceFactor = 0.8 + audioLevel * 0.4;
        if (particle.x < particle.radius) {
          particle.x = particle.radius;
          particle.vx *= -bounceFactor;
        }
        if (particle.x > canvas.offsetWidth - particle.radius) {
          particle.x = canvas.offsetWidth - particle.radius;
          particle.vx *= -bounceFactor;
        }
        if (particle.y < particle.radius) {
          particle.y = particle.radius;
          particle.vy *= -bounceFactor;
        }
        if (particle.y > canvas.offsetHeight - particle.radius) {
          particle.y = canvas.offsetHeight - particle.radius;
          particle.vy *= -bounceFactor;
        }

        // Update fluid field
        const cellX = Math.floor((particle.x / canvas.offsetWidth) * fluid.width);
        const cellY = Math.floor((particle.y / canvas.offsetHeight) * fluid.height);
        if (cellX >= 0 && cellX < fluid.width && cellY >= 0 && cellY < fluid.height) {
          const idx = cellX + cellY * fluid.width;
          fluid.cells[idx] += audioLevel * 0.5;
        }
      });

      // Draw metaballs
      offscreenCtx.fillStyle = '#fff';
      particlesRef.current.forEach(particle => {
        const gradient = offscreenCtx.createRadialGradient(
          particle.x, particle.y, 0,
          particle.x, particle.y, particle.radius
        );
        gradient.addColorStop(0, `rgba(255, 255, 255, 1)`);
        gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
        
        offscreenCtx.fillStyle = gradient;
        offscreenCtx.beginPath();
        offscreenCtx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        offscreenCtx.fill();
      });

      // Process metaballs with cycling colors
      const imageData = offscreenCtx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;

      for (let i = 0; i < pixels.length; i += 4) {
        const x = (i / 4) % canvas.width;
        const y = Math.floor((i / 4) / canvas.width);
        
        const fluidX = Math.floor((x / canvas.width) * fluid.width);
        const fluidY = Math.floor((y / canvas.height) * fluid.height);
        const fluidValue = fluid.cells[fluidX + fluidY * fluid.width];

        if (pixels[i] > 128) {
          // Get the nearest particle for coloring
          let nearestParticle = particlesRef.current[0];
          let minDist = Number.MAX_VALUE;
          
          particlesRef.current.forEach(particle => {
            const dx = x - particle.x;
            const dy = y - particle.y;
            const dist = dx * dx + dy * dy;
            if (dist < minDist) {
              minDist = dist;
              nearestParticle = particle;
            }
          });

          const audioLevel = audioLevelRef.current[nearestParticle.audioIndex];
          const brightness = 50 + audioLevel * 15;
          const saturation = 60 + fluidValue * 20;
          
          // Calculate final hue by combining base hue and particle's offset
          const finalHue = (baseHueRef.current + nearestParticle.hueOffset) % 360;

          pixels[i] = 0;   // R
          pixels[i+1] = 0; // G
          pixels[i+2] = 0; // B
          pixels[i+3] = 255; // A

          ctx.fillStyle = `hsla(${finalHue}, ${saturation}%, ${brightness}%, 0.08)`;
          ctx.fillRect(x, y, 1, 1);
        }
      }

      // After drawing the fluid visualization, overlay the spectrum
      const drawSpectrum = () => {
        const spectrumHeight = canvas.offsetHeight * 0.25;
        const barWidth = canvas.offsetWidth / spectrumDataRef.current.length;
        const bottomPadding = 20;
        const y = canvas.offsetHeight - spectrumHeight - bottomPadding;

        // Find the center of energy in the spectrum
        let maxEnergy = 0;
        let energyCenter = 0;
        let totalEnergy = 0;

        spectrumDataRef.current.forEach((value, i) => {
          const energy = value * value; // Square for more pronounced peaks
          totalEnergy += energy;
          if (energy > maxEnergy) {
            maxEnergy = energy;
            energyCenter = i;
          }
        });

        // Calculate the offset to center the most active frequency
        const centerIndex = Math.floor(spectrumDataRef.current.length / 2);
        const shift = centerIndex - energyCenter;
        const visibleBars = spectrumDataRef.current.length;
        
        // Draw spectrum bars with increased amplitude and centering
        spectrumDataRef.current.forEach((value, i) => {
          // Shift the index to center around the energy center
          let shiftedIndex = (i + shift + visibleBars) % visibleBars;
          const x = shiftedIndex * barWidth;
          
          // Calculate height with smooth falloff from center
          const distanceFromCenter = Math.abs(shiftedIndex - centerIndex);
          const falloff = Math.exp(-distanceFromCenter * 0.1); // Exponential falloff
          const height = value * spectrumHeight * 1.5 * falloff;
          
          const hue = (baseHueRef.current + (shiftedIndex * 360 / spectrumDataRef.current.length)) % 360;
          
          // Create gradient for each bar with increased opacity for better visibility
          const gradient = ctx.createLinearGradient(x, y + spectrumHeight, x, y + spectrumHeight - height);
          gradient.addColorStop(0, `hsla(${hue}, 70%, 50%, 0.15)`);
          gradient.addColorStop(1, `hsla(${hue}, 70%, 70%, ${0.4 * falloff})`); // Fade opacity with distance from center

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.moveTo(x, y + spectrumHeight);
          
          // Create a smooth curve for the top of the bar
          const controlPointY = y + spectrumHeight - height;
          const nextValue = spectrumDataRef.current[(i + 1) % visibleBars] || value;
          const nextShiftedIndex = ((i + 1) + shift + visibleBars) % visibleBars;
          const nextDistanceFromCenter = Math.abs(nextShiftedIndex - centerIndex);
          const nextFalloff = Math.exp(-nextDistanceFromCenter * 0.1);
          const nextHeight = nextValue * spectrumHeight * 1.5 * nextFalloff;
          const nextX = nextShiftedIndex * barWidth;
          const nextControlPointY = y + spectrumHeight - nextHeight;

          ctx.bezierCurveTo(
            x + barWidth * 0.5, controlPointY,
            nextX - barWidth * 0.5, nextControlPointY,
            nextX, nextControlPointY
          );
          
          ctx.lineTo(nextX, y + spectrumHeight);
          ctx.closePath();
          ctx.fill();
        });

        // Add enhanced glow effect with centered emphasis
        ctx.shadowBlur = 20;
        ctx.shadowColor = `hsla(${baseHueRef.current}, 70%, 60%, 0.4)`;
        ctx.fillStyle = `hsla(${baseHueRef.current}, 70%, 60%, 0.15)`;
        ctx.beginPath();
        ctx.moveTo(0, y + spectrumHeight);
        
        spectrumDataRef.current.forEach((value, i) => {
          const shiftedIndex = (i + shift + visibleBars) % visibleBars;
          const x = shiftedIndex * barWidth;
          const distanceFromCenter = Math.abs(shiftedIndex - centerIndex);
          const falloff = Math.exp(-distanceFromCenter * 0.1);
          const height = value * spectrumHeight * 1.5 * falloff;
          ctx.lineTo(x, y + spectrumHeight - height);
        });
        
        ctx.lineTo(canvas.offsetWidth, y + spectrumHeight);
        ctx.closePath();
        ctx.fill();
        
        // Reset shadow
        ctx.shadowBlur = 0;
      };

      // Draw spectrum after fluid visualization
      drawSpectrum();

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

export { VectorArt4 }; 