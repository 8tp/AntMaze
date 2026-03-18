import { Maze } from "./maze";
import { Player } from "./player";
import { Renderer } from "./renderer";

/** Hitbox radius as a fraction of tileSize (60% diameter → 0.3 radius). */
const HITBOX_RATIO = 0.3;

/**
 * Shortest distance from point (px, py) to the line segment (ax,ay)→(bx,by).
 */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  // Degenerate segment (shouldn't happen, but guard).
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const nearX = ax + t * dx;
  const nearY = ay + t * dy;
  return Math.hypot(px - nearX, py - nearY);
}

/**
 * Returns true if the player's circular hitbox overlaps any wall segment
 * or is outside the maze bounds.
 */
export function checkWallCollision(
  player: Player,
  maze: Maze,
  renderer: Renderer
): boolean {
  const { tileSize, offsetX, offsetY } = renderer;
  const radius = tileSize * HITBOX_RATIO;

  // Convert player pixel position to floating-point grid coords.
  const gridCol = (player.x - offsetX) / tileSize;
  const gridRow = (player.y - offsetY) / tileSize;

  // Out of maze bounds check.
  if (gridCol < 0 || gridCol >= maze.cols || gridRow < 0 || gridRow >= maze.rows) {
    return true;
  }

  // The cell the player center is in.
  const cellCol = Math.floor(gridCol);
  const cellRow = Math.floor(gridRow);

  // Check walls in a 3×3 neighbourhood around the player's cell so that
  // the hitbox can't clip a wall from a neighbouring cell near edges/corners.
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = cellRow + dr;
      const c = cellCol + dc;
      const cell = maze.getCell(r, c);
      if (!cell) continue;

      const cx = offsetX + c * tileSize;
      const cy = offsetY + r * tileSize;

      // Top wall
      if (cell.walls.top) {
        if (distToSegment(player.x, player.y, cx, cy, cx + tileSize, cy) < radius) {
          return true;
        }
      }
      // Bottom wall
      if (cell.walls.bottom) {
        if (
          distToSegment(
            player.x,
            player.y,
            cx,
            cy + tileSize,
            cx + tileSize,
            cy + tileSize
          ) < radius
        ) {
          return true;
        }
      }
      // Left wall
      if (cell.walls.left) {
        if (distToSegment(player.x, player.y, cx, cy, cx, cy + tileSize) < radius) {
          return true;
        }
      }
      // Right wall
      if (cell.walls.right) {
        if (
          distToSegment(
            player.x,
            player.y,
            cx + tileSize,
            cy,
            cx + tileSize,
            cy + tileSize
          ) < radius
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Returns true if the player's center is inside the goal cell.
 */
export function checkGoalReached(
  player: Player,
  maze: Maze,
  renderer: Renderer
): boolean {
  const { tileSize, offsetX, offsetY } = renderer;
  const goalPx = offsetX + maze.goal.x * tileSize;
  const goalPy = offsetY + maze.goal.y * tileSize;

  return (
    player.x >= goalPx &&
    player.x <= goalPx + tileSize &&
    player.y >= goalPy &&
    player.y <= goalPy + tileSize
  );
}
