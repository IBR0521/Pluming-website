/* Your Plumbing Co. — interactions
   Header scroll state · mobile nav · scroll reveal · gauge dial · form · year */
(function () {
  "use strict";

  /* ---- per-prospect personalization via URL params ----
     Add ?co=Business+Name (and optionally &city=City&phone=(614)+555-1212)
     to the link and the demo instantly shows that plumber's name/city —
     no rebuild, no separate file. No params = the generic demo stays generic.
     e.g. https://pluming-website.vercel.app/?co=Limes+Plumbing&city=Columbus */
  (function personalize() {
    var p = new URLSearchParams(location.search);
    var co = (p.get("co") || "").trim();
    var city = (p.get("city") || "").trim();
    var phone = (p.get("phone") || "").trim();
    if (!co && !city && !phone) return;

    var pairs = [];
    if (co) pairs.push(["Your Plumbing Co.", co]);
    if (city) pairs.push(["Your City", city]);
    if (phone) pairs.push(["(555) 555-0100", phone]);

    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) {
      var v = node.nodeValue, changed = false;
      for (var i = 0; i < pairs.length; i++) {
        if (v.indexOf(pairs[i][0]) > -1) { v = v.split(pairs[i][0]).join(pairs[i][1]); changed = true; }
      }
      if (changed) node.nodeValue = v;
    }
    if (co) {
      document.title = co + " — Licensed Local Plumbers";
      var brandAria = document.querySelector(".brand");
      if (brandAria) brandAria.setAttribute("aria-label", co + ", home");
    }
    if (phone) {
      var tel = "tel:+1" + phone.replace(/[^0-9]/g, "");
      document.querySelectorAll('a[href^="tel:"]').forEach(function (a) { a.setAttribute("href", tel); });
    }
  })();

  /* ---- footer year ---- */
  var yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---- header solid-on-scroll ---- */
  var header = document.querySelector("[data-header]");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-stuck", window.scrollY > 40); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* ---- mobile nav ---- */
  var toggle = document.querySelector(".nav-toggle");
  var mobileNav = document.getElementById("mobile-nav");
  if (toggle && mobileNav) {
    var setNav = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      mobileNav.classList.toggle("is-open", open);
      mobileNav.hidden = !open;
    };
    toggle.addEventListener("click", function () {
      setNav(toggle.getAttribute("aria-expanded") !== "true");
    });
    mobileNav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setNav(false); });
    });
  }

  /* ---- interactive pipe hero: a blocked line you explore, then clear ---- */
  var hero = document.querySelector("[data-hero]");
  var torchBtn = hero && hero.querySelector("[data-enter]");
  var pipeCanvas = hero && hero.querySelector("[data-pipe]");
  if (hero && torchBtn && pipeCanvas && pipeCanvas.getContext) {
    var heroReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var label = torchBtn.querySelector("[data-enter-label]");
    var hint = hero.querySelector("[data-hint]");
    var lockClass = "hero-lock";
    var state = "armed"; // armed -> fixing -> done
    var progress = 0;

    /* ----- borescope HUD: running timecode + live depth readout ----- */
    var hudTime = hero.querySelector("[data-hud-time]");
    var hudDepth = hero.querySelector("[data-hud-depth]");
    var hudStatus = hero.querySelector("[data-hud-status]");
    var MAXDEPTH = 18.4, hudStart = Date.now(), hudTimer = null;
    var pad2h = function (n) { return (n < 10 ? "0" : "") + n; };
    var hudTick = function () {
      if (hudTime) {
        var s = Math.floor((Date.now() - hudStart) / 1000);
        hudTime.textContent = pad2h(Math.floor(s / 3600)) + ":" + pad2h(Math.floor(s / 60) % 60) + ":" + pad2h(s % 60);
      }
      if (hudDepth) {
        var d = state === "done" ? MAXDEPTH
          : state === "fixing" ? progress * MAXDEPTH
          : 0.4 + Math.sin(Date.now() / 900) * 0.3; // idle camera creep at the blockage
        hudDepth.textContent = d.toFixed(1);
      }
    };
    hudTimer = setInterval(hudTick, 200); hudTick();

    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    window.addEventListener("load", function () { if (state !== "done") window.scrollTo(0, 0); });
    document.body.classList.add(lockClass);
    if (heroReduce) hero.style.setProperty("--torch", "440px");

    /* flashlight follows the pointer (CSS mask layers) */
    var mx = window.innerWidth * 0.5, my = window.innerHeight * 0.42, mFrame = null;
    var applyLight = function () {
      hero.style.setProperty("--mx", mx + "px");
      hero.style.setProperty("--my", my + "px");
      mFrame = null;
    };
    applyLight();
    hero.addEventListener("pointermove", function (e) {
      if (state !== "armed") return;
      mx = e.clientX; my = e.clientY;
      if (!mFrame) mFrame = requestAnimationFrame(applyLight);
    });

    /* no scrolling past a blocked line */
    var locked = function () { return document.body.classList.contains(lockClass); };
    var blockScroll = function (e) { if (locked()) e.preventDefault(); };
    window.addEventListener("wheel", blockScroll, { passive: false });
    window.addEventListener("touchmove", blockScroll, { passive: false });
    window.addEventListener("keydown", function (e) {
      var keys = ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " ", "Spacebar"];
      if (locked() && keys.indexOf(e.key) > -1) e.preventDefault();
    });
    window.addEventListener("scroll", function () {
      if (locked() && window.scrollY !== 0) window.scrollTo(0, 0);
    }, { passive: true });

    /* ----- the bore, painted twice: scaled shut, and jetted clean ----- */
    var ctx = pipeCanvas.getContext("2d");
    var dirtyC = document.createElement("canvas");
    var cleanC = document.createElement("canvas");
    var W, H, DPR, cx, cy, hx, hy, holeR, maxR;

    var rng = (function (seed) {
      return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    })(20260703);

    /* features live in polar bore coords (angle, depth) so the pattern survives resizes.
       Muck settles low in a real run, so most dirt is biased toward the bottom. */
    var crust = [], tubercles = [], flows = [], grains = [], sheens = [];
    (function () {
      var i, j;
      var lowAngle = function () {
        return rng() < 0.55 ? Math.PI * (0.25 + rng() * 0.5) : rng() * Math.PI * 2;
      };
      for (i = 0; i < 560; i++) {
        var patch = { a: lowAngle(), d: Math.pow(rng(), 1.35), bits: [] };
        var m = 5 + Math.floor(rng() * 9);
        for (j = 0; j < m; j++) patch.bits.push({ oa: (rng() - 0.5) * 0.16, od: (rng() - 0.5) * 0.035, s: 0.12 + rng() * 0.5, hue: 15 + rng() * 18, sat: 35 + rng() * 30, l: 10 + rng() * 22, al: 0.18 + rng() * 0.35 });
        crust.push(patch);
      }
      for (i = 0; i < 260; i++) tubercles.push({ a: lowAngle(), d: Math.pow(rng(), 1.3), s: 0.07 + rng() * 0.2, l: 10 + rng() * 16, al: 0.45 + rng() * 0.35 });
      for (i = 0; i < 190; i++) flows.push({ a: rng() * Math.PI * 2, d0: 0.02 + rng() * 0.3, d1: 0.45 + rng() * 0.5, al: 0.03 + rng() * 0.11, w: 0.6 + rng() * 2.2, light: rng() < 0.3 });
      for (i = 0; i < 9000; i++) grains.push({ a: rng() * Math.PI * 2, d: Math.pow(rng(), 1.25), s: 0.5 + rng() * 1.4, l: 8 + rng() * 60, al: 0.04 + rng() * 0.15 });
      for (i = 0; i < 46; i++) sheens.push({ d: rng(), al: 0.04 + rng() * 0.14 });
    })();

    /* depth 0 = at the viewer's face (rim), depth 1 = far end of the run.
       The bore axis drifts toward an off-center vanishing point, like a
       camera pushed into the line slightly off-axis. */
    var R = function (d) { return holeR + (maxR - holeR) * Math.pow(1 - d, 2.1); };
    var CX = function (d) { return cx + (hx - cx) * Math.pow(d, 0.85); };
    var CY = function (d) { return cy + (hy - cy) * Math.pow(d, 0.85); };
    var P = function (a, d) {
      var r = R(d);
      return [CX(d) + Math.cos(a) * r, CY(d) + Math.sin(a) * r * 0.97];
    };
    var bandW = function (d) { return Math.max(1.6, R(Math.max(0, d - 0.02)) - R(Math.min(0.99, d + 0.02))); };

    var paintBore = function (g, mode) {
      var dirty = mode === "dirty";
      var grad = g.createRadialGradient(hx, hy, holeR * 0.3, hx, hy, maxR);
      if (dirty) {
        grad.addColorStop(0, "#050302"); grad.addColorStop(0.05, "#170c04");
        grad.addColorStop(0.18, "#54300f"); grad.addColorStop(0.42, "#8c521a");
        grad.addColorStop(0.68, "#a8641d"); grad.addColorStop(0.88, "#8a4d15"); grad.addColorStop(1, "#63370e");
      } else {
        grad.addColorStop(0, "#070403"); grad.addColorStop(0.05, "#1c0e07");
        grad.addColorStop(0.16, "#5c3517"); grad.addColorStop(0.38, "#a96a33");
        grad.addColorStop(0.62, "#cd8a4b"); grad.addColorStop(0.85, "#b06f36"); grad.addColorStop(1, "#8a5426");
      }
      g.fillStyle = grad; g.fillRect(0, 0, W, H);

      /* pipe wall rings, drifting toward the vanishing point */
      var n = 150, i, d0, r0, r1, rm;
      for (i = 0; i < n; i++) {
        d0 = i / n; r0 = R(d0); r1 = R(d0 + 1 / n); rm = (r0 + r1) / 2;
        var wob = Math.sin(i * 1.7) * 0.5 + Math.sin(i * 0.53) * 0.5;
        g.beginPath();
        g.ellipse(CX(d0), CY(d0), rm, rm * 0.97, 0, 0, Math.PI * 2);
        g.strokeStyle = dirty
          ? "rgba(28,15,6," + (0.1 + 0.1 * Math.abs(wob)) + ")"
          : (wob > 0.3 ? "rgba(255,214,166,0.11)" : "rgba(40,20,8,0.11)");
        g.lineWidth = Math.max(1, r0 - r1);
        g.stroke();
      }

      /* longitudinal streaks converging on the vanishing point */
      flows.forEach(function (f) {
        var steps = 7, k, p;
        g.beginPath();
        for (k = 0; k <= steps; k++) {
          p = P(f.a, f.d0 + (f.d1 - f.d0) * (k / steps));
          if (k) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]);
        }
        if (dirty) g.strokeStyle = f.light ? "rgba(190,140,80," + f.al + ")" : "rgba(16,9,4," + (f.al * 1.4) + ")";
        else g.strokeStyle = f.light ? "rgba(255,224,186," + f.al + ")" : "rgba(60,30,12," + f.al + ")";
        g.lineWidth = f.w; g.stroke();
      });

      if (dirty) {
        /* crust patches — clusters of small mineral scale, fading with depth */
        crust.forEach(function (c) {
          var bw = bandW(c.d);
          var fog = 1 - c.d * 0.45;
          c.bits.forEach(function (b) {
            var p = P(c.a + b.oa, Math.min(0.98, Math.max(0, c.d + b.od)));
            g.beginPath();
            g.ellipse(p[0], p[1], Math.max(1, bw * b.s * 1.1), Math.max(0.8, bw * b.s * 0.7), c.a + Math.PI / 2, 0, Math.PI * 2);
            g.fillStyle = "hsla(" + b.hue + "," + b.sat + "%," + b.l + "%," + (b.al * fog) + ")";
            g.fill();
          });
        });
        /* tubercles — small rust bumps, mostly shadow */
        tubercles.forEach(function (t) {
          var bw = bandW(t.d), p = P(t.a, t.d), s = Math.max(1, bw * t.s);
          var fog = 1 - t.d * 0.45;
          g.beginPath(); g.arc(p[0] + s * 0.35, p[1] + s * 0.35, s, 0, Math.PI * 2);
          g.fillStyle = "rgba(12,6,2," + t.al * 0.5 * fog + ")"; g.fill();
          g.beginPath(); g.arc(p[0], p[1], s, 0, Math.PI * 2);
          g.fillStyle = "hsla(22,48%," + t.l + "%," + t.al * fog + ")"; g.fill();
        });
        /* sediment channel settled along the bottom of the run */
        var ch, cp, wob2;
        g.save();
        if ("filter" in g) g.filter = "blur(" + Math.max(8, holeR * 0.18) + "px)";
        g.beginPath();
        for (ch = 0; ch <= 20; ch++) {
          wob2 = 0.3 + 0.07 * Math.sin(ch * 2.7) + 0.05 * Math.sin(ch * 1.3);
          cp = P(Math.PI / 2 - wob2, ch / 20 * 0.97);
          ch ? g.lineTo(cp[0], cp[1]) : g.moveTo(cp[0], cp[1]);
        }
        for (ch = 20; ch >= 0; ch--) {
          wob2 = 0.3 + 0.06 * Math.sin(ch * 3.1) + 0.05 * Math.cos(ch * 1.7);
          cp = P(Math.PI / 2 + wob2, ch / 20 * 0.97);
          g.lineTo(cp[0], cp[1]);
        }
        g.closePath();
        g.fillStyle = "rgba(22,15,7,0.42)"; g.fill();
        g.restore();
        /* wet specular glints — light catching standing water on the gunk */
        crust.forEach(function (c, ci) {
          if (ci % 6) return;
          var bw = bandW(c.d), p = P(c.a, c.d), fog = 1 - c.d * 0.4;
          var s = Math.max(0.7, bw * 0.085);
          g.beginPath();
          g.ellipse(p[0] - s * 0.4, p[1] - s * 0.4, s, s * 0.5, c.a, 0, Math.PI * 2);
          g.fillStyle = "rgba(255,239,212," + (0.09 + 0.13 * fog) + ")";
          g.fill();
        });
      } else {
        /* joint couplings down the clean run */
        [0.13, 0.3, 0.5, 0.72].forEach(function (jd) {
          var r = R(jd);
          g.beginPath(); g.ellipse(CX(jd), CY(jd), r, r * 0.97, 0, 0, Math.PI * 2);
          g.strokeStyle = "rgba(30,14,5,0.5)"; g.lineWidth = Math.max(2, bandW(jd) * 0.5); g.stroke();
          var jd2 = jd + 0.012, r2 = R(jd2);
          g.beginPath(); g.ellipse(CX(jd2), CY(jd2), r2, r2 * 0.97, 0, 0, Math.PI * 2);
          g.strokeStyle = "rgba(255,232,200,0.5)"; g.lineWidth = Math.max(1.4, bandW(jd) * 0.3); g.stroke();
        });
        /* sheen rings + a water glint along the bottom */
        sheens.forEach(function (s) {
          var r = R(s.d);
          g.beginPath(); g.ellipse(CX(s.d), CY(s.d), r, r * 0.97, 0, 0, Math.PI * 2);
          g.strokeStyle = "rgba(255,226,188," + s.al + ")"; g.lineWidth = 1.5; g.stroke();
        });
        var wg, wp;
        g.beginPath();
        for (wg = 0; wg <= 20; wg++) { wp = P(Math.PI / 2, wg / 20 * 0.9); wg ? g.lineTo(wp[0], wp[1]) : g.moveTo(wp[0], wp[1]); }
        g.strokeStyle = "rgba(210,235,255,0.12)"; g.lineWidth = Math.max(2, holeR * 0.16); g.stroke();
      }

      /* granular texture over everything — kills the airbrushed look */
      grains.forEach(function (gr) {
        var p = P(gr.a, gr.d), bw = bandW(gr.d);
        var sz = Math.min(2.4, gr.s * bw * 0.12 + 0.4);
        g.fillStyle = dirty
          ? "hsla(" + (16 + gr.l * 0.3) + ",48%," + Math.min(58, gr.l) + "%," + gr.al + ")"
          : "hsla(28,55%," + Math.min(72, gr.l + 14) + "%," + (gr.al * 0.55) + ")";
        g.fillRect(p[0], p[1], sz, sz);
      });

      /* the dark far end of the run */
      var hole = g.createRadialGradient(hx, hy, 1, hx, hy, holeR * 1.5);
      hole.addColorStop(0, "#020202"); hole.addColorStop(0.72, "#050404"); hole.addColorStop(1, "rgba(5,4,4,0)");
      g.fillStyle = hole; g.beginPath(); g.arc(hx, hy, holeR * 1.5, 0, Math.PI * 2); g.fill();

      /* rim vignette */
      var vig = g.createRadialGradient(hx, hy, maxR * 0.55, hx, hy, maxR);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, dirty ? "rgba(0,0,0,0.66)" : "rgba(22,9,2,0.45)");
      g.fillStyle = vig; g.fillRect(0, 0, W, H);
    };

    var draw = function (t, now) {
      /* subtle handheld-camera wobble while the jet runs — reads as live footage */
      if (state === "fixing") {
        pipeCanvas.style.transform = "translate(" + (Math.sin(now * 0.006) * 3.5).toFixed(2) + "px," + (Math.cos(now * 0.0085) * 3).toFixed(2) + "px)";
      }
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(dirtyC, 0, 0, W, H);
      if (t <= 0) return;
      var tt = Math.min(1, t);
      var rF = R(tt), fx = CX(tt), fy = CY(tt);

      /* everything nearer than the jet front is already clean */
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.ellipse(fx, fy, rF, rF * 0.97, 0, 0, Math.PI * 2, true);
      ctx.clip();
      ctx.drawImage(cleanC, 0, 0, W, H);
      ctx.restore();
      if (t >= 1) return;

      /* the hydro-jet: a scouring ring of water driving down the line */
      var seg = 64, k, a0, rr, arc = (Math.PI * 2) / seg + 0.02;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (k = 0; k < seg; k++) {
        a0 = (k / seg) * Math.PI * 2;
        rr = rF + Math.sin(a0 * 5 + now * 0.011) * rF * 0.045 + Math.sin(a0 * 11 - now * 0.017) * rF * 0.02;
        ctx.beginPath(); ctx.ellipse(fx, fy, rr, rr * 0.97, 0, a0, a0 + arc);
        ctx.strokeStyle = "rgba(168,214,255,0.45)"; ctx.lineWidth = Math.max(6, rF * 0.05); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(fx, fy, rr, rr * 0.97, 0, a0, a0 + arc);
        ctx.strokeStyle = "rgba(240,250,255,0.7)"; ctx.lineWidth = Math.max(2, rF * 0.016); ctx.stroke();
      }
      /* spray droplets around the front */
      for (k = 0; k < 60; k++) {
        var sa = (k * 2.399 + now * 0.0018) % (Math.PI * 2);
        var sr = rF + (Math.sin(now * 0.02 + k * 7) * 0.5 + 0.7) * rF * 0.14;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(sa) * sr, fy + Math.sin(sa) * sr * 0.97, 1.2 + (k % 3), 0, Math.PI * 2);
        ctx.fillStyle = "rgba(214,240,255,0.5)"; ctx.fill();
      }
      /* bright turbulent core right at the nozzle front */
      var core = ctx.createRadialGradient(fx, fy, 0, fx, fy, rF * 0.9);
      core.addColorStop(0, "rgba(255,255,255,0.5)"); core.addColorStop(0.4, "rgba(200,232,255,0.22)"); core.addColorStop(1, "rgba(200,232,255,0)");
      ctx.fillStyle = core; ctx.beginPath(); ctx.arc(fx, fy, rF * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      /* debris blasted off the blockage, tumbling toward the lens */
      for (k = 0; k < 18; k++) {
        var dph = ((now * 0.00055) + k * 0.61803398) % 1;   // 0..1 life
        var da = (k * 2.399963) % (Math.PI * 2);
        var drad = rF + (maxR - rF) * dph * 0.62;            // flies from front toward the rim
        var dsz = (1.4 + dph * 8) * (1 + (k % 3) * 0.35);    // grows as it nears the camera
        var dal = (1 - dph) * (1 - dph) * 0.55;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(da) * drad, fy + Math.sin(da) * drad * 0.97, dsz, dsz * 0.7, da, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(34,20,9," + dal + ")"; ctx.fill();
      }

      /* mist glow behind the front */
      var mist = ctx.createRadialGradient(fx, fy, rF, fx, fy, Math.min(maxR, rF * 1.6 + 40));
      mist.addColorStop(0, "rgba(190,225,255,0.16)"); mist.addColorStop(1, "rgba(190,225,255,0)");
      ctx.fillStyle = mist; ctx.fillRect(0, 0, W, H);
    };

    var size = function () {
      DPR = Math.min(2, window.devicePixelRatio || 1);
      W = hero.clientWidth || window.innerWidth;
      H = hero.clientHeight || window.innerHeight;
      var vh = Math.min(H, window.innerHeight);
      [pipeCanvas, dirtyC, cleanC].forEach(function (c) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); });
      pipeCanvas.style.width = W + "px"; pipeCanvas.style.height = H + "px";
      cx = W * 0.5; cy = vh * 0.46;
      holeR = Math.min(W, vh) * 0.07;
      hx = cx + Math.min(W, vh) * 0.06;
      hy = cy + Math.min(W, vh) * 0.025;
      maxR = Math.hypot(Math.max(cx, W - cx), Math.max(cy, vh - cy)) * 1.05;
      var gd = dirtyC.getContext("2d"); gd.setTransform(DPR, 0, 0, DPR, 0, 0); paintBore(gd, "dirty");
      var gc = cleanC.getContext("2d"); gc.setTransform(DPR, 0, 0, DPR, 0, 0); paintBore(gc, "clean");
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      draw(state === "done" ? 1 : progress, performance.now());
    };

    /* ----- pressing the button clears the line ----- */
    var DUR = heroReduce ? 500 : 4200;
    if (window.location.hash === "#slowjet") DUR = 40000; // debug: slow-motion jet
    var startT = 0, backupTimer = null, safetyTimer = null;
    var ease = function (x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
    var finish = function () {
      if (state === "done") return;
      state = "done";
      if (backupTimer) { clearInterval(backupTimer); backupTimer = null; }
      if (safetyTimer) { clearTimeout(safetyTimer); safetyTimer = null; }
      hero.classList.remove("is-armed");
      hero.classList.remove("is-fixing");
      document.body.classList.remove(lockClass);
      if (hint) hint.hidden = true;
      if (header) header.classList.add("is-stuck");
      if (hudStatus) { hudStatus.textContent = "LINE CLEAR"; hudStatus.classList.add("is-clear"); }
      hudTick();
      if (hudTimer) { clearInterval(hudTimer); hudTimer = null; }
      pipeCanvas.style.transform = "";
      draw(1, performance.now());
    };
    /* progress is wall-clock driven, so throttled frames just skip ahead */
    var step = function () {
      if (state !== "fixing") return;
      var now = performance.now();
      var p = Math.min(1, (now - startT) / DUR);
      progress = ease(p);
      draw(progress, now);
      if (p >= 1) finish();
    };
    var rafLoop = function () {
      if (state !== "fixing") return;
      step();
      requestAnimationFrame(rafLoop);
    };
    var fixIt = function () {
      if (state !== "armed") return;
      state = "fixing";
      hero.classList.add("is-fixing");
      if (label) label.textContent = "Clearing the line…";
      if (hint) hint.textContent = "Hydro-jet running — watch the line come back";
      if (hudStatus) { hudStatus.textContent = "JETTING"; hudStatus.classList.remove("is-clear"); }
      startT = performance.now();
      requestAnimationFrame(rafLoop);
      /* rAF pauses in background tabs — keep the clock honest either way */
      backupTimer = setInterval(step, 250);
      safetyTimer = setTimeout(finish, DUR + 400);
    };
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden && state === "fixing") step();
    });

    torchBtn.addEventListener("click", fixIt);
    var sizeT;
    window.addEventListener("resize", function () { clearTimeout(sizeT); sizeT = setTimeout(size, 150); });
    size();
  }

  /* ---- instant estimate: the ballpark gauge ----
     Homeowner picks a job + severity, the gauge swings to a live price range,
     and the choice carries into the booking form so there's no re-typing.
     Ranges are honest your area ballparks; the on-site quote is flat + final. */
  var estimator = document.querySelector("[data-estimator]");
  if (estimator) {
    /* lo/hi = full spread for the job; svc maps to the booking <select> */
    var JOBS = {
      drain:   { lo: 149,  hi: 450,   svc: "Drain or sewer clog" },
      leak:    { lo: 185,  hi: 700,   svc: "Leak detection & repair" },
      heater:  { lo: 320,  hi: 2600,  svc: "Water heater" },
      fixture: { lo: 150,  hi: 550,   svc: "Fixture or faucet" },
      repipe:  { lo: 3500, hi: 12000, svc: "Repipe / new lines", big: true },
      burst:   { lo: 250,  hi: 1500,  svc: "Emergency — burst / flooding", forceEmg: true }
    };
    /* where in the spread each severity sits [fractionLo, fractionHi] */
    var SEV = { minor: [0, 0.42], typical: [0.2, 0.72], major: [0.5, 1] };
    var SCALE_MAX = 4000;          // top of the needle scale ($)
    var A0 = 150, SWEEP = 240;     // gauge arc: start angle + degrees swept

    var jobBtns = estimator.querySelectorAll("[data-est-jobs] .chip");
    var sevBtns = estimator.querySelectorAll("[data-est-severity] button");
    var emgInput = estimator.querySelector("[data-est-emergency]");
    var amountEl = estimator.querySelector("[data-est-amount]");
    var subEl = estimator.querySelector("[data-est-sub]");
    var noteEl = estimator.querySelector("[data-est-note]");
    var bookCta = estimator.querySelector("[data-est-book]");
    var valPath = estimator.querySelector("[data-gauge-val]");
    var needle = estimator.querySelector("[data-gauge-needle]");
    var ticksG = estimator.querySelector("[data-gauge-ticks]");

    var job = null, sev = "typical";
    var pathLen = valPath.getTotalLength ? valPath.getTotalLength() : 503;
    valPath.style.strokeDasharray = pathLen;
    valPath.style.strokeDashoffset = pathLen;

    /* polar helper on the gauge circle (center 150,150 · radius 120) */
    var pt = function (t, r) {
      var a = (A0 + SWEEP * t) * Math.PI / 180;
      return [150 + r * Math.cos(a), 150 + r * Math.sin(a)];
    };
    /* draw the scale tick marks around the arc */
    (function () {
      var svgNS = "http://www.w3.org/2000/svg", i;
      for (i = 0; i <= 4; i++) {
        var t = i / 4, o = pt(t, 118), n = pt(t, 103);
        var ln = document.createElementNS(svgNS, "line");
        ln.setAttribute("x1", o[0].toFixed(1)); ln.setAttribute("y1", o[1].toFixed(1));
        ln.setAttribute("x2", n[0].toFixed(1)); ln.setAttribute("y2", n[1].toFixed(1));
        ticksG.appendChild(ln);
      }
    })();

    var money = function (v) {
      var step = v < 1000 ? 5 : 50;
      return "$" + (Math.round(v / step) * step).toLocaleString("en-US");
    };
    var setNeedle = function (t) {
      needle.style.transform = "rotate(" + (-120 + 240 * t) + "deg)";
      valPath.style.strokeDashoffset = pathLen * (1 - t);
    };

    var compute = function () {
      if (!job) return;
      var b = JOBS[job], f = SEV[sev];
      var lo = b.lo + (b.hi - b.lo) * f[0];
      var hi = b.lo + (b.hi - b.lo) * f[1];
      var emg = b.forceEmg || (emgInput && emgInput.checked);
      if (emg) { lo = lo * 1.3 + 95; hi = hi * 1.3 + 95; }

      amountEl.classList.remove("is-empty");
      amountEl.textContent = money(lo) + " – " + money(hi);
      subEl.textContent = b.big
        ? "Big job — final number scoped on site"
        : (emg ? "Includes after-hours call-out"
               : sev.charAt(0).toUpperCase() + sev.slice(1) + " job · parts + labor");

      var mid = (lo + hi) / 2;
      setNeedle(Math.max(0.02, Math.min(1, mid / SCALE_MAX)));
      if (bookCta) bookCta.hidden = false;
    };

    jobBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        job = btn.getAttribute("data-job");
        jobBtns.forEach(function (b) { b.classList.toggle("is-on", b === btn); b.setAttribute("aria-checked", String(b === btn)); });
        if (JOBS[job].forceEmg && emgInput) emgInput.checked = true;
        compute();
      });
    });
    sevBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        sev = btn.getAttribute("data-sev");
        sevBtns.forEach(function (b) { b.classList.toggle("is-on", b === btn); b.setAttribute("aria-checked", String(b === btn)); });
        compute();
      });
    });
    if (emgInput) emgInput.addEventListener("change", compute);

    /* carry the estimate into the booking form so nothing gets re-typed */
    if (bookCta) {
      bookCta.addEventListener("click", function () {
        if (!job) return;
        var b = JOBS[job];
        var svc = document.getElementById("f-service");
        var win = document.getElementById("f-window");
        var msg = document.getElementById("f-msg");
        if (svc) { svc.value = b.svc; }
        if (win && (b.forceEmg || (emgInput && emgInput.checked))) { win.value = "ASAP — it's urgent"; }
        if (msg) {
          var line = "Ballpark from your site: " + amountEl.textContent + " (" + sev + (b.forceEmg || (emgInput && emgInput.checked) ? ", emergency" : "") + ").";
          msg.value = msg.value ? line + "\n" + msg.value : line + "\n";
        }
      });
    }
  }

  /* ---- scroll reveal + gauge dial ---- */
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealTargets = document.querySelectorAll(
    ".section-head, .row, .band__inner, .why__copy, .dialcard, .stage, .craft__photo, .craft__copy, .review, .area__grid > div, .book__grid > div, .specbar__item, .estimator__panel, .estimator__gauge, .repwall"
  );
  revealTargets.forEach(function (el) { el.classList.add("reveal"); });

  var dial = document.querySelector("[data-dial]");

  if ("IntersectionObserver" in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
    revealTargets.forEach(function (el) { io.observe(el); });

    if (dial) {
      var dialIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) { dial.classList.add("is-in"); dialIo.unobserve(dial); }
        });
      }, { threshold: 0.4 });
      dialIo.observe(dial);
    }
  } else {
    revealTargets.forEach(function (el) { el.classList.add("is-in"); });
    if (dial) dial.classList.add("is-in");
  }

  /* ---- booking form: capture a real lead 24/7 ----
     Two independent, no-backend form services chained for reliability:
       1. Formspree (primary) — fast, stable. Endpoint is tied to whichever
          account created it; for a new client, create a new form at
          formspree.io under their own account/inbox and swap the URL below.
       2. FormSubmit (fallback) — used only if Formspree fails/times out.
          Also the one that sends the customer auto-confirmation email.
          Change LEAD_EMAIL to reroute this leg. First submission to a new
          address triggers a one-time activation email — click it once.
     If both fail, falls back to opening the visitor's email app. */
  var form = document.getElementById("book-form");
  var status = document.getElementById("form-status");
  var donePanel = document.getElementById("book-done");
  var LEAD_EMAIL = "ibr20117o@gmail.com"; // <-- FormSubmit fallback inbox
  var FORMSPREE_ENDPOINT = "https://formspree.io/f/xeeyeqjv"; // <-- primary
  var FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax/" + LEAD_EMAIL; // <-- fallback

  if (form) {
    /* ---- smart scheduling guards: no past dates, no gone-by windows ----
       True slot-locking needs a shared calendar (see Cal.com add-on for
       appointment businesses); for trades we keep request-and-confirm but
       stop impossible requests before they're sent. */
    var dayInput = document.getElementById("f-day");
    var winSelect = document.getElementById("f-window");
    var NOTE_DEFAULT = status ? status.textContent : "";
    var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };
    var fmtDay = function (d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
    if (dayInput && winSelect) {
      var maxD = new Date(); maxD.setDate(maxD.getDate() + 30);
      dayInput.min = fmtDay(new Date());
      dayInput.max = fmtDay(maxD);
      /* each window's closing hour (24h, visitor's local time) */
      var WINDOW_ENDS = { "Morning (7am–11am)": 11, "Midday (11am–2pm)": 14, "Afternoon (2pm–5pm)": 17, "Evening (5pm–7pm)": 19 };
      var syncWindows = function () {
        var now = new Date();
        var isToday = dayInput.value === fmtDay(now);
        Array.prototype.forEach.call(winSelect.options, function (op) {
          var end = WINDOW_ENDS[op.value];
          /* a window is gone once we're within an hour of its close */
          op.disabled = !!(isToday && end && now.getHours() >= end - 1);
        });
        var sel = winSelect.options[winSelect.selectedIndex];
        if (sel && sel.disabled) winSelect.value = "";
        if (status && !form.classList.contains("is-sending")) {
          status.classList.remove("is-error");
          status.textContent = (dayInput.value && new Date(dayInput.value + "T12:00:00").getDay() === 0)
            ? "Heads up: Sundays are emergency-first — we'll confirm by phone."
            : NOTE_DEFAULT;
        }
      };
      dayInput.addEventListener("change", syncWindows);
      dayInput.addEventListener("input", syncWindows);
      syncWindows();
    }

    var readFields = function () {
      var d = new FormData(form);
      return {
        name: (d.get("name") || "").toString().trim(),
        phone: (d.get("phone") || "").toString().trim(),
        email: (d.get("email") || "").toString().trim(),
        service: (d.get("service") || "").toString().trim(),
        day: (d.get("preferred_day") || "").toString().trim(),
        window: (d.get("time_window") || "").toString().trim(),
        message: (d.get("message") || "").toString().trim(),
        honey: (d.get("_honey") || "").toString().trim()
      };
    };

    var isUrgent = function (v) {
      return v.window === "ASAP — it's urgent" || v.service.indexOf("Emergency") === 0;
    };

    var showDone = function (v, ref) {
      var msgEl = donePanel && donePanel.querySelector("[data-done-msg]");
      var refEl = donePanel && donePanel.querySelector("[data-ref]");
      if (refEl) refEl.textContent = "#" + ref;
      if (msgEl && isUrgent(v)) {
        msgEl.textContent = "Flagged as urgent — we'll call you fast. If it's an active flood or burst right now, call (555) 555-0100 so we can roll a truck to you.";
      }
      if (donePanel) { form.hidden = true; donePanel.hidden = false; donePanel.scrollIntoView({ behavior: "smooth", block: "center" }); }
    };

    var mailtoFallback = function (v, ref) {
      var subject = "Service request " + ref + (v.service ? " — " + v.service : "") + (v.name ? " (" + v.name + ")" : "");
      var body = [
        "Request: " + ref,
        "Name: " + v.name, "Phone: " + v.phone, "Email: " + (v.email || "—"),
        "Service: " + (v.service || "—"),
        "Preferred: " + ((v.day || "—") + (v.window ? " · " + v.window : "")),
        "", "Details:", v.message || "—"
      ].join("\n");
      window.location.href = "mailto:" + LEAD_EMAIL +
        "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = readFields();
      /* short reference id, e.g. R-K3F9Z — goes in both emails + the screen */
      var ref = "R-" + Date.now().toString(36).toUpperCase().slice(-5);
      if (v.honey) { showDone(v, ref); return; }             // silently drop bots
      if (!form.checkValidity()) { form.reportValidity(); return; }

      var urgent = isUrgent(v);
      form.classList.add("is-sending");
      if (status) { status.classList.remove("is-error"); status.textContent = "Sending your request…"; }

      var payload = {
        _subject: (urgent ? "🚨 URGENT — " : "") + "New service request " + ref + (v.service ? " — " + v.service : "") + (v.name ? " (" + v.name + ")" : ""),
        _template: "table",
        _captcha: "false",
        request_id: ref,
        name: v.name, phone: v.phone, email: v.email,
        service: v.service, preferred_day: v.day, time_window: v.window,
        message: v.message
      };
      if (v.email) {
        payload._replyto = v.email;   // plumber can just hit Reply
        payload._autoresponse =       // instant written confirmation to the customer
          "Thanks" + (v.name ? " " + v.name : "") + " — we got your request (" + ref + "). " +
          "We'll call you to lock in a time, usually within the hour during business hours. " +
          (urgent ? "If it's an active flood or burst, call (555) 555-0100 right now so we can move fast. " : "") +
          "— Your Plumbing Co., (555) 555-0100";
      }

      /* never leave a customer stuck on "Sending…" — 30s cap, then fallback.
         (FormSubmit can take 5–15s on busy days; 15s proved too tight.) */
      var aborter = ("AbortController" in window) ? new AbortController() : null;
      var timeoutId = aborter && setTimeout(function () { aborter.abort(); }, 30000);
      var slowId = setTimeout(function () {
        if (status && form.classList.contains("is-sending")) {
          status.textContent = "Still sending — busy line, hang tight…";
        }
      }, 8000);

      fetch(FORMSUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: aborter ? aborter.signal : undefined
      })
        .then(function (r) { return r.json().catch(function () { return { success: r.ok }; }); })
        .then(function (data) {
          if (timeoutId) clearTimeout(timeoutId);
          clearTimeout(slowId);
          form.classList.remove("is-sending");
          if (data && (data.success === true || data.success === "true")) { showDone(v, ref); }
          else { throw new Error("send failed"); }
        })
        .catch(function () {
          if (timeoutId) clearTimeout(timeoutId);
          clearTimeout(slowId);
          form.classList.remove("is-sending");
          if (status) {
            status.classList.add("is-error");
            status.textContent = "Couldn't send just now — please call (555) 555-0100 or email us.";
          }
          mailtoFallback(v, ref); // give them a working path regardless
        });
    });
  }
})();
