import React, { useEffect, useRef } from 'react';

interface Point4D {
  x: number;
  y: number;
  z: number;
  w: number;
  vx: number;
  vy: number;
  vz: number;
  vw: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  baseW: number;
}

interface VectorArt3Props {
  audioElement: HTMLAudioElement | null;
}

const VectorArt3: React.FC<VectorArt3Props> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointsRef = useRef<Point4D[]>([]);
  const animationFrameRef = useRef<number>();
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]); // Four frequency ranges
  const rotationRef = useRef({
    x: 0,
    y: 0,
    z: 0,
    vx: (Math.random() - 0.5) * 0.01,
    vy: (Math.random() - 0.5) * 0.01,
    vz: (Math.random() - 0.5) * 0.01
  });

  // Set up audio monitoring
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

    // Initialize 4D cube vertices
    const size = Math.min(canvas.offsetWidth, canvas.offsetHeight) * 0.08;
    pointsRef.current = [
      // Front face of inner cube
      { x: -size, y: -size, z: -size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: -size, baseZ: -size, baseW: -size },
      { x: size, y: -size, z: -size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: -size, baseZ: -size, baseW: -size },
      { x: size, y: size, z: -size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: size, baseZ: -size, baseW: -size },
      { x: -size, y: size, z: -size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: size, baseZ: -size, baseW: -size },
      // Back face of inner cube
      { x: -size, y: -size, z: size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: -size, baseZ: size, baseW: -size },
      { x: size, y: -size, z: size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: -size, baseZ: size, baseW: -size },
      { x: size, y: size, z: size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: size, baseZ: size, baseW: -size },
      { x: -size, y: size, z: size, w: -size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: size, baseZ: size, baseW: -size },
      // Front face of outer cube (w = size)
      { x: -size, y: -size, z: -size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: -size, baseZ: -size, baseW: size },
      { x: size, y: -size, z: -size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: -size, baseZ: -size, baseW: size },
      { x: size, y: size, z: -size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: size, baseZ: -size, baseW: size },
      { x: -size, y: size, z: -size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: size, baseZ: -size, baseW: size },
      // Back face of outer cube (w = size)
      { x: -size, y: -size, z: size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: -size, baseZ: size, baseW: size },
      { x: size, y: -size, z: size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: -size, baseZ: size, baseW: size },
      { x: size, y: size, z: size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: size, baseY: size, baseZ: size, baseW: size },
      { x: -size, y: size, z: size, w: size, vx: 0, vy: 0, vz: 0, vw: 0, baseX: -size, baseY: size, baseZ: size, baseW: size }
    ];

    // Project 4D point to 2D with protection against division by zero
    const project = (point: Point4D): { x: number; y: number; z: number } => {
      // Apply 3D rotation to the point
      const cosX = Math.cos(rotationRef.current.x);
      const sinX = Math.sin(rotationRef.current.x);
      const cosY = Math.cos(rotationRef.current.y);
      const sinY = Math.sin(rotationRef.current.y);
      const cosZ = Math.cos(rotationRef.current.z);
      const sinZ = Math.sin(rotationRef.current.z);

      // Rotate around X axis
      let rotatedX = point.x;
      let rotatedY = point.y * cosX - point.z * sinX;
      let rotatedZ = point.y * sinX + point.z * cosX;

      // Rotate around Y axis
      const tempX = rotatedX * cosY + rotatedZ * sinY;
      const tempZ = -rotatedX * sinY + rotatedZ * cosY;
      rotatedX = tempX;
      rotatedZ = tempZ;

      // Rotate around Z axis
      const finalX = rotatedX * cosZ - rotatedY * sinZ;
      const finalY = rotatedX * sinZ + rotatedY * cosZ;
      const finalZ = rotatedZ;

      // First project from 4D to 3D
      const distance4D = 30;
      const aspectRatio = canvas.offsetWidth / canvas.offsetHeight;
      const aspectRatio2 = 1/aspectRatio;
      const w = 1 / Math.max(0.1, distance4D - point.w);
      const projectedX = finalX * w * aspectRatio2;
      const projectedY = finalY * w;
      const projectedZ = finalZ * w;

      // Then project from 3D to 2D
      const distance3D = 1.5;
      const z = 1 / Math.max(0.1, distance3D - projectedZ);
      return {
        x: projectedX * z * canvas.offsetWidth + canvas.offsetWidth / 2,
        y: projectedY * z * canvas.offsetHeight + canvas.offsetHeight / 2,
        z: Math.max(0.1, z)
      };
    };

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Update rotation angles
      rotationRef.current.x += rotationRef.current.vx;
      rotationRef.current.y += rotationRef.current.vy;
      rotationRef.current.z += rotationRef.current.vz;

      // Add small random variations to rotation velocities
      const rotationJitter = 0.0005;
      rotationRef.current.vx += (Math.random() - 0.5) * rotationJitter;
      rotationRef.current.vy += (Math.random() - 0.5) * rotationJitter;
      rotationRef.current.vz += (Math.random() - 0.5) * rotationJitter;

      // Dampen rotation velocities less
      const rotationDamping = 0.995;
      rotationRef.current.vx *= rotationDamping;
      rotationRef.current.vy *= rotationDamping;
      rotationRef.current.vz *= rotationDamping;

      // Add audio-reactive boost to rotation
      const rotationBoost = 0.002;
      const avgAudioLevel = audioLevelRef.current.reduce((a, b) => a + b, 0) / 4;
      rotationRef.current.vx += (Math.random() - 0.5) * avgAudioLevel * rotationBoost;
      rotationRef.current.vy += (Math.random() - 0.5) * avgAudioLevel * rotationBoost;
      rotationRef.current.vz += (Math.random() - 0.5) * avgAudioLevel * rotationBoost;

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update point positions with audio-reactive jitter
      pointsRef.current.forEach((point, i) => {
        const jitterGain = 1.1;
        const audioIndex = i % 4;
        const jitterAmount = audioLevelRef.current[audioIndex] * jitterGain;
        
        // Add random velocity changes
        point.vx += (Math.random() - 0.5) * jitterAmount;
        point.vy += (Math.random() - 0.5) * jitterAmount;
        point.vz += (Math.random() - 0.5) * jitterAmount;
        point.vw += (Math.random() - 0.5) * jitterAmount;

        // Apply velocity with damping
        const damping = 0.92;
        point.x += point.vx;
        point.y += point.vy;
        point.z += point.vz;
        point.w += point.vw;
        point.vx *= damping;
        point.vy *= damping;
        point.vz *= damping;
        point.vw *= damping;

        // Spring force back to base position
        const springStrength = 0.15;
        point.vx += (point.baseX - point.x) * springStrength;
        point.vy += (point.baseY - point.y) * springStrength;
        point.vz += (point.baseZ - point.z) * springStrength;
        point.vw += (point.baseW - point.w) * springStrength;
      });

      // Project and draw points
      const projectedPoints = pointsRef.current.map(project);

      // Draw edges with depth-based opacity
      const edges = [
        // Inner cube
        [0, 1], [1, 2], [2, 3], [3, 0],
        [4, 5], [5, 6], [6, 7], [7, 4],
        [0, 4], [1, 5], [2, 6], [3, 7],
        // Outer cube
        [8, 9], [9, 10], [10, 11], [11, 8],
        [12, 13], [13, 14], [14, 15], [15, 12],
        [8, 12], [9, 13], [10, 14], [11, 15],
        // Connections between cubes
        [0, 8], [1, 9], [2, 10], [3, 11],
        [4, 12], [5, 13], [6, 14], [7, 15]
      ];

      edges.forEach(([i, j]) => {
        const p1 = projectedPoints[i];
        const p2 = projectedPoints[j];
        const avgZ = Math.max(0.1, (p1.z + p2.z) / 2);
        const opacity = Math.min(1, avgZ * 0.5);

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `hsla(200, 80%, 70%, ${opacity * 0.3})`;
        ctx.lineWidth = Math.max(0.5, avgZ * 2);
        ctx.stroke();
      });

      // Draw vertices with protection against negative radii
      projectedPoints.forEach((point, i) => {
        const audioIndex = i % 4;
        const audioLevel = audioLevelRef.current[audioIndex];
        const z = Math.max(0.1, point.z);
        
        // Calculate radius with protection against negative values
        const pulseGain = 3;
        const baseRadius = Math.max(0.1, z * 2);
        const pulseAmount = Math.max(0, audioLevel * pulseGain);
        const radius = Math.max(0.1, baseRadius + pulseAmount);
        
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
        
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, radius
        );
        const alpha = Math.min(0.8, z * 0.8);
        gradient.addColorStop(0, `hsla(${200 + i * 20}, 80%, 70%, ${alpha})`);
        gradient.addColorStop(0.5, `hsla(${200 + i * 20}, 80%, 70%, ${alpha * 0.3})`);
        gradient.addColorStop(1, 'rgba(18, 18, 18, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fill();
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

export { VectorArt3 }; 