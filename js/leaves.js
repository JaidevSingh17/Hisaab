'use strict';
/* GaronchiHisaab — autumn leaves drifting down the screen.
   One canvas above the page that ignores taps. Leaves.set(true / false) switches it.
   It stops while the tab is hidden, and never runs for people who ask their device for reduced motion. */

const Leaves = (() => {
  const COLORS = ['#E39A00', '#C2410C', '#D9541E', '#F2B705', '#9A5B1E', '#B8860B'];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let canvas = null, ctx = null, leaves = [], raf = 0, last = 0, wanted = false, W = 0, H = 0;

  const rnd = (a, b) => a + Math.random() * (b - a);
  function spawn(anywhere) {
    return {
      x: rnd(0, W), y: anywhere ? rnd(-H, H) : rnd(-60, -20),
      size: rnd(0.7, 1.35), fall: rnd(28, 62), sway: rnd(14, 38), swaySpeed: rnd(0.6, 1.4), phase: rnd(0, 6.28),
      rot: rnd(0, 6.28), spin: rnd(-1.1, 1.1), flip: rnd(0, 6.28), flipSpeed: rnd(0.8, 2.2),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    };
  }
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const want = Math.round(Math.min(26, Math.max(10, W / 45)));
    while (leaves.length < want) leaves.push(spawn(true));
    leaves.length = want;
  }
  function draw(l) {
    ctx.save();
    ctx.translate(l.x, l.y); ctx.rotate(l.rot);
    ctx.scale(l.size, l.size * (0.35 + 0.65 * Math.abs(Math.cos(l.flip))));   /* the leaf turning over as it falls */
    ctx.beginPath(); ctx.moveTo(0, -11); ctx.bezierCurveTo(10, -6, 9, 7, 0, 11); ctx.bezierCurveTo(-9, 7, -10, -6, 0, -11);
    ctx.fillStyle = l.color; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 15);
    ctx.strokeStyle = 'rgba(60, 30, 0, .3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < leaves.length; i++) {
      const l = leaves[i];
      l.y += l.fall * dt;
      l.x += Math.sin(now / 1000 * l.swaySpeed + l.phase) * l.sway * dt;
      l.rot += l.spin * dt; l.flip += l.flipSpeed * dt;
      if (l.y > H + 24) leaves[i] = spawn(false);
      draw(l);
    }
    raf = requestAnimationFrame(frame);
  }
  function run() {
    const on = wanted && !still.matches && !document.hidden;
    if (on && !raf) {
      if (!canvas) {
        canvas = document.createElement('canvas'); canvas.className = 'leaves'; canvas.setAttribute('aria-hidden', 'true');
        document.body.append(canvas); ctx = canvas.getContext('2d');
        addEventListener('resize', () => { if (canvas) resize(); });
      }
      canvas.hidden = false; resize(); last = performance.now(); raf = requestAnimationFrame(frame);
    } else if (!on && raf) {
      cancelAnimationFrame(raf); raf = 0;
      if (!wanted || still.matches) { ctx.clearRect(0, 0, W, H); canvas.hidden = true; }
    }
  }
  document.addEventListener('visibilitychange', run);
  still.addEventListener('change', run);
  return { set(on) { wanted = !!on; run(); }, get running() { return !!raf; } };
})();
