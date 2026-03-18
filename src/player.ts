import { Direction } from "./types";

export class Player {
  x: number;
  y: number;
  direction: Direction;
  speed: number;

  constructor(x: number, y: number, direction: Direction, speed: number) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.speed = speed;
  }

  /** Move forward in the current direction by speed * dt pixels. */
  update(dt: number): void {
    const dist = this.speed * dt;
    switch (this.direction) {
      case Direction.UP:
        this.y -= dist;
        break;
      case Direction.DOWN:
        this.y += dist;
        break;
      case Direction.LEFT:
        this.x -= dist;
        break;
      case Direction.RIGHT:
        this.x += dist;
        break;
    }
  }

  /** Change facing direction immediately. */
  changeDirection(dir: Direction): void {
    this.direction = dir;
  }

  /** Teleport back to start position and direction. */
  reset(startX: number, startY: number, startDirection: Direction): void {
    this.x = startX;
    this.y = startY;
    this.direction = startDirection;
  }
}
