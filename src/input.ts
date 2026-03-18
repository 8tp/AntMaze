import { Direction } from "./types";

const DPAD_BTN_SIZE = 64;
const DPAD_GAP = 6;
const DPAD_BOTTOM = 24;

export class InputHandler {
  private pendingDirection: Direction | null = null;
  private _escapePressed = false;
  private _anyKeyPressed = false;
  private _muteToggled = false;

  readonly isTouchDevice: boolean;
  private dpadContainer: HTMLElement | null = null;
  private muteBtn: HTMLButtonElement | null = null;

  constructor() {
    this.isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;

    window.addEventListener("keydown", (e) => this.onKeyDown(e));

    if (this.isTouchDevice) {
      this.createDpad();
      this.createMuteBtn();
    }
  }

  // ---- consume API (unchanged) ----

  consumeDirection(): Direction | null {
    const dir = this.pendingDirection;
    this.pendingDirection = null;
    return dir;
  }

  consumeEscape(): boolean {
    const val = this._escapePressed;
    this._escapePressed = false;
    return val;
  }

  consumeAnyKey(): boolean {
    const val = this._anyKeyPressed;
    this._anyKeyPressed = false;
    return val;
  }

  consumeMuteToggle(): boolean {
    const val = this._muteToggled;
    this._muteToggled = false;
    return val;
  }

  // ---- keyboard ----

  private onKeyDown(e: KeyboardEvent): void {
    this._anyKeyPressed = true;

    switch (e.key) {
      case "ArrowUp":
      case "w":
      case "W":
        e.preventDefault();
        this.pendingDirection = Direction.UP;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        e.preventDefault();
        this.pendingDirection = Direction.DOWN;
        break;
      case "ArrowLeft":
      case "a":
      case "A":
        e.preventDefault();
        this.pendingDirection = Direction.LEFT;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        e.preventDefault();
        this.pendingDirection = Direction.RIGHT;
        break;
      case "Escape":
        this._escapePressed = true;
        break;
      case "m":
      case "M":
        this._muteToggled = true;
        break;
    }
  }

  // ---- touch D-pad ----

  private createDpad(): void {
    const container = document.createElement("div");
    container.id = "dpad";
    Object.assign(container.style, {
      position: "fixed",
      bottom: DPAD_BOTTOM + "px",
      left: "50%",
      transform: "translateX(-50%)",
      display: "grid",
      gridTemplateColumns: `${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px`,
      gridTemplateRows: `${DPAD_BTN_SIZE}px ${DPAD_BTN_SIZE}px`,
      gap: DPAD_GAP + "px",
      zIndex: "100",
      pointerEvents: "auto",
      touchAction: "none",
    });

    // Row 1: _  ▲  _
    container.appendChild(this.spacer());
    container.appendChild(this.makeBtn("\u25B2", Direction.UP));
    container.appendChild(this.spacer());
    // Row 2: ◄  ▼  ►
    container.appendChild(this.makeBtn("\u25C4", Direction.LEFT));
    container.appendChild(this.makeBtn("\u25BC", Direction.DOWN));
    container.appendChild(this.makeBtn("\u25BA", Direction.RIGHT));

    document.body.appendChild(container);
    this.dpadContainer = container;
  }

  private spacer(): HTMLElement {
    const el = document.createElement("div");
    return el;
  }

  private makeBtn(label: string, dir: Direction): HTMLElement {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.setAttribute("aria-label", Direction[dir]);
    Object.assign(btn.style, {
      width: DPAD_BTN_SIZE + "px",
      height: DPAD_BTN_SIZE + "px",
      border: "none",
      borderRadius: "12px",
      background: "rgba(255,255,255,0.18)",
      color: "rgba(255,255,255,0.75)",
      fontSize: "26px",
      lineHeight: "1",
      cursor: "pointer",
      touchAction: "none",
      WebkitTapHighlightColor: "transparent",
      outline: "none",
    });

    const activate = (e: Event) => {
      e.preventDefault();
      this.pendingDirection = dir;
      this._anyKeyPressed = true;
      btn.style.background = "rgba(255,255,255,0.35)";
    };
    const deactivate = () => {
      btn.style.background = "rgba(255,255,255,0.18)";
    };

    btn.addEventListener("touchstart", activate, { passive: false });
    btn.addEventListener("touchend", deactivate);
    btn.addEventListener("touchcancel", deactivate);
    // Mouse fallback for hybrid devices.
    btn.addEventListener("mousedown", activate);
    btn.addEventListener("mouseup", deactivate);
    btn.addEventListener("mouseleave", deactivate);

    return btn;
  }

  // ---- mute button (mobile) ----

  private createMuteBtn(): void {
    const btn = document.createElement("button");
    btn.id = "mute-btn";
    btn.textContent = "\u{1F50A}";
    Object.assign(btn.style, {
      position: "fixed",
      top: "10px",
      right: "10px",
      width: "44px",
      height: "44px",
      border: "none",
      borderRadius: "10px",
      background: "rgba(0,0,0,0.4)",
      color: "#fff",
      fontSize: "20px",
      lineHeight: "1",
      zIndex: "100",
      cursor: "pointer",
      touchAction: "none",
      WebkitTapHighlightColor: "transparent",
      outline: "none",
    });
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      this._muteToggled = true;
    }, { passive: false });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this._muteToggled = true;
    });
    document.body.appendChild(btn);
    this.muteBtn = btn;
  }

  /** Update the mute button icon to reflect current state. */
  updateMuteBtn(muted: boolean): void {
    if (this.muteBtn) {
      this.muteBtn.textContent = muted ? "\u{1F507}" : "\u{1F50A}";
    }
  }

  /** Show or hide the D-pad. */
  setDpadVisible(visible: boolean): void {
    if (this.dpadContainer) {
      this.dpadContainer.style.display = visible ? "grid" : "none";
    }
  }

  /** Height consumed by the D-pad so the maze can avoid it. */
  get dpadHeight(): number {
    if (!this.isTouchDevice) return 0;
    return DPAD_BTN_SIZE * 2 + DPAD_GAP + DPAD_BOTTOM + 16;
  }
}
