/* Party Agent intro office: a small simulation of agents that sit at their desks, walk over to a teammate's
   agent, talk for a moment and walk back, plus one character the visitor drives ("You").
   Rendered as the 2D map (flat) or a tilted diorama ("3D").
   Uses the Office art: map plate, collision grid (black = blocked) and seats.json. Made-up agents only. */
(function () {
  var TILE = 32, COLS = 56, ROWS = 36, MAP_W = 1792, MAP_H = 1152;
  var BASE = 'office/'; // the Office art; the Pages workflow copies it here from dashboard/public/office

  // One agent per kind of work in the company; names only a programmer would pick.
  var AGENTS = [
    { id: 'Root', role: 'The boss. Has every permission there is', skin: 'knight', c: '#3D5BA9', seat: 'MGR' },
    { id: 'Cron', role: 'Manager. Schedules everything, always on time', skin: 'healer', c: '#8A9A3B', seat: 'D15' },
    { id: 'Backlog', role: 'Product. Owns the roadmap and the sticky notes', skin: 'lead', c: '#B04A5A', seat: 'M2' },
    { id: 'Segfault', role: 'Backend. Talks to databases at 3am', skin: 'dev-hoodie', c: '#E67E5A', seat: 'D3' },
    { id: 'Flexbox', role: 'Frontend. Centers divs with dark magic', skin: 'mage', c: '#7A6BC2', seat: 'D6' },
    { id: 'HotReload', role: 'Mobile. Ships to both app stores', skin: 'shiba', c: '#2F8FA0', seat: 'D10' },
    { id: 'Prefab', role: 'Unity. Builds whole worlds before lunch', skin: 'dragon', c: '#C9772E', seat: 'D12' },
    { id: 'Sudo', role: 'DevOps. Keeps the servers breathing', skin: 'robot', c: '#56657A', seat: 'M1' },
    { id: 'Pixel', role: 'Design. Moves things 2px to the left', skin: 'designer', c: '#D0679B', seat: 'D2' },
    { id: 'Edgecase', role: 'QA. Finds the bug you swore was fixed', skin: 'cat', c: '#3E9E6E', seat: 'D7' },
    { id: 'Handshake', role: 'HR. Says hello to everyone first', skin: 'slime', c: '#E0A21B', seat: 'D14' },
    { id: 'Chmod', role: 'Admin. Hands out the keys (and the forms)', skin: 'rogue', c: '#7B5A44', seat: 'D1' }
  ];
  var PLAYER = { id: 'you', label: 'You', skin: 'alien', c: '#D9663F' };
  var SPAWN = [19, 6]; // just inside the entrance door
  // Places agents sometimes wander to: pantry, lounge, window, printer corner.
  var SPOTS = [[44, 9], [36, 14], [30, 7], [12, 28], [48, 30]];
  var SPEED = 2.6, PLAYER_SPEED = 4.2; // tiles per second
  var TALK_S = 4.6, STAND_S = 2.6, HI_S = 4.2, REACH = 2.4;

  function loadImage(src) {
    return new Promise(function (ok, bad) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = bad; i.src = src; });
  }

  function officeSim(walk, seats) {
    this.walk = walk; this.seats = seats; this.listeners = []; this.t = 0; this.keys = {};
    this.agents = AGENTS.map(function (a) {
      var s = seats[a.seat];
      return Object.assign({}, a, { x: s.x + 0.5, y: s.y + 0.5, mode: 'sit', face: s.face, path: [], busy: false, partner: null, bubble: false, home: s });
    });
    var sp = this.nearestOpen(SPAWN[0], SPAWN[1]);
    this.player = Object.assign({}, PLAYER, { x: sp[0] + 0.5, y: sp[1] + 0.5, mode: 'stand', face: 'down', path: [], bubble: false, isPlayer: true, hiWith: null, active: false });
    this.all = this.agents.concat([this.player]);
  }
  officeSim.prototype.on = function (fn) { this.listeners.push(fn); };
  officeSim.prototype.emit = function (type, a, b) { this.listeners.forEach(function (fn) { fn(type, a, b); }); };
  officeSim.prototype.ok = function (x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && this.walk[y * COLS + x]; };
  officeSim.prototype.talking = function () {
    return this.agents.filter(function (a) { return a.mode === 'talk'; }).length + (this.player.hiWith ? 1 : 0);
  };
  // What an agent is up to, in a few plain words (for the "Who's in" list).
  officeSim.prototype.status = function (a) {
    if (a.withPlayer) return 'Chatting with you';
    if (a.mode === 'talk') return 'Chatting with ' + a.partner.id;
    if (a.mode === 'stand') return 'Refilling coffee (tokens)';
    if (a.mode === 'walk') return a.goal === 'visit' ? 'Walking over to ' + a.partner.id : a.goal === 'stroll' ? 'Stretching its legs' : 'Heading back to the desk';
    if (a.busy && a.partner) return a.partner.mode === 'talk' ? 'Answering ' + a.partner.id : a.partner.id + ' is on the way';
    return 'Typing very seriously';
  };

  // A* over the tile grid, 8 directions, no cutting corners.
  officeSim.prototype.find = function (sx, sy, tx, ty) {
    var self = this, N = COLS * ROWS, g = new Float32Array(N).fill(1e9), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    var start = sy * COLS + sx, goal = ty * COLS + tx, open = [start]; g[start] = 0;
    var h = function (i) { var dx = Math.abs(i % COLS - tx), dy = Math.abs((i / COLS | 0) - ty); return Math.max(dx, dy) + 0.41 * Math.min(dx, dy); };
    while (open.length) {
      var bi = 0; for (var k = 1; k < open.length; k++) if (g[open[k]] + h(open[k]) < g[open[bi]] + h(open[bi])) bi = k;
      var cur = open.splice(bi, 1)[0];
      if (cur === goal) break;
      closed[cur] = 1;
      var cx = cur % COLS, cy = cur / COLS | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        var nx = cx + dx, ny = cy + dy;
        if (!self.ok(nx, ny)) continue;
        if (dx && dy && (!self.ok(cx + dx, cy) || !self.ok(cx, cy + dy))) continue;
        var ni = ny * COLS + nx; if (closed[ni]) continue;
        var ng = g[cur] + (dx && dy ? 1.41 : 1);
        if (ng < g[ni]) { if (g[ni] === 1e9) open.push(ni); g[ni] = ng; from[ni] = cur; }
      }
    }
    if (from[goal] === -1 && goal !== start) return null;
    var out = []; for (var i = goal; i !== -1 && i !== start; i = from[i]) out.unshift([i % COLS + 0.5, (i / COLS | 0) + 0.5]);
    return out;
  };
  officeSim.prototype.nearestOpen = function (x, y) {
    for (var r = 0; r < 8; r++) for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) if (this.ok(x + dx, y + dy)) return [x + dx, y + dy];
    return [x, y];
  };
  officeSim.prototype.go = function (a, tx, ty, goal) {
    var p = this.find(Math.floor(a.x), Math.floor(a.y), tx, ty);
    if (!p) return false;
    a.path = p; a.mode = 'walk'; a.goal = goal; return true;
  };

  officeSim.prototype.plan = function () {
    var free = this.agents.filter(function (a) { return a.mode === 'sit' && !a.busy; });
    if (free.length < 1) return;
    var a = free[Math.floor(Math.random() * free.length)];
    var peers = free.filter(function (b) { return b !== a; });
    if (peers.length && Math.random() < 0.7) {
      var b = peers[Math.floor(Math.random() * peers.length)];
      var s = b.home, spots = (s.extras || []).concat([{ x: s.x + 1, y: s.y }, { x: s.x - 1, y: s.y }, { x: s.x, y: s.y + 1 }, { x: s.x, y: s.y - 1 }]);
      var taken = this.all.map(function (o) { return Math.floor(o.x) + ',' + Math.floor(o.y); });
      for (var i = 0; i < spots.length; i++) {
        var p = spots[i];
        if (!this.ok(p.x, p.y) || taken.indexOf(p.x + ',' + p.y) >= 0 || (p.x === s.x && p.y === s.y)) continue;
        if (this.go(a, p.x, p.y, 'visit')) { a.partner = b; b.busy = true; b.partner = a; this.emit('leave', a, b); return; }
      }
    } else {
      var sp = SPOTS[Math.floor(Math.random() * SPOTS.length)], o = this.nearestOpen(sp[0], sp[1]);
      if (this.go(a, o[0], o[1], 'stroll')) this.emit('stroll', a);
    }
  };

  function faceTo(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
  }
  // Move along a path; returns false when the path is used up.
  function follow(a, speed, dt) {
    var p = a.path[0];
    if (!p) return false;
    var dx = p[0] - a.x, dy = p[1] - a.y, d = Math.hypot(dx, dy), s = speed * dt;
    if (d <= s) { a.x = p[0]; a.y = p[1]; a.path.shift(); }
    else { a.x += dx / d * s; a.y += dy / d * s; }
    var horiz = a.face === 'left' || a.face === 'right';
    var goH = horiz ? Math.abs(dx) * 1.4 > Math.abs(dy) : Math.abs(dx) > Math.abs(dy) * 1.4;
    if (d > 0.01) a.face = goH ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    return true;
  }

  officeSim.prototype.step = function (dt) {
    var self = this; this.t += dt; var t = this.t;
    this.agents.forEach(function (a) {
      if (a.withPlayer) return; // stops whatever it was doing while you chat
      if (a.mode === 'walk') {
        if (!follow(a, SPEED, dt)) self.arrive(a);
      } else if ((a.mode === 'talk' || a.mode === 'stand') && t > a.until) {
        var b = a.partner;
        a.bubble = false; a.partner = null;
        if (b) { b.bubble = false; b.busy = false; b.partner = null; self.emit('end', a, b); }
        self.go(a, a.home.x, a.home.y, 'home');
      }
      if (a.mode === 'talk' && a.partner) {
        var mine = Math.floor((t - a.since) / 1.25) % 2 === 0;
        a.bubble = mine; a.partner.bubble = !mine;
      }
    });
    this.stepPlayer(dt);
  };
  officeSim.prototype.arrive = function (a) {
    if (a.goal === 'visit' && a.partner) {
      a.mode = 'talk'; a.since = this.t; a.until = this.t + TALK_S; a.face = faceTo(a, a.partner);
      this.emit('talk', a, a.partner);
    } else if (a.goal === 'stroll') {
      a.mode = 'stand'; a.until = this.t + STAND_S; a.face = 'down';
    } else {
      a.mode = 'sit'; a.face = a.home.face; a.x = a.home.x + 0.5; a.y = a.home.y + 0.5;
    }
  };

  // ---- the visitor's character ----
  officeSim.prototype.clear = function (x, y) {
    return this.ok(Math.floor(x - 0.28), Math.floor(y)) && this.ok(Math.floor(x + 0.28), Math.floor(y)) &&
      this.ok(Math.floor(x), Math.floor(y - 0.12)) && this.ok(Math.floor(x), Math.floor(y + 0.28));
  };
  // Drop the visitor's character in at the entrance (Play now, or the first arrow key).
  // Pressing Play now again sends it back to the door.
  officeSim.prototype.spawn = function (again) {
    var p = this.player;
    if (p.active && !again) return false;
    if (p.active) { this.endHi(); var sp = this.nearestOpen(SPAWN[0], SPAWN[1]); p.x = sp[0] + 0.5; p.y = sp[1] + 0.5; p.path = []; p.face = 'down'; }
    p.active = true; this.emit('spawn', p);
    return true;
  };
  officeSim.prototype.stepPlayer = function (dt) {
    var p = this.player, k = this.keys;
    if (!p.active) return;
    var vx = (k.right ? 1 : 0) - (k.left ? 1 : 0), vy = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    // A rotated 3D view turns the keys with it, so W always walks up the screen (inputTurn is set by office3d.js).
    if (this.inputTurn) {
      var c = Math.round(Math.cos(this.inputTurn)), sn = Math.round(Math.sin(this.inputTurn)), rx = vx * c - vy * sn;
      vy = vx * sn + vy * c; vx = rx;
    }
    if (vx || vy) {
      p.path = [];
      var n = Math.hypot(vx, vy), s = PLAYER_SPEED * dt;
      var nx = p.x + vx / n * s, ny = p.y + vy / n * s;
      if (this.clear(nx, p.y)) p.x = nx;
      if (this.clear(p.x, ny)) p.y = ny;
      p.face = Math.abs(vx) >= Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up');
      p.mode = 'walk';
    } else if (follow(p, PLAYER_SPEED, dt)) {
      p.mode = 'walk';
    } else {
      p.mode = 'stand';
    }
    var b = p.hiWith;
    if (b) {
      if (this.t > p.hiUntil || Math.hypot(b.x - p.x, b.y - p.y) > REACH + 1) this.endHi();
      else {
        var mine = Math.floor((this.t - p.hiSince) / 1.1) % 2 === 0;
        p.bubble = mine; b.bubble = !mine;
        if (p.mode === 'stand') p.face = faceTo(p, b);
        if (b.mode !== 'sit') b.face = faceTo(b, p);
      }
    }
  };
  // The closest agent within reach of the visitor's character.
  officeSim.prototype.nearby = function () {
    var p = this.player, best = null, bd = REACH;
    if (!p.active) return null;
    this.agents.forEach(function (a) {
      var d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bd) { bd = d; best = a; }
    });
    return best;
  };
  // Agents already talking to another agent finish that first.
  officeSim.prototype.canChat = function (b) { return !!b && (b.withPlayer || (b.mode !== 'talk' && !b.busy)); };
  officeSim.prototype.sayHi = function () {
    var p = this.player, b = this.nearby();
    if (!b || p.hiWith || !this.canChat(b)) return null;
    p.hiWith = b; p.hiSince = this.t; p.hiUntil = this.t + HI_S;
    b.busy = true; b.withPlayer = true; b.face = faceTo(b, p);
    if (b.mode === 'stand') b.until = Math.max(b.until, p.hiUntil);
    this.emit('hi', p, b);
    return b;
  };
  officeSim.prototype.endHi = function () {
    var p = this.player, b = p.hiWith;
    if (!b) return;
    p.bubble = false; b.bubble = false; b.busy = false; b.withPlayer = false; p.hiWith = null;
  };
  officeSim.prototype.walkPlayerTo = function (tx, ty) {
    var o = this.nearestOpen(tx, ty), p = this.player;
    var path = this.find(Math.floor(p.x), Math.floor(p.y), o[0], o[1]);
    if (path) p.path = path;
  };

  // ---- 2D view (flat map, or tilted like a diorama) ----
  function mapView(sim, el, opts) {
    opts = opts || {};
    this.sim = sim; this.el = el;
    el.classList.add('ap-view');
    if (opts.tilt) el.classList.add('tilt');
    var map = document.createElement('div'); map.className = 'ap-map';
    map.style.backgroundImage = 'url(' + BASE + 'map/background.png)';
    el.appendChild(map);
    this.map = map;
    this.actors = sim.all.map(function (a) {
      var n = document.createElement('div'); n.className = 'ap-actor' + (a.isPlayer ? ' me' : '');
      n.style.setProperty('--c', a.c);
      n.style.width = (48 / MAP_W * 100) + '%';
      n.innerHTML = '<span class="ap-ring"></span><span class="ap-sp" style="background-image:url(' + BASE + 'characters48/' + a.skin + '.png)"></span>' +
        '<span class="ap-tag">' + (a.label || a.id) + '</span><span class="ap-bubble" aria-hidden="true"><i></i></span>';
      map.appendChild(n);
      return { el: n, sp: n.children[1], bb: n.children[3] };
    });
    var size = function () { el.style.setProperty('--tag', Math.max(9, Math.min(13, el.clientWidth / 95)) + 'px'); };
    size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(el); else addEventListener('resize', size);
  }
  mapView.prototype.setTilt = function (on) { this.el.classList.toggle('tilt', on); };
  mapView.prototype.tilted = function () { return this.el.classList.contains('tilt'); };
  // Tile under a click, in the flat view only.
  mapView.prototype.tileAt = function (clientX, clientY) {
    if (this.tilted()) return null;
    var r = this.map.getBoundingClientRect();
    var x = (clientX - r.left) / r.width, y = (clientY - r.top) / r.height;
    if (x < 0 || y < 0 || x >= 1 || y >= 1) return null;
    return [Math.floor(x * COLS), Math.floor(y * ROWS)];
  };
  mapView.prototype.draw = function (t) {
    var all = this.sim.all, rowFor = { down: 0, left: 1, right: 1, up: 2 };
    for (var i = 0; i < all.length; i++) {
      var a = all[i], o = this.actors[i];
      var fx = a.x * TILE, fy = a.y * TILE + 10;
      o.el.style.left = ((fx - 24) / MAP_W * 100) + '%';
      o.el.style.top = ((fy - 71) / MAP_H * 100) + '%';
      o.el.style.zIndex = Math.round(fy);
      if (a.isPlayer) o.el.hidden = !a.active;
      var col = 0, row = 0, flip = a.face === 'right';
      o.el.classList.toggle('lift', a.mode === 'talk' || !!a.hiWith);
      if (a.mode === 'walk' && !a.withPlayer) { col = Math.floor(t * 8) % 4; row = rowFor[a.face]; }
      else if (a.mode === 'sit') { row = 3; col = a.face === 'down' ? 0 : a.face === 'up' ? 2 : 1; }
      else if (a.mode === 'stand' && !a.isPlayer && !a.withPlayer) { row = 4; col = 2 + Math.floor(t * 1.5 + i) % 2; flip = false; }
      else { row = rowFor[a.face]; col = 0; }
      o.sp.style.backgroundPosition = (col / 3 * 100) + '% ' + (row / 4 * 100) + '%';
      o.sp.style.transform = flip ? 'scaleX(-1)' : '';
      o.bb.classList.toggle('on', a.bubble);
    }
  };

  // Keyboard (WASD / arrows to walk, E to say hi) and click-to-walk on the flat map.
  function controls(sim, view) {
    var map = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    addEventListener('keydown', function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var dir = map[e.code];
      if (dir) { sim.keys[dir] = true; sim.spawn(); e.preventDefault(); }
      else if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E' || e.code === 'Space') { if (sim.sayHi() || e.code === 'Space') e.preventDefault(); }
    });
    addEventListener('keyup', function (e) { var dir = map[e.code]; if (dir) sim.keys[dir] = false; });
    addEventListener('blur', function () { sim.keys = {}; });
    view.el.addEventListener('click', function (e) {
      var tile = view.tileAt(e.clientX, e.clientY);
      if (!tile) return;
      sim.spawn(); // the first click on the floor walks you in
      var b = sim.nearby();
      sim.walkPlayerTo(tile[0], tile[1]);
      if (b && Math.floor(b.x) === tile[0] && Math.floor(b.y) === tile[1]) sim.sayHi();
    });
  }

  function start() {
    return Promise.all([
      loadImage(BASE + 'map/collision.png'),
      fetch(BASE + 'map/seats.json').then(function (r) { return r.json(); })
    ]).then(function (res) {
      var img = res[0], cv = document.createElement('canvas'); cv.width = COLS; cv.height = ROWS;
      var g = cv.getContext('2d'); g.drawImage(img, 0, 0);
      var px = g.getImageData(0, 0, COLS, ROWS).data, walk = new Uint8Array(COLS * ROWS);
      for (var i = 0; i < COLS * ROWS; i++) walk[i] = (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) > 180 ? 1 : 0;
      var seats = {}; res[1].forEach(function (s) { seats[s.id] = { id: s.id, x: s.seat.x, y: s.seat.y, face: s.face, extras: s.extras || [] }; walk[s.seat.y * COLS + s.seat.x] = 1; });
      var sim = new officeSim(walk, seats), views = [];
      return {
        sim: sim,
        view: function (el, opts) { var v = new mapView(sim, el, opts); views.push(v); v.draw(0); return v; },
        addView: function (v) { views.push(v); }, // any object with draw(t), e.g. the 3D view in office3d.js
        controls: function (view) { controls(sim, view); },
        run: function () {
          var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduce) {
            // Agents hold still in one moment (Segfault at Flexbox's desk); only the visitor's character moves.
            var a = sim.agents[3], b = sim.agents[4], s = b.home;
            a.x = s.x - 0.5; a.y = s.y + 1.5; a.mode = 'talk'; a.face = 'right'; a.bubble = true; a.partner = b; a.until = Infinity; b.busy = true; b.partner = a;
          } else {
            sim.plan(); sim.plan();
          }
          var last = performance.now(), next = 1.2;
          var loop = function (now) {
            var dt = Math.min(0.05, (now - last) / 1000); last = now;
            sim.step(dt);
            if (!reduce && sim.t > next) { sim.plan(); next = sim.t + 1.4 + Math.random() * 2.2; }
            views.forEach(function (v) { v.draw(sim.t); });
            requestAnimationFrame(loop);
          };
          requestAnimationFrame(loop);
        }
      };
    });
  }

  window.AgentParty = { start: start };
})();
