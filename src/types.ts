export enum Direction {
  UP,
  DOWN,
  LEFT,
  RIGHT,
}

export interface Position {
  x: number;
  y: number;
}

export interface Cell {
  row: number;
  col: number;
  walls: {
    top: boolean;
    right: boolean;
    bottom: boolean;
    left: boolean;
  };
}

export enum GameState {
  TITLE,
  PLAYING,
  PAUSED,
  LEVEL_COMPLETE,
  GAME_OVER,
}
