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
          state: Math.random() > 0.96 ? Math.floor(Math.random() * 3) + 1 : 0,
          nextState: 0,
          energy: 0,
          age: 0,
          transitionProgress: 1,
          visualState: 0
        }))
      );

      // Generate base monochromatic palette that will be tinted
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
      
      // Smooth audio transitions with increased sensitivity
      smoothedAudioRef.current = smoothedAudioRef.current * 0.6 + globalAudioLevel * 0.4; // Even faster audio response
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
      
      // Dynamic update interval more responsive to audio
      const dynamicInterval = Math.max(15, baseUpdateInterval - (globalAudioLevel * 120)); // Faster updates with audio
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
            state: Math.random() > 0.96 ? Math.floor(Math.random() * 3) + 1 : 0,
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

      // Calculate the current hue based on time
      const hueShiftSpeed = 0.1; // Controls how fast the hue changes
      const currentHue = (timeRef.current * hueShiftSpeed) % 360;
      
      // Create tint color based on current hue (at full saturation but mid lightness)
      const [tintR, tintG, tintB] = hslToRgb(currentHue, 40, 50);
      const tintFactors = [
        tintR / 255,
        tintG / 255,
        tintB / 255
      ];

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

            // Enhanced audio boost with improved temporal averaging
            const audioIndex = (i + j) % 4;
            const audioLevel = audioLevelRef.current[audioIndex];
            const totalNeighbors = neighbors.reduce((a, b) => a + b, 0);
            
            // More dramatic audio boost transitions
            const targetBoost = Math.pow(audioLevel, 0.8) * 3.0; // Increased audio influence and reduced curve
            lastAudioBoostRef.current = lastAudioBoostRef.current * 0.5 + targetBoost * 0.5; // Much faster response
            const audioBoost = lastAudioBoostRef.current;

            // Complex state transition rules with enhanced audio influence
            if (cell.state === 0) {
              if (totalNeighbors >= 2 && totalNeighbors <= 4 + Math.floor(audioBoost * 4)) { // More audio influence on threshold
                const dominantState = neighbors.indexOf(Math.max(...neighbors));
                cell.nextState = dominantState || 1;
                // More aggressive audio-reactive activation
                if (Math.random() < audioBoost * 0.4 && totalNeighbors >= 2) { // Higher activation chance
                  const newState = Math.floor(Math.random() * 3) + 1;
                  if (neighbors[newState] < totalNeighbors * 0.4) { // More lenient neighbor requirement
                    cell.nextState = newState;
                  }
                }
              } else {
                cell.nextState = 0;
              }
            } else {
              const survivalThreshold = 4 + Math.floor(audioBoost * 4); // More audio influence on survival
              if (totalNeighbors < 2 || totalNeighbors > survivalThreshold) {
                // More audio-reactive death probability
                if (Math.random() > audioBoost * 0.5 + cell.energy * 0.2) { // Higher survival chance with audio
                  cell.nextState = 0;
                } else {
                  cell.nextState = cell.state;
                }
              } else {
                const currentStateCount = neighbors[cell.state];
                const stateStability = currentStateCount / totalNeighbors;
                
                // More audio-reactive stability threshold
                if (stateStability >= 0.25 - audioBoost * 0.2) { // Lower base stability requirement
                  cell.nextState = cell.state;
                  // Enhanced audio-reactive mutations
                  if (Math.random() < audioBoost * 0.35 && totalNeighbors > 2) { // More mutations with audio
                    const neighborStates = neighbors.map((count, state) => 
                      state > 0 ? Array(count).fill(state) : []
                    ).flat();
                    if (neighborStates.length > 0) {
                      const newState = neighborStates[Math.floor(Math.random() * neighborStates.length)];
                      if (neighbors[newState] >= 2) {
                        cell.nextState = newState;
                      }
                    }
                  }
                } else {
                  cell.nextState = 0;
                }
              }
            }

            // More responsive energy updates
            if (cell.nextState > 0) {
              const targetEnergy = Math.min(1, audioBoost * 1.2 + 0.2); // More audio influence on energy
              const energyDelta = targetEnergy - cell.energy;
              cell.energy += energyDelta * 0.3; // Even faster energy adjustment
              cell.age++;
            } else {
              cell.energy *= 0.95 + audioBoost * 0.03; // Audio-reactive decay
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
          
          // Enhanced energy visualization with audio influence
          const timeScale = 0.02 + smoothedAudio * 0.01; // Audio-reactive time scale
          const energyLevel = cell.energy * (
            0.9 + 
            Math.sin(timeRef.current * timeScale + i * 0.02 + j * 0.02) * (0.08 + smoothedAudio * 0.04) +
            Math.cos(timeRef.current * timeScale * 1.5 + i * 0.03 + j * 0.03) * (0.02 + smoothedAudio * 0.02)
          );

          // Improved color transitions for shifting monochrome
          const stateInfluence = Math.max(0, cell.visualState);
          const rawColorIndex = (energyLevel * stateInfluence) * (paletteRef.current.length - 1);
          const baseColorIndex = Math.floor(rawColorIndex);
          const colorIndex = Math.min(Math.max(0, baseColorIndex), paletteRef.current.length - 1);
          
          // Enhanced color interpolation with tinting
          const color = paletteRef.current[colorIndex];
          const nextColor = paletteRef.current[Math.min(colorIndex + 1, paletteRef.current.length - 1)];
          const colorFraction = rawColorIndex - baseColorIndex;
          
          // Smoother interpolation with tinting
          const t = colorFraction;
          const baseIntensity = Math.round(color[0] * (1 - t) + nextColor[0] * t);
          
          // Apply tint while preserving intensity
          const tintStrength = 0.7; // How strong the tint is (0 = grayscale, 1 = full tint)
          const r = Math.round(baseIntensity * (1 - tintStrength + tintStrength * tintFactors[0]));
          const g = Math.round(baseIntensity * (1 - tintStrength + tintStrength * tintFactors[1]));
          const b = Math.round(baseIntensity * (1 - tintStrength + tintStrength * tintFactors[2]));

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

      // Enhanced bloom effect with more audio reactivity
      ctx.globalCompositeOperation = 'lighter';
      const bloomIntensity = 12 + smoothedAudio * 15; // More dramatic bloom with audio
      ctx.shadowBlur = bloomIntensity;
      ctx.shadowColor = `hsla(${currentHue}, ${70 + smoothedAudio * 20}%, ${55 + smoothedAudio * 10}%, ${0.3 + smoothedAudio * 0.4})`;
      
      if (shouldUpdateStates) {
        // Update states for next frame
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            if (grid[i][j].transitionProgress >= 0.95) { // Only update state when transition is nearly complete
              grid[i][j].state = grid[i][j].nextState;
            }
          }
        }

        // Enhanced audio-reactive seeding with more dramatic response
        if (Math.random() < 0.2 + globalAudioLevel * 0.6) { // Higher seeding probability
          const numSeeds = 4 + Math.floor(globalAudioLevel * 16); // More seeds with audio
          for (let i = 0; i < numSeeds; i++) {
            const row = Math.floor(Math.random() * rows);
            const col = Math.floor(Math.random() * cols);
            if (grid[row][col].state === 0) {
              grid[row][col].state = Math.floor(Math.random() * 3) + 1;
              grid[row][col].energy = 1;
              grid[row][col].age = 0;
            }
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