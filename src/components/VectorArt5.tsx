import React, { useEffect, useRef } from 'react';

interface Cell {
  state: number;  // 0-3 for different states
  nextState: number;
  energy: number;
  age: number;
  transitionProgress: number; // For smooth state transitions
  visualState: number; // For interpolated display
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
  const lastUpdateRef = useRef(0);
  const baseUpdateInterval = 100;
  const transitionSpeedRef = useRef(0.05); // Even slower transitions
  const energyDecayRef = useRef(0.98); // More stable energy decay
  const lastAudioBoostRef = useRef(0);
  const smoothedAudioRef = useRef(0);

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
      const dpr = window.devicePixelRatio;
      const logicalWidth = canvas.offsetWidth;
      const logicalHeight = canvas.offsetHeight;
      
      // Set canvas buffer size to match physical pixels
      canvas.width = logicalWidth * dpr;
      canvas.height = logicalHeight * dpr;
      
      // Scale the context to handle DPR
      ctx.scale(dpr, dpr);

      // Base size in logical pixels (CSS pixels)
      const baseCellSize = 4;
      
      // Calculate grid dimensions based on logical pixels
      const cols = Math.ceil(logicalWidth / baseCellSize);
      const rows = Math.ceil(logicalHeight / baseCellSize);

      gridRef.current = Array(rows).fill(0).map(() =>
        Array(cols).fill(0).map(() => ({
          state: Math.random() > 0.92 ? Math.floor(Math.random() * 3) + 1 : 0,
          nextState: 0,
          energy: 0,
          age: 0,
          transitionProgress: 1,
          visualState: 0
        }))
      );

      // Generate monochromatic palette (black to white)
      const numColors = 32; // Reduced for smoother transitions
      paletteRef.current = Array(numColors).fill(0).map((_, i) => {
        const intensity = Math.round((i / (numColors - 1)) * 255);
        return [intensity, intensity, intensity] as [number, number, number];
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    const animate = () => {
      if (!canvas || !ctx) return;

      const currentTime = Date.now();
      const globalAudioLevel = Math.max(...audioLevelRef.current);
      
      // Smooth audio transitions
      smoothedAudioRef.current = smoothedAudioRef.current * 0.9 + globalAudioLevel * 0.1;
      const smoothedAudio = smoothedAudioRef.current;
      
      const dpr = window.devicePixelRatio;
      const logicalWidth = canvas.offsetWidth;
      const logicalHeight = canvas.offsetHeight;
      const physicalWidth = Math.floor(logicalWidth * dpr);
      const physicalHeight = Math.floor(logicalHeight * dpr);
      
      // Ensure canvas dimensions match physical pixels
      if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;
        ctx.scale(dpr, dpr);
      }
      
      // Dynamic update interval based on audio level
      const dynamicInterval = Math.max(25, baseUpdateInterval - (globalAudioLevel * 75));
      const shouldUpdateStates = currentTime - lastUpdateRef.current >= dynamicInterval;

      // Base size in physical pixels
      const baseCellSize = Math.floor(4 * dpr);
      
      let grid = gridRef.current;
      if (!grid || !grid[0]) {
        // Re-initialize grid if it's not set up
        const cols = Math.ceil(logicalWidth / 4);  // Use logical pixels for grid size
        const rows = Math.ceil(logicalHeight / 4);
        gridRef.current = Array(rows).fill(0).map(() =>
          Array(cols).fill(0).map(() => ({
            state: Math.random() > 0.92 ? Math.floor(Math.random() * 3) + 1 : 0,
            nextState: 0,
            energy: 0,
            age: 0,
            transitionProgress: 1,
            visualState: 0
          }))
        );
        grid = gridRef.current;
      }

      const rows = grid.length;
      const cols = grid[0].length;
      
      // Create image data using physical dimensions
      const imageData = ctx.createImageData(physicalWidth, physicalHeight);
      const data = imageData.data;

      timeRef.current += 1;

      // Update cell states based on enhanced cellular automata rules and audio
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          const cell = grid[i][j];
          
          if (shouldUpdateStates) {
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

            // Smoother audio boost with improved temporal averaging
            const audioIndex = (i + j) % 4;
            const audioLevel = audioLevelRef.current[audioIndex];
            const totalNeighbors = neighbors.reduce((a, b) => a + b, 0);
            
            // Smooth audio boost transitions
            const targetBoost = Math.pow(audioLevel, 1.2) * 1.5;
            lastAudioBoostRef.current = lastAudioBoostRef.current * 0.85 + targetBoost * 0.15;
            const audioBoost = lastAudioBoostRef.current;

            // Complex state transition rules with smoother influence
            if (cell.state === 0) {
              if (totalNeighbors >= 2 && totalNeighbors <= 4 + Math.floor(audioBoost * 3)) {
                const dominantState = neighbors.indexOf(Math.max(...neighbors));
                cell.nextState = dominantState || 1;
                // More controlled activation with temporal stability
                if (Math.random() < audioBoost * 0.2 && totalNeighbors >= 3) {
                  const newState = Math.floor(Math.random() * 3) + 1;
                  // Only change state if significantly different from current neighbors
                  if (neighbors[newState] < totalNeighbors * 0.3) {
                    cell.nextState = newState;
                  }
                }
              } else {
                cell.nextState = 0;
              }
            } else {
              const survivalThreshold = 5 + Math.floor(audioBoost * 2);
              if (totalNeighbors < 2 || totalNeighbors > survivalThreshold) {
                // Gradual death with improved stability
                if (Math.random() > audioBoost * 0.3 + cell.energy * 0.2) {
                  cell.nextState = 0;
                } else {
                  cell.nextState = cell.state;
                }
              } else {
                const currentStateCount = neighbors[cell.state];
                const stateStability = currentStateCount / totalNeighbors;
                
                if (stateStability >= 0.25 - audioBoost * 0.15) {
                  cell.nextState = cell.state;
                  // More stable mutations
                  if (Math.random() < audioBoost * 0.15 && totalNeighbors > 3) {
                    const neighborStates = neighbors.map((count, state) => 
                      state > 0 ? Array(count).fill(state) : []
                    ).flat();
                    if (neighborStates.length > 0) {
                      const newState = neighborStates[Math.floor(Math.random() * neighborStates.length)];
                      // Only mutate if the new state is common enough
                      if (neighbors[newState] >= 2) {
                        cell.nextState = newState;
                      }
                    }
                  }
                } else {
                  // Smoother state transitions
                  const maxCount = Math.max(...neighbors);
                  const possibleStates = neighbors
                    .map((count, state) => state > 0 && count >= maxCount - 1 ? state : 0)
                    .filter(state => state > 0);
                  cell.nextState = possibleStates[Math.floor(Math.random() * possibleStates.length)] || cell.state;
                }
              }
            }

            // Smoother energy updates with improved temporal stability
            if (cell.nextState > 0) {
              const targetEnergy = Math.min(1, audioBoost * 0.6 + 0.4);
              const energyDelta = targetEnergy - cell.energy;
              cell.energy += energyDelta * 0.1; // Gradual energy adjustment
              cell.age++;
            } else {
              cell.energy *= energyDecayRef.current;
              cell.age = 0;
            }

            // Smoother transition initiation
            if (cell.nextState !== cell.state) {
              // Only start transition if energy levels are appropriate
              if (cell.nextState === 0 || cell.energy > 0.3) {
                cell.transitionProgress = 0;
              } else {
                cell.nextState = cell.state; // Maintain current state if energy is too low
              }
            }
          }

          // Smoother transition progress
          if (cell.transitionProgress < 1) {
            cell.transitionProgress = Math.min(1, 
              cell.transitionProgress + transitionSpeedRef.current * (1 - Math.pow(cell.transitionProgress, 2))
            );
          }

          // Improved visual state interpolation
          const targetState = shouldUpdateStates ? cell.nextState : cell.state;
          const startState = cell.state;
          const progress = Math.sin(cell.transitionProgress * Math.PI / 2); // Smooth easing
          cell.visualState = startState + (targetState - startState) * progress;

          // Enhanced visual effects with smoother transitions
          const x = Math.floor(j * baseCellSize);
          const y = Math.floor(i * baseCellSize);
          
          // Smoother energy visualization with reduced oscillation
          const timeScale = 0.015; // Slower time scale
          const energyLevel = cell.energy * (
            0.9 + 
            Math.sin(timeRef.current * timeScale + i * 0.02 + j * 0.02) * 0.08 +
            Math.cos(timeRef.current * timeScale * 1.5 + i * 0.03 + j * 0.03) * 0.02
          );

          // Improved color transitions for monochrome
          const stateInfluence = Math.max(0, cell.visualState);
          const rawColorIndex = (energyLevel * stateInfluence) * (paletteRef.current.length - 1);
          const baseColorIndex = Math.floor(rawColorIndex);
          const colorIndex = Math.min(Math.max(0, baseColorIndex), paletteRef.current.length - 1);
          
          // Enhanced color interpolation
          const color = paletteRef.current[colorIndex];
          const nextColor = paletteRef.current[Math.min(colorIndex + 1, paletteRef.current.length - 1)];
          const colorFraction = rawColorIndex - baseColorIndex;
          
          // Smoother interpolation for monochrome
          const t = colorFraction;
          const intensity = Math.round(color[0] * (1 - t) + nextColor[0] * t);
          const r = intensity;
          const g = intensity;
          const b = intensity;

          // Fill pixels with enhanced smoothing
          for (let pi = 0; pi < baseCellSize; pi++) {
            for (let pj = 0; pj < baseCellSize; pj++) {
              const pixelX = x + pj;
              const pixelY = y + pi;
              
              if (pixelX < physicalWidth && pixelY < physicalHeight) {
                const index = (pixelY * physicalWidth + pixelX) * 4;
                const ageFactor = Math.min(1, cell.age / 150);
                const transitionFactor = Math.sin(cell.transitionProgress * Math.PI / 2);
                const alpha = cell.visualState > 0 
                  ? Math.floor(255 * (0.8 + ageFactor * 0.2) * transitionFactor)
                  : 0;
                
                data[index] = r;
                data[index + 1] = g;
                data[index + 2] = b;
                data[index + 3] = alpha;
              }
            }
          }
        }
      }

      // Apply the image data
      ctx.putImageData(imageData, 0, 0);

      // Monochromatic bloom effect
      ctx.globalCompositeOperation = 'lighter';
      const bloomIntensity = 8 + smoothedAudio * 6;
      ctx.shadowBlur = bloomIntensity;
      ctx.shadowColor = `rgba(255, 255, 255, ${0.2 + smoothedAudio * 0.2})`;
      
      if (shouldUpdateStates) {
        // Update states for next frame
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            if (grid[i][j].transitionProgress >= 0.95) { // Only update state when transition is nearly complete
              grid[i][j].state = grid[i][j].nextState;
            }
          }
        }

        // Audio-reactive seeding of new cells with enhanced sensitivity
        if (Math.random() < 0.15 + globalAudioLevel * 0.5) { // Increased seeding probability
          const numSeeds = 3 + Math.floor(globalAudioLevel * 10); // More seeds and faster seeding
          for (let i = 0; i < numSeeds; i++) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);
            grid[row][col].state = Math.floor(Math.random() * 3) + 1;
            grid[row][col].energy = 1;
            grid[row][col].age = 0;
          }
        }

        lastUpdateRef.current = currentTime;
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