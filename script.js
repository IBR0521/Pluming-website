/* Your Plumbing Co. — interactions
   Header scroll state · mobile nav · scroll reveal · gauge dial · form · year */
(function () {
  "use strict";

  var reduceMotionGlobal = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

  /* ---- hero backdrop: interactive water ripples on a midnight canvas ---- */
  var hero = document.querySelector("[data-hero]");
  var rippleCanvas = hero && hero.querySelector("[data-ripple]");
  if (hero && rippleCanvas && rippleCanvas.getContext) {
    var rctx = rippleCanvas.getContext("2d");
    var rReduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var RDPR = Math.min(window.devicePixelRatio || 1, 2);
    var rW = 0, rH = 0, rafR = null;
    var ripples = [];
    var MAXR = 46;

    var sizeRipple = function () {
      rW = hero.clientWidth; rH = hero.clientHeight;
      rippleCanvas.width = Math.round(rW * RDPR);
      rippleCanvas.height = Math.round(rH * RDPR);
      rippleCanvas.style.width = rW + "px";
      rippleCanvas.style.height = rH + "px";
      rctx.setTransform(RDPR, 0, 0, RDPR, 0, 0);
    };

    var spawn = function (x, y, strength) {
      if (ripples.length >= MAXR) ripples.splice(0, ripples.length - MAXR + 1);
      ripples.push({ x: x, y: y, r: 5, max: 130 + Math.random() * 130, life: 1, w: strength || 1 });
    };

    if (!rReduce) {
      /* pointer drags a wake through the water */
      var lastX = 0, lastY = 0, lastSpawn = 0;
      hero.addEventListener("pointermove", function (e) {
        var rect = rippleCanvas.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        var now = performance.now();
        var moved = Math.hypot(x - lastX, y - lastY);
        if (now - lastSpawn > 58 && moved > 6) {
          spawn(x, y, Math.min(1.7, 0.55 + moved / 90));
          lastSpawn = now; lastX = x; lastY = y;
        }
      }, { passive: true });
      hero.addEventListener("pointerdown", function (e) {
        var rect = rippleCanvas.getBoundingClientRect();
        spawn(e.clientX - rect.left, e.clientY - rect.top, 2.2);
      }, { passive: true });
    }

    var ambientT = 0;
    var frame = function (t) {
      rctx.clearRect(0, 0, rW, rH);
      /* a slow ambient drip keeps the surface alive when the pointer is still */
      if (t - ambientT > 1500) {
        spawn(rW * (0.15 + Math.random() * 0.7), rH * (0.28 + Math.random() * 0.55), 0.6);
        ambientT = t;
      }
      for (var i = ripples.length - 1; i >= 0; i--) {
        var rp = ripples[i];
        rp.r += (rp.max - rp.r) * 0.045 + 0.6;
        rp.life -= 0.0105;
        if (rp.life <= 0 || rp.r >= rp.max) { ripples.splice(i, 1); continue; }
        var a = rp.life * rp.life * 0.5 * rp.w;
        rctx.beginPath();
        rctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
        rctx.strokeStyle = "rgba(214, 178, 108," + (a * 0.55).toFixed(3) + ")";
        rctx.lineWidth = 1.4;
        rctx.stroke();
        rctx.beginPath();
        rctx.arc(rp.x, rp.y, rp.r * 0.68, 0, Math.PI * 2);
        rctx.strokeStyle = "rgba(122, 166, 226," + (a * 0.5).toFixed(3) + ")";
        rctx.lineWidth = 1;
        rctx.stroke();
      }
      rafR = requestAnimationFrame(frame);
    };

    sizeRipple();
    if (rReduce) {
      /* static: a few calm concentric rings, no animation */
      [[0.72, 0.38, 1], [0.38, 0.62, 0.7], [0.86, 0.72, 0.5]].forEach(function (p) {
        var x = rW * p[0], y = rH * p[1];
        for (var k = 1; k <= 3; k++) {
          rctx.beginPath(); rctx.arc(x, y, 26 * k, 0, Math.PI * 2);
          rctx.strokeStyle = "rgba(150, 180, 225," + (0.1 / k * p[2]).toFixed(3) + ")";
          rctx.lineWidth = 1; rctx.stroke();
        }
      });
    } else {
      rafR = requestAnimationFrame(frame);
    }

    var rsizeT;
    window.addEventListener("resize", function () { clearTimeout(rsizeT); rsizeT = setTimeout(sizeRipple, 150); });
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
    var cur = { lo: 0, hi: 0 };   // displayed values, for the count-up animation
    var countRAF = null;
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
      /* roll the price up to the new range instead of snapping (rAF tween) */
      if (countRAF) { cancelAnimationFrame(countRAF); countRAF = null; }
      if (reduceMotionGlobal) {
        cur.lo = lo; cur.hi = hi;
        amountEl.textContent = money(lo) + " – " + money(hi);
      } else {
        var fromLo = cur.lo, fromHi = cur.hi, t0 = performance.now(), DURc = 620;
        var easeOutCubic = function (x) { return 1 - Math.pow(1 - x, 3); };
        var tick = function (now) {
          var p = Math.min(1, (now - t0) / DURc), e = easeOutCubic(p);
          cur.lo = fromLo + (lo - fromLo) * e;
          cur.hi = fromHi + (hi - fromHi) * e;
          amountEl.textContent = money(cur.lo) + " – " + money(cur.hi);
          countRAF = p < 1 ? requestAnimationFrame(tick) : null;
        };
        countRAF = requestAnimationFrame(tick);
      }
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
      var batch = 0;
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.transitionDelay = (batch++ * 70) + "ms";  // gentle stagger
          entry.target.classList.add("is-in");      // CSS transition drives the reveal
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
      if (donePanel) { form.hidden = true; donePanel.hidden = false; donePanel.classList.add("is-in"); donePanel.scrollIntoView({ behavior: "smooth", block: "center" }); }
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
