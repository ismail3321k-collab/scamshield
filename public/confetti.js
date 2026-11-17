// Kiçik konfeti (kitabxanasız). Hərəkəti azaldılmış rejimdə işləmir.
const COLORS = ["#0f5c56", "#17803d", "#f2b705", "#e4572e", "#2e86de", "#9b59b6"];

export function confetti({ count = 60, x = 0.5, y = 0.4, spread = 1 } = {}) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50";
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const ox = innerWidth * x, oy = innerHeight * y;
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9 * spread;
    const v = 6 + Math.random() * 7;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + Math.random() * 6, h: 4 + Math.random() * 5,
      r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.35,
      col: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });
  const t0 = performance.now(), life = 1600;
  const step = (t) => {
    const k = (t - t0) / life;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.28; p.vx *= 0.985; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.col;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(step);
    else c.remove();
  };
  requestAnimationFrame(step);
}
