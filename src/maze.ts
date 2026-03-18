import { Cell, Direction, Position } from "./types";

export class Maze {
  readonly rows: number;
  readonly cols: number;
  private grid: Cell[][] = [];

  readonly start: Position = { x: 0, y: 0 };
  readonly goal: Position;

  constructor(rows: number, cols: number) {
    this.rows = rows;
    this.cols = cols;
    this.goal = { x: cols - 1, y: rows - 1 };
    this.generate();
  }

  /** Reset grid and carve a new maze using recursive backtracker. */
  generate(): void {
    // Initialize grid — every cell starts with all four walls.
    this.grid = [];
    for (let r = 0; r < this.rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < this.cols; c++) {
        row.push({
          row: r,
          col: c,
          walls: { top: true, right: true, bottom: true, left: true },
        });
      }
      this.grid.push(row);
    }

    // Recursive backtracker (iterative with explicit stack).
    const visited: boolean[][] = Array.from({ length: this.rows }, () =>
      Array(this.cols).fill(false)
    );

    const stack: [number, number][] = [];
    const startRow = this.start.y;
    const startCol = this.start.x;
    visited[startRow][startCol] = true;
    stack.push([startRow, startCol]);

    while (stack.length > 0) {
      const [cr, cc] = stack[stack.length - 1];
      const neighbors = this.unvisitedNeighbors(cr, cc, visited);

      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }

      // Pick a random unvisited neighbor.
      const [nr, nc] = neighbors[Math.floor(Math.random() * neighbors.length)];
      this.removeWallBetween(cr, cc, nr, nc);
      visited[nr][nc] = true;
      stack.push([nr, nc]);
    }
  }

  getCell(row: number, col: number): Cell | undefined {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return undefined;
    }
    return this.grid[row][col];
  }

  /** Check if there is a wall on the given side of cell (row, col). */
  isWall(row: number, col: number, direction: Direction): boolean {
    const cell = this.getCell(row, col);
    if (!cell) return true;
    switch (direction) {
      case Direction.UP:
        return cell.walls.top;
      case Direction.DOWN:
        return cell.walls.bottom;
      case Direction.LEFT:
        return cell.walls.left;
      case Direction.RIGHT:
        return cell.walls.right;
    }
  }

  // ---- private helpers ----

  private unvisitedNeighbors(
    row: number,
    col: number,
    visited: boolean[][]
  ): [number, number][] {
    const dirs: [number, number][] = [
      [-1, 0], // up
      [1, 0],  // down
      [0, -1], // left
      [0, 1],  // right
    ];
    const result: [number, number][] = [];
    for (const [dr, dc] of dirs) {
      const nr = row + dr;
      const nc = col + dc;
      if (nr >= 0 && nr < this.rows && nc >= 0 && nc < this.cols && !visited[nr][nc]) {
        result.push([nr, nc]);
      }
    }
    return result;
  }

  private removeWallBetween(
    r1: number,
    c1: number,
    r2: number,
    c2: number
  ): void {
    const dr = r2 - r1;
    const dc = c2 - c1;

    if (dr === -1) {
      // neighbor is above
      this.grid[r1][c1].walls.top = false;
      this.grid[r2][c2].walls.bottom = false;
    } else if (dr === 1) {
      // neighbor is below
      this.grid[r1][c1].walls.bottom = false;
      this.grid[r2][c2].walls.top = false;
    } else if (dc === -1) {
      // neighbor is left
      this.grid[r1][c1].walls.left = false;
      this.grid[r2][c2].walls.right = false;
    } else if (dc === 1) {
      // neighbor is right
      this.grid[r1][c1].walls.right = false;
      this.grid[r2][c2].walls.left = false;
    }
  }
}
