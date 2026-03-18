interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface EmitConfig {
  speedMin: number;
  speedMax: number;
  sizeMin: number;
  sizeMax: number;
  lifeMin: number;
  lifeMax: number;
  colors: string[];
  gravity?: number;
  /** Emission angle range in radians (default: full circle 0–2π). */
  angleMin?: number;
  angleMax?: number;
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export class ParticleSystem {
  private particles: Particle[] = [];

  get count(): number {
    return this.particles.length;
  }

  emit(x: number, y: number, count: number, config: EmitConfig): void {
    const aMin = config.angleMin ?? 0;
    const aMax = config.angleMax ?? Math.PI * 2;
    const g = config.gravity ?? 0;

    for (let i = 0; i < count; i++) {
      const angle = rand(aMin, aMax);
      const speed = rand(config.speedMin, config.speedMax);
      const life = rand(config.lifeMin, config.lifeMax);
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life,
        maxLife: life,
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: rand(config.sizeMin, config.sizeMax),
        gravity: g,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        // Swap-remove for perf.
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  clear(): void {
    this.particles.length = 0;
  }
}

// ---- Preset configs ----

export const WALL_HIT_CONFIG: EmitConfig = {
  speedMin: 40,
  speedMax: 120,
  sizeMin: 2,
  sizeMax: 5,
  lifeMin: 0.3,
  lifeMax: 0.7,
  colors: ["#5C3A1E", "#D2B48C", "#8B6914", "#A0522D"],
};

export const CONFETTI_CONFIG: EmitConfig = {
  speedMin: 80,
  speedMax: 220,
  sizeMin: 3,
  sizeMax: 7,
  lifeMin: 1.0,
  lifeMax: 2.0,
  colors: ["#4CAF50", "#FFC107", "#FF9800", "#8BC34A"],
  gravity: 180,
  angleMin: -Math.PI * 0.85, // mostly upward spread
  angleMax: -Math.PI * 0.15,
};
