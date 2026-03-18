export const TILE_SIZE = 40;

/** Speed expressed in tiles-per-second. Multiplied by tileSize at runtime. */
export const BASE_SPEED_TPS = 2.0;
export const SPEED_INCREMENT_TPS = 0.12;
export const MAX_SPEED_TPS = 3.5;

export const colors = {
  WALL: "#5C3A1E",
  PATH: "#D2B48C",
  ANT: "#1A1A1A",
  GOAL: "#4CAF50",
  BG: "#3E2723",
} as const;
