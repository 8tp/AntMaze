import { describe, it, expect } from "vitest";
import { Maze } from "../src/maze";
import { Direction } from "../src/types";

/** Flood-fill from (startRow, startCol) and return the count of reachable cells. */
function floodFill(maze: Maze): number {
  const visited: boolean[][] = Array.from({ length: maze.rows }, () =>
    Array(maze.cols).fill(false)
  );
  const stack: [number, number][] = [[0, 0]];
  visited[0][0] = true;
  let count = 0;

  while (stack.length > 0) {
    const [r, c] = stack.pop()!;
    count++;

    // Try each direction — only traverse if there's no wall.
    const neighbors: [Direction, number, number][] = [
      [Direction.UP, r - 1, c],
      [Direction.DOWN, r + 1, c],
      [Direction.LEFT, r, c - 1],
      [Direction.RIGHT, r, c + 1],
    ];

    for (const [dir, nr, nc] of neighbors) {
      if (
        nr >= 0 &&
        nr < maze.rows &&
        nc >= 0 &&
        nc < maze.cols &&
        !visited[nr][nc] &&
        !maze.isWall(r, c, dir)
      ) {
        visited[nr][nc] = true;
        stack.push([nr, nc]);
      }
    }
  }

  return count;
}

describe("Maze", () => {
  const sizes: [number, number][] = [
    [7, 7],
    [9, 9],
    [11, 11],
    [15, 15],
    [21, 21],
  ];

  for (const [rows, cols] of sizes) {
    describe(`${rows}×${cols}`, () => {
      const maze = new Maze(rows, cols);

      it("has correct dimensions", () => {
        expect(maze.rows).toBe(rows);
        expect(maze.cols).toBe(cols);
        // Every cell exists.
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const cell = maze.getCell(r, c);
            expect(cell).toBeDefined();
            expect(cell!.row).toBe(r);
            expect(cell!.col).toBe(c);
          }
        }
      });

      it("returns undefined for out-of-bounds cells", () => {
        expect(maze.getCell(-1, 0)).toBeUndefined();
        expect(maze.getCell(0, -1)).toBeUndefined();
        expect(maze.getCell(rows, 0)).toBeUndefined();
        expect(maze.getCell(0, cols)).toBeUndefined();
      });

      it("has start at (0,0) and goal at (rows-1, cols-1)", () => {
        expect(maze.start).toEqual({ x: 0, y: 0 });
        expect(maze.goal).toEqual({ x: cols - 1, y: rows - 1 });
      });

      it("every cell is reachable from start (no isolated sections)", () => {
        const reachable = floodFill(maze);
        expect(reachable).toBe(rows * cols);
      });

      it("is a perfect maze (exactly rows*cols - 1 passages)", () => {
        // A perfect maze on R*C cells has exactly R*C - 1 removed walls
        // (one per edge in the spanning tree). Count passages by iterating
        // right/down walls only to avoid double-counting.
        let passages = 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (!maze.isWall(r, c, Direction.RIGHT) && c + 1 < cols) passages++;
            if (!maze.isWall(r, c, Direction.DOWN) && r + 1 < rows) passages++;
          }
        }
        expect(passages).toBe(rows * cols - 1);
      });

      it("walls are consistent between adjacent cells", () => {
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (c + 1 < cols) {
              // right wall of (r,c) must match left wall of (r,c+1)
              expect(maze.isWall(r, c, Direction.RIGHT)).toBe(
                maze.isWall(r, c + 1, Direction.LEFT)
              );
            }
            if (r + 1 < rows) {
              // bottom wall of (r,c) must match top wall of (r+1,c)
              expect(maze.isWall(r, c, Direction.DOWN)).toBe(
                maze.isWall(r + 1, c, Direction.UP)
              );
            }
          }
        }
      });

      it("has outer boundary walls intact", () => {
        for (let c = 0; c < cols; c++) {
          expect(maze.isWall(0, c, Direction.UP)).toBe(true);
          expect(maze.isWall(rows - 1, c, Direction.DOWN)).toBe(true);
        }
        for (let r = 0; r < rows; r++) {
          expect(maze.isWall(r, 0, Direction.LEFT)).toBe(true);
          expect(maze.isWall(r, cols - 1, Direction.RIGHT)).toBe(true);
        }
      });
    });
  }

  it("generate() produces a different maze on regeneration", () => {
    const maze = new Maze(7, 7);
    // Snapshot walls of first few cells.
    const snapshot = () =>
      JSON.stringify(
        Array.from({ length: 7 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => maze.getCell(r, c)!.walls)
        )
      );

    const first = snapshot();
    // Regenerate up to 10 times — extremely unlikely to get identical maze.
    let different = false;
    for (let i = 0; i < 10; i++) {
      maze.generate();
      if (snapshot() !== first) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });
});
