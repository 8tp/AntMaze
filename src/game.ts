import { AudioManager } from "./audio";
import { checkGoalReached, checkWallCollision } from "./collision";
import { BASE_SPEED_TPS, MAX_SPEED_TPS, SPEED_INCREMENT_TPS, colors } from "./constants";
import { HUD } from "./hud";
import { InputHandler } from "./input";
import { Maze } from "./maze";
import {
  CONFETTI_CONFIG,
  ParticleSystem,
  WALL_HIT_CONFIG,
} from "./particles";
import { Player } from "./player";
import { Renderer, TrailPoint } from "./renderer";
import { LevelScoreBreakdown, ScoreManager } from "./scoring";
import { Direction, GameState } from "./types";

function gridSizeForLevel(level: number): number {
  return Math.min(5 + level * 2, 21);
}

function speedTpsForLevel(level: number): number {
  return Math.min(BASE_SPEED_TPS + (level - 1) * SPEED_INCREMENT_TPS, MAX_SPEED_TPS);
}

const SHAKE_DURATION = 0.12;
const SHAKE_MAGNITUDE = 3;
const TRAIL_MAX = 5;
const TRAIL_INTERVAL = 0.03;
const FADE_DURATION = 0.3;

const STORAGE_KEY = "antmaze_best";

interface BestRecord { score: number; level: number }

function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const obj = JSON.parse(raw);
      if (typeof obj.score === "number" && typeof obj.level === "number") {
        return obj as BestRecord;
      }
    }
  } catch { /* ignore */ }
  return { score: 0, level: 0 };
}

function saveBest(rec: BestRecord): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(rec)); } catch { /* ignore */ }
}

// ---- Pause menu items ----

const enum PauseView { MENU, SETTINGS }

const MENU_ITEMS = ["Resume", "Settings", "Quit"] as const;

export class Game {
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;
  private input: InputHandler;
  private hud: HUD;
  private score: ScoreManager;
  private particles: ParticleSystem;
  private audio: AudioManager;
  private player!: Player;
  private maze!: Maze;

  private state = GameState.TITLE;
  private levelCompleteTime = 0;
  private lastBreakdown: LevelScoreBreakdown | null = null;

  private shakeTimer = 0;
  private trail: TrailPoint[] = [];
  private trailTimer = 0;
  private fadeTimer = 0;
  private levelTps = 0;

  private titleAntX = 0;
  private titleAntDir = Direction.RIGHT;
  private titleAntSpeed = 80;

  private lastTime = 0;
  private pausedAtTime = 0; // wall-clock time when paused

  private best: BestRecord;
  private isNewHighScore = false;

  // Pause menu state.
  private pauseView = PauseView.MENU;
  private pauseMenuIndex = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
    this.renderer = new Renderer(ctx);
    this.input = new InputHandler();
    this.hud = new HUD(ctx, this.renderer);
    this.score = new ScoreManager();
    this.particles = new ParticleSystem();
    this.audio = new AudioManager();
    this.renderer.bottomReserved = this.input.dpadHeight;
    this.best = loadBest();
    this.input.updateMuteBtn(this.audio.muted);
  }

  start(): void {
    this.state = GameState.TITLE;
    this.titleAntX = this.renderer.logicalWidth * 0.1;
    requestAnimationFrame((t) => this.frame(t));
  }

  handleResize(w: number, h: number): void {
    this.renderer.setLogicalSize(w, h);
    if ((this.state === GameState.PLAYING || this.state === GameState.PAUSED) && this.maze) {
      this.renderer.computeLayout(this.maze.rows, this.maze.cols);
      this.resetPlayerToStart();
      this.trail.length = 0;
    }
  }

  private get cw(): number { return this.renderer.logicalWidth; }
  private get ch(): number { return this.renderer.logicalHeight; }

  // ----------------------------------------------------------------
  // Frame dispatch
  // ----------------------------------------------------------------

  private frame(t: number): void {
    const dt = this.lastTime === 0 ? 0 : Math.min((t - this.lastTime) / 1000, 0.1);
    this.lastTime = t;
    const time = t / 1000;

    // Global mute toggle (M key / mobile button) works in any state.
    if (this.input.consumeMuteToggle()) {
      this.audio.init();
      this.audio.toggleMute();
      this.input.updateMuteBtn(this.audio.muted);
    }

    switch (this.state) {
      case GameState.TITLE:
        this.updateTitle(dt, time);
        break;
      case GameState.PLAYING:
        this.updatePlaying(dt, time);
        break;
      case GameState.PAUSED:
        this.updatePaused(time);
        break;
      case GameState.LEVEL_COMPLETE:
        this.updateLevelComplete(dt, time);
        break;
      case GameState.GAME_OVER:
        this.updateGameOver(time);
        break;
    }

    requestAnimationFrame((t2) => this.frame(t2));
  }

  // ----------------------------------------------------------------
  // TITLE
  // ----------------------------------------------------------------

  private updateTitle(dt: number, time: number): void {
    const { cw, ch } = this;

    this.titleAntX +=
      (this.titleAntDir === Direction.RIGHT ? 1 : -1) * this.titleAntSpeed * dt;
    if (this.titleAntX > cw * 0.9) this.titleAntDir = Direction.LEFT;
    if (this.titleAntX < cw * 0.1) this.titleAntDir = Direction.RIGHT;

    if (this.input.consumeAnyKey()) {
      this.audio.init();
      this.audio.startMusic();
      this.beginLevel(1);
      return;
    }

    this.renderer.clear();
    const ctx = this.ctx;

    ctx.fillStyle = colors.PATH;
    ctx.font = `bold ${Math.min(cw * 0.1, 80)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ANT MAZE", cw / 2, ch * 0.28);

    ctx.fillStyle = colors.GOAL;
    ctx.font = `${Math.min(cw * 0.03, 22)}px monospace`;
    ctx.fillText("Navigate the maze. Don't touch the walls!", cw / 2, ch * 0.39);

    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `${Math.min(cw * 0.025, 20)}px monospace`;
      const prompt = this.input.isTouchDevice ? "Tap to start" : "Press any key to start";
      ctx.fillText(prompt, cw / 2, ch * 0.49);
    }

    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `${Math.min(cw * 0.02, 16)}px monospace`;
    const hint = this.input.isTouchDevice
      ? "Use the D-pad to steer. Don't touch the walls!"
      : "Use arrow keys or WASD to steer. Don't touch the walls!";
    ctx.fillText(hint, cw / 2, ch * 0.57);

    if (this.best.score > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = `${Math.min(cw * 0.02, 16)}px monospace`;
      ctx.fillText(`Best: ${this.best.score}  (Level ${this.best.level})`, cw / 2, ch * 0.63);
    }

    const savedTile = this.renderer.tileSize;
    this.renderer.tileSize = Math.min(cw * 0.06, 50);
    this.renderer.drawAnt(this.titleAntX, ch * 0.78, this.titleAntDir, time);
    this.renderer.tileSize = savedTile;
  }

  // ----------------------------------------------------------------
  // PLAYING
  // ----------------------------------------------------------------

  private beginLevel(level: number): void {
    this.state = GameState.PLAYING;
    this.lastBreakdown = null;
    this.trail.length = 0;
    this.trailTimer = 0;
    this.shakeTimer = 0;
    this.fadeTimer = FADE_DURATION;
    this.particles.clear();
    this.isNewHighScore = false;

    const size = gridSizeForLevel(level);
    this.maze = new Maze(size, size);
    this.renderer.computeLayout(this.maze.rows, this.maze.cols);

    this.levelTps = speedTpsForLevel(level);
    const sp = this.startPixel();
    this.player = new Player(sp.x, sp.y, this.startDirection(), this.levelTps * this.renderer.tileSize);

    this.score.startLevel(level);
    this.input.setDpadVisible(true);
  }

  private updatePlaying(dt: number, time: number): void {
    const { cw, ch } = this;

    if (this.fadeTimer > 0) this.fadeTimer -= dt;

    // Escape → pause.
    if (this.input.consumeEscape()) {
      this.pausedAtTime = performance.now();
      this.state = GameState.PAUSED;
      this.pauseView = PauseView.MENU;
      this.pauseMenuIndex = 0;
      this.input.consumeAnyKey();
      this.input.consumeDirection();
      return;
    }

    const dir = this.input.consumeDirection();
    if (dir !== null) {
      this.player.changeDirection(dir);
      this.audio.playDirectionChange();
    }

    this.player.speed = this.levelTps * this.renderer.tileSize;
    this.player.update(dt);

    this.trailTimer += dt;
    if (this.trailTimer >= TRAIL_INTERVAL) {
      this.trailTimer = 0;
      this.trail.push({ x: this.player.x, y: this.player.y });
      if (this.trail.length > TRAIL_MAX) this.trail.shift();
    }

    if (checkWallCollision(this.player, this.maze, this.renderer)) {
      this.particles.emit(this.player.x, this.player.y, 18, WALL_HIT_CONFIG);
      this.shakeTimer = SHAKE_DURATION;
      this.score.recordWallHit();
      this.audio.playWallHit();
      this.resetPlayerToStart();
      this.trail.length = 0;
    } else if (checkGoalReached(this.player, this.maze, this.renderer)) {
      this.completeLevel();
      return;
    }

    this.updateShake(dt);
    this.particles.update(dt);

    this.renderer.clear();
    this.renderer.applyShake();
    this.renderer.drawMaze(this.maze, time);
    this.renderer.drawTrail(this.trail);
    this.renderer.drawAnt(this.player.x, this.player.y, this.player.direction, time);
    this.particles.draw(this.ctx);
    this.renderer.endShake();
    this.hud.draw(this.score, time, this.input.dpadHeight, this.audio.muted, this.input.isTouchDevice);

    if (this.fadeTimer > 0) {
      this.ctx.fillStyle = colors.BG;
      this.ctx.globalAlpha = this.fadeTimer / FADE_DURATION;
      this.ctx.fillRect(0, 0, cw, ch);
      this.ctx.globalAlpha = 1;
    }
  }

  private completeLevel(): void {
    const { px, py } = this.renderer.gridToPixel(this.maze.goal.x, this.maze.goal.y);
    this.particles.emit(px + this.renderer.tileSize / 2, py + this.renderer.tileSize / 2, 45, CONFETTI_CONFIG);
    this.audio.playLevelComplete();
    this.lastBreakdown = this.score.completeLevel();
    this.state = GameState.LEVEL_COMPLETE;
    this.levelCompleteTime = performance.now() / 1000;
    this.input.consumeAnyKey();
    this.input.consumeDirection();
  }

  // ----------------------------------------------------------------
  // PAUSED
  // ----------------------------------------------------------------

  private updatePaused(time: number): void {
    const { cw, ch } = this;
    const ctx = this.ctx;

    // Handle input.
    const esc = this.input.consumeEscape();
    const dir = this.input.consumeDirection();
    const any = this.input.consumeAnyKey();

    if (this.pauseView === PauseView.SETTINGS) {
      this.updateSettings(esc, dir, any, time);
      return;
    }

    // --- MENU view ---
    // Navigate with up/down.
    if (dir === Direction.UP) {
      this.pauseMenuIndex = (this.pauseMenuIndex - 1 + MENU_ITEMS.length) % MENU_ITEMS.length;
    } else if (dir === Direction.DOWN) {
      this.pauseMenuIndex = (this.pauseMenuIndex + 1) % MENU_ITEMS.length;
    }

    // Escape = resume.
    if (esc) {
      this.resumeGame();
      return;
    }

    // Select with Enter / any non-direction key, or tap.
    // We check `any` but exclude if a direction was also pressed this frame.
    if (any && dir === null) {
      const selected = MENU_ITEMS[this.pauseMenuIndex];
      if (selected === "Resume") { this.resumeGame(); return; }
      if (selected === "Settings") { this.pauseView = PauseView.SETTINGS; return; }
      if (selected === "Quit") { this.enterGameOver(); return; }
    }

    // --- Draw ---
    this.drawFrozenScene(time);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = colors.PATH;
    ctx.font = `bold ${Math.min(cw * 0.07, 56)}px monospace`;
    ctx.fillText("PAUSED", cw / 2, ch * 0.25);

    const itemFont = `${Math.min(cw * 0.035, 28)}px monospace`;
    const startY = ch * 0.42;
    const gap = Math.min(cw * 0.06, 48);

    for (let i = 0; i < MENU_ITEMS.length; i++) {
      const y = startY + i * gap;
      const selected = i === this.pauseMenuIndex;
      ctx.font = selected ? `bold ${itemFont}` : itemFont;
      ctx.fillStyle = selected ? "#FFFFFF" : "rgba(255,255,255,0.5)";
      const prefix = selected ? "\u25B6 " : "  ";
      ctx.fillText(prefix + MENU_ITEMS[i], cw / 2, y);
    }

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.min(cw * 0.018, 14)}px monospace`;
    ctx.fillText("Arrow keys to navigate, Enter to select, Esc to resume", cw / 2, ch * 0.78);
  }

  // ----------------------------------------------------------------
  // SETTINGS (sub-view of PAUSED)
  // ----------------------------------------------------------------

  private settingsIndex = 0;

  private updateSettings(
    esc: boolean,
    dir: Direction | null,
    any: boolean,
    time: number
  ): void {
    const { cw, ch } = this;
    const ctx = this.ctx;

    const items = [
      { label: "Music", on: this.audio.musicOn },
      { label: "Sound FX", on: this.audio.sfxOn },
      { label: "Back", on: null as boolean | null },
    ];

    // Navigate.
    if (dir === Direction.UP) {
      this.settingsIndex = (this.settingsIndex - 1 + items.length) % items.length;
    } else if (dir === Direction.DOWN) {
      this.settingsIndex = (this.settingsIndex + 1) % items.length;
    }

    // Escape or selecting "Back" → return to pause menu.
    if (esc) {
      this.pauseView = PauseView.MENU;
      this.input.consumeAnyKey();
      return;
    }

    // Toggle / select.
    if (any && dir === null) {
      const item = items[this.settingsIndex];
      if (item.label === "Music") {
        this.audio.setMusicOn(!this.audio.musicOn);
        this.input.updateMuteBtn(this.audio.muted);
      } else if (item.label === "Sound FX") {
        this.audio.setSfxOn(!this.audio.sfxOn);
        this.input.updateMuteBtn(this.audio.muted);
      } else {
        this.pauseView = PauseView.MENU;
        return;
      }
    }

    // Left/right also toggle the current item.
    if ((dir === Direction.LEFT || dir === Direction.RIGHT) && this.settingsIndex < 2) {
      if (this.settingsIndex === 0) this.audio.setMusicOn(!this.audio.musicOn);
      else this.audio.setSfxOn(!this.audio.sfxOn);
      this.input.updateMuteBtn(this.audio.muted);
    }

    // --- Draw ---
    // Re-read items after potential toggle.
    const drawItems = [
      { label: "Music", on: this.audio.musicOn },
      { label: "Sound FX", on: this.audio.sfxOn },
      { label: "Back", on: null as boolean | null },
    ];

    this.drawFrozenScene(time);

    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = colors.PATH;
    ctx.font = `bold ${Math.min(cw * 0.06, 48)}px monospace`;
    ctx.fillText("SETTINGS", cw / 2, ch * 0.22);

    const itemFont = `${Math.min(cw * 0.03, 24)}px monospace`;
    const startY = ch * 0.40;
    const gap = Math.min(cw * 0.06, 48);

    for (let i = 0; i < drawItems.length; i++) {
      const y = startY + i * gap;
      const sel = i === this.settingsIndex;
      const item = drawItems[i];

      ctx.font = sel ? `bold ${itemFont}` : itemFont;
      ctx.fillStyle = sel ? "#FFFFFF" : "rgba(255,255,255,0.5)";

      if (item.on !== null) {
        const prefix = sel ? "\u25B6 " : "  ";
        const status = item.on ? " ON" : " OFF";
        const statusColor = item.on ? colors.GOAL : "#FF5722";
        // Draw label.
        ctx.textAlign = "right";
        ctx.fillText(prefix + item.label + ":", cw / 2 + 10, y);
        // Draw status with color.
        ctx.textAlign = "left";
        ctx.fillStyle = sel ? statusColor : "rgba(255,255,255,0.5)";
        ctx.font = `bold ${itemFont}`;
        ctx.fillText(status, cw / 2 + 14, y);
      } else {
        ctx.textAlign = "center";
        ctx.fillText(sel ? "\u25B6 Back" : "  Back", cw / 2, y);
      }
    }

    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = `${Math.min(cw * 0.018, 14)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("Enter/arrows to toggle, Esc to go back", cw / 2, ch * 0.78);
  }

  // ----------------------------------------------------------------
  // Resume from pause
  // ----------------------------------------------------------------

  private resumeGame(): void {
    // Compensate the score timer for time spent paused.
    const pauseDuration = (performance.now() - this.pausedAtTime) / 1000;
    this.score.addPausedTime(pauseDuration);

    this.state = GameState.PLAYING;
    this.lastTime = 0; // force dt=0 on next frame to avoid a jump
    this.input.consumeAnyKey();
    this.input.consumeDirection();
  }

  /** Draw the frozen game scene underneath overlays. */
  private drawFrozenScene(time: number): void {
    this.renderer.clear();
    this.renderer.drawMaze(this.maze, time);
    this.renderer.drawAnt(this.player.x, this.player.y, this.player.direction, time);
    this.hud.draw(this.score, time, this.input.dpadHeight, this.audio.muted, this.input.isTouchDevice);
  }

  // ----------------------------------------------------------------
  // Screen shake
  // ----------------------------------------------------------------

  private updateShake(dt: number): void {
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const intensity = (this.shakeTimer / SHAKE_DURATION) * SHAKE_MAGNITUDE;
      this.renderer.shakeX = (Math.random() * 2 - 1) * intensity;
      this.renderer.shakeY = (Math.random() * 2 - 1) * intensity;
    } else {
      this.renderer.shakeX = 0;
      this.renderer.shakeY = 0;
    }
  }

  // ----------------------------------------------------------------
  // LEVEL_COMPLETE
  // ----------------------------------------------------------------

  private updateLevelComplete(dt: number, time: number): void {
    const { cw, ch } = this;
    const elapsed = time - this.levelCompleteTime;

    this.particles.update(dt);

    if (elapsed > 1.5 || this.input.consumeAnyKey()) {
      this.beginLevel(this.score.currentLevel + 1);
      return;
    }

    this.renderer.clear();
    this.renderer.drawMaze(this.maze, time);
    this.renderer.drawAnt(this.player.x, this.player.y, this.player.direction, time);
    this.particles.draw(this.ctx);
    this.hud.draw(this.score, time, this.input.dpadHeight, this.audio.muted, this.input.isTouchDevice);

    const ctx = this.ctx;
    const b = this.lastBreakdown!;
    const levelElapsed = this.score.elapsedSeconds();

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, cw, ch);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = colors.GOAL;
    ctx.font = `bold ${Math.min(cw * 0.06, 48)}px monospace`;
    ctx.fillText(`Level ${this.score.currentLevel} Complete!`, cw / 2, ch * 0.25);

    ctx.font = `${Math.min(cw * 0.026, 21)}px monospace`;
    const mins = Math.floor(levelElapsed / 60);
    const secs = levelElapsed % 60;

    ctx.fillStyle = colors.PATH;
    ctx.fillText(`Time: ${mins}:${secs.toFixed(1).padStart(4, "0")}`, cw / 2, ch * 0.37);

    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`Time Bonus:  ${b.timeBonus}`, cw / 2, ch * 0.45);
    ctx.fillText(`Level Bonus: ${b.levelBonus}`, cw / 2, ch * 0.51);

    if (b.streakMultiplier > 1) {
      ctx.fillStyle = "#FF5722";
      ctx.fillText(`\u2605 Clean Run! \u00d7${b.streakMultiplier}`, cw / 2, ch * 0.57);
    } else {
      ctx.fillStyle = colors.PATH;
      ctx.fillText(`Wall hits: ${this.score.wallHitsThisLevel}`, cw / 2, ch * 0.57);
    }

    ctx.fillStyle = colors.GOAL;
    ctx.font = `bold ${Math.min(cw * 0.035, 28)}px monospace`;
    ctx.fillText(`+ ${b.total} pts`, cw / 2, ch * 0.66);

    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.min(cw * 0.02, 16)}px monospace`;
    ctx.fillText("Next level starting...", cw / 2, ch * 0.76);
  }

  // ----------------------------------------------------------------
  // GAME_OVER
  // ----------------------------------------------------------------

  private enterGameOver(): void {
    this.state = GameState.GAME_OVER;
    this.input.consumeAnyKey();
    this.input.setDpadVisible(false);
    this.audio.stopMusic();

    this.isNewHighScore = this.score.totalScore > this.best.score;
    if (this.isNewHighScore) {
      this.best = { score: this.score.totalScore, level: this.score.currentLevel - 1 };
      saveBest(this.best);
    }
  }

  private updateGameOver(time: number): void {
    const { cw, ch } = this;

    if (this.input.consumeAnyKey()) {
      this.score.reset();
      this.particles.clear();
      this.isNewHighScore = false;
      this.state = GameState.TITLE;
      this.lastTime = 0;
      return;
    }

    this.renderer.clear();
    const ctx = this.ctx;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = colors.PATH;
    ctx.font = `bold ${Math.min(cw * 0.08, 64)}px monospace`;
    ctx.fillText("GAME OVER", cw / 2, ch * 0.22);

    if (this.isNewHighScore) {
      const pulse = 0.7 + 0.3 * Math.sin(time * 4);
      ctx.fillStyle = `rgba(255, 193, 7, ${pulse})`;
      ctx.font = `bold ${Math.min(cw * 0.04, 32)}px monospace`;
      ctx.fillText("NEW HIGH SCORE!", cw / 2, ch * 0.34);
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.font = `${Math.min(cw * 0.035, 28)}px monospace`;
    ctx.fillText(`Total Score: ${this.score.totalScore}`, cw / 2, ch * 0.44);
    ctx.fillText(`Levels Completed: ${this.score.currentLevel - 1}`, cw / 2, ch * 0.52);

    if (this.best.score > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = `${Math.min(cw * 0.022, 18)}px monospace`;
      ctx.fillText(`Best: ${this.best.score}  (Level ${this.best.level})`, cw / 2, ch * 0.60);
    }

    if (Math.floor(time * 2) % 2 === 0) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `${Math.min(cw * 0.025, 20)}px monospace`;
      const prompt = this.input.isTouchDevice ? "Tap to play again" : "Press any key to play again";
      ctx.fillText(prompt, cw / 2, ch * 0.70);
    }
  }

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------

  private startPixel(): { x: number; y: number } {
    const { px, py } = this.renderer.gridToPixel(this.maze.start.x, this.maze.start.y);
    return { x: px + this.renderer.tileSize / 2, y: py + this.renderer.tileSize / 2 };
  }

  private resetPlayerToStart(): void {
    const sp = this.startPixel();
    this.player.reset(sp.x, sp.y, this.startDirection());
  }

  private startDirection(): Direction {
    const { x: col, y: row } = this.maze.start;
    if (!this.maze.isWall(row, col, Direction.RIGHT)) return Direction.RIGHT;
    if (!this.maze.isWall(row, col, Direction.DOWN)) return Direction.DOWN;
    if (!this.maze.isWall(row, col, Direction.LEFT)) return Direction.LEFT;
    return Direction.UP;
  }
}
