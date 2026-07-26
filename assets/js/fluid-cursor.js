/* =====================================================================
   Dynamic Fluid Cursor — "The Liquid Element"
   Native WebGL. A transparent hero-overlay canvas renders the low-opacity
   background typography into a texture, then a custom fragment shader
   refracts it around the pointer: a spring-damped ripple field warps and
   chromatically refracts the words, then settles back to still.

   Degrades cleanly: if WebGL is unavailable the CSS marquee stays visible
   and this module is a no-op. pointer-events:none keeps text/buttons live.
   ===================================================================== */
(function () {
  "use strict";

  var hero = document.querySelector("[data-hero]");
  var canvas = document.getElementById("fluid-canvas");
  if (!hero || !canvas) return;

  var glOpts = { alpha: true, premultipliedAlpha: false, antialias: false, depth: false, preserveDrawingBuffer: true };
  var gl = canvas.getContext("webgl", glOpts) || canvas.getContext("experimental-webgl", glOpts);
  if (!gl) return; // no WebGL -> CSS marquee fallback remains

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var isMobile = window.matchMedia("(max-width: 760px), (pointer: coarse)").matches;

  /* ---- shaders ------------------------------------------------------- */
  var VERT = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }"
  ].join("\n");

  var RCOUNT = 14;
  var FRAG = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform vec2 uRes;",
    "uniform vec2 uMouse;",        // px, y-up
    "uniform float uMouseStr;",    // 0..1, from capped pointer speed
    "uniform float uOpacity;",
    "uniform sampler2D uTex;",
    "uniform vec4 uRipples[" + RCOUNT + "];", // xy px(y-up), z=age 0..1, w=strength
    "uniform int uRippleN;",
    "",
    "vec2 fieldDisp(vec2 p){",
    "  vec2 d = vec2(0.0);",
    "  for(int i=0;i<" + RCOUNT + ";i++){",
    "    if(i>=uRippleN) break;",
    "    vec4 r = uRipples[i];",
    "    vec2 diff = p - r.xy;",
    "    float dist = length(diff) + 0.0001;",
    "    float radius = r.z * 540.0;",            // ring expands as it ages
    "    float ring = dist - radius;",
    "    float env = exp(-abs(ring) * 0.011) * exp(-r.z * 3.1) * r.w;", // damped envelope
    "    float wave = sin(ring * 0.05);",
    "    d += (diff / dist) * wave * env * 30.0;",
    "  }",
    "  vec2 md = p - uMouse; float mdist = length(md) + 0.0001;",   // immediate lens under cursor
    "  d += (md / mdist) * exp(-mdist * 0.006) * uMouseStr * 36.0;",
    "  return d;",
    "}",
    "",
    "void main(){",
    "  vec2 p = vUv * uRes;",
    "  vec2 disp = fieldDisp(p);",
    "  vec2 off = disp / uRes;",
    "  vec2 chroma = off * 0.16;",                 // gentle split = clear-water refraction, not rainbow
    "  vec4 sP = texture2D(uTex, vUv + off + chroma);",
    "  vec4 s0 = texture2D(uTex, vUv + off);",
    "  vec4 sM = texture2D(uTex, vUv + off - chroma);",
    "  vec3 col = vec3(sP.r, s0.g, sM.b);",
    "  float a = max(s0.a, max(sP.a, sM.a));",
    "  float dmag = length(disp);",
    "  float glint = clamp(dmag * 0.016, 0.0, 1.0);",         // brushed-copper sheen on flexed lines
    "  col += vec3(0.82, 0.62, 0.4) * glint * a * 0.55;",
    "  float md = length(p - uMouse);",                       // soft dark water-tension pool under the cursor
    "  float aura = exp(-md * 0.0042) * (0.07 + uMouseStr * 0.11);",
    "  col = mix(col, vec3(0.02, 0.05, 0.10), aura * 0.7);",
    "  gl_FragColor = vec4(col, max(a * uOpacity, aura * 0.45));",
    "}"
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("fluid-cursor shader error:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  var prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("fluid-cursor link error:", gl.getProgramInfoLog(prog)); return;
  }
  gl.useProgram(prog);

  /* fullscreen quad */
  var quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {
    res: gl.getUniformLocation(prog, "uRes"),
    mouse: gl.getUniformLocation(prog, "uMouse"),
    mouseStr: gl.getUniformLocation(prog, "uMouseStr"),
    opacity: gl.getUniformLocation(prog, "uOpacity"),
    tex: gl.getUniformLocation(prog, "uTex"),
    ripples: gl.getUniformLocation(prog, "uRipples"),
    rippleN: gl.getUniformLocation(prog, "uRippleN")
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);

  /* ---- offscreen typography texture (the words we refract) ----------- */
  var tCanvas = document.createElement("canvas");
  var tctx = tCanvas.getContext("2d");
  var texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  var ROWS = [
    { text: "LEAK DETECTION — DRAINS — WATER HEATERS — REPIPES — FIXTURES — EMERGENCY — ", color: "rgb(200,218,248)", y: 0.44, spd: 26 },
    { text: "LICENSED — INSURED — FLAT-RATE — SAME-DAY — GUARANTEED — ", color: "rgb(230,182,114)", y: 0.6, spd: -19 }
  ];

  /* The blueprint is deliberately NOT drawn here: rasterising it into a downscaled
     texture made it soft. It lives as a crisp DOM SVG layer (.hero__blueprint) so it
     stays vector-sharp; this canvas refracts the display typography over that area. */
  function drawType(t) {
    var W = tCanvas.width, H = tCanvas.height;
    tctx.clearRect(0, 0, W, H);
    tctx.textBaseline = "middle";
    for (var i = 0; i < ROWS.length; i++) {
      var r = ROWS[i], fs2 = H * 0.2;
      tctx.font = "800 " + fs2 + "px 'Playfair Display', Georgia, 'Times New Roman', serif";
      tctx.fillStyle = r.color;
      var pw = tctx.measureText(r.text).width;
      if (pw < 10) continue;
      var scroll = t * r.spd * (H / 600);
      var start = -(((scroll % pw) + pw) % pw) - pw;
      for (var x = start; x < W + pw; x += pw) tctx.fillText(r.text, x, H * r.y);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tCanvas);
  }

  /* ---- sizing (downscaled render target; heavier downscale on mobile) - */
  var scale = isMobile ? 0.5 : 0.8;
  var DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 1.5);
  var W = 0, H = 0;
  function resize() {
    var cssW = hero.clientWidth, cssH = hero.clientHeight;
    W = Math.max(2, Math.round(cssW * scale * DPR));
    H = Math.max(2, Math.round(cssH * scale * DPR));
    canvas.width = W; canvas.height = H;
    canvas.style.width = cssW + "px"; canvas.style.height = cssH + "px";
    tCanvas.width = W; tCanvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(U.res, W, H);
  }

  /* ---- pointer -> ripple pool (capped speed, throttled spawn) --------- */
  var ripples = [];               // {x,y (px y-up), born, strength}
  var MAXR = RCOUNT;
  var mouse = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, str: 0 };
  var lastSpawn = 0, lastX = 0, lastY = 0;

  function toBacking(clientX, clientY) {
    var rect = canvas.getBoundingClientRect();
    var bx = (clientX - rect.left) * (W / rect.width);
    var byTop = (clientY - rect.top) * (H / rect.height);
    return { x: bx, y: H - byTop };   // y-up
  }

  if (!reduce) {
    window.addEventListener("pointermove", function (e) {
      var pt = toBacking(e.clientX, e.clientY);
      mouse.tx = pt.x; mouse.ty = pt.y;
      var now = performance.now();
      var moved = Math.hypot(pt.x - lastX, pt.y - lastY);
      // cap tracking: clamp per-move contribution, throttle spawns
      var capped = Math.min(moved, 90);
      mouse.str = Math.min(1, mouse.str * 0.6 + (capped / 90) * 0.9);
      if (now - lastSpawn > 55 && moved > 5) {
        if (ripples.length >= MAXR) ripples.shift();
        ripples.push({ x: pt.x, y: pt.y, born: now, strength: 0.5 + Math.min(1, capped / 60) });
        lastSpawn = now; lastX = pt.x; lastY = pt.y;
      }
    }, { passive: true });
    window.addEventListener("pointerdown", function (e) {
      var pt = toBacking(e.clientX, e.clientY);
      if (ripples.length >= MAXR) ripples.shift();
      ripples.push({ x: pt.x, y: pt.y, born: performance.now(), strength: 1.6 });
    }, { passive: true });
  }

  /* ---- loop (fps budgeting; pause when hidden / out of view) ---------- */
  var rip = new Float32Array(RCOUNT * 4);
  var running = true, raf = null, start = performance.now(), lastFrame = 0;
  var minDT = isMobile ? 1000 / 34 : 0;   // throttle mobile to ~34fps
  var LIFE = 1500;                          // ripple lifetime (ms) -> settles back

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    if (minDT && now - lastFrame < minDT) return;
    lastFrame = now;

    var t = (now - start) / 1000;
    drawType(t);

    // ease cursor (inertia) + decay its lens strength
    mouse.x += (mouse.tx - mouse.x) * 0.12;
    mouse.y += (mouse.ty - mouse.y) * 0.12;
    mouse.str *= 0.94;

    // pack live ripples, aged 0..1 (older -> settled)
    var n = 0;
    for (var i = 0; i < ripples.length; i++) {
      var age = (now - ripples[i].born) / LIFE;
      if (age >= 1) continue;
      rip[n * 4] = ripples[i].x; rip[n * 4 + 1] = ripples[i].y;
      rip[n * 4 + 2] = age; rip[n * 4 + 3] = ripples[i].strength;
      n++;
    }
    if (n < ripples.length) ripples = ripples.filter(function (r) { return (now - r.born) / LIFE < 1; });

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.mouseStr, mouse.str);
    gl.uniform1f(U.opacity, 0.2);
    gl.uniform1i(U.tex, 0);
    gl.uniform4fv(U.ripples, rip);
    gl.uniform1i(U.rippleN, Math.min(RCOUNT, n));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /* ---- boot ---------------------------------------------------------- */
  var booted = false;
  function boot() {
    if (booted) return;
    booted = true;
    resize();
    hero.classList.add("webgl-on");   // hide the CSS marquee fallback
    raf = requestAnimationFrame(frame);
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(boot);
    setTimeout(function () { if (!raf) boot(); }, 1200); // safety if fonts hang
  } else { boot(); }

  var rt;
  window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(resize, 150); });
  document.addEventListener("visibilitychange", function () { running = !document.hidden; });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) { running = es[0].isIntersecting && !document.hidden; }, { threshold: 0 }).observe(hero);
  }
  canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); running = false; }, false);
  canvas.addEventListener("webglcontextrestored", function () { running = true; }, false);
})();
