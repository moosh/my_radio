import React, { useEffect, useRef } from 'react';

interface Cell {
  state: number;  // 0-3 for different states
  nextState: number;
  energy: number;
  age: number;
}

interface VectorArt5Props {
  audioElement: HTMLAudioElement | null;
}

// Helper function to convert HSL to RGB
const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [
    Math.round(255 * f(0)),
    Math.round(255 * f(8)),
    Math.round(255 * f(4))
  ];
};

const VectorArt5: React.FC<VectorArt5Props> = ({ audioElement }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<Cell[][]>([]);
  const animationFrameRef = useRef<number>();
  const audioLevelRef = useRef<number[]>([0, 0, 0, 0]);
  const paletteRef = useRef<[number, number, number][]>([]);
  const timeRef = useRef(0);

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

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Initialize grid with cell size of 2x2 pixels for more detail
      const cellSize = 2;
      const cols = Math.ceil(canvas.offsetWidth / cellSize);
      const rows = Math.ceil(canvas.offsetHeight / cellSize);

      gridRef.current = Array(rows).fill(0).map(() =>
        Array(cols).fill(0).map(() => ({
          state: Math.random() > 0.92 ? Math.floor(Math.random() * 3) + 1 : 0,
          nextState: 0,
          energy: 0,
          age: 0
        }))
      );

      // Generate expanded color palette
      const numColors = 48;
      paletteRef.current = Array(numColors).fill(0).map((_, i) => {
        const progress = i / (numColors - 1);
        const hue = (progress * 180 + 200) % 360; // Wider color range
        const saturation = 70 + Math.sin(progress * Math.PI) * 20;
        const lightness = 40 + progress * 30;
        return hslToRgb(hue, saturation, lightness);
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const animate = () => {
      if (!canvas || !ctx) return;

      // Ensure palette is initialized
      if (paletteRef.current.length === 0) {
        const numColors = 48;
        paletteRef.current = Array(numColors).fill(0).map((_, i) => {
          const progress = i / (numColors - 1);
          const hue = (progress * 180 + 200) % 360;
          const saturation = 70 + Math.sin(progress * Math.PI) * 20;
          const lightness = 40 + progress * 30;
          return hslToRgb(hue, saturation, lightness);
        });
      }

      const cellSize = 2;
      let grid = gridRef.current;
      if (!grid || !grid[0]) {
        // Re-initialize grid if it's not set up
        const cols = Math.ceil(canvas.offsetWidth / cellSize);
        const rows = Math.ceil(canvas.offsetHeight / cellSize);
        gridRef.current = Array(rows).fill(0).map(() =>
          Array(cols).fill(0).map(() => ({
            state: Math.random() > 0.92 ? Math.floor(Math.random() * 3) + 1 : 0,
            nextState: 0,
            energy: 0,
            age: 0
          }))
        );
        grid = gridRef.current;
      }

      const rows = grid.length;
      const cols = grid[0].length;
      const imageData = ctx.createImageData(canvas.offsetWidth, canvas.offsetHeight);
      const data = imageData.data;

      timeRef.current += 1;
      const globalAudioLevel = Math.max(...audioLevelRef.current);

      // Update cell states based on enhanced cellular automata rules and audio
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const cell = grid[i][j];
          let neighbors = [0, 0, 0, 0]; // Count of each state type

          // Count neighbors in larger radius for more interesting patterns
          for (let di = -2; di <= 2; di++) {
            for (let dj = -2; dj <= 2; dj++) {
              if (di === 0 && dj === 0) continue;
              const ni = (i + di + rows) % rows;
              const nj = (j + dj + cols) % cols;
              const state = grid[ni][nj].state;
              if (state > 0) {
                neighbors[state]++;
              }
            }
          }

          // Audio-reactive rules
          const audioIndex = (i + j) % 4;
          const audioLevel = audioLevelRef.current[audioIndex];
          const totalNeighbors = neighbors.reduce((a, b) => a + b, 0);

          // Complex state transition rules
          if (cell.state === 0) {
            // Dead cell can become any active state
            if (totalNeighbors >= 3 && totalNeighbors <= 4 + Math.floor(audioLevel * 3)) {
              const dominantState = neighbors.indexOf(Math.max(...neighbors));
              cell.nextState = dominantState || 1;
            } else {
              cell.nextState = 0;
            }
          } else {
            // Living cells evolve based on neighbor composition
            if (totalNeighbors < 2 || totalNeighbors > 6 + Math.floor(audioLevel * 2)) {
              cell.nextState = 0; // Death by isolation or overcrowding
            } else {
              // State evolution
              const currentStateCount = neighbors[cell.state];
              if (currentStateCount >= 2) {
                cell.nextState = cell.state;
              } else {
                // Transition to most common neighbor state
                cell.nextState = neighbors.indexOf(Math.max(...neighbors));
              }
            }
          }

          // Update cell energy and age
          if (cell.nextState > 0) {
            cell.energy = Math.min(1, cell.energy * 0.95 + audioLevel * 0.3);
            cell.age++;
          } else {
            cell.energy *= 0.8;
            cell.age = 0;
          }

          // Draw cells with enhanced visual effects
          const baseIndex = (i * cellSize * canvas.offsetWidth + j * cellSize) * 4;
          const energyLevel = cell.energy * (1 + Math.sin(timeRef.current * 0.05 + i * 0.1 + j * 0.1) * 0.2);
          const colorIndex = Math.min(
            Math.max(0, Math.floor(energyLevel * (paletteRef.current.length - 1))),
            paletteRef.current.length - 1
          );
          const color = paletteRef.current[colorIndex] || [0, 0, 0];
          const [r, g, b] = color;

          // Fill cell pixels with glow effect
          for (let pi = 0; pi < cellSize; pi++) {
            for (let pj = 0; pj < cellSize; pj++) {
              const index = baseIndex + (pi * canvas.offsetWidth + pj) * 4;
              const ageFactor = Math.min(1, cell.age / 100);
              data[index] = r;
              data[index + 1] = g;
              data[index + 2] = b;
              data[index + 3] = cell.state > 0 ? Math.floor(255 * (0.7 + ageFactor * 0.3)) : 0;
            }
          }
        }
      }

      // Apply the image data
      ctx.putImageData(imageData, 0, 0);

      // Enhanced bloom effect
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowBlur = 15 + globalAudioLevel * 10;
      ctx.shadowColor = `hsla(${(timeRef.current / 2) % 360}, 80%, 60%, ${0.3 + globalAudioLevel * 0.4})`;
      
      // Update states for next frame
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          grid[i][j].state = grid[i][j].nextState;
        }
      }

      // Audio-reactive seeding of new cells
      if (Math.random() < 0.15 + globalAudioLevel * 0.3) {
        const numSeeds = 2 + Math.floor(globalAudioLevel * 5);
        for (let i = 0; i < numSeeds; i++) {
          const row = Math.floor(Math.random() * rows);
          const col = Math.floor(Math.random() * cols);
          grid[row][col].state = Math.floor(Math.random() * 3) + 1;
          grid[row][col].energy = 1;
          grid[row][col].age = 0;
        }
      }

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

export { VectorArt5 }; 