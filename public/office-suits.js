import './avatars.js';
// Agent Office – the Pearson Specter office. Background plate + the cast sprites in /assets/suits:
//   stand/<id>.png  standing, facing us (canvas 480x720 at source scale, figure 600 px, feet at y=660)
//   walk/<id>-a|b   the two steps of a walk cycle, same canvas and baseline
//   seat/<id>.png   seated from behind (canvas 400x420, figure y 30..390, hips at the bottom)
//   front/*.png     Harvey and Donna seated facing us (canvas 600x600, figure y 100..500)
// Working: seated at the desk, back to us, the real chair backrest from the plate drawn over the lower back.
// Idle, waiting or done: standing beside the chair, facing us. Blocked: walks to Harvey and sits on a bench.
// Exposes the window.OfficeGame API the page uses.
const W = 2172, H = 724, ART = '/assets/suits/';
const VB = [30, 62, 2112, 628];   // crop the empty margins around the floor plate
const CAST = ['alex', 'ava', 'benjamin', 'donna', 'edith', 'esther', 'gallo', 'gretchen', 'hardman', 'harold', 'harvey', 'jenny', 'jessica', 'katrina', 'kyle', 'logan', 'louis', 'marcus', 'mike', 'moore', 'norma', 'oliver', 'rachel', 'robert', 'samantha', 'scottie', 'sheila', 'soloff', 'stu', 'tanner', 'tara', 'trevor'];
const MAIN = ['harvey', 'donna', 'mike', 'rachel', 'louis'];
const COLS = [541, 729, 918, 1102, 1286, 1472, 1656, 1842];
const BACK = [288, 409, 529];      // top edge of the chair backrest in each desk row
const STAND = 98;                  // standing height in plate units: the chair back (50 units off the floor) reaches the waist
const KS = STAND / 600;            // stand/walk source scale (600 px figure)
const KSEAT = .158;                // seat/ source scale (360 px from crown to hips)
const KFRONT = .168;                // front/ source scale (Harvey, Donna)
const SEAT_TOP = -27;              // a seated head starts this far above the backrest top
const AISLE = 432;                 // corridor between Harvey's office and the desks
// Harvey's two benches face his desk; a visitor sits on one with their back to us. x/y = hips, approach = where they walk in.
const BENCHES = [{ x: 181, y: 418 }, { x: 330, y: 418 }];
const BENCH_APPROACH = 462;
const VISIT = [[424, 374], [428, 408], [446, 344]];   // standing room once both benches are taken
const HARVEY = { x: 261, clip: 300, top: 245 }, DONNA = { x: 199, clip: 533, top: 467, cover: [165, 504, 50, 30] };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const STYLE = `
.so{position:relative;width:100%;aspect-ratio:${VB[2]}/${VB[3]};user-select:none;-webkit-user-select:none}
.so svg{position:absolute;inset:0;width:100%;height:100%;display:block;overflow:visible}
.so .pp{cursor:pointer;transition-property:transform;transition-timing-function:linear}
.so .pp:focus{outline:none}
.so .bob{transform-box:fill-box;transform-origin:50% 100%}
/* standing ↔ walking ↔ sitting on a bench */
.so .walkv,.so .bench{display:none}
.so .pp.walking .still{display:none}.so .pp.walking .walkv{display:inline}
.so .pp.lounge .still,.so .pp.lounge .walkv,.so .pp.lounge .shadow{display:none}.so .pp.lounge .bench{display:inline}
.so .pp.lounge .bubs{transform:translateY(${STAND + 10 - (390 - 30) * KSEAT - 12}px)}
.so .wa{animation:so-stepA .5s steps(1,end) infinite}.so .wb{animation:so-stepB .5s steps(1,end) infinite}
@keyframes so-stepA{0%{opacity:1}50%{opacity:0}}@keyframes so-stepB{0%{opacity:0}50%{opacity:1}}
.so .pp.walking .walkv{transform-box:fill-box;transform-origin:50% 100%;animation:so-walk .25s ease-in-out infinite alternate}
@keyframes so-walk{from{transform:translateY(0)}to{transform:translateY(-1.6px)}}
.so .pp.left .walkv image{transform:scaleX(-1);transform-box:fill-box;transform-origin:50% 50%}
.so .pp.standing:not(.walking) .still{animation:so-idle 4.5s ease-in-out var(--d,0s) infinite}
@keyframes so-idle{0%,100%{transform:none}50%{transform:scaleY(1.01) translateY(-.4px)}}
.so .pp.stood .still{animation:so-up .35s ease-out}
@keyframes so-up{from{transform:translateY(6px) scaleY(.94)}}
/* seated at a desk / on a bench: a slow breathing sway and a small typing bob */
.so .pp.sitting .bob,.so .pp.lounge .bench .bob{animation:so-idle 5s ease-in-out var(--d,0s) infinite}
.so .pp.sitting.working .bob{animation:so-type .9s ease-in-out infinite}
@keyframes so-type{0%,100%{transform:none}50%{transform:translateY(-.8px) rotate(.4deg)}}
/* Harvey and Donna: one picture per mood */
.so .bust .v{display:none}.so .bust .v-idle{display:inline}
.so .bust.working .v-type{display:inline}.so .bust.working .v-idle{display:none}
.so .bust.ask .v-ask{display:inline}.so .bust.ask .v-idle{display:none}
.so .bust .bob{transform-box:fill-box;transform-origin:50% 100%;animation:so-idle 5s ease-in-out infinite}
.so .bust.working .bob{animation:so-type 1.1s ease-in-out infinite}
.so .bub{display:none}.so .b-dots .bub.dots,.so .b-ask .bub.ask,.so .b-bad .bub.bad,.so .b-ok .bub.ok{display:inline;animation:so-hop 1.4s ease-in-out infinite}
@keyframes so-hop{50%{transform:translateY(-2.5px)}}
.so .bub.dots circle{animation:so-dot 1.2s ease-in-out infinite}.so .bub.dots .d2{animation-delay:.2s}.so .bub.dots .d3{animation-delay:.4s}
@keyframes so-dot{0%,100%{opacity:.3}50%{opacity:1}}
.so .tag{opacity:0;pointer-events:none} /* invisible anchor: the visible name tag is the frosted-glass .so-tip above the scene */
.so .pp:hover image,.so .bust:hover image{filter:brightness(1.07)}
.so .more{cursor:pointer}
@media(prefers-reduced-motion:reduce){.so *{animation:none!important;transition:none!important}}
`;

const bubbles = (y) => `<g transform="translate(0 ${y})">
  <g class="bub dots"><rect x="-14" y="-10" width="28" height="18" rx="9" fill="#fff" stroke="#0002"/><circle class="d1" cx="-6" cy="-1" r="2.1" fill="#555b66"/><circle class="d2" cx="0" cy="-1" r="2.1" fill="#555b66"/><circle class="d3" cx="6" cy="-1" r="2.1" fill="#555b66"/></g>
  <g class="bub ask"><circle r="10.5" fill="#f5b83d" stroke="#0002"/><text y="5.2" text-anchor="middle" font-size="15" font-weight="800" fill="#2b1d05" font-family="system-ui">?</text></g>
  <g class="bub bad"><circle r="10.5" fill="#ef4444" stroke="#0002"/><text y="5.2" text-anchor="middle" font-size="15" font-weight="800" fill="#fff" font-family="system-ui">!</text></g>
  <g class="bub ok"><circle r="10.5" fill="#22c55e" stroke="#0002"/><path d="M-4.8 0 l3.2 3.6 6.4 -7.2" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g></g>`;
const tag = (text, y) => { const w = text.length * 7.2 + 18; return `<g class="tag" transform="translate(0 ${y})"><rect class="tag-bg" x="${-w / 2}" y="-11" width="${w}" height="20" rx="10"/><text class="tag-tx" y="3.8" text-anchor="middle" font-size="11.5" font-weight="600" font-family="-apple-system,system-ui,sans-serif">${esc(text)}</text></g>`; };

// Seated from behind, hips at the origin (used on benches) or shifted so the head clears a desk chair backrest.
const seatImage = (ch, dy) => `<image href="${ART}seat/${ch}.png" x="${-200 * KSEAT}" y="${dy - 30 * KSEAT}" width="${400 * KSEAT}" height="${420 * KSEAT}"/>`;
// At a desk: origin = top edge of the chair backrest; the plate's backrest is drawn over the body afterwards.
function seatView(id, ch) {
  return `<g class="seat"><clipPath id="sc-${id}"><rect x="-40" y="-60" width="80" height="78"/></clipPath>
    <g clip-path="url(#sc-${id})"><g class="bob">${seatImage(ch, SEAT_TOP)}</g></g></g>`;
}
// Standing, facing us. Origin = feet. Walking swaps two drawn steps; on a bench the seated picture is shown instead.
function standView(id, ch) {
  const img = (file, cls = '') => `<image class="${cls}" href="${ART}${file}.png" x="${-240 * KS}" y="${-660 * KS}" width="${480 * KS}" height="${720 * KS}"/>`;
  return `<ellipse class="shadow" cx="0" cy="0" rx="${STAND * .17}" ry="4" fill="#0b1020" opacity=".2"/>
    <g class="still bob">${img(`stand/${ch}`)}</g>
    <g class="walkv">${img(`walk/${ch}-a`, 'wa')}${img(`walk/${ch}-b`, 'wb')}</g>
    <g class="bench"><g class="bob">${seatImage(ch, -(390 - 30) * KSEAT)}</g></g>`;
}
// Harvey and Donna, seated behind their desks facing us; the desk edge hides everything below the chest.
function bust(id, ch, spot, name, role) {
  const { x, clip, top } = spot, k = KFRONT, ix = x - 300 * k, iy = top - 100 * k;
  const pic = (file, v) => `<image class="v ${v}" href="${ART}front/${file}.png" x="${ix}" y="${iy}" width="${600 * k}" height="${600 * k}"/>`;
  const pics = ch === 'harvey' ? pic('harvey', 'v-idle') + pic('harvey-ask', 'v-ask') + pic('harvey-type', 'v-type') : pic('donna', 'v-idle') + pic('donna-type', 'v-type') + pic('donna', 'v-ask');
  return `<g class="bust idle" data-role="${esc(role || '')}" data-id="${esc(id)}" ${role ? 'tabindex="0" role="button"' : ''} aria-label="${esc(name)}">
    <clipPath id="clip-${id}"><rect x="${x - 60}" y="${top - 40}" width="120" height="${clip - top + 40}"/></clipPath>
    <ellipse cx="${x + 4}" cy="${top + 22}" rx="16" ry="12" fill="#000" opacity=".25" filter="url(#soft)"/>
    <g clip-path="url(#clip-${id})"><g class="bob">${pics}</g></g>
    ${spot.cover ? `<clipPath id="cov-${id}"><rect x="${spot.cover[0]}" y="${spot.cover[1]}" width="${spot.cover[2]}" height="${spot.cover[3]}" rx="2"/></clipPath><image href="${ART}office.png" width="${W}" height="${H}" clip-path="url(#cov-${id})" style="pointer-events:none"/>` : ''}
    <g transform="translate(${x} ${top})">${bubbles(-14)}${tag(name, -14)}</g></g>`;
}

function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

class Office {
  constructor(el) {
    if (!document.getElementById('so-style')) { const s = document.createElement('style'); s.id = 'so-style'; s.textContent = STYLE; document.head.append(s); }
    this.el = el; el.replaceChildren(); this.root = document.createElement('div'); this.root.className = 'so'; el.append(this.root);
    this.team = []; this.state = { agents: {}, inbox: [] }; this.nodes = new Map();
    this.root.addEventListener('keydown', (e) => { const p = e.target.closest?.('[data-role]'); if (p && p.dataset.role && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); window.openAgent?.(p.dataset.role); } });
    this.root.addEventListener('click', (e) => { if (e.target.closest('.more')) { e.stopPropagation(); window.setStageView?.('team'); } });
    // name tag: an HTML pill over the scene (SVG cannot blur what is behind it), placed at the agent's hidden SVG anchor
    el.style.position = 'relative'; this.tip = document.createElement('div'); this.tip.className = 'so-tip'; this.tip.setAttribute('aria-hidden', 'true'); el.append(this.tip);
    const show = (g) => {
      const anchor = g?.querySelector('.tag'); if (!anchor) return this.tip.classList.remove('on');
      const r = el.getBoundingClientRect(), a = anchor.getBoundingClientRect();
      let top, cx;
      if (g.classList.contains('bust')) { top = a.top; cx = a.left + a.width / 2; } // Harvey and Donna: their anchor sits just above the head
      else { // desk agents: just above the highest visible picture of the person (bubbles and the anchor do not count)
        const pics = [...g.querySelectorAll('image')].filter((im) => !im.closest('.tag,.bubs') && im.getBoundingClientRect().height > 0).map((im) => im.getBoundingClientRect());
        top = pics.length ? Math.min(...pics.map((x) => x.top)) : a.top; cx = pics.length ? (Math.min(...pics.map((x) => x.left)) + Math.max(...pics.map((x) => x.right))) / 2 : a.left + a.width / 2;
      }
      this.tipG = g; this.tip.textContent = this.doing(g); this.tip.classList.add('on');
      const h = this.tip.offsetHeight || 24, w = this.tip.offsetWidth || 80;
      const y = Math.max(top - r.top - 4, h + 4), x = Math.min(Math.max(cx - r.left, w / 2 + 4), r.width - w / 2 - 4); // never cut off by the scene's edges
      this.tip.style.left = `${x}px`; this.tip.style.top = `${y}px`;
    };
    this.root.addEventListener('pointerover', (e) => show(e.target.closest?.('.pp,.bust')));
    this.root.addEventListener('pointerout', (e) => { const g = e.target.closest?.('.pp,.bust'); if (g && !g.contains(e.relatedTarget)) this.tip.classList.remove('on'); });
    this.root.addEventListener('focusin', (e) => show(e.target.closest?.('.pp,.bust')));
    this.root.addEventListener('focusout', () => this.tip.classList.remove('on'));
  }
  /** What this person is doing right now, short and readable (shown on hover instead of the name). */
  doing(g) {
    const cs = window.AO_I18N?.lang === 'cs', L = (c, e) => (cs ? c : e);
    const id = g.dataset.id === 'boss' ? 'boss' : g.dataset.id === 'donna' ? this.donnaId : g.dataset.role || g.dataset.id;
    const st = this.state || {}, a = (id && st.agents?.[id]) || {};
    if (g.dataset.id === 'boss' && st.inbox?.some((q) => q.answer === null)) return L('Čeká na tvou odpověď', 'Waiting for your answer');
    if (g.dataset.id === 'donna' && !this.donnaId) return L('Recepce · drží kancelář v chodu', 'Front desk · keeps the office running');
    const clean = (t) => String(t || '').replace(/~?\/(?:[^\/,\n]+\/)+([^\/,\n]+)/g, '$1').replace(/^(Spouští|spouští|příkaz|Příkaz):\s.*/, L('spouští příkaz', 'running a command')).replace(/^Upravuje:\s*/, L('upravuje ', 'editing ')).replace(/\s+/g, ' ').trim();
    const t = clean(a.activity);
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const clip = (x) => (x.length > 46 ? x.slice(0, 45).trimEnd() + '…' : x);
    if (a.status === 'working') return clip(cap(t || L('Pracuje', 'Working')));
    if (a.status === 'waiting') return L('Čeká na kolegy', 'Waiting for teammates');
    if (a.status === 'blocked') return L('Zablokováno', 'Blocked');
    if (a.status === 'done') return L('Hotovo', 'Done');
    return t ? clip(cap(t)) : L('Volno', 'Free');
  }
  setTeam(agents) {
    const sig = agents.map((a) => a.id + a.char + a.name).join(); if (sig === this.sig) return; this.sig = sig; this.team = agents.filter((a) => a.id !== 'boss'); this.build();
  }
  build() {
    const nm = (ch, fallback) => window.OfficeAvatars?.name(ch, fallback) || fallback;
    const donnaAgent = this.team.find((a) => a.char === 'donna');
    const staff = this.team.filter((a) => a !== donnaAgent), used = new Set(['harvey', 'donna']);
    const seats = []; BACK.forEach((b, r) => COLS.forEach((c) => seats.push({ x: c + 4, back: b, row: r })));
    const pool = CAST.filter((k) => !MAIN.includes(k));
    const shown = staff.length > seats.length ? staff.slice(0, seats.length - 1) : staff, hidden = staff.length - shown.length;
    this.people = shown.map((a, i) => {
      let ch = CAST.includes(a.char) && a.char !== 'harvey' && a.char !== 'donna' ? a.char : null;
      if (!ch || used.has(ch)) ch = pool.find((s) => !used.has(s)) || pool[hash(a.id) % pool.length];
      used.add(ch);
      const s = seats[i];
      return { id: a.id, ch, name: nm(a.char, a.name), seat: s, stand: [s.x + 30, s.back + 52], i };
    });
    const chairs = this.people.map((p) => `<clipPath id="ch-${p.id}"><rect x="${p.seat.x - 17}" y="${p.seat.back}" width="34" height="29" rx="3.5"/></clipPath>`).join('');
    const people = this.people.map((p) => `<g class="pp standing idle" data-role="${esc(p.id)}" tabindex="0" role="button" aria-label="${esc(p.name)}" style="--d:-${(p.i * 1.3).toFixed(1)}s;transform:translate(${p.stand[0]}px,${p.stand[1]}px)">
        ${standView(p.id, p.ch)}<g class="bubs">${bubbles(-STAND - 10)}</g>${tag(p.name, 13)}</g>`).join('');
    // Seated figures live in their own layer: body first, then the real chair backrest from the plate on top.
    const seated = this.people.map((p) => `<g class="pp sitting" data-seat="${esc(p.id)}" data-role="${esc(p.id)}" style="--d:-${(p.i * 1.3).toFixed(1)}s;display:none;transform:translate(${p.seat.x}px,${p.seat.back}px)">${seatView(p.id, p.ch)}${bubbles(SEAT_TOP - 12)}${tag(p.name, 46)}</g>
        <image class="chairback" data-seat="${esc(p.id)}" href="${ART}office.png" width="${W}" height="${H}" clip-path="url(#ch-${p.id})" style="display:none;pointer-events:none"/>`).join('');
    const more = hidden > 0 ? `<g class="more" transform="translate(${COLS[7]} ${BACK[2] + 30})" role="button" aria-label="Zobrazit celý tým"><rect class="more-bg" x="-26" y="-14" width="52" height="26" rx="13"/><text class="more-tx" y="5" text-anchor="middle" font-size="13" font-weight="700" font-family="-apple-system,system-ui,sans-serif">+${hidden}</text></g>` : '';
    this.root.innerHTML = `<svg viewBox="${VB.join(' ')}" role="img" aria-label="Kancelář týmu"><defs>${chairs}<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter></defs>
      <image href="${ART}office.png" width="${W}" height="${H}"/>
      ${bust('boss', 'harvey', HARVEY, nm('harvey', 'Harvey Specter') + ' · šéf', 'boss')}
      ${bust('donna', 'donna', DONNA, nm('donna', 'Donna Paulsen') + (donnaAgent ? '' : ' · asistentka'), donnaAgent?.id)}
      <g class="seated">${seated}</g><g class="people">${people}</g>${more}</svg>`;
    this.nodes = new Map(this.people.map((p) => [p.id, { ...p, el: this.root.querySelector(`.people .pp[data-role="${CSS.escape(p.id)}"]`),
      seatEl: this.root.querySelector(`.seated .pp[data-seat="${CSS.escape(p.id)}"]`), chair: this.root.querySelector(`.chairback[data-seat="${CSS.escape(p.id)}"]`), mode: 'stand', at: [...p.stand] }]));
    this.donnaId = donnaAgent?.id;
    this.update(this.state, true);
  }
  sit(n, on, cls) {
    n.seatEl.style.display = on ? '' : 'none'; n.chair.style.display = on ? '' : 'none'; n.el.style.display = on ? 'none' : '';
    if (on) n.seatEl.setAttribute('class', `pp sitting ${cls}`);
  }
  setClass(n, cls) { n.el.setAttribute('class', `pp standing ${cls}${n.left ? ' left' : ''}`); }
  walk(n, points, done) {
    clearTimeout(n.timer); n.token = (n.token || 0) + 1; const token = n.token;
    const step = () => {
      if (token !== n.token) return;
      const p = points.shift(); if (!p) { done?.(); return; }
      const dx = p[0] - n.at[0], d = Math.hypot(dx, p[1] - n.at[1]); n.at = p;
      if (Math.abs(dx) > 2) { n.left = dx < 0; n.el.classList.toggle('left', n.left); }
      n.el.style.transitionDuration = `${Math.max(.05, d / 120)}s`;
      n.el.style.transform = `translate(${p[0]}px,${p[1]}px)`;
      if (d < 1) step(); else n.timer = setTimeout(step, d / 120 * 1000 + 40);
    };
    step();
  }
  jump(n, p) { clearTimeout(n.timer); n.token = (n.token || 0) + 1; n.at = p; n.el.style.transitionDuration = '0s'; n.el.style.transform = `translate(${p[0]}px,${p[1]}px)`; }
  update(state, instant) {
    this.state = state || this.state;
    if (this.tipG && this.tip?.classList.contains('on')) this.tip.textContent = this.doing(this.tipG); // live while hovered
    const st = this.state, ask = !!st.inbox?.some((q) => q.answer === null);
    const bs = st.agents?.boss?.status;
    this.root.querySelector('.bust[data-id="boss"]')?.setAttribute('class', `bust ${ask ? 'ask b-ask' : bs === 'working' ? 'working b-dots' : 'idle'}`);
    const ds = this.donnaId ? st.agents?.[this.donnaId]?.status : 'idle';
    this.root.querySelector('.bust[data-id="donna"]')?.setAttribute('class', `bust ${ds === 'working' ? 'working b-dots' : ds === 'waiting' ? 'b-ask' : ds === 'blocked' ? 'b-bad' : ds === 'done' ? 'b-ok' : 'idle'}`);
    let visit = 0;
    for (const n of this.nodes.values()) {
      const s = st.agents?.[n.id]?.status || 'idle', aisleY = n.seat.back + 70;
      const bub = s === 'waiting' ? 'b-ask' : s === 'done' ? 'b-ok' : '';
      if (s === 'blocked') {                                   // needs Harvey: walk to his office, sit on a free bench
        const k = visit++, bench = BENCHES[k], spot = bench ? `bench${k}` : String(VISIT[(k - BENCHES.length) % VISIT.length]);
        if (n.mode === 'sit') { this.sit(n, false); this.jump(n, n.stand); }
        if (n.mode !== 'visit' || n.spot !== spot) {
          n.mode = 'visit'; n.spot = spot; n.bench = undefined;
          const settle = () => { if (bench) { this.jump(n, [bench.x, bench.y]); n.bench = k; this.setClass(n, 'lounge b-bad'); } else this.setClass(n, 'b-bad'); };
          const end = bench ? [bench.x, BENCH_APPROACH] : VISIT[(k - BENCHES.length) % VISIT.length];
          if (instant) { this.jump(n, end); settle(); }
          else { this.setClass(n, 'walking b-bad'); this.walk(n, [[n.at[0], aisleY], [AISLE, aisleY], [AISLE, end[1]], end], settle); }
        }
        continue;
      }
      if (n.mode === 'visit' || n.mode === 'back') {          // came back from Harvey
        if (n.mode === 'visit') {
          n.mode = 'back'; const from = n.bench !== undefined ? [BENCHES[n.bench].x, BENCH_APPROACH] : n.at; n.bench = undefined;
          this.jump(n, from); this.setClass(n, 'walking');
          this.walk(n, [[AISLE, from[1]], [AISLE, aisleY], [n.stand[0], aisleY], n.stand], () => { n.mode = 'stand'; n.left = false; this.update(); });
        }
        continue;
      }
      if (s === 'working') {
        if (n.mode !== 'sit') { n.mode = 'sit'; this.jump(n, n.stand); }
        this.sit(n, true, 'working b-dots');
        continue;
      }
      // idle, waiting, done: standing next to the chair, facing us
      const wasSitting = n.mode === 'sit';
      if (wasSitting) { this.sit(n, false); n.mode = 'stand'; this.jump(n, n.stand); }
      this.setClass(n, `${bub}${wasSitting && !instant ? ' stood' : ''}`);
    }
  }
}

let office = null;
const mount = () => { const el = document.getElementById('scene'); if (!el) return null; if (!office || office.el !== el) office = new Office(el); return office; };
window.OfficeGame = { office(agents) { mount()?.setTeam(agents || []); }, update(state) { mount()?.update(state); }, view() {}, outputs() {}, zoom() {}, nextTeam() {}, hall() {} };
document.dispatchEvent(new Event('office-game-ready'));
