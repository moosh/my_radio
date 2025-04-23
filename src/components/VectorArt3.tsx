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

interface HypercubeState {
  points: Point4D[];
  rotation: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
  };
  position: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  scale: number;
  pointScale: number;
  rotationSpeed: number;
  baseHue: number;
}

const VectorArt3: React.FC<VectorArt3Props> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cubesRef = useRef<HypercubeState[]>([]);
  const animationFrameRef = useRef<number>();
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]); // Four frequency ranges

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

    // Initialize multiple hypercubes
    const numCubes = 11;
    cubesRef.current = Array.from({ length: numCubes }, (_, index) => {
      const baseSize = Math.min(canvas.offsetWidth, canvas.offsetHeight) * 0.08;
      const scale = 0.3 + (Math.random() * 0.7); // Random scale between 0.3 and 1.0
      const size = baseSize * scale;
      
      // Random initial position within canvas bounds
      const margin = size * 2; // Keep cubes away from edges
      const x = margin + Math.random() * (canvas.offsetWidth - 2 * margin);
      const y = margin + Math.random() * (canvas.offsetHeight - 2 * margin);
      
      // Random initial velocity
      const speed = 0.2 + Math.random() * 0.3;
      const angle = Math.random() * Math.PI * 2;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Create points for this cube
      const points = [
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

      return {
        points,
        rotation: {
          x: Math.random() * Math.PI * 2,
          y: Math.random() * Math.PI * 2,
          z: Math.random() * Math.PI * 2,
          vx: (Math.random() - 0.5) * 0.01 * (1 + Math.random()),
          vy: (Math.random() - 0.5) * 0.01 * (1 + Math.random()),
          vz: (Math.random() - 0.5) * 0.01 * (1 + Math.random())
        },
        position: {
          x,
          y,
          vx,
          vy
        },
        scale,
        pointScale: 0.5 + Math.random() * 1.5,
        rotationSpeed: 0.8 + Math.random() * 0.4,
        baseHue: (index * 360 / numCubes + Math.random() * 20) % 360
      };
    });

    // Project 4D point to 2D with protection against division by zero
    const project = (point: Point4D, rotation: { x: number; y: number; z: number }, position: { x: number; y: number }): { x: number; y: number; z: number } => {
      // Apply 3D rotation to the point
      const cosX = Math.cos(rotation.x);
      const sinX = Math.sin(rotation.x);
      const cosY = Math.cos(rotation.y);
      const sinY = Math.sin(rotation.y);
      const cosZ = Math.cos(rotation.z);
      const sinZ = Math.sin(rotation.z);

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
      const distance4D = 15;
      const aspectRatio = canvas.offsetWidth / canvas.offsetHeight;
      const w = 1 / Math.max(0.1, distance4D - point.w);
      const projectedX = finalX * w / aspectRatio;
      const projectedY = finalY * w;
      const projectedZ = finalZ * w;

      // Then project from 3D to 2D
      const distance3D = 1.5;
      const z = 1 / Math.max(0.1, distance3D - projectedZ);
      return {
        x: projectedX * z * canvas.offsetWidth + position.x,
        y: projectedY * z * canvas.offsetHeight + position.y,
        z: Math.max(0.1, z)
      };
    };

    // Animation function
    const animate = () => {
      if (!canvas || !ctx) return;

      // Clear canvas with fade effect
      ctx.fillStyle = 'rgba(18, 18, 18, 0.1)';
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      // Update and draw each cube
      cubesRef.current.forEach((cube, cubeIndex) => {
        // Update cube position
        cube.position.x += cube.position.vx;
        cube.position.y += cube.position.vy;

        // Calculate cube bounds for collision
        const maxRadius = cube.scale * Math.min(canvas.offsetWidth, canvas.offsetHeight) * 0.08 * 2;

        // Bounce off edges with slight randomization
        if (cube.position.x - maxRadius <= 0 || cube.position.x + maxRadius >= canvas.offsetWidth) {
          cube.position.vx *= -1;
          // Add slight random variation to velocity on bounce
          cube.position.vx += (Math.random() - 0.5) * 0.1;
          cube.position.vy += (Math.random() - 0.5) * 0.1;
        }
        if (cube.position.y - maxRadius <= 0 || cube.position.y + maxRadius >= canvas.offsetHeight) {
          cube.position.vy *= -1;
          // Add slight random variation to velocity on bounce
          cube.position.vx += (Math.random() - 0.5) * 0.1;
          cube.position.vy += (Math.random() - 0.5) * 0.1;
        }

        // Keep velocity within bounds
        const maxSpeed = 2;
        const speed = Math.hypot(cube.position.vx, cube.position.vy);
        if (speed > maxSpeed) {
          cube.position.vx = (cube.position.vx / speed) * maxSpeed;
          cube.position.vy = (cube.position.vy / speed) * maxSpeed;
        }

        // Update rotation angles with individual speeds
        cube.rotation.x += cube.rotation.vx * cube.rotationSpeed;
        cube.rotation.y += cube.rotation.vy * cube.rotationSpeed;
        cube.rotation.z += cube.rotation.vz * cube.rotationSpeed;

        // Add small random variations to rotation velocities
        const rotationJitter = 0.0005 * cube.rotationSpeed;
        cube.rotation.vx += (Math.random() - 0.5) * rotationJitter;
        cube.rotation.vy += (Math.random() - 0.5) * rotationJitter;
        cube.rotation.vz += (Math.random() - 0.5) * rotationJitter;

        // Dampen rotation velocities
        const rotationDamping = 0.995;
        cube.rotation.vx *= rotationDamping;
        cube.rotation.vy *= rotationDamping;
        cube.rotation.vz *= rotationDamping;

        // Add audio-reactive boost to rotation
        const rotationBoost = 0.002 * cube.rotationSpeed;
        const audioIndex = cubeIndex % 4;
        const audioLevel = audioLevelRef.current[audioIndex];
        cube.rotation.vx += (Math.random() - 0.5) * audioLevel * rotationBoost;
        cube.rotation.vy += (Math.random() - 0.5) * audioLevel * rotationBoost;
        cube.rotation.vz += (Math.random() - 0.5) * audioLevel * rotationBoost;

        // Update point positions with audio-reactive jitter
        cube.points.forEach((point, i) => {
          const jitterGain = 1.1 * cube.scale;
          const pointAudioIndex = (cubeIndex + i) % 4;
          const jitterAmount = audioLevelRef.current[pointAudioIndex] * jitterGain;
          
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

        // Project and draw points with updated position
        const projectedPoints = cube.points.map(p => project(p, cube.rotation, cube.position));

        // Draw edges
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
          const opacity = Math.min(1, avgZ * 0.5) * cube.scale;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `hsla(${cube.baseHue}, 80%, 70%, ${opacity * 0.3})`;
          ctx.lineWidth = Math.max(0.5, avgZ * 2 * cube.scale);
          ctx.stroke();
        });

        // Draw vertices
        projectedPoints.forEach((point, i) => {
          const pointAudioIndex = (cubeIndex + i) % 4;
          const audioLevel = audioLevelRef.current[pointAudioIndex];
          const z = Math.max(0.1, point.z);
          
          const baseRadius = Math.max(0.1, z * 2 * cube.pointScale);
          const pulseAmount = Math.max(0, audioLevel * 3 * cube.scale);
          const radius = Math.max(0.1, baseRadius + pulseAmount);
          
          ctx.beginPath();
          ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          
          const gradient = ctx.createRadialGradient(
            point.x, point.y, 0,
            point.x, point.y, radius
          );
          const alpha = Math.min(0.8, z * 0.8) * cube.scale;
          gradient.addColorStop(0, `hsla(${cube.baseHue + i * 20}, 80%, 70%, ${alpha})`);
          gradient.addColorStop(0.5, `hsla(${cube.baseHue + i * 20}, 80%, 70%, ${alpha * 0.3})`);
          gradient.addColorStop(1, 'rgba(18, 18, 18, 0)');
          
          ctx.fillStyle = gradient;
          ctx.fill();
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

export { VectorArt3 }; 