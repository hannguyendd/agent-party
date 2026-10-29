/* Party Agent intro page: everything around the demo office.
   - stars():       the GitHub star count in the header
   - pageLayout():  sizes the left column so the map is as big as the height allows
   - welcome():     intro -> loader -> office
   - mapControls(): 2D / 3D switch, zoom, pan, follow
   - officeLife():  gossip line, crew, live stats, hints on the map
   office.js runs the simulation and the 2D map; office3d.js is the 3D view, loaded on demand. */
(function () {
  'use strict';

  var REPO = 'hannguyendd/agent-party';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (id) { return document.getElementById(id); };
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } },
  };

  // ---------------------------------------------------------------------------------------------------------------
  // GitHub star count, cached for half an hour to stay under the API's rate limit.
  function stars() {
    var KEY = 'party-agent-stars', el = $('stars');
    function show(n) { el.textContent = n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n); el.hidden = false; }
    var cached = null;
    try { cached = JSON.parse(store.get(KEY) || 'null'); } catch (e) { /* ignore */ }
    if (cached && Date.now() - cached.at < 30 * 60 * 1000) { show(cached.n); return; }
    fetch('https://api.github.com/repos/' + REPO, { headers: { Accept: 'application/vnd.github+json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d || typeof d.stargazers_count !== 'number') return;
        show(d.stargazers_count);
        store.set(KEY, JSON.stringify({ n: d.stargazers_count, at: Date.now() }));
      })
      .catch(function () { /* offline: no count */ });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The map frame keeps the plate's aspect (1792 x 1152 plus the 9px frame on each side). The left column is sized
  // from the height; the side panel takes the rest. CSS (.mapfit, container units) does the inner fit.
  function pageLayout() {
    var main = document.querySelector('.main'), col = document.querySelector('.office');
    var bar = col.querySelector('.bar'), dock = col.querySelector('.dock'), box = col.querySelector('.mapbox');
    var GAP = 20, FRAME = 18, ASPECT = 1792 / 1152, PANEL = 360;
    function layout() {
      if (innerWidth <= 900) {
        main.style.gridTemplateColumns = col.style.gridTemplateRows = col.style.alignContent = box.style.height = '';
        return;
      }
      var frameH = main.clientHeight - bar.offsetHeight - dock.offsetHeight - 2 * GAP;
      var ideal = (frameH - FRAME) * ASPECT + FRAME;
      var frameW = Math.max(320, Math.min(ideal, main.clientWidth - PANEL - GAP));
      main.style.gridTemplateColumns = 'minmax(0, ' + Math.floor(frameW) + 'px) minmax(' + PANEL + 'px, 1fr)';
      // When the width is what limits the map, keep the bar, map and dock together in the middle.
      var byWidth = frameW < ideal - 1;
      box.style.height = byWidth ? Math.floor((frameW - FRAME) / ASPECT + FRAME) + 'px' : '';
      col.style.gridTemplateRows = byWidth ? 'auto auto auto' : '';
      col.style.alignContent = byWidth ? 'center' : '';
    }
    var queued = false;
    function schedule() { if (!queued) { queued = true; requestAnimationFrame(function () { queued = false; layout(); }); } }
    layout();
    addEventListener('resize', schedule);
    if ('ResizeObserver' in window) { var ro = new ResizeObserver(schedule); ro.observe(main); ro.observe(bar); ro.observe(dock); }
    if (document.fonts) document.fonts.ready.then(layout);
    return layout;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Intro -> loader -> office. The office loads behind the welcome screen from the start. "Come in" (a click or any
  // key) shrinks the name into the loader; the office shows once it is ready and the letters had a moment.
  function welcome(layout) {
    var intro = $('intro'), line = $('intro-line'), word = intro.querySelector('.word');
    var LINES = ['Assigning desks...', 'Brewing coffee...', 'Waking up the agents...', 'Hiding the standup calendar...', 'Untangling the cables...'];
    var entered = false, ready = false, shown = false, enteredAt = 0, ticker = 0, onReveal = [];
    var mapImg = new Image();
    mapImg.src = 'office/map/background.png';

    function say(t) { line.textContent = t; line.classList.remove('fresh'); void line.offsetWidth; line.classList.add('fresh'); }
    function enter() {
      if (entered) return;
      entered = true; enteredAt = Date.now();
      // Move the name to the middle of the screen, shrunk, with the loading line right under it.
      var r = word.getBoundingClientRect(), lr = line.getBoundingClientRect();
      var S = innerWidth < 600 ? 0.62 : 0.48, cx = innerWidth / 2, cy = innerHeight / 2 - 14;
      word.style.transform = 'translate(' + (cx - (r.left + r.width / 2)) + 'px, ' + (cy - (r.top + r.height / 2)) + 'px) scale(' + S + ')';
      line.style.transform = 'translate(' + (cx - (lr.left + lr.width / 2)) + 'px, ' + (cy + r.height * S / 2 + 10 - lr.top) + 'px)';
      intro.classList.add('loading');
      var i = 0;
      say(LINES[0]);
      ticker = setInterval(function () { i = (i + 1) % LINES.length; say(LINES[i]); }, 700);
      finish();
    }
    function finish() {
      if (!entered || !ready || shown) return;
      shown = true;
      setTimeout(function () {
        clearInterval(ticker);
        layout();
        intro.classList.add('done');
        document.body.classList.remove('booting');
        onReveal.forEach(function (fn) { fn(); });
        setTimeout(function () { intro.hidden = true; }, 900);
      }, Math.max(0, (reduce ? 200 : 1500) - (Date.now() - enteredAt)));
    }
    function markReady() { if (!ready) { ready = true; finish(); } }

    $('enter').addEventListener('click', function (e) { e.stopPropagation(); enter(); });
    intro.addEventListener('click', enter);
    addEventListener('keydown', function (e) {
      if (entered || e.metaKey || e.ctrlKey || e.altKey || e.key === 'Tab' || e.key === 'Shift') return;
      e.preventDefault();
      enter();
    });
    $('home').addEventListener('click', function (e) { e.preventDefault(); location.hash = ''; location.reload(); });
    setTimeout(markReady, 4000); // never wait longer than this
    if (location.hash === '#office') enter();

    return {
      onReveal: function (fn) { onReveal.push(fn); },
      // The office runs: wait for the fonts and the decoded map image, then show it.
      officeReady: function () {
        Promise.all([document.fonts && document.fonts.ready, mapImg.decode && mapImg.decode().catch(function () {})])
          .then(markReady, markReady);
      },
      failed: markReady,
    };
  }

  // ---------------------------------------------------------------------------------------------------------------
  // 2D / 3D, zoom, pan and follow. With the 3D office art (office/3d/, copied in by scripts/build-site.sh) 3D is the
  // diorama in office3d.js, built in the background once the office shows; without it, or if WebGL fails, 3D tilts
  // the 2D map instead.
  function mapControls(office, view, page) {
    var sim = office.sim, fit = document.querySelector('.mapfit'), map = $('office');
    var b2 = $('v2d'), b3 = $('v3d'), followBtn = $('follow');
    var loading = { el: $('loading3d'), text: $('loading3d-text'), bar: $('loading3d-bar') };
    var VIEW_KEY = 'party-agent-view';
    var mode = '2d', view3d = null, building = null, following = false;
    var z = 1, tx = 0, ty = 0; // 2D zoom and offset in px

    var has3d = fetch('office/3d/layout3d.json', { method: 'HEAD' }).then(function (r) { return r.ok; }, function () { return false; });
    function in3d() { return mode === '3d' && view3d && fit.classList.contains('real3d'); }

    function build3d() {
      if (!building) {
        building = has3d.then(function (ok) {
          if (!ok) return null;
          return import('./office3d.js').then(function (m) {
            return m.mount(fit, office, {
              hidden: true,
              onFollow: setFollow,
              onProgress: function (done, total) {
                loading.text.textContent = 'Building the 3D office · ' + done + '/' + total;
                loading.bar.style.setProperty('--p', Math.round(done / Math.max(1, total) * 100) + '%');
              },
            });
          });
        }).then(function (v) {
          view3d = v;
          if (v) v.setFollow(following);
          return v;
        }, function (err) {
          console.warn('3D office unavailable, tilting the map instead', err);
          building = null; // try again on the next switch
          return null;
        });
      }
      return building;
    }

    // Swap views behind a short fade so the switch never pops.
    function fade(fn) {
      if (reduce) { fn(); return; }
      fit.classList.add('fading');
      setTimeout(function () { fn(); requestAnimationFrame(function () { fit.classList.remove('fading'); }); }, 200);
    }
    function setMode(m) {
      mode = m;
      b2.setAttribute('aria-pressed', m === '2d');
      b3.setAttribute('aria-pressed', m === '3d');
      store.set(VIEW_KEY, m);
      if (m === '2d') {
        loading.el.hidden = true; fit.classList.remove('building');
        fade(function () { view.setTilt(false); fit.classList.remove('real3d'); if (view3d) view3d.setActive(false); });
        return;
      }
      if (!view3d) { loading.el.hidden = false; fit.classList.add('building'); }
      build3d().then(function (v) {
        loading.el.hidden = true; fit.classList.remove('building');
        if (mode !== '3d') return;
        fade(function () {
          reset2d();
          if (v) { v.setActive(true); view.setTilt(false); fit.classList.add('real3d'); }
          else view.setTilt(true);
        });
      });
    }

    // --- 2D zoom and pan: wheel or buttons zoom around a point, drag moves the map; a drag never counts as a click.
    function apply2d() {
      var w = fit.clientWidth, h = fit.clientHeight;
      tx = Math.min(0, Math.max(w - w * z, tx));
      ty = Math.min(0, Math.max(h - h * z, ty));
      map.style.transform = z === 1 ? '' : 'translate(' + tx + 'px, ' + ty + 'px) scale(' + z + ')';
      fit.classList.toggle('zoomed', z > 1 && mode === '2d');
    }
    function zoom2d(f, x, y) {
      var r = fit.getBoundingClientRect(), px = x - r.left, py = y - r.top, nz = Math.max(1, Math.min(4, z * f));
      tx = px - (px - tx) * (nz / z);
      ty = py - (py - ty) * (nz / z);
      z = nz;
      if (z === 1) tx = ty = 0;
      apply2d();
    }
    function reset2d() { z = 1; tx = ty = 0; apply2d(); }
    function zoomBy(f) {
      if (in3d()) { view3d.zoomBy(f); return; }
      var r = fit.getBoundingClientRect();
      zoom2d(f, r.left + r.width / 2, r.top + r.height / 2);
    }

    map.addEventListener('wheel', function (e) {
      if (mode !== '2d') return;
      e.preventDefault();
      zoom2d(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
    }, { passive: false });
    var drag = null, dragged = false;
    map.addEventListener('pointerdown', function (e) { if (z > 1) { drag = { x: e.clientX, y: e.clientY }; dragged = false; } });
    addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (!dragged) setFollow(false);
      dragged = true;
      fit.classList.add('grabbing');
      tx += dx; ty += dy;
      drag = { x: e.clientX, y: e.clientY };
      apply2d();
    });
    addEventListener('pointerup', function () { drag = null; fit.classList.remove('grabbing'); });
    map.addEventListener('click', function (e) { if (dragged) { dragged = false; e.stopImmediatePropagation(); } }, true);

    // --- Follow: while zoomed in, keep the visitor's character centred. Walking turns it on, panning by hand off.
    function setFollow(on) {
      following = on;
      followBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
      if (view3d) view3d.setFollow(on);
    }
    office.addView({
      draw: function () { // runs in the simulation's frame loop
        var me = sim.player;
        if (!following || mode !== '2d' || z === 1 || !me.active) return;
        var w = fit.clientWidth, h = fit.clientHeight;
        var ux = me.x * 32 / 1792 * w, uy = (me.y * 32 + 10) / 1152 * h;
        tx += (w / 2 - ux * z - tx) * 0.12;
        ty += (h / 2 - uy * z - ty) * 0.12;
        apply2d();
      },
    });
    sim.on(function (type) { if (type === 'spawn') setFollow(true); });
    addEventListener('keydown', function (e) {
      if (!following && sim.player.active && /^(Key[WASD]|Arrow)/.test(e.code)) setFollow(true);
    });

    // --- Buttons
    b2.addEventListener('click', function () { setMode('2d'); });
    b3.addEventListener('click', function () { setMode('3d'); });
    $('zin').addEventListener('click', function () { zoomBy(1.4); });
    $('zout').addEventListener('click', function () { zoomBy(1 / 1.4); });
    $('zfit').addEventListener('click', function () { if (view3d) view3d.resetZoom(); reset2d(); });
    $('rotl').addEventListener('click', function () { if (view3d) view3d.rotate(-1); });
    $('rotr').addEventListener('click', function () { if (view3d) view3d.rotate(1); });
    followBtn.addEventListener('click', function () {
      setFollow(!following);
      if (following && z === 1 && !in3d()) zoomBy(2);
    });
    addEventListener('resize', apply2d);

    // Build the 3D office in the background once the office shows, so the switch is instant later. The characters
    // weigh ~18 MB, so only on a computer and when the browser isn't saving data; elsewhere it loads on first use.
    var saveData = navigator.connection && navigator.connection.saveData;
    if (!saveData && matchMedia('(min-width: 901px) and (pointer: fine)').matches) page.onReveal(function () { setTimeout(build3d, 1500); });
    setMode(store.get(VIEW_KEY) === '3d' ? '3d' : '2d');
  }

  // ---------------------------------------------------------------------------------------------------------------
  // The office's life around the map: the gossip line (who walked where, never what was said), the crew with what
  // each is doing, the live stats, and the hints on the map.
  function officeLife(office) {
    var sim = office.sim;
    var el = { line: $('gossip'), when: $('gossip-time'), crew: $('crew'), chats: $('chats'), hint: $('hint'), invite: $('invite') };
    var BREAKS = ['went to refill coffee', 'is stretching by the window', 'went looking for snacks', 'is pretending to think at the fridge'];
    var b = function (s) { return '<b>' + s + '</b>'; };
    var gossipAt = Date.now(), tipUntil = 0;

    function gossip(html) {
      el.line.innerHTML = html;
      gossipAt = Date.now();
      el.line.classList.remove('fresh'); void el.line.offsetWidth; el.line.classList.add('fresh');
    }
    sim.on(function (type, a, other) {
      if (type === 'leave') gossip(b(a.id) + ' walked over to ' + b(other.id));
      else if (type === 'talk') gossip(b(a.id) + ' and ' + b(other.id) + ' are talking in dots');
      else if (type === 'stroll') gossip(b(a.id) + ' ' + BREAKS[Math.floor(Math.random() * BREAKS.length)]);
      else if (type === 'spawn') { gossip(b('You') + ' walked in. Everyone pretended not to notice'); tipUntil = Date.now() + 6000; }
      else if (type === 'hi') gossip(b(other.id) + ' told ' + b('you') + ': \u201c' + other.line + '\u201d');
    });
    gossip(b('Cron') + ' tried to schedule a standup. ' + b('Root') + ' said no');

    $('agents').textContent = sim.agents.length;
    var rows = sim.agents.map(function (a) {
      var li = document.createElement('li');
      li.style.setProperty('--c', a.c);
      li.setAttribute('aria-label', a.id + ', ' + a.role);
      li.innerHTML = '<span class="av" style="background-image:url(office/characters/' + a.skin + '-portrait.png)"></span>' +
        '<span class="name">' + a.id + '</span><span class="tip" role="tooltip"><b>' + a.id + '</b>' + a.role + '<br><span class="what"></span></span>';
      el.crew.appendChild(li);
      return { li: li, what: li.querySelector('.what'), busy: null };
    });

    // Every write below is skipped when nothing changed.
    var last = { chats: -1, ago: '', hint: null, invite: null };
    function refresh() {
      sim.agents.forEach(function (a, i) {
        var r = rows[i], text = 'Now: ' + sim.status(a).toLowerCase(), busy = a.mode !== 'sit' || a.busy;
        if (r.what.textContent !== text) r.what.textContent = text;
        if (r.busy !== busy) { r.busy = busy; r.li.classList.toggle('busy', busy); }
      });
      var n = sim.talking();
      if (n !== last.chats) { last.chats = n; el.chats.innerHTML = b(n) + ' ' + (n === 1 ? 'chat' : 'chats') + ' going'; }
      var s = Math.round((Date.now() - gossipAt) / 1000), ago = s < 5 ? 'now' : s < 60 ? s + 's ago' : Math.round(s / 60) + 'm ago';
      if (ago !== last.ago) { last.ago = ago; el.when.textContent = ago; }
      if (last.invite !== sim.player.active) { last.invite = sim.player.active; el.invite.classList.toggle('gone', sim.player.active); }
      var near = sim.nearby(), hint = '';
      if (sim.player.hiWith) hint = 'Press <kbd>E</kbd> again for more from ' + sim.player.hiWith.id;
      else if (near && !sim.canChat(near)) hint = near.id + ' is busy chatting. Try someone else';
      else if (near) hint = 'Press <kbd>E</kbd> to say hi to ' + near.id;
      else if (sim.player.active && Date.now() < tipUntil) hint = 'Nice! Walk up to an agent and press <kbd>E</kbd>';
      if (hint !== last.hint) { last.hint = hint; if (hint) el.hint.innerHTML = hint; el.hint.classList.toggle('off', !hint); }
    }
    refresh();
    setInterval(refresh, 150);
  }

  // ---------------------------------------------------------------------------------------------------------------
  stars();
  var page = welcome(pageLayout());
  AgentParty.start().then(function (office) {
    var view = office.view($('office'));
    page.onReveal(function () { office.controls(view); }); // the keys belong to the welcome screen until then
    mapControls(office, view, page);
    officeLife(office);
    office.run();
    page.officeReady();
  }).catch(function (err) {
    console.error(err);
    $('office').textContent = 'The office could not load. Refresh the page to try again.';
    page.failed();
  });
})();
