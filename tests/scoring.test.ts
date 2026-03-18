import { describe, it, expect } from "vitest";
import { ScoreManager } from "../src/scoring";

describe("ScoreManager.calculateLevelScore", () => {
  it("gives max time bonus for instant completion", () => {
    const b = ScoreManager.calculateLevelScore(0, 1, 0);
    expect(b.timeBonus).toBe(1000);
  });

  it("reduces time bonus by 10 per elapsed second", () => {
    const b = ScoreManager.calculateLevelScore(30, 1, 0);
    expect(b.timeBonus).toBe(1000 - 30 * 10);
  });

  it("floors time bonus at 100 for very slow completions", () => {
    const b = ScoreManager.calculateLevelScore(999, 1, 0);
    expect(b.timeBonus).toBe(100);
  });

  it("level bonus is 500 * level", () => {
    expect(ScoreManager.calculateLevelScore(0, 1, 0).levelBonus).toBe(500);
    expect(ScoreManager.calculateLevelScore(0, 5, 0).levelBonus).toBe(2500);
  });

  it("applies 1.5x streak multiplier when wallHits is 0", () => {
    const b = ScoreManager.calculateLevelScore(0, 1, 0);
    expect(b.streakMultiplier).toBe(1.5);
    expect(b.total).toBe(Math.floor((1000 + 500) * 1.5));
  });

  it("no streak multiplier when wallHits > 0", () => {
    const b = ScoreManager.calculateLevelScore(0, 1, 3);
    expect(b.streakMultiplier).toBe(1.0);
    expect(b.total).toBe(1000 + 500);
  });

  it("total is floor of (timeBonus + levelBonus) * multiplier", () => {
    // 15 seconds, level 3, no hits → time=850, level=1500, ×1.5 = 3525
    const b = ScoreManager.calculateLevelScore(15, 3, 0);
    expect(b.total).toBe(Math.floor((850 + 1500) * 1.5));
  });

  it("uses floor(elapsedSeconds) for time bonus calculation", () => {
    // 10.9 seconds → floor = 10 → 1000-100 = 900
    const b = ScoreManager.calculateLevelScore(10.9, 1, 1);
    expect(b.timeBonus).toBe(900);
  });
});

describe("ScoreManager instance", () => {
  it("accumulates totalScore across levels", () => {
    const sm = new ScoreManager();

    // Simulate two instant level completions via calculateLevelScore.
    sm.startLevel(1);
    // Override elapsed by calling completeLevel immediately.
    const b1 = sm.completeLevel();
    expect(b1.total).toBeGreaterThan(0);
    const afterFirst = sm.totalScore;

    sm.startLevel(2);
    const b2 = sm.completeLevel();
    expect(sm.totalScore).toBe(afterFirst + b2.total);
  });

  it("recordWallHit increments wallHitsThisLevel", () => {
    const sm = new ScoreManager();
    sm.startLevel(1);
    expect(sm.wallHitsThisLevel).toBe(0);
    sm.recordWallHit();
    sm.recordWallHit();
    expect(sm.wallHitsThisLevel).toBe(2);
  });

  it("startLevel resets wallHitsThisLevel", () => {
    const sm = new ScoreManager();
    sm.startLevel(1);
    sm.recordWallHit();
    sm.startLevel(2);
    expect(sm.wallHitsThisLevel).toBe(0);
  });

  it("reset clears everything", () => {
    const sm = new ScoreManager();
    sm.startLevel(1);
    sm.recordWallHit();
    sm.completeLevel();
    sm.reset();
    expect(sm.totalScore).toBe(0);
    expect(sm.currentLevel).toBe(0);
    expect(sm.wallHitsThisLevel).toBe(0);
  });
});
