import { colors } from "./constants";
import { Maze } from "./maze";
import { Direction } from "./types";

const WALL_THICKNESS = 4;
const PADDING_DESKTOP = 40;
const PADDING_MOBILE = 12;
const TRAIL_LENGTH = 5;

export interface TrailPoint {
  x: number;
  y: number;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;

  /** Logical (CSS-pixel) canvas size. */
  logicalWidth = 0;
  logicalHeight = 0;

  /** Computed tile size so the maze fits the canvas. */
  tileSize = 0;
  /** Pixel offset to center the maze on the canvas. */
  offsetX = 0;
  offsetY = 0;

  /** Screen shake offset applied during draw. */
  shakeX = 0;
  shakeY = 0;

  /** Extra bottom padding (e.g. for touch D-pad). */
  bottomReserved = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Update the stored logical size (called on every resize). */
  setLogicalSize(w: number, h: number): void {
    this.logicalWidth = w;
    this.logicalHeight = h;
  }

  /** Recompute tileSize and offsets for the current canvas + maze dimensions. */
  computeLayout(rows: number, cols: number): void {
    const cw = this.logicalWidth;
    const ch = this.logicalHeight - this.bottomReserved;
    const pad = Math.min(cw, ch) < 500 ? PADDING_MOBILE : PADDING_DESKTOP;
    this.tileSize = Math.max(
      4,
      Math.floor(Math.min((cw - pad * 2) / cols, (ch - pad * 2) / rows))
    );
    const mazeW = cols * this.tileSize;
    const mazeH = rows * this.tileSize;
    this.offsetX = Math.floor((cw - mazeW) / 2);
    this.offsetY = Math.floor((ch - mazeH) / 2);
  }

  /** Convert grid col/row to pixel x/y (top-left of tile). */
  gridToPixel(col: number, row: number): { px: number; py: number } {
    return {
      px: this.offsetX + col * this.tileSize,
      py: this.offsetY + row * this.tileSize,
    };
  }

  /** Clear the entire canvas with the BG color. */
  clear(): void {
    const { ctx } = this;
    ctx.fillStyle = colors.BG;
    ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight);
  }

  /** Apply screen shake translation. Call before drawing scene, end with endShake(). */
  applyShake(): void {
    if (this.shakeX !== 0 || this.shakeY !== 0) {
      this.ctx.save();
      this.ctx.translate(this.shakeX, this.shakeY);
    }
  }

  /** Undo screen shake translation. */
  endShake(): void {
    if (this.shakeX !== 0 || this.shakeY !== 0) {
      this.ctx.restore();
    }
  }

  /** Draw the full maze: path tiles, start highlight, goal glow, wall segments. */
  drawMaze(maze: Maze, time: number): void {
    const { ctx, tileSize } = this;

    // --- path tiles ---
    ctx.fillStyle = colors.PATH;
    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const { px, py } = this.gridToPixel(c, r);
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }

    // --- start cell highlight ---
    {
      const { px, py } = this.gridToPixel(maze.start.x, maze.start.y);
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(px, py, tileSize, tileSize);
    }

    // --- goal cell pulsing glow + scaled marker ---
    {
      const { px, py } = this.gridToPixel(maze.goal.x, maze.goal.y);
      const pulse = 0.25 + 0.2 * Math.sin(time * 3);
      ctx.fillStyle = `rgba(76, 175, 80, ${pulse})`;
      ctx.fillRect(px, py, tileSize, tileSize);

      const cx = px + tileSize / 2;
      const cy = py + tileSize / 2;
      const baseR = tileSize * 0.22;
      const scale = 0.9 + 0.2 * (0.5 + 0.5 * Math.sin(time * 3));
      const dotR = baseR * scale;
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = colors.GOAL;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(time * 3);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- walls ---
    ctx.strokeStyle = colors.WALL;
    ctx.lineWidth = WALL_THICKNESS;
    ctx.lineCap = "round";

    for (let r = 0; r < maze.rows; r++) {
      for (let c = 0; c < maze.cols; c++) {
        const { px, py } = this.gridToPixel(c, r);
        const cell = maze.getCell(r, c)!;

        if (cell.walls.top) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + tileSize, py);
          ctx.stroke();
        }
        if (cell.walls.right) {
          ctx.beginPath();
          ctx.moveTo(px + tileSize, py);
          ctx.lineTo(px + tileSize, py + tileSize);
          ctx.stroke();
        }
        if (cell.walls.bottom) {
          ctx.beginPath();
          ctx.moveTo(px, py + tileSize);
          ctx.lineTo(px + tileSize, py + tileSize);
          ctx.stroke();
        }
        if (cell.walls.left) {
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + tileSize);
          ctx.stroke();
        }
      }
    }
  }

  /** Draw a faint trail of the ant's recent positions. */
  drawTrail(trail: TrailPoint[]): void {
    const { ctx, tileSize } = this;
    const len = Math.min(trail.length, TRAIL_LENGTH);
    for (let i = 0; i < len; i++) {
      const p = trail[trail.length - 1 - i];
      const frac = 1 - i / TRAIL_LENGTH;
      ctx.globalAlpha = frac * 0.18;
      ctx.fillStyle = colors.ANT;
      ctx.beginPath();
      ctx.arc(p.x, p.y, tileSize * 0.12 * frac, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Draw the ant at pixel position (x, y) facing the given direction. */
  drawAnt(x: number, y: number, direction: Direction, time = 0): void {
    const { ctx, tileSize } = this;
    const s = tileSize * 0.38;

    let angle = 0;
    switch (direction) {
      case Direction.RIGHT:
        angle = 0;
        break;
      case Direction.DOWN:
        angle = Math.PI / 2;
        break;
      case Direction.LEFT:
        angle = Math.PI;
        break;
      case Direction.UP:
        angle = -Math.PI / 2;
        break;
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = colors.ANT;
    ctx.beginPath();
    ctx.ellipse(-s * 0.35, 0, s * 0.48, s * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(s * 0.2, 0, s * 0.28, s * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(s * 0.58, 0, s * 0.22, s * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const bob = Math.sin(time * 12) * s * 0.08;
    ctx.strokeStyle = colors.ANT;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(s * 0.72, -s * 0.08);
    ctx.quadraticCurveTo(s * 0.95, -s * 0.45 + bob, s * 1.0, -s * 0.55 + bob);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(s * 0.72, s * 0.08);
    ctx.quadraticCurveTo(s * 0.95, s * 0.45 - bob, s * 1.0, s * 0.55 - bob);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    const legPairs: [number, number, number][] = [
      [-s * 0.2, s * 0.55, 0.3],
      [s * 0.1, s * 0.58, 0.0],
      [s * 0.35, s * 0.52, -0.3],
    ];
    for (const [lx, reach, bend] of legPairs) {
      ctx.beginPath();
      ctx.moveTo(lx, -s * 0.2);
      ctx.lineTo(lx + reach * Math.sin(bend), -reach);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(lx, s * 0.2);
      ctx.lineTo(lx + reach * Math.sin(bend), reach);
      ctx.stroke();
    }

    ctx.restore();
  }
}
