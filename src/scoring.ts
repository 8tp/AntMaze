export interface LevelScoreBreakdown {
  timeBonus: number;
  levelBonus: number;
  streakMultiplier: number;
  total: number;
}

export class ScoreManager {
  totalScore = 0;
  currentLevel = 0;
  wallHitsThisLevel = 0;
  private levelStartTime = 0;

  /** Reset per-level tracking for a new level. */
  startLevel(level: number): void {
    this.currentLevel = level;
    this.wallHitsThisLevel = 0;
    this.levelStartTime = performance.now() / 1000;
  }

  /** Seconds elapsed since startLevel() was called. */
  elapsedSeconds(): number {
    return performance.now() / 1000 - this.levelStartTime;
  }

  recordWallHit(): void {
    this.wallHitsThisLevel++;
  }

  /** Push the start time forward to compensate for time spent paused. */
  addPausedTime(seconds: number): void {
    this.levelStartTime += seconds;
  }

  /** Pure calculation — no side effects. */
  static calculateLevelScore(
    elapsedSeconds: number,
    level: number,
    wallHits: number
  ): LevelScoreBreakdown {
    const timeBonus = Math.max(100, 1000 - Math.floor(elapsedSeconds) * 10);
    const levelBonus = 500 * level;
    const streakMultiplier = wallHits === 0 ? 1.5 : 1.0;
    const total = Math.floor((timeBonus + levelBonus) * streakMultiplier);
    return { timeBonus, levelBonus, streakMultiplier, total };
  }

  /** Finalize the level: calculate score, add to total, return breakdown. */
  completeLevel(): LevelScoreBreakdown {
    const elapsed = this.elapsedSeconds();
    const breakdown = ScoreManager.calculateLevelScore(
      elapsed,
      this.currentLevel,
      this.wallHitsThisLevel
    );
    this.totalScore += breakdown.total;
    return breakdown;
  }

  reset(): void {
    this.totalScore = 0;
    this.currentLevel = 0;
    this.wallHitsThisLevel = 0;
    this.levelStartTime = 0;
  }
}
