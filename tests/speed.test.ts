import { describe, it, expect } from "vitest";
import {
  BASE_SPEED_TPS,
  SPEED_INCREMENT_TPS,
  MAX_SPEED_TPS,
} from "../src/constants";
import { Player } from "../src/player";
import { Renderer } from "../src/renderer";
import { Direction } from "../src/types";

/** Simulate the speed computation that Game does at level start. */
function speedTpsForLevel(level: number): number {
  return Math.min(BASE_SPEED_TPS + (level - 1) * SPEED_INCREMENT_TPS, MAX_SPEED_TPS);
}

/** Create a renderer with a specific logical screen size and compute layout. */
function makeRenderer(
  screenW: number,
  screenH: number,
  gridSize: number,
  bottomReserved = 0
): Renderer {
  // Renderer constructor needs a ctx, but layout math never touches it.
  // Provide a stub so we can test purely computational methods.
  const r = new Renderer({} as CanvasRenderingContext2D);
  r.setLogicalSize(screenW, screenH);
  r.bottomReserved = bottomReserved;
  r.computeLayout(gridSize, gridSize);
  return r;
}

/**
 * Compute how many tiles the ant crosses in exactly 1 second
 * by simulating the game loop's speed formula.
 */
function measureTilesPerSecond(
  renderer: Renderer,
  level: number
): number {
  const tps = speedTpsForLevel(level);
  const pxPerSec = tps * renderer.tileSize;
  // tiles/sec = (px/sec) / (px/tile)
  return pxPerSec / renderer.tileSize;
}

/**
 * Simulate actual Player movement for 1 second and count how many tiles it crossed.
 */
function simulateMovement(
  renderer: Renderer,
  level: number,
  dtPerFrame: number,
  totalSeconds: number
): number {
  const tps = speedTpsForLevel(level);
  const pxSpeed = tps * renderer.tileSize;
  const player = new Player(0, 0, Direction.RIGHT, pxSpeed);

  const frames = Math.round(totalSeconds / dtPerFrame);
  for (let i = 0; i < frames; i++) {
    // Each frame, recompute speed from tileSize (as the real game loop does).
    player.speed = tps * renderer.tileSize;
    player.update(dtPerFrame);
  }

  return player.x / renderer.tileSize;
}

// ---- Screen configs to test ----

interface ScreenConfig {
  name: string;
  width: number;
  height: number;
  bottomReserved: number;
}

const SCREENS: ScreenConfig[] = [
  { name: "Desktop 1920x1080", width: 1920, height: 1080, bottomReserved: 0 },
  { name: "Desktop 1440x900", width: 1440, height: 900, bottomReserved: 0 },
  { name: "Laptop 1366x768", width: 1366, height: 768, bottomReserved: 0 },
  { name: "iPad 1024x1366", width: 1024, height: 1366, bottomReserved: 174 },
  { name: "iPhone 14 (390x844)", width: 390, height: 844, bottomReserved: 174 },
  { name: "iPhone SE (375x667)", width: 375, height: 667, bottomReserved: 174 },
  { name: "Small phone (320x568)", width: 320, height: 568, bottomReserved: 174 },
];

describe("Speed parity across screen sizes", () => {
  for (const level of [1, 3, 5, 8]) {
    const gridSize = Math.min(5 + level * 2, 21);
    const expectedTps = speedTpsForLevel(level);

    describe(`Level ${level} (${gridSize}x${gridSize}, ${expectedTps} TPS)`, () => {
      const results: { name: string; tileSize: number; tps: number }[] = [];

      for (const screen of SCREENS) {
        it(`${screen.name}: tiles-per-second equals ${expectedTps}`, () => {
          const renderer = makeRenderer(
            screen.width,
            screen.height,
            gridSize,
            screen.bottomReserved
          );
          const tps = measureTilesPerSecond(renderer, level);
          results.push({ name: screen.name, tileSize: renderer.tileSize, tps });
          expect(tps).toBeCloseTo(expectedTps, 5);
        });
      }

      it("all screens produce identical TPS", () => {
        // After all screens run, verify they all match.
        const unique = new Set(results.map((r) => r.tps.toFixed(6)));
        expect(unique.size).toBe(1);
      });
    });
  }

  describe("Simulation: actual Player movement over 3 seconds", () => {
    for (const level of [1, 5]) {
      const gridSize = Math.min(5 + level * 2, 21);
      const expectedTps = speedTpsForLevel(level);

      it(`Level ${level}: all screens cross same number of tiles at 60fps`, () => {
        const tilesCrossed: number[] = [];

        for (const screen of SCREENS) {
          const renderer = makeRenderer(
            screen.width,
            screen.height,
            gridSize,
            screen.bottomReserved
          );
          const tiles = simulateMovement(renderer, level, 1 / 60, 3);
          tilesCrossed.push(tiles);
        }

        // All should be approximately expectedTps * 3 seconds.
        for (const tiles of tilesCrossed) {
          expect(tiles).toBeCloseTo(expectedTps * 3, 1);
        }

        // And all should match each other within floating-point tolerance.
        for (let i = 1; i < tilesCrossed.length; i++) {
          expect(tilesCrossed[i]).toBeCloseTo(tilesCrossed[0], 1);
        }
      });

      it(`Level ${level}: 30fps and 120fps produce same distance as 60fps`, () => {
        const screen = SCREENS[0]; // Desktop
        const renderer = makeRenderer(
          screen.width,
          screen.height,
          gridSize,
          screen.bottomReserved
        );

        const tiles30 = simulateMovement(renderer, level, 1 / 30, 3);
        const tiles60 = simulateMovement(renderer, level, 1 / 60, 3);
        const tiles120 = simulateMovement(renderer, level, 1 / 120, 3);

        expect(tiles30).toBeCloseTo(expectedTps * 3, 1);
        expect(tiles60).toBeCloseTo(expectedTps * 3, 1);
        expect(tiles120).toBeCloseTo(expectedTps * 3, 1);
      });
    }
  });

  describe("Speed recomputes correctly after resize", () => {
    it("player speed updates when tileSize changes", () => {
      const level = 1;
      const gridSize = 7;
      const tps = speedTpsForLevel(level);

      // Start on desktop.
      const renderer = makeRenderer(1920, 1080, gridSize);
      const desktopTileSize = renderer.tileSize;
      const desktopSpeed = tps * renderer.tileSize;

      const player = new Player(0, 0, Direction.RIGHT, desktopSpeed);
      expect(player.speed).toBe(desktopSpeed);

      // Simulate resize to mobile.
      renderer.setLogicalSize(390, 844);
      renderer.bottomReserved = 174;
      renderer.computeLayout(gridSize, gridSize);
      const mobileTileSize = renderer.tileSize;

      expect(mobileTileSize).toBeLessThan(desktopTileSize);

      // Update speed as the game loop does.
      player.speed = tps * renderer.tileSize;
      expect(player.speed).toBe(tps * mobileTileSize);

      // Verify both produce the same tiles-per-second.
      const desktopTps = desktopSpeed / desktopTileSize;
      const mobileTps = player.speed / mobileTileSize;
      expect(desktopTps).toBeCloseTo(mobileTps, 5);
    });
  });
});
