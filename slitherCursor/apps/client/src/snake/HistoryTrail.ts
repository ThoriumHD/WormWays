// apps/client/src/snake/HistoryTrail.ts
export type Vec2 = { x: number; y: number };

function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const a = 0.5, t2 = t * t, t3 = t2 * t;
  return {
    x: a * ((2 * p1.x) + (-p0.x + p2.x) * t +
      (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
      (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y: a * ((2 * p1.y) + (-p0.y + p2.y) * t +
      (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
      (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

export class HistoryTrail {
  static generateSmoothTrail(points: Vec2[]): Vec2[] {
    if (points.length <= 2) {
      return points.map(p => ({ x: p.x, y: p.y }));
    }

    const smoothed: Vec2[] = [];
    const stepsPerSegment = 3;
    const lastIndex = points.length - 1;

    smoothed.push({ x: points[0].x, y: points[0].y });
    for (let i = 0; i < lastIndex; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(lastIndex, i + 2)];

      for (let step = 1; step <= stepsPerSegment; step++) {
        const t = step / (stepsPerSegment + 1);
        const sample = catmullRom(p0, p1, p2, p3, t);
        smoothed.push(sample);
      }

      smoothed.push({ x: p2.x, y: p2.y });
    }

    return smoothed;
  }

  static ensureTrailCoverage(trail: Vec2[], tailDirection: Vec2, spacing: number, requiredDistance: number): void {
    if (trail.length === 0) {
      trail.push({ x: 0, y: 0 });
    }

    let accumulated = 0;
    for (let i = 1; i < trail.length; i++) {
      const dx = trail[i - 1].x - trail[i].x;
      const dy = trail[i - 1].y - trail[i].y;
      accumulated += Math.sqrt(dx * dx + dy * dy);
      if (accumulated >= requiredDistance) {
        break;
      }
    }

    while (accumulated < requiredDistance) {
      const tail = trail[trail.length - 1];
      let dirX: number;
      let dirY: number;
      
      if (trail.length > 1) {
        // Use tail's actual direction (from second-to-last to last)
        const beforeTail = trail[trail.length - 2];
        dirX = tail.x - beforeTail.x;
        dirY = tail.y - beforeTail.y;
      } else {
        // Fallback to provided tail direction
        dirX = tailDirection.x;
        dirY = tailDirection.y;
      }
      
      let dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
      if (dirLen < 0.001) {
        // If no direction available, use fallback
        dirX = tailDirection.x;
        dirY = tailDirection.y;
        dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      }
      
      const newPoint = {
        x: tail.x + (dirX / dirLen) * spacing,
        y: tail.y + (dirY / dirLen) * spacing
      };
      trail.push(newPoint);
      accumulated += spacing;
    }
  }

  static padTrail(trail: Vec2[], segmentCount: number): Vec2[] {
    const history = trail.map(p => ({ x: p.x, y: p.y }));
    const minHistoryLength = Math.max(segmentCount * 2, 50);
    const tailFallback = history.length > 0 ? history[history.length - 1] : { x: 0, y: 0 };
    while (history.length < minHistoryLength) {
      history.push({ x: tailFallback.x, y: tailFallback.y });
    }
    return history;
  }

  static sampleSegmentsFromHistory(history: Vec2[], angle: number, spacing: number, segmentCount: number): Vec2[] {
    const resampled: Vec2[] = [];
    if (history.length === 0 || segmentCount <= 0) {
      return resampled;
    }

    resampled.push({ x: history[0].x, y: history[0].y });

    const arcLengths: number[] = [0];
    for (let i = 1; i < history.length; i++) {
      const dx = history[i - 1].x - history[i].x;
      const dy = history[i - 1].y - history[i].y;
      arcLengths[i] = arcLengths[i - 1] + Math.sqrt(dx * dx + dy * dy);
    }

    const totalLength = arcLengths[arcLengths.length - 1] || 0;
    const fallbackDir = (() => {
      if (history.length >= 2) {
        const tail = history[history.length - 1];
        const beforeTail = history[history.length - 2];
        const dx = tail.x - beforeTail.x;
        const dy = tail.y - beforeTail.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 0.001) {
          return { x: dx / len, y: dy / len };
        }
      }
      return { x: -Math.cos(angle), y: -Math.sin(angle) };
    })();

    for (let index = 1; index < segmentCount; index++) {
      const targetDistance = index * spacing;

      if (totalLength <= 0 || targetDistance >= totalLength) {
        const last = resampled[resampled.length - 1];
        let dirX = fallbackDir.x;
        let dirY = fallbackDir.y;
        if (resampled.length >= 2) {
          const prev = resampled[resampled.length - 2];
          const dx = last.x - prev.x;
          const dy = last.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len > 0.001) {
            dirX = dx / len;
            dirY = dy / len;
          }
        }
        resampled.push({
          x: last.x + dirX * spacing,
          y: last.y + dirY * spacing
        });
        continue;
      }

      let j = 1;
      for (; j < arcLengths.length; j++) {
        if (arcLengths[j] >= targetDistance) break;
      }
      const prevIdx = Math.max(0, j - 1);
      const nextIdx = Math.min(j, history.length - 1);
      const distPrev = arcLengths[prevIdx];
      const distNext = arcLengths[nextIdx];
      let sample: Vec2;

      if (distNext > distPrev) {
        const t = (targetDistance - distPrev) / (distNext - distPrev);
        const p0 = history[prevIdx];
        const p1 = history[nextIdx];
        sample = {
          x: p0.x + (p1.x - p0.x) * t,
          y: p0.y + (p1.y - p0.y) * t
        };
      } else {
        sample = { x: history[nextIdx].x, y: history[nextIdx].y };
      }

      resampled.push(sample);
    }

    for (let i = 1; i < resampled.length; i++) {
      const prev = resampled[i - 1];
      const curr = resampled[i];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.0001) {
        const dirX = dx / dist;
        const dirY = dy / dist;
        resampled[i].x = prev.x + dirX * spacing;
        resampled[i].y = prev.y + dirY * spacing;
      } else {
        let dirX = fallbackDir.x;
        let dirY = fallbackDir.y;
        if (i >= 2) {
          const ref = resampled[i - 2];
          const dx2 = prev.x - ref.x;
          const dy2 = prev.y - ref.y;
          const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (len2 > 0.001) {
            dirX = dx2 / len2;
            dirY = dy2 / len2;
          }
        }
        resampled[i].x = prev.x + dirX * spacing;
        resampled[i].y = prev.y + dirY * spacing;
      }
    }

    return resampled;
  }
}

