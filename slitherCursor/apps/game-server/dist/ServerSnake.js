"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerSnake = exports.SNAKE = void 0;
exports.dir = dir;
exports.SNAKE = {
    radius: 21,
    overlap: 0.4,
    turnRate: 4.5,
    speed: 250,
    boostSpeed: 625,
    baseSpacing: 13.4,
    growthPerSegment: 0.0025,
    cameraZoomCompensation: 0.7,
    turnRateReduction: 0.3,
    eyeSeparation: 0.80,
    minSegments: 12,
    boostMassLossRate: 1.0,
    boostPelletDropRate: 2.0,
    boostTrailRadius: 6,
    boostPointsPerSecond: 1.0,
    pointsPerSegment: 2,
    deathAnimationDuration: 2000,
    deathDotMassRatio: 0.5,
    deathDotBaseRadius: 8,
    deathDotMaxRadius: 15,
};
function dir(a) {
    return { x: Math.cos(a), y: Math.sin(a) };
}
class ServerSnake {
    playerId;
    name;
    angle = 0; // radians
    boosting = false;
    score = 0;
    isDead = false; // Death state
    deathAnimationProgress = 0; // 0 to 1, death animation progress
    snakeFadeProgress = 0; // 0 to 1, snake fade-out progress
    color = '#4A90E2'; // Snake color (default blue)
    history = []; // head-first trail
    resampled = []; // even spacing, head -> tail
    _currentSpeed = exports.SNAKE.speed; // smooth speed transition
    // Boost trail system
    boostTrailDots = [];
    lastPelletTime = 0; // Last time a pellet was dropped
    actualSegments = 12; // Actual segment count (can be reduced by boosting)
    boostPoints = 0; // Accumulated boost points (for anti-cheat)
    fractionalFoodPoints = 0; // Accumulated fractional food points for growth
    // Death animation
    deathDots = [];
    constructor(playerId, name) {
        this.playerId = playerId;
        this.name = name;
    }
    get r() {
        // Snake grows slightly larger as it gains segments
        const growthFactor = 1.0 + (this.targetSegments - 20) * exports.SNAKE.growthPerSegment;
        return exports.SNAKE.radius * growthFactor;
    }
    get spacing() { return this.r * exports.SNAKE.overlap; }
    /** visual segment count derived ONLY from score (NOT speed) */
    get targetSegments() { return Math.max(exports.SNAKE.minSegments, this.actualSegments); }
    /** Check if snake can boost (has enough segments) */
    get canBoost() {
        return this.actualSegments > exports.SNAKE.minSegments && this.resampled.length > exports.SNAKE.minSegments;
    }
    /** Head is now just the first body segment */
    get head() {
        return this.resampled.length > 0 ? this.resampled[0] : { x: 0, y: 0 };
    }
    /** Get current speed for collision detection */
    get currentSpeed() {
        return this._currentSpeed;
    }
    /** Get color variants for gradients */
    getColorVariants() {
        return this.generateColorVariants(this.color);
    }
    /** Generate darker and lighter variants of a color for gradients */
    generateColorVariants(baseColor) {
        // Parse hex color
        const hex = baseColor.replace('#', '');
        const r = parseInt(hex.substr(0, 2), 16);
        const g = parseInt(hex.substr(2, 2), 16);
        const b = parseInt(hex.substr(4, 2), 16);
        // Generate variants
        const lighten = (factor) => {
            const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
            const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
            const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };
        const darken = (factor) => {
            const newR = Math.max(0, Math.floor(r * (1 - factor)));
            const newG = Math.max(0, Math.floor(g * (1 - factor)));
            const newB = Math.max(0, Math.floor(b * (1 - factor)));
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };
        return {
            light: lighten(0.2), // 20% lighter
            base: baseColor, // Original color
            dark: darken(0.3), // 30% darker
            darker: darken(0.5) // 50% darker
        };
    }
    /** Assign a random color from the food color palette */
    assignRandomColor() {
        const foodColors = [
            '#ff4444', '#44ff44', '#4444ff', '#ffff44',
            '#ff8844', '#ff44ff', '#44ffff', '#ff88ff',
            '#88ff88', '#8888ff', '#ffff88', '#ffaa44'
        ];
        this.color = foodColors[Math.floor(Math.random() * foodColors.length)];
    }
    /** Get boost trail dots for rendering */
    getBoostTrailDots() {
        return this.boostTrailDots;
    }
    /** Get current boost points (for anti-cheat) */
    getBoostPoints() {
        return this.boostPoints;
    }
    /** Set boost points (for anti-cheat) */
    setBoostPoints(value) {
        this.boostPoints = Math.max(0, value);
    }
    /** Get actual segment count */
    get actualSegmentCount() {
        return this.actualSegments;
    }
    /** Set actual segment count */
    set actualSegmentCount(value) {
        this.actualSegments = Math.max(exports.SNAKE.minSegments, Math.floor(value));
    }
    /** Add food points and handle fractional growth */
    addFoodPoints(points) {
        this.fractionalFoodPoints += points;
        // Calculate how many segments we can add
        const segmentsToAdd = Math.floor(this.fractionalFoodPoints / exports.SNAKE.pointsPerSegment);
        if (segmentsToAdd > 0) {
            this.actualSegments += segmentsToAdd;
            this.fractionalFoodPoints -= segmentsToAdd * exports.SNAKE.pointsPerSegment; // Keep remainder
        }
    }
    /** Get growth factor for camera zoom compensation */
    get growthFactor() {
        return 1.0 + (this.targetSegments - 20) * exports.SNAKE.growthPerSegment; // Same as radius growth
    }
    /** Get effective turn rate (reduces with snake length) */
    get effectiveTurnRate() {
        const maxSegments = 200; // Assume max reasonable snake length
        const lengthFactor = Math.min(1.0, this.targetSegments / maxSegments);
        const reduction = exports.SNAKE.turnRateReduction * lengthFactor;
        return exports.SNAKE.turnRate * (1.0 - reduction);
    }
    reset(pos, angle = 0) {
        this.angle = angle;
        this._currentSpeed = exports.SNAKE.speed;
        this.history.length = 0;
        this.resampled.length = 0;
        // Initialize all segments in a straight line behind the head
        this.actualSegments = 25; // Start with minimum segments
        const segmentSpacing = this.spacing;
        const backDir = { x: -Math.cos(angle), y: -Math.sin(angle) };
        // Initialize head
        this.resampled.push({ ...pos });
        // Initialize remaining segments in a straight line behind head
        for (let i = 1; i < this.actualSegments; i++) {
            this.resampled.push({
                x: pos.x + backDir.x * segmentSpacing * i,
                y: pos.y + backDir.y * segmentSpacing * i
            });
        }
        // Initialize history with ALL segment positions (tail to head, reversed for path following)
        // This ensures the path-following system has a proper trail from the start
        for (let i = this.resampled.length - 1; i >= 0; i--) {
            this.history.push({ ...this.resampled[i] });
        }
        // Assign random color from food colors
        this.assignRandomColor();
        // Reset boost trail system
        this.boostTrailDots = [];
        this.lastPelletTime = 0;
        this.boostPoints = 0;
        this.fractionalFoodPoints = 0;
        this.score = 0;
        // Reset death animation
        this.isDead = false;
        this.deathAnimationProgress = 0;
        this.snakeFadeProgress = 0;
        this.deathDots = [];
    }
    step(dt, desiredAngle) {
        // If dead, only update death animation
        if (this.isDead) {
            this.updateDeathAnimation(dt);
            return;
        }
        // Validate desired angle
        if (!isFinite(desiredAngle)) {
            desiredAngle = this.angle;
        }
        // Normalize angles to [0, 2π) range for consistent calculations
        const normalizeAngle = (a) => {
            let normalized = a % (2 * Math.PI);
            if (normalized < 0)
                normalized += 2 * Math.PI;
            return normalized;
        };
        // Calculate shortest angular difference (handles wrapping correctly)
        const angDiff = (target, current) => {
            target = normalizeAngle(target);
            current = normalizeAngle(current);
            let diff = target - current;
            // Normalize to [-π, π] range (shortest path)
            if (diff > Math.PI)
                diff -= 2 * Math.PI;
            if (diff < -Math.PI)
                diff += 2 * Math.PI;
            return diff;
        };
        // Clamp turn using shortest delta (with length-based reduction)
        let da = angDiff(desiredAngle, this.angle);
        const maxDa = this.effectiveTurnRate * dt;
        // Prevent backwards movement: limit angle change to ±90 degrees (π/2)
        // Snake can only turn left or right, never go backwards
        const maxTurnAngle = Math.PI / 2; // 90 degrees
        if (da > maxTurnAngle)
            da = maxTurnAngle;
        if (da < -maxTurnAngle)
            da = -maxTurnAngle;
        // Dead zone: ignore extremely small angle changes to prevent jitter
        const minAngleChange = 0.001; // Minimum angle change threshold (radians)
        if (Math.abs(da) < minAngleChange) {
            da = 0; // Ignore tiny angle changes to prevent oscillation
        }
        if (da > maxDa)
            da = maxDa;
        if (da < -maxDa)
            da = -maxDa;
        this.angle = normalizeAngle(this.angle + da);
        // Speed transition
        const targetSpeed = this.boosting ? exports.SNAKE.boostSpeed : exports.SNAKE.speed;
        const speedTransitionRate = 12.0; // Faster transition to reduce lag
        this._currentSpeed += (targetSpeed - this._currentSpeed) * speedTransitionRate * dt;
        // Handle boost trail system
        this.updateBoostTrail(dt);
        // SYNCHRONOUS SEGMENT-BASED MOVEMENT
        // History is updated inside moveSegmentsSynchronously for path following
        this.moveSegmentsSynchronously(dt);
    }
    updateBoostTrail(dt) {
        // Create new trail dots while boosting
        if (this.boosting && this.canBoost) {
            // Accumulate boost points (anti-cheat system)
            this.boostPoints += exports.SNAKE.boostPointsPerSecond * dt;
            // Lose mass (reduce segments) - 1 segment per second
            const segmentsLost = exports.SNAKE.boostMassLossRate * dt;
            this.actualSegments -= segmentsLost;
            // Drop pellets at 2 per second rate
            this.lastPelletTime += dt;
            const pelletInterval = 1.0 / exports.SNAKE.boostPelletDropRate; // 0.5 seconds between pellets
            while (this.lastPelletTime >= pelletInterval) {
                // Create trail dot at tail position (last segment)
                const tailPosition = this.resampled[this.resampled.length - 1];
                if (tailPosition) {
                    this.boostTrailDots.push({
                        x: tailPosition.x,
                        y: tailPosition.y,
                        radius: exports.SNAKE.boostTrailRadius,
                        age: 0,
                        maxAge: Infinity, // Trail dots are now persistent food pellets
                        processed: false // Mark as unprocessed
                    });
                }
                this.lastPelletTime -= pelletInterval;
            }
            // Ensure we don't go below minimum
            this.actualSegments = Math.max(exports.SNAKE.minSegments, this.actualSegments);
        }
    }
    moveSegmentsSynchronously(dt) {
        if (this.resampled.length === 0)
            return;
        const movementDistance = this._currentSpeed * dt;
        const v = dir(this.angle);
        // Move head forward and add to history trail
        this.resampled[0].x += v.x * movementDistance;
        this.resampled[0].y += v.y * movementDistance;
        const head = this.resampled[0];
        // Add current head position to history trail (path following system)
        this.history.unshift({ x: head.x, y: head.y });
        // Keep history - no cap, allows full coverage for any snake size
        // Build cumulative distance along history trail from head (index 0) backwards
        const distances = [0];
        for (let i = 1; i < this.history.length; i++) {
            const dx = this.history[i - 1].x - this.history[i].x;
            const dy = this.history[i - 1].y - this.history[i].y;
            distances[i] = distances[i - 1] + Math.sqrt(dx * dx + dy * dy);
        }
        // Each segment follows the path at a distance based on its index
        for (let i = 1; i < this.resampled.length; i++) {
            const targetDistance = i * this.spacing;
            const prevSegment = i > 1 ? this.resampled[i - 1] : head;
            let segmentPos;
            // Only use history trail if we have enough history for this segment
            if (this.history.length > 1 && distances.length > 0) {
                const maxAvailableDist = distances[distances.length - 1];
                if (targetDistance <= maxAvailableDist) {
                    // We have enough history - use path following
                    let foundIndex = 1;
                    for (let j = 1; j < distances.length; j++) {
                        if (distances[j] >= targetDistance) {
                            foundIndex = j;
                            break;
                        }
                    }
                    if (foundIndex < this.history.length) {
                        // Interpolate between history points for smooth following
                        const prevIdx = Math.max(0, foundIndex - 1);
                        const nextIdx = foundIndex;
                        if (prevIdx === nextIdx || foundIndex === 1) {
                            // Use the exact point if we're at the beginning
                            segmentPos = { ...this.history[prevIdx] };
                        }
                        else {
                            // Interpolate between the two history points
                            const distPrev = distances[prevIdx];
                            const distNext = distances[nextIdx];
                            const t = distNext > distPrev ? (targetDistance - distPrev) / (distNext - distPrev) : 0;
                            segmentPos = {
                                x: this.history[prevIdx].x + (this.history[nextIdx].x - this.history[prevIdx].x) * t,
                                y: this.history[prevIdx].y + (this.history[nextIdx].y - this.history[prevIdx].y) * t
                            };
                        }
                    }
                    else {
                        // Shouldn't happen due to check above, but fallback to spacing from previous
                        const dx = prevSegment.x - this.resampled[i].x;
                        const dy = prevSegment.y - this.resampled[i].y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist > 0.01) {
                            const dirX = dx / dist;
                            const dirY = dy / dist;
                            segmentPos = {
                                x: prevSegment.x - dirX * this.spacing,
                                y: prevSegment.y - dirY * this.spacing
                            };
                        }
                        else {
                            segmentPos = { ...this.resampled[i] };
                        }
                    }
                }
                else {
                    // History too short - extend straight from previous segment (no history reference)
                    const dx = prevSegment.x - this.resampled[i].x;
                    const dy = prevSegment.y - this.resampled[i].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 0.01) {
                        const dirX = dx / dist;
                        const dirY = dy / dist;
                        segmentPos = {
                            x: prevSegment.x - dirX * this.spacing,
                            y: prevSegment.y - dirY * this.spacing
                        };
                    }
                    else {
                        segmentPos = { ...this.resampled[i] };
                    }
                }
            }
            else {
                // No history available - extend straight from previous segment
                const dx = prevSegment.x - this.resampled[i].x;
                const dy = prevSegment.y - this.resampled[i].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0.01) {
                    const dirX = dx / dist;
                    const dirY = dy / dist;
                    segmentPos = {
                        x: prevSegment.x - dirX * this.spacing,
                        y: prevSegment.y - dirY * this.spacing
                    };
                }
                else {
                    segmentPos = { ...this.resampled[i] };
                }
            }
            // ALWAYS enforce exact spacing from previous segment to prevent gaps/flickering
            // This is the root fix - ensures consistent spacing regardless of history trail issues
            const dx = prevSegment.x - segmentPos.x;
            const dy = prevSegment.y - segmentPos.y;
            const actualDist = Math.sqrt(dx * dx + dy * dy);
            if (actualDist > 0.01 && Math.abs(actualDist - this.spacing) > 0.01) {
                // Adjust position to maintain exact spacing
                const dirX = dx / actualDist;
                const dirY = dy / actualDist;
                segmentPos.x = prevSegment.x - dirX * this.spacing;
                segmentPos.y = prevSegment.y - dirY * this.spacing;
            }
            this.resampled[i].x = segmentPos.x;
            this.resampled[i].y = segmentPos.y;
        }
        // Ensure we have the right number of segments
        this.ensureCorrectSegmentCount();
    }
    ensureCorrectSegmentCount() {
        const needCount = Math.floor(this.actualSegments);
        // Ensure we never have an invalid array length
        if (needCount < 1) {
            console.warn('[ServerSnake] Invalid segment count, resetting to minimum');
            this.resampled.length = exports.SNAKE.minSegments;
            return;
        }
        if (this.resampled.length < needCount) {
            // Add segments when actualSegments >= needCount
            // Use threshold only when fractional to prevent oscillation, but allow whole number growth from eating
            // If actualSegments is a whole number or clearly above, always add
            const isWholeNumber = Math.abs(this.actualSegments - Math.round(this.actualSegments)) < 0.01;
            const threshold = (isWholeNumber || this.actualSegments >= needCount + 0.5) ? 0.0 : 0.2;
            if (this.actualSegments >= needCount + threshold) {
                // Limit to adding one segment per frame to prevent stacking on head
                // Remaining segments will be added gradually over subsequent frames
                const maxSegmentsToAdd = 1;
                let segmentsAdded = 0;
                while (this.resampled.length < needCount && segmentsAdded < maxSegmentsToAdd) {
                    const lastSegment = this.resampled[this.resampled.length - 1];
                    // Always extend straight from tail - simple direction calculation, no history or head reference
                    let newSegmentPos;
                    if (this.resampled.length > 1) {
                        // Simple: extend in the direction from second-to-last to last segment
                        const secondLast = this.resampled[this.resampled.length - 2];
                        const tailDirX = lastSegment.x - secondLast.x;
                        const tailDirY = lastSegment.y - secondLast.y;
                        const tailDirLen = Math.sqrt(tailDirX * tailDirX + tailDirY * tailDirY);
                        if (tailDirLen > 0.01) {
                            // Continue extending straight in tail's current direction
                            newSegmentPos = {
                                x: lastSegment.x + (tailDirX / tailDirLen) * this.spacing,
                                y: lastSegment.y + (tailDirY / tailDirLen) * this.spacing
                            };
                        }
                        else {
                            // Segments are overlapping - use snake's current angle as fallback
                            const dirVec = dir(this.angle);
                            newSegmentPos = {
                                x: lastSegment.x - dirVec.x * this.spacing,
                                y: lastSegment.y - dirVec.y * this.spacing
                            };
                        }
                    }
                    else {
                        // Only head exists - extend opposite to snake's direction (tail extends backward)
                        const dirVec = dir(this.angle);
                        newSegmentPos = {
                            x: lastSegment.x - dirVec.x * this.spacing,
                            y: lastSegment.y - dirVec.y * this.spacing
                        };
                    }
                    this.resampled.push(newSegmentPos);
                    segmentsAdded++;
                }
            }
        }
        else if (this.resampled.length > needCount) {
            // Remove excess segments from the tail gradually to prevent flickering
            // Only remove one segment per frame, with a threshold to prevent oscillation
            const excess = this.resampled.length - needCount;
            if (excess > 1 || (excess === 1 && this.actualSegments < needCount + 0.1)) {
                // Only remove if we're significantly over, or if actualSegments is clearly below
                // This prevents rapid add/remove when actualSegments oscillates around an integer
                this.resampled.length = Math.max(needCount, this.resampled.length - 1);
            }
        }
    }
    // Trigger death animation
    triggerDeath() {
        if (this.isDead)
            return;
        this.isDead = true;
        this.deathAnimationProgress = 0;
        this.snakeFadeProgress = 0; // Start snake fade-out
        // Convert snake segments to death pellets (same as boost pellets)
        const points = this.resampled;
        // Create pellets randomly distributed within the snake's silhouette
        const pelletCount = Math.floor(points.length / 2); // Half the segment count, scales with snake size
        const snakeRadius = this.r;
        for (let i = 0; i < pelletCount; i++) {
            // Find a random segment to use as a base position
            const segmentIndex = Math.floor(Math.random() * points.length);
            const baseSegment = points[segmentIndex];
            // Add random offset within the snake's radius
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.random() * snakeRadius * 0.8; // Stay within 80% of snake radius
            const offsetX = Math.cos(angle) * distance;
            const offsetY = Math.sin(angle) * distance;
            this.deathDots.push({
                x: baseSegment.x + offsetX,
                y: baseSegment.y + offsetY,
                radius: exports.SNAKE.boostTrailRadius * 3, // Double size
                progress: 0,
                color: '#4A90E2' // Same color as snake
            });
        }
    }
    // Update death animation
    updateDeathAnimation(dt) {
        if (!this.isDead)
            return;
        // Phase 1: Snake fade-out (0.3 seconds)
        if (this.snakeFadeProgress < 1.0) {
            this.snakeFadeProgress += dt * 3.33; // Fade out over 0.3 seconds (dt is in seconds)
            this.snakeFadeProgress = Math.min(1.0, this.snakeFadeProgress);
        }
        // Phase 2: Death pellets animation (0.7 seconds - longer to see pellets)
        if (this.snakeFadeProgress >= 1.0) {
            this.deathAnimationProgress += dt / 1.5; // Pellets animate over 0.7 seconds
            this.deathAnimationProgress = Math.min(1.0, this.deathAnimationProgress);
            // Update individual pellet animations
            for (const dot of this.deathDots) {
                dot.progress += dt * 1.43; // Each pellet animates over 0.7 seconds
                dot.progress = Math.min(1.0, dot.progress);
            }
        }
        // Phase 3: Complete - transition to game over screen
        if (this.deathAnimationProgress >= 1.0) {
            // Animation complete - ready for game over screen
            return;
        }
    }
    // Get death dots for rendering
    getDeathDots() {
        return this.deathDots;
    }
    // Get snake fade progress for rendering
    getSnakeFadeProgress() {
        return this.snakeFadeProgress;
    }
    getPoints() {
        return this.resampled;
    }
    /**
     * Set snake segments directly from points
     * Used for potential future server-side corrections
     */
    setFromPoints(points, angle) {
        this.resampled.length = 0;
        for (const p of points) {
            this.resampled.push({ x: p.x, y: p.y });
        }
        this.angle = angle;
        // Update history with new points (tail to head, reversed for path following)
        this.history.length = 0;
        for (let i = this.resampled.length - 1; i >= 0; i--) {
            this.history.push({ ...this.resampled[i] });
        }
    }
    /**
     * Set boosting state directly
     */
    setBoosting(on) {
        this.boosting = on;
    }
    // Get snake state for network transmission
    getState() {
        return {
            playerId: this.playerId,
            name: this.name,
            angle: this.angle,
            boosting: this.boosting,
            score: this.score,
            isDead: this.isDead,
            deathAnimationProgress: this.deathAnimationProgress,
            snakeFadeProgress: this.snakeFadeProgress,
            head: this.head,
            points: this.resampled,
            boostTrailDots: this.boostTrailDots,
            deathDots: this.deathDots,
            actualSegments: this.actualSegments,
            boostPoints: this.boostPoints,
            color: this.color
        };
    }
}
exports.ServerSnake = ServerSnake;
