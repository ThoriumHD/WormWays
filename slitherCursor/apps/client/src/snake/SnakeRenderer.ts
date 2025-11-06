import { SnakeBody, SNAKE } from './SnakeBody';

type Camera = { x: number; y: number; zoom: number };
type Vec2 = { x: number; y: number };

// Boost effects constants from original
const BOOST = {
  GLOW_RADIUS_SCALE: 1.5,
  PASSIVE_ALPHA: 0.10,        
  BASE_ALPHA: 0.28,
  FLICKER_GAIN: 0.15,
  FLICKER_OMEGA: 12.0,
  FLICKER_PHASE_STEP: Math.PI * 0.4,
  PULSE_SPEED_PX_PER_S: 512,
  PULSE_SIGMA_R: 2.3,
  PULSE_GAIN: 0.55,
  PULSE_SPAWN_INTERVAL_S: 0.4,
  MAX_PULSES: 1000,
  DECAY_SECONDS: 0.12,
  PULSE_SPEED_REFERENCE_LENGTH: 800, // Reference length for speed scaling (increase to scale less aggressively)
  PULSE_SPEED_SCALE_POWER: 0.3 // Power for speed scaling (0.5 = square root, 1.0 = linear, lower = more gradual)
};

export class SnakeRenderer {
  private ctx: CanvasRenderingContext2D;
  private tClock = 0;
  private lastDt = 0;

  // Pulse system removed - now stored per-snake in SnakeBody
  
  // Eye tracking
private lastGlobalPointer: { x: number; y: number } | null = null;
private pupilTargetLocal: { x: number; y: number } | null = null;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    
    // Track mouse for eye following
    document.addEventListener('mousemove', (e) => {
      this.lastGlobalPointer = { x: e.clientX, y: e.clientY };
    });
  }

  /** Generate darker and lighter variants of a color for gradients */
  private generateColorVariants(baseColor: string) {
    // Parse hex color
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Generate variants
    const lighten = (factor: number) => {
      const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
      const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
      const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    const darken = (factor: number) => {
      const newR = Math.max(0, Math.floor(r * (1 - factor)));
      const newG = Math.max(0, Math.floor(g * (1 - factor)));
      const newB = Math.max(0, Math.floor(b * (1 - factor)));
      return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
    };
    
    return {
      light: lighten(0.2),    // 20% lighter
      base: baseColor,         // Original color
      dark: darken(0.3),       // 30% darker
      darker: darken(0.5)      // 50% darker
    };
  }

  tick(dt: number) {
    this.tClock += dt;
    this.lastDt = dt;
  }

  // Render other players (from server state)
  renderOtherPlayer(playerData: any, cam: Camera) {
    if (!playerData.points || playerData.points.length === 0) return;
    
    const worldToScreen = (x: number, y: number) => ({
      x: (x - cam.x) * cam.zoom + window.innerWidth / 2,
      y: (y - cam.y) * cam.zoom + window.innerHeight / 2
    });
    
    // Render snake body segments
    for (let i = 0; i < playerData.points.length; i++) {
      const segment = playerData.points[i];
      const screenPos = worldToScreen(segment.x, segment.y);
      
      // Calculate radius based on segment position (head is larger)
      const isHead = i === 0;
      const radius = isHead ? 21 : 18; // Slightly smaller than local snake
      
      // Create gradient for snake body
      const gradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, radius
      );
      
      // Use snake's color variants
      const snakeColor = playerData.color || '#4A90E2';
      const colors = this.generateColorVariants(snakeColor);
      gradient.addColorStop(0, colors.light);
      gradient.addColorStop(1, colors.darker);
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Add subtle border
      this.ctx.strokeStyle = colors.darker;
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
      
      // Render eyes on head
      if (isHead) {
        this.renderOtherPlayerEyes(screenPos, radius, playerData.angle);
      }
    }
    
    // Render player name above head
    if (playerData.name) {
      const headPos = worldToScreen(playerData.points[0].x, playerData.points[0].y);
      this.renderPlayerName(playerData.name, headPos.x, headPos.y - 40);
    }
  }
  
  // Render eyes for other players
  private renderOtherPlayerEyes(screenPos: { x: number; y: number }, radius: number, angle: number) {
    const eyeSeparation = radius * 0.6;
    const eyeRadius = radius * 0.15;
    
    // Calculate eye positions based on snake direction
    const eyeOffsetX = Math.cos(angle) * eyeSeparation * 0.5;
    const eyeOffsetY = Math.sin(angle) * eyeSeparation * 0.5;
    
    const leftEye = {
      x: screenPos.x - eyeOffsetX,
      y: screenPos.y - eyeOffsetY
    };
    
    const rightEye = {
      x: screenPos.x + eyeOffsetX,
      y: screenPos.y + eyeOffsetY
    };
    
    // Render eyes
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.beginPath();
    this.ctx.arc(leftEye.x, leftEye.y, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.arc(rightEye.x, rightEye.y, eyeRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Render pupils
    this.ctx.fillStyle = '#000000';
    this.ctx.beginPath();
    this.ctx.arc(leftEye.x, leftEye.y, eyeRadius * 0.6, 0, Math.PI * 2);
    this.ctx.fill();
    
    this.ctx.beginPath();
    this.ctx.arc(rightEye.x, rightEye.y, eyeRadius * 0.6, 0, Math.PI * 2);
    this.ctx.fill();
  }
  
  // Render player name above snake
  private renderPlayerName(name: string, x: number, y: number) {
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = '12px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    
    // Add text shadow for better visibility
    this.ctx.shadowColor = '#000000';
    this.ctx.shadowBlur = 2;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;
    
    this.ctx.fillText(name, x, y);
    
    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;
  }

  // Render death animation dots
  renderDeathDots(deathDots: Array<{x: number, y: number, radius: number, progress: number, color: string}>, worldToScreen: (x: number, y: number) => { x: number; y: number }) {
    for (const dot of deathDots) {
      const rawScreenPos = worldToScreen(dot.x, dot.y);
      const screenPos = {
        x: Math.round(rawScreenPos.x),
        y: Math.round(rawScreenPos.y)
      };
      
      // Calculate animated properties
      const fadeProgress = Math.min(1.0, dot.progress * 2); // Fade in quickly
      const scaleProgress = Math.min(1.0, dot.progress * 1.5); // Scale up slightly slower
      
      // Animated radius (starts small, grows to full size)
      const animatedRadius = dot.radius * (0.3 + 0.7 * scaleProgress);
      
      // Create blue gradient (same as snake/boost pellets)
      const gradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, animatedRadius
      );
      
      // Blue gradient with fade (same as snake color)
      const alpha = fadeProgress;
      gradient.addColorStop(0, `rgba(74, 144, 226, ${alpha})`);     // Light blue center
      gradient.addColorStop(0.6, `rgba(53, 122, 189, ${alpha * 0.8})`); // Medium blue middle
      gradient.addColorStop(1, `rgba(30, 95, 153, ${alpha * 0.4})`);   // Dark blue edge
      
      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, animatedRadius, 0, Math.PI * 2);
      this.ctx.fill();
      
      // Add subtle highlight (like boost pellets)
      const highlightGradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, animatedRadius * 0.4
      );
      highlightGradient.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.3})`);
      highlightGradient.addColorStop(1, `rgba(255, 255, 255, 0)`);
      
      this.ctx.fillStyle = highlightGradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, animatedRadius * 0.4, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }


  renderSnake(snakeBody: SnakeBody, camera: { x: number; y: number; zoom: number }, isLocal: boolean = true) {
    // Get camera transform
    const cam = camera;
    const worldScale = cam.zoom;
    const worldOffsetX = -cam.x * cam.zoom + window.innerWidth / 2;
    const worldOffsetY = -cam.y * cam.zoom + window.innerHeight / 2;

    // Transform world coordinates to screen coordinates
    const worldToScreen = (x: number, y: number) => ({
      x: x * worldScale + worldOffsetX,
      y: y * worldScale + worldOffsetY
    });
    
    // Keep radius in world-space - it will scale automatically via worldToScreen transform
    // No need to manually scale - the canvas transform handles it
    const worldRadiusToScreen = (worldRadius: number) => worldRadius * worldScale;

    // If snake is dead, handle death animation phases
    if (snakeBody.isDead) {
      const snakeFadeProgress = snakeBody.getSnakeFadeProgress();
      
      // Phase 1: Snake fade-out (render snake with decreasing opacity)
      if (snakeFadeProgress < 1.0) {
        const points = snakeBody.getPoints();
        if (points.length > 0) {
          // Calculate arc-lengths for pulse system
          const S: number[] = new Array(points.length).fill(0);
          for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            S[i] = S[i - 1] + Math.hypot(dx, dy);
          }
          
          // Pulse system is now updated in SnakeBody.step(), no need to update here
          
          // Draw snake with fade-out effect
          this.ctx.save();
          this.ctx.globalAlpha = 1.0 - snakeFadeProgress; // Fade out
          this.drawSnakeWithEffects(snakeBody, worldToScreen, S, (r) => r * cam.zoom);
          this.drawEyesWithTracking(snakeBody, worldToScreen, cam, isLocal);
          this.ctx.restore();
        }
      }
      
      // Phase 2: Death animation complete (death dots are now server-side food)
      if (snakeFadeProgress >= 1.0) {
        // Death dots are now rendered as server food, no need to render them here
      }
      
      return;
    }

    const points = snakeBody.getPoints();
    if (points.length === 0) return;

    // Calculate arc-lengths for pulse system
    const S: number[] = new Array(points.length).fill(0);
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      S[i] = S[i - 1] + Math.hypot(dx, dy);
    }

    // Pulse system is now updated in SnakeBody.step(), no need to update here

    // Draw snake with proper visuals
    this.drawSnakeWithEffects(snakeBody, worldToScreen, S, (r) => r * cam.zoom);
    
    // Draw eyes with tracking
    this.drawEyesWithTracking(snakeBody, worldToScreen, cam, isLocal);
  }

  // updatePulses method removed - now in SnakeBody

  private drawSnakeWithEffects(snakeBody: SnakeBody, worldToScreen: (x: number, y: number) => { x: number; y: number }, S: number[], worldRadiusToScreen: (r: number) => number) {
    const points = snakeBody.getPoints();
    if (!points || points.length === 0) return;
    
    const R = worldRadiusToScreen(snakeBody.r); // Convert world-space radius to screen-space
    
    // Draw from tail to head for proper layering
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (!p || p.x === undefined || p.y === undefined) continue;
      const rawScreenPos = worldToScreen(p.x, p.y);
      
      // Round to pixel boundaries to prevent jittering
      const screenPos = {
        x: Math.round(rawScreenPos.x),
        y: Math.round(rawScreenPos.y)
      };
      
      // Calculate tangent for rotation using world-space coordinates
      // This gives correct rotation regardless of camera zoom
      let t: Vec2;
      if (i < points.length - 1 && points[i + 1] && points[i + 1].x !== undefined && points[i + 1].y !== undefined) {
        t = { x: points[i + 1].x - p.x, y: points[i + 1].y - p.y };
      } else if (i > 0 && points[i - 1] && points[i - 1].x !== undefined && points[i - 1].y !== undefined) {
        t = { x: p.x - points[i - 1].x, y: p.y - points[i - 1].y };
      } else {
        t = { x: 1, y: 0 }; // Default tangent if neighbors are invalid
      }
      const rotation = Math.atan2(t.y, t.x);

      // 1. Draw glow behind body (only when boosting)
      if (snakeBody.boosting) {
        this.drawGlowEffect(screenPos, R, i, snakeBody.getColorVariants());
      }

      // 2. Draw body segment
      this.drawBodySegment(screenPos, R, rotation, snakeBody.getColorVariants());

      // 3. Draw pulse effects over body
      if (snakeBody.pulses.length > 0) {
        this.drawPulseEffect(screenPos, R, rotation, S[i], snakeBody.pulses);
      }
    }
  }

  private drawGlowEffect(screenPos: { x: number; y: number }, R: number, segmentIndex: number, colors: any) {
    const glowRadius = R * BOOST.GLOW_RADIUS_SCALE;
    const baseA = BOOST.BASE_ALPHA * 
      (1 + BOOST.FLICKER_GAIN * Math.sin(this.tClock * BOOST.FLICKER_OMEGA + segmentIndex * BOOST.FLICKER_PHASE_STEP));
    const alpha = Math.max(0, baseA);

    // Create radial gradient for glow using snake's color
    const gradient = this.ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,
      screenPos.x, screenPos.y, glowRadius
    );
    gradient.addColorStop(0, `${colors.base}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(0.65, `${colors.dark}${Math.floor(alpha * 127).toString(16).padStart(2, '0')}`);
    gradient.addColorStop(1, `${colors.dark}00`);

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, glowRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  private drawBodySegment(screenPos: { x: number; y: number }, R: number, rotation: number, colors: any) {
    // Create radial gradient for Slither.io-like effect (lighter center, darker edges)
    const gradient = this.ctx.createRadialGradient(
      screenPos.x, screenPos.y, 0,           // Center point
      screenPos.x, screenPos.y, R            // Outer edge
    );
    
    // Gradient stops: lighter center -> darker edge using snake's colors
    gradient.addColorStop(0, colors.light);     // Light center
    gradient.addColorStop(0.6, colors.dark);    // Medium middle
    gradient.addColorStop(1, colors.darker);    // Dark edge
    
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(screenPos.x, screenPos.y, R, 0, Math.PI * 2);
    this.ctx.fill();

    // Add subtle darker outline for definition
    //this.ctx.strokeStyle = '#5A4BC7';
    //this.ctx.lineWidth = 1;
    //this.ctx.stroke();
  }

  private drawPulseEffect(screenPos: { x: number; y: number }, R: number, rotation: number, arcLength: number, pulses: Array<{ position: number; fadeAlpha: number }>) {
    const headR = R;
    const sigma = BOOST.PULSE_SIGMA_R * headR;
    const inv2s2 = 1 / (2 * sigma * sigma);
    
    let totalAlpha = 0;
    for (let k = 0; k < pulses.length; k++) {
      const pulse = pulses[k];
      const ds = arcLength - pulse.position;
      const pulseAlpha = Math.exp(-ds * ds * inv2s2) * pulse.fadeAlpha; // Apply fade-out
      totalAlpha += pulseAlpha;
    }
    totalAlpha *= BOOST.PULSE_GAIN;
    totalAlpha = Math.min(1, totalAlpha);

    if (totalAlpha > 0.01) {
      const pulseRadius = R * BOOST.GLOW_RADIUS_SCALE;
      const gradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, pulseRadius
      );
      gradient.addColorStop(0, `rgba(230, 224, 255, ${totalAlpha})`);
      gradient.addColorStop(0.65, `rgba(230, 224, 255, ${totalAlpha * 0.5})`);
      gradient.addColorStop(1, `rgba(230, 224, 255, 0)`);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, pulseRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawEyesWithTracking(snakeBody: SnakeBody, worldToScreen: (x: number, y: number) => { x: number; y: number }, camera: Camera, isLocal: boolean = true) {
    const oldPupilTarget = this.pupilTargetLocal;
    const points = snakeBody.getPoints();
    if (points.length === 0) return;

    const headP = points[0];
    
    // Calculate forward direction from first two points
    const ahead = snakeBody.r * SNAKE.overlap;
    let j = 0;
    while (j + 1 < points.length && this.getArcLength([...points], j + 1) < ahead) j++;
    
    const segLen = (j + 1 < points.length) ? 
      (this.getArcLength([...points], j + 1) - this.getArcLength([...points], j)) : 0;
    const tAhead = segLen > 0 ? (ahead - this.getArcLength([...points], j)) / segLen : 0;
    
    const ax = (j + 1 < points.length) ? 
      (points[j].x + (points[j + 1].x - points[j].x) * tAhead) : points[0].x + 1;
    const ay = (j + 1 < points.length) ? 
      (points[j].y + (points[j + 1].y - points[j].y) * tAhead) : points[0].y;
    
    const dx = ax - headP.x, dy = ay - headP.y;
    const len = Math.hypot(dx, dy) || 1;
    const headF = { x: dx / len, y: dy / len };

    // Only track mouse for local player
    let currentPupilTarget: { x: number; y: number } | null = null;
    if (isLocal && this.lastGlobalPointer) {
      const worldMouseX = (this.lastGlobalPointer.x - window.innerWidth / 2) / camera.zoom + camera.x;
      const worldMouseY = (this.lastGlobalPointer.y - window.innerHeight / 2) / camera.zoom + camera.y;
      currentPupilTarget = { x: worldMouseX, y: worldMouseY };
    }

    // Use THIS SNAKE's own radius and segment count
    const snakeR = snakeBody.r;
    const snakeSegments = snakeBody.targetSegments;
    this.drawEyesFromFrame(headP, headF, worldToScreen, snakeR, snakeSegments, currentPupilTarget, camera.zoom);
    
    // Restore previous state for next snake
    this.pupilTargetLocal = oldPupilTarget;
  }

  private getArcLength(points: Vec2[], index: number): number {
    let length = 0;
    for (let i = 1; i <= index && i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.hypot(dx, dy);
    }
    return length;
  }

  private drawEyesFromFrame(headCenter: Vec2, forward: Vec2, worldToScreen: (x: number, y: number) => { x: number; y: number }, snakeRadius: number, segmentCount: number, pupilTarget: { x: number; y: number } | null = null, cameraZoom: number = 1.0) {
    // Use world-space radius for calculations (headCenter is in world-space)
    const R = snakeRadius; // Head radius in world-space
    const headDiameter = R * 2; // Real visual distance from edge to edge of head (world-space)
    
    // FIXED RELATIVE POSITIONS on the head (as fractions of head diameter)
    // These constants lock eyes to specific positions - they NEVER change
    const EYE_FORWARD_OFFSET = -0.17;  // 20% of diameter forward from center (reduced from -0.25)
    const EYE_VERTICAL_OFFSET = 0.0;   // Centered vertically (was 0.05, now 0 for true center)
    const EYE_SEPARATION = 0.47;        // 50% of diameter between eye centers
    
    // EYE SIZES (as fractions of head radius - scales proportionally)
    const SCLERA_RADIUS_RATIO = 0.41;  // Sclera (white part) is 41% of head radius
    const PUPIL_RADIUS_RATIO = 0.58;   // Pupil is 58% of sclera radius
    
    // Calculate world-space dimensions (all scale with head size)
    const scleraRadiusWorld = R * SCLERA_RADIUS_RATIO;
    const pupilRadiusWorld = scleraRadiusWorld * PUPIL_RADIUS_RATIO;
    const eyeSeparationWorld = headDiameter * EYE_SEPARATION;
    
    // Convert to screen-space for rendering (after calculating positions in world-space)
    const R_screen = R * cameraZoom;
    const scleraRadius = scleraRadiusWorld * cameraZoom;
    const pupilRadius = pupilRadiusWorld * cameraZoom;
    
    // Direction vectors
    const F = forward; // Forward direction (normalized)
    const U = { x: -F.y, y: F.x }; // Perpendicular to forward (left side)
    
    // Calculate eye origin position in WORLD-SPACE (locked relative to head center)
    const eyeOriginForward = headDiameter * EYE_FORWARD_OFFSET;
    const eyeOriginVertical = headDiameter * EYE_VERTICAL_OFFSET;
    
    // World-space position of eye origin point
    const eyeOriginX = headCenter.x + eyeOriginForward * F.x + eyeOriginVertical * U.x;
    const eyeOriginY = headCenter.y + eyeOriginForward * F.y + eyeOriginVertical * U.y;
    
    // Calculate eye centers in WORLD-SPACE (locked relative positions, scaled by head size)
    const halfSeparation = eyeSeparationWorld * 0.5;
    const leftEyeX = eyeOriginX - halfSeparation * U.x;
    const leftEyeY = eyeOriginY - halfSeparation * U.y;
    const rightEyeX = eyeOriginX + halfSeparation * U.x;
    const rightEyeY = eyeOriginY + halfSeparation * U.y;
    
    // Convert to screen coordinates and round
    const screenLeftEye = worldToScreen(leftEyeX, leftEyeY);
    const screenRightEye = worldToScreen(rightEyeX, rightEyeY);
    const roundedLeftEye = { x: Math.round(screenLeftEye.x), y: Math.round(screenLeftEye.y) };
    const roundedRightEye = { x: Math.round(screenRightEye.x), y: Math.round(screenRightEye.y) };
    
    // Draw sclera (white part of eyes)
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(roundedLeftEye.x, roundedLeftEye.y, scleraRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(roundedRightEye.x, roundedRightEye.y, scleraRadius, 0, Math.PI * 2);
    this.ctx.fill();
    
    // Calculate pupil positions with tracking
    const edgeClearance = scleraRadius * 0.05; // Small clearance from edge
    const maxPupilOffset = scleraRadius - pupilRadius - edgeClearance;
    
    // Get pupil target (mouse cursor or forward direction) - in world-space
    // When null, invert the forward vector to make pupils face forward (eyes stay in same position)
    const targetX = pupilTarget?.x ?? (headCenter.x - F.x * R);
    const targetY = pupilTarget?.y ?? (headCenter.y - F.y * R);
    const targetScreen = worldToScreen(targetX, targetY);
    
    // Calculate center point between eyes for unified tracking
    const eyeCenterScreen = {
      x: (roundedLeftEye.x + roundedRightEye.x) * 0.5,
      y: (roundedLeftEye.y + roundedRightEye.y) * 0.5
    };
    
    // Calculate direction from eye center to target
    const dx = targetScreen.x - eyeCenterScreen.x;
    const dy = targetScreen.y - eyeCenterScreen.y;
    const distance = Math.hypot(dx, dy);
    
    // Calculate unified offset direction (same for both eyes to avoid cross-eyed look)
    const scale = distance > 0 ? Math.min(1, maxPupilOffset / distance) : 0;
    const offsetX = dx * scale;
    const offsetY = dy * scale;
    
    // Apply same offset to both pupils (maintains eye separation)
    const pupilLeft = {
      x: Math.round(roundedLeftEye.x + offsetX),
      y: Math.round(roundedLeftEye.y + offsetY)
    };
    const pupilRight = {
      x: Math.round(roundedRightEye.x + offsetX),
      y: Math.round(roundedRightEye.y + offsetY)
    };
    
    // Draw pupils (black)
    this.ctx.fillStyle = '#101010';
    this.ctx.beginPath();
    this.ctx.arc(pupilLeft.x, pupilLeft.y, pupilRadius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.arc(pupilRight.x, pupilRight.y, pupilRadius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  // cleanupPulses method removed - pulse cleanup is now handled in SnakeBody.updatePulses()
}
