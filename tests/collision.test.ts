import { describe, it, expect } from "vitest";
import { checkWallCollision, checkGoalReached } from "../src/collision";
import { Maze } from "../src/maze";
import { Player } from "../src/player";
import { Direction } from "../src/types";

/**
 * Minimal Renderer-like object with the fields collision.ts reads.
 * We set tileSize=100 and offset=(0,0) for easy mental math.
 */
function makeLayout(tileSize: number) {
  return { tileSize, offsetX: 0, offsetY: 0 } as {
    tileSize: number;
    offsetX: number;
    offsetY: number;
  };
}

describe("checkWallCollision", () => {
  it("returns false when player is in the center of the start cell", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // Center of cell (0,0) = (50, 50). Hitbox radius = 30.
    const player = new Player(50, 50, Direction.RIGHT, 120);
    expect(checkWallCollision(player, maze, layout as never)).toBe(false);
  });

  it("returns true when player is outside maze bounds", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    const player = new Player(-10, 50, Direction.LEFT, 120);
    expect(checkWallCollision(player, maze, layout as never)).toBe(true);
  });

  it("returns true when player is beyond bottom-right bound", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // 7 cols × 100 = 700, so x=710 is out.
    const player = new Player(710, 350, Direction.RIGHT, 120);
    expect(checkWallCollision(player, maze, layout as never)).toBe(true);
  });

  it("returns true when player is touching the top outer boundary", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // radius=30, y=20 → distance to top wall (y=0) is 20 < 30
    const player = new Player(50, 20, Direction.UP, 120);
    expect(checkWallCollision(player, maze, layout as never)).toBe(true);
  });

  it("returns true when player is near a known interior wall", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // The start cell (0,0) always has left and top outer walls.
    // Position the player near the top wall: y = 10, radius = 30 → collides.
    const player = new Player(50, 10, Direction.UP, 120);
    expect(checkWallCollision(player, maze, layout as never)).toBe(true);
  });
});

describe("checkGoalReached", () => {
  it("returns true when player center is inside the goal cell", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // Goal = (6,6), pixel range = (600..700, 600..700). Center = (650, 650).
    const player = new Player(650, 650, Direction.RIGHT, 120);
    expect(checkGoalReached(player, maze, layout as never)).toBe(true);
  });

  it("returns false when player is at the start cell", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    const player = new Player(50, 50, Direction.RIGHT, 120);
    expect(checkGoalReached(player, maze, layout as never)).toBe(false);
  });

  it("returns false when player is just outside the goal cell", () => {
    const maze = new Maze(7, 7);
    const layout = makeLayout(100);
    // Just left of goal cell: x=599
    const player = new Player(599, 650, Direction.RIGHT, 120);
    expect(checkGoalReached(player, maze, layout as never)).toBe(false);
  });
});
