import { Renderer } from "./renderer";
import { ScoreManager } from "./scoring";

const HUD_HEIGHT = 36;
const HUD_FONT = "18px monospace";
const STREAK_FONT = "15px monospace";

export class HUD {
  private ctx: CanvasRenderingContext2D;
  private renderer: Renderer;

  constructor(ctx: CanvasRenderingContext2D, renderer: Renderer) {
    this.ctx = ctx;
    this.renderer = renderer;
  }

  draw(score: ScoreManager, time: number, bottomReserved: number, muted = false, isTouchDevice = false): void {
    const { ctx, renderer } = this;
    const cw = renderer.logicalWidth;
    const ch = renderer.logicalHeight;

    ctx.save();

    // --- top bar background ---
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, cw, HUD_HEIGHT);

    ctx.font = HUD_FONT;
    ctx.textBaseline = "middle";
    const yMid = HUD_HEIGHT / 2;

    // Level (top-left).
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left";
    ctx.fillText(`Level ${score.currentLevel}`, 14, yMid);

    // Timer (top-center).
    const elapsed = score.elapsedSeconds();
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    ctx.textAlign = "center";
    ctx.fillText(`${mins}:${secs.toFixed(1).padStart(4, "0")}`, cw / 2, yMid);

    // Score (top-right).
    ctx.textAlign = "right";
    ctx.fillText(`Score: ${score.totalScore}`, cw - 14, yMid);

    // Mute indicator — desktop only (mobile has a DOM button).
    if (!isTouchDevice) {
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "14px monospace";
      ctx.textAlign = "right";
      ctx.fillText(muted ? "\u{1F507} [M]" : "\u{1F50A} [M]", cw - 14, yMid + 22);
    }

    // --- streak indicator (bottom-center, above D-pad if present) ---
    if (score.wallHitsThisLevel === 0) {
      const alpha = 0.6 + 0.4 * Math.sin(time * 2.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#FF5722";
      ctx.font = STREAK_FONT;
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText("\u{1F525} CLEAN RUN", cw / 2, ch - bottomReserved - 12);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }
}
