/* Движок ценников: шрифт → вёрстка → цвет → SVG / PDF. Без внешних библиотек. */
(function (root) {
'use strict';
const MM = 72 / 25.4;

/* ───── Размеры, снятые с шаблона «ценники на новую точку.pdf» ───── */
const SPEC = {
  w: 77, h: 55, r: 2.8, shape: 'round', pad: 5,   // мм: карточка, радиус и форма углов, отступ со всех сторон
  compMid: 28.06,                        // мм: середина блока состава (в шаблоне одинакова для 1–6 строк)
  price: 48, comp: 6, lead: 6.685 / 6,   // pt: цена, состав, интерлиньяж состава (доля кегля)
  titleMax: 50, titleMin: 11,            // pt: границы автоподбора названия
  gapX: 6.5, gapY: 3.7, denseX: 4.8, denseY: 3, margin: 4.5   // мм: зазоры на листе и поле принтера
};
const PAPER = { A4: [210, 297], A5: [148, 210] };

/* ───── Категории ─────
   tier: 0 — питание (важнее всего), 1 — особые, 2 — вкус, 3 — вид десерта. «!слово» отменяет категорию.
   Розовый, бирюзовый, коричневый, графит, зелёный и красный взяты из шаблона. */
const CATS = [
  { id: 'pp', tier: 0, name: 'ПП, протеин, без сахара', c1: '#D4527E', c2: '#A52A6C', kw: 'пп, без сахара, без рафинир, эритрит, стеви, сахарозамен, протеин, фитнес, низкокалор, диетич' },
  { id: 'vegan', tier: 0, name: 'Веган, постное, овощное', c1: '#4F8879', c2: '#1F5A58', kw: 'веган, постн, шпинат, без глютена, безглютен, без лактозы, безлактоз' },
  { id: 'food', tier: 1, name: 'Напитки и еда', c1: '#616A6E', c2: '#333C42', kw: 'напиток, вода, сок, тоник, лимонад, морс, чай, кофе в, дрип, энергетич, сендвич, сэндвич, поке, салат, сырник, ролл, !зефир, !торт' },
  { id: 'season', tier: 1, name: 'Сезонное и праздничное', c1: '#4A4FA8', c2: '#7A2E6B', kw: 'сезон, тыкв, рождеств, новогод, имбир, пряник, пряное, кулич, пасх, глинтвейн, штоллен' },
  { id: 'berry', tier: 2, name: 'Ягодные', c1: '#E3193A', c2: '#8E1246', kw: 'малин, клубни, вишн, черник, голубик, смородин, ежевик, клюкв, брусник, ягод, красный бархат' },
  { id: 'fruit', tier: 2, name: 'Фрукты и цитрус', c1: '#E0781A', c2: '#B8480F', kw: 'лимон, апельсин, мандарин, юдзу, манго, маракуй, банан, яблок, яблоч, груш, персик, абрикос, ананас, кокос, цитрус, фрукт' },
  { id: 'pist', tier: 2, name: 'Фисташка, матча, мята', c1: '#6E9A36', c2: '#2F7350', kw: 'фисташ, матча, мята, мятн, лайм, базилик' },
  { id: 'choco', tier: 2, name: 'Шоколад и кофе', c1: '#5A3325', c2: '#2C1916', kw: 'шокол, choco, какао, брауни, трюфел, прага, кофе, кофейн, мокко, эспрессо, тирамису, орео, картошка' },
  { id: 'nut', tier: 2, name: 'Орех, карамель, мёд', c1: '#96511F', c2: '#5E2C0E', kw: 'карамел, орех, фундук, миндал, арахис, пекан, кешью, пралине, сникерс, медов, мед, сгущ, ириск' },
  { id: 'lav', tier: 2, name: 'Лаванда, зефир, моти', c1: '#9A7BD0', c2: '#5F62BE', kw: 'лаванд, зефир, безе, меренг, макарон, павлов, маршмел, моти' },
  { id: 'cake', tier: 3, name: 'Торты, чизкейки, трайфлы', c1: '#815C57', c2: '#4E3233', kw: 'торт, чизкейк, трайфл, сан-себастьян, сан себастьян, сансебастьян, муравейник, наполеон, мусс, суфле, творожн' },
  { id: 'bake', tier: 3, name: 'Выпечка, печенье, эклеры', c1: '#65B0B8', c2: '#2B7288', kw: 'синнабон, булоч, круассан, слойк, эклер, кекс, печенье, кукис, cookies, пирожн, рулет, маффин, вафл, донат' },
  { id: 'classic', tier: 9, name: 'Остальное', c1: '#42494C', c2: '#22282C', kw: '' }
];
const STYLES = [
  ['mesh', 'Перелив'], ['flat', 'Сплошной'], ['diag', 'Диагональ'], ['vert', 'Закат'], ['glow', 'Сияние'], ['duo', 'Дуэт вкусов']
];

/* ───── Готовые переливы: [цвет, x, y, сила] ───── «Луг» снят с присланной картинки ───── */
const PRESETS = [
  ['Луг', 'flow', 1.5, .1, [['#175226', .5, 0, 1.1], ['#4ED682', .5, .38, .7], ['#E7FFE9', 0, .3, 1], ['#9CFCB5', .4, .75, .9], ['#F1FEEA', 1, 0, .9], ['#E3EE90', .72, .75, .7], ['#FED353', .78, 1, .7], ['#FF5F28', 1, 1, 1]]],
  ['Малина', 'flow', 1.4, .4, [['#FF4D8D', .05, .1, 1], ['#B0143C', .55, .35, 1], ['#FF8A5C', 1, 0, .8], ['#5A0E4F', .9, 1, 1.1], ['#E3193A', .1, 1, .8]]],
  ['Закат', 'flow', 1.6, .35, [['#FFB02E', 0, 0, .9], ['#FF5F28', .5, .2, 1], ['#E0245E', .9, .5, 1], ['#5B2A86', 1, 1, 1], ['#C2361B', 0, 1, .9]]],
  ['Мята', 'blob', 1.3, .3, [['#0E5E5A', 0, 0, 1], ['#2BB5A0', .5, .3, .9], ['#8CFFC4', .95, .05, .8], ['#1C7480', .3, 1, 1], ['#0B3B4A', 1, 1, 1.1]]],
  ['Лаванда', 'flow', 1.3, .5, [['#9A7BD0', 0, .1, 1], ['#E58BC8', .6, 0, .8], ['#5F62BE', 1, .6, 1], ['#3C2A78', .4, 1, 1], ['#7FB4F0', 0, .9, .7]]],
  ['Какао', 'swirl', 1.6, .6, [['#2C1916', 0, 0, 1], ['#7A4630', .55, .3, 1], ['#C98A52', 1, 0, .7], ['#3E221A', 1, 1, 1], ['#5A3325', .1, 1, .9]]],
  ['Манго', 'blob', 1.2, .4, [['#FFC83D', .1, 0, .9], ['#FF7A1A', .6, .4, 1], ['#E0452B', 1, 1, 1], ['#7CC242', 0, 1, .7], ['#FFA62B', 1, 0, .8]]],
  ['Ночь', 'swirl', 1.4, .7, [['#0D1B3E', 0, 0, 1.1], ['#2C6BD1', .6, .25, .8], ['#7A3BD0', 1, .9, 1], ['#12243A', .2, 1, 1], ['#1FA5B8', 1, 0, .7]]]
].map(([name, mode, p, warp, pts]) => ({ name, bg: { mode, p, warp, ph: .2, guard: 4.5, pts: pts.map(([c, x, y, s]) => ({ c, x, y, s })) } }));

/* ───── TrueType ───── */
function parseFont(buf) {
  const dv = new DataView(buf), u16 = o => dv.getUint16(o), i16 = o => dv.getInt16(o), u32 = o => dv.getUint32(o);
  const sig = u32(0);
  if (sig === 0x4F54544F) throw new Error('Это OTF-шрифт. Нужен файл TTF.');
  if (sig === 0x774F4646 || sig === 0x774F4632) throw new Error('Это веб-шрифт WOFF. Нужен файл TTF.');
  let base = 0;
  if (sig === 0x74746366) base = u32(12);
  else if (sig !== 0x00010000 && sig !== 0x74727565) throw new Error('Файл не похож на шрифт TTF.');
  const T = {};
  for (let i = 0, n = u16(base + 4); i < n; i++) {
    const o = base + 12 + 16 * i;
    T[String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3))] = u32(o + 8);
  }
  for (const t of ['head', 'hhea', 'hmtx', 'cmap', 'glyf', 'loca', 'maxp']) if (!T[t]) throw new Error('В шрифте нет таблицы ' + t + '.');
  const upm = u16(T.head + 18), longLoca = i16(T.head + 50) === 1, nH = u16(T.hhea + 34), nGlyphs = u16(T.maxp + 4);
  // cmap
  let sub4 = 0, sub12 = 0;
  for (let i = 0, n = u16(T.cmap + 2); i < n; i++) {
    const o = T.cmap + u32(T.cmap + 8 + 8 * i), f = u16(o);
    if (f === 4) sub4 = o; else if (f === 12) sub12 = o;
  }
  if (!sub4 && !sub12) throw new Error('В шрифте нет таблицы символов Unicode.');
  function gidOf(c) {
    if (sub12) {
      const n = u32(sub12 + 12);
      for (let i = 0; i < n; i++) { const o = sub12 + 16 + 12 * i; if (c >= u32(o) && c <= u32(o + 4)) return u32(o + 8) + c - u32(o); }
      if (!sub4) return 0;
    }
    const sx = u16(sub4 + 6), n = sx / 2, E = sub4 + 14, S = E + sx + 2, D = S + sx, R = D + sx;
    for (let i = 0; i < n; i++) if (c <= u16(E + 2 * i)) {
      const s = u16(S + 2 * i); if (c < s) return 0;
      const ro = u16(R + 2 * i);
      if (!ro) return (c + u16(D + 2 * i)) & 0xFFFF;
      const g = u16(R + 2 * i + ro + 2 * (c - s));
      return g ? (g + u16(D + 2 * i)) & 0xFFFF : 0;
    }
    return 0;
  }
  const loca = g => longLoca ? u32(T.loca + 4 * g) : 2 * u16(T.loca + 2 * g);
  const adv = g => u16(T.hmtx + 4 * Math.min(g, nH - 1));
  function contours(g, depth) {
    const a = loca(g), b = loca(g + 1);
    if (a === b || depth > 5 || g >= nGlyphs) return [];
    let o = T.glyf + a; const nc = i16(o); o += 10; const out = [];
    if (nc >= 0) {
      const ends = []; for (let i = 0; i < nc; i++, o += 2) ends.push(u16(o));
      o += 2 + u16(o);
      const n = nc ? ends[nc - 1] + 1 : 0, fl = [];
      while (fl.length < n) { const f = dv.getUint8(o++); fl.push(f); if (f & 8) { let r = dv.getUint8(o++); while (r--) fl.push(f); } }
      const pts = fl.map(f => ({ on: !!(f & 1) })); let v = 0;
      for (let i = 0; i < n; i++) { if (fl[i] & 2) { const d = dv.getUint8(o++); v += fl[i] & 16 ? d : -d; } else if (!(fl[i] & 16)) { v += i16(o); o += 2; } pts[i].x = v; }
      v = 0;
      for (let i = 0; i < n; i++) { if (fl[i] & 4) { const d = dv.getUint8(o++); v += fl[i] & 32 ? d : -d; } else if (!(fl[i] & 32)) { v += i16(o); o += 2; } pts[i].y = v; }
      let s = 0; for (const e of ends) { out.push(pts.slice(s, e + 1)); s = e + 1; }
      return out;
    }
    let f;
    do {
      f = u16(o); const g2 = u16(o + 2); o += 4; let dx = 0, dy = 0, a1 = 1, b1 = 0, c1 = 0, d1 = 1;
      if (f & 1) { if (f & 2) { dx = i16(o); dy = i16(o + 2); } o += 4; } else { if (f & 2) { dx = dv.getInt8(o); dy = dv.getInt8(o + 1); } o += 2; }
      const f2 = p => i16(p) / 16384;
      if (f & 8) { a1 = d1 = f2(o); o += 2; } else if (f & 0x40) { a1 = f2(o); d1 = f2(o + 2); o += 4; } else if (f & 0x80) { a1 = f2(o); b1 = f2(o + 2); c1 = f2(o + 4); d1 = f2(o + 6); o += 8; }
      for (const c of contours(g2, depth + 1)) out.push(c.map(p => ({ on: p.on, x: a1 * p.x + c1 * p.y + dx, y: b1 * p.x + d1 * p.y + dy })));
    } while (f & 0x20);
    return out;
  }
  function toCmds(pts, out) {
    if (pts.length < 2) return;
    const i0 = pts.findIndex(p => p.on); let seq;
    if (i0 < 0) { const a = pts[0], b = pts[pts.length - 1]; seq = [{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, on: true }, ...pts]; }
    else seq = [...pts.slice(i0), ...pts.slice(0, i0)];
    seq.push(seq[0]);
    let cur = seq[0], q = null; out.push(['M', cur.x, cur.y]);
    const quad = (a, c, b) => out.push(['C', a.x + 2 / 3 * (c.x - a.x), a.y + 2 / 3 * (c.y - a.y), b.x + 2 / 3 * (c.x - b.x), b.y + 2 / 3 * (c.y - b.y), b.x, b.y]);
    for (let i = 1; i < seq.length; i++) {
      const p = seq[i];
      if (p.on) { if (q) { quad(cur, q, p); q = null; } else out.push(['L', p.x, p.y]); cur = p; }
      else { if (q) { const m = { x: (q.x + p.x) / 2, y: (q.y + p.y) / 2 }; quad(cur, q, m); cur = m; } q = p; }
    }
    out.push(['Z']);
  }
  const gCache = new Map();
  function glyph(g) {
    let r = gCache.get(g); if (r) return r;
    const cmds = []; for (const c of contours(g, 0)) toCmds(c, cmds);
    const a = loca(g), o = T.glyf + a;
    r = cmds.length ? { cmds, x0: i16(o + 2), y0: i16(o + 4), x1: i16(o + 6), y1: i16(o + 8) } : { cmds: null };
    gCache.set(g, r); return r;
  }
  // кернинг: GPOS, иначе kern
  const lookups = [];
  if (T.GPOS) {
    const G = T.GPOS, FL = G + u16(G + 6), LL = G + u16(G + 8), ids = new Set();
    for (let i = 0, n = u16(FL); i < n; i++) {
      const o = FL + 2 + 6 * i;
      if (u32(o) === 0x6B65726E) { const f = FL + u16(o + 4); for (let k = 0, m = u16(f + 2); k < m; k++) ids.add(u16(f + 4 + 2 * k)); }
    }
    [...ids].sort((a, b) => a - b).forEach(id => {
      const L = LL + u16(LL + 2 + 2 * id), type = u16(L), subs = [];
      for (let i = 0, n = u16(L + 4); i < n; i++) {
        let s = L + u16(L + 6 + 2 * i), t = type;
        if (t === 9) { t = u16(s + 2); s += u32(s + 4); }
        if (t === 2) subs.push(s);
      }
      if (subs.length) lookups.push(subs);
    });
  }
  function cover(o, g) {
    const f = u16(o), n = u16(o + 2);
    let lo = 0, hi = n - 1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (f === 1) { const v = u16(o + 4 + 2 * m); if (v === g) return m; if (v < g) lo = m + 1; else hi = m - 1; }
      else { const r = o + 4 + 6 * m; if (g < u16(r)) hi = m - 1; else if (g > u16(r + 2)) lo = m + 1; else return u16(r + 4) + g - u16(r); }
    }
    return -1;
  }
  function klass(o, g) {
    if (u16(o) === 1) { const s = u16(o + 2); return g >= s && g < s + u16(o + 4) ? u16(o + 6 + 2 * (g - s)) : 0; }
    let lo = 0, hi = u16(o + 2) - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1, r = o + 4 + 6 * m; if (g < u16(r)) hi = m - 1; else if (g > u16(r + 2)) lo = m + 1; else return u16(r + 4); }
    return 0;
  }
  const pop = v => { let n = 0; while (v) { n += v & 1; v >>= 1; } return n; };
  const kernT = new Map();
  if (!lookups.length && T.kern && u16(T.kern) === 0 && u16(T.kern + 2) > 0 && (u16(T.kern + 8) >> 8) === 0)
    for (let i = 0, n = u16(T.kern + 10); i < n; i++) { const o = T.kern + 18 + 6 * i; kernT.set(u32(o), i16(o + 4)); }
  const kCache = new Map();
  function kern(a, b) {
    const key = a * 65536 + b; let v = kCache.get(key); if (v !== undefined) return v;
    v = kernT.get(key) || 0;
    for (const subs of lookups) for (const s of subs) {
      const ci = cover(s + u16(s + 2), a); if (ci < 0) continue;
      const vf1 = u16(s + 4), vf2 = u16(s + 6), l1 = 2 * pop(vf1), l2 = 2 * pop(vf2), xo = 2 * pop(vf1 & 3);
      if (u16(s) === 1) {
        const ps = s + u16(s + 10 + 2 * ci), n = u16(ps), step = 2 + l1 + l2; let hit = -1, lo = 0, hi = n - 1;
        while (lo <= hi) { const m = (lo + hi) >> 1, r = ps + 2 + step * m, g = u16(r); if (g === b) { hit = r; break; } if (g < b) lo = m + 1; else hi = m - 1; }
        if (hit < 0) continue;
        if (vf1 & 4) v += i16(hit + 2 + xo);
        break;
      }
      const k1 = klass(s + u16(s + 8), a), k2 = klass(s + u16(s + 10), b), n1 = u16(s + 12), n2 = u16(s + 14);
      if (k1 >= n1 || k2 >= n2) continue;
      if (vf1 & 4) v += i16(s + 16 + (l1 + l2) * (k1 * n2 + k2) + xo);
      break;
    }
    kCache.set(key, v); return v;
  }
  const capG = glyph(gidOf(0x41F) || gidOf(0x48)), cap = (capG.cmds ? capG.y1 : upm * .7) / upm;
  if (!gidOf(0x416)) throw new Error('В этом шрифте нет русских букв.');
  const sCache = new Map();
  function shape(text) {
    let r = sCache.get(text); if (r) return r;
    let x = 0, prev = -1, L = Infinity, R = -Infinity, lo = 0, hi = 0, missing = ''; const gs = [];
    for (const ch of text) {
      const g = gidOf(ch === ' ' ? 32 : ch.codePointAt(0));
      if (!g) { if (ch.trim()) missing += ch; continue; }
      if (prev >= 0) x += kern(prev, g);
      const G = glyph(g);
      if (G.cmds) { gs.push({ g, x }); L = Math.min(L, x + G.x0); R = Math.max(R, x + G.x1); lo = Math.min(lo, G.y0); hi = Math.max(hi, G.y1); }
      x += adv(g); prev = g;
    }
    if (L === Infinity) L = R = 0;
    r = { gs, L: L / upm, R: R / upm, w: (R - L) / upm, lo: lo / upm, hi: hi / upm, missing };
    if (sCache.size > 6000) sCache.clear();
    sCache.set(text, r); return r;
  }
  return { upm, cap, glyph, shape, gid: gidOf };
}

/* ───── Название: подбор кегля и переносов только по словам ───── */
const SHORT = new Set('и а но с со в во к ко о об на из за по до от у без для под над при или не'.split(' '));
const endsShort = l => SHORT.has(l.toLowerCase().split(/\s+/).pop());
function tokens(text) {
  const out = [];
  text.split(/\s+/).filter(Boolean).forEach((w, i) => {
    const parts = w.split(/(?<=[^\s-]{2,}-)(?=[^\s-]{2,})/u);       // только по уже стоящему дефису
    parts.forEach((p, k) => out.push({ t: p, glue: k > 0, sp: i > 0 && k === 0 }));
  });
  return out;
}
function* splits(tok, n) {
  const N = tok.length;
  function* rec(start, left) {
    if (left === 1) { yield [[start, N]]; return; }
    for (let e = start + 1; e <= N - left + 1; e++) for (const r of rec(e, left - 1)) yield [[start, e], ...r];
  }
  if (n <= N) for (const p of rec(0, n)) yield p.map(([a, b]) => ({
    text: tok.slice(a, b).map((t, i) => (i && t.sp ? ' ' : '') + t.t).join(''), glue: a > 0 && tok[a].glue
  }));
}
function variants(text, maxLines) {
  let tok = tokens(text);
  if (tok.length > 14) { const extra = tok.splice(13); tok.push({ t: extra.map(t => (t.sp ? ' ' : '') + t.t).join('').trim(), sp: true, glue: false }); }
  const out = [];
  for (let n = 1; n <= maxLines; n++) for (const p of splits(tok, n)) out.push({
    lines: p.map(l => l.text),
    q: Math.pow(.88, n - 1) * p.reduce((q, l, i) => q * (l.glue ? .6 : 1) * (i < p.length - 1 && endsShort(l.text) ? .85 : 1), 1)
  });
  return out;
}
function stack(font, rows) {                // rows: [{text,size}] → базовые линии от верха заглавной буквы
  let y = 0, prev = null;
  rows.forEach(r => {
    const s = font.shape(r.text), cap = font.cap * r.size;
    if (!prev) y = cap;
    else {
      const ink = (-prev.lo) * prev.size + Math.max(0, s.hi - font.cap) * r.size + .05 * r.size;
      y += Math.max(.2 * Math.max(r.size, prev.size * .9), ink) + cap;
    }
    r.y = y; prev = { lo: s.lo, size: r.size };
  });
  return y;
}
function fitTitle(font, raw, W, H, spec) {
  const m = raw.match(/^(.+?)\s*(«[^»]+»)$/u), main = m ? m[1] : raw, sub = m ? m[2] : '';
  const A = variants(main, sub ? 2 : 4), B = sub ? variants(sub, 2) : [null];
  let best = null;
  for (const a of A) {
    const wa = Math.max(...a.lines.map(l => font.shape(l).w), .01);
    for (const b of B) for (const r of b ? [1, .85, .72, .62] : [1]) {      // «название в кавычках» может быть мельче
      const wb = b ? Math.max(...b.lines.map(l => font.shape(l).w), .01) * r : 0;
      let s = Math.min(spec.titleMax, W / Math.max(wa, wb));
      const rows = () => [...a.lines.map(text => ({ text, size: s })), ...(b ? b.lines.map(text => ({ text, size: s * r })) : [])];
      let R = rows(); const z = R[R.length - 1], h = stack(font, R) + Math.max(0, -font.shape(z.text).lo) * z.size;   // с учётом хвостиков Д, Щ, Ц
      if (h > H) { s *= H / h; R = rows(); stack(font, R); }
      const score = (b ? s * (.5 + .5 * r) * (1 - (1 - r) * .16) : s) * a.q * (b ? b.q : 1);
      if (!best || score > best.score + 1e-6) best = { score, rows: R, size: s };
    }
  }
  return best;
}

/* ───── Углы ─────
   Точки угла заданы в долях радиуса: a — отступ от вершины по входящей стороне, b — по выходящей. */
const K = .44771525;
const CORNERS = {
  round: ['Круглые', [[1, 0], ['C', K, 0, 0, K, 0, 1]]],
  smooth: ['Плавные', [[1.528665, 0], ['C', 1.08849296, 0, .86840694, 0, .63149379, .07491139], ['C', .37282383, .16905956, .16905956, .37282383, .07491139, .63149379], ['C', 0, .86840694, 0, 1.08849296, 0, 1.528665]]],
  bevel: ['Скос', [[1, 0], ['L', 0, 1]]],
  scoop: ['Вогнутые', [[1, 0], ['C', 1, 1 - K, 1 - K, 1, 0, 1]]],
  notch: ['Ступенька', [[1, 0], ['L', 1, 1], ['L', 0, 1]]]
};
// предел радиуса: вырез не ближе 2 мм к буквам и не больше половины стороны
function maxR(spec) {
  const q = Math.SQRT2, a = spec.pad, m = Math.min(spec.w, spec.h) / 2;
  const lim = { round: (a * q - 2) / (q - 1), smooth: (a * q - 2) / (q - 1), bevel: 2 * a - 2 * q, scoop: a * q - 2, notch: a - q }[spec.shape] || 0;
  return Math.max(0, Math.floor(Math.min(lim, spec.shape === 'smooth' ? m / 1.53 : m) * 10) / 10);
}
function outline(W, H, r, shape) {                       // команды контура от левого верхнего угла, y вниз
  const def = (CORNERS[shape] || CORNERS.round)[1], out = [];
  [[0, 0, 0, -1, 1, 0], [W, 0, 1, 0, 0, 1], [W, H, 0, 1, -1, 0], [0, H, -1, 0, 0, -1]].forEach(([x, y, ix, iy, ox, oy], n) => {
    const pt = (a, b) => [x - ix * a * r + ox * b * r, y - iy * a * r + oy * b * r], go = n ? 'L' : 'M';
    if (r < .01) { out.push([go, x, y]); return; }
    out.push([go, ...pt(...def[0])]);
    def.slice(1).forEach(c => { const q = [c[0]]; for (let i = 1; i < c.length; i += 2) q.push(...pt(c[i], c[i + 1])); out.push(q); });
  });
  out.push(['Z']); return out;
}

/* ───── Вёрстка карточки ───── координаты в pt от левого верхнего угла ───── */
const tidy = s => (s || '').replace(/["“„]([^"“”„]+)["”“]/g, '«$1»').replace(/[ \t\r\n]+/g, ' ').trim();
function layout(tag, font, spec, upper) {
  const W = spec.w * MM, H = spec.h * MM, P = spec.pad * MM, inner = W - 2 * P, runs = [], warn = [];
  const missing = new Set();
  const put = (text, size, x, y, right) => {
    const s = font.shape(text); [...s.missing].forEach(c => missing.add(c));
    runs.push({ gs: s.gs, size, x: right ? x - s.R * size : x - s.L * size, y });
  };
  // цена: кегль постоянный, правый нижний угол
  const price = tidy(tag.price); let priceTop = H - P, priceLeft = W - P;
  if (price) {
    const s = font.shape(price);
    put(price, spec.price, W - P, H - P, true);
    priceTop = H - P - font.cap * spec.price; priceLeft = W - P - s.w * spec.price;
    if (s.w * spec.price > inner + .5) warn.push('Цена шире ценника');
  }
  // состав: кегль постоянный, блок держится на одной середине, как в шаблоне
  const comp = [...(tag.comp || '').split(/\r?\n/), kbjuLine(tag.kbju)].map(tidy).filter(Boolean), lead = spec.lead * spec.comp;
  let y0 = 0;
  if (comp.length) {
    const flow = (y, width) => {
      const lines = []; let full = true;
      for (const para of comp) {
        let cur = '';
        for (const w of para.split(' ')) {
          const t = cur ? cur + ' ' + w : w;
          if (!cur || font.shape(t).w * spec.comp <= width(y)) cur = t; else { lines.push([cur, y]); y += lead; cur = w; }
          if (font.shape(cur).w * spec.comp > width(y) + .1) full = false;
        }
        lines.push([cur, y]); y += lead;
      }
      return { lines, ok: full && lines[lines.length - 1][1] <= H - P + .1 };
    };
    const floor = priceTop - 1.5 * MM;                                  // нижняя строка над ценой
    const minY = P + font.cap * spec.titleMin * 2.5 + 2.8 * MM + font.cap * spec.comp;
    const n = flow(0, () => inner).lines.length;
    y0 = Math.min(spec.compMid * MM - (n - 1) / 2 * lead, floor - (n - 1) * lead);
    let f;
    if (y0 >= minY) f = flow(y0, () => inner);
    else {                                                             // очень длинный состав обтекает цену слева
      y0 = minY; f = flow(y0, y => (price && y > floor ? priceLeft - P - 3 * MM : inner));
    }
    if (!kbjuFull(kbjuNorm(tag.kbju))) warn.push('КБЖУ заполнено не полностью');
    if (!f.ok) warn.push('Состав не помещается, сократите текст');
    f.lines.forEach(([t, y]) => { if (y <= H - 2) put(t, spec.comp, P, y); });
  }
  // название: занимает всё, что осталось сверху
  let name = tidy(tag.name), titleSize = 0; if (upper) name = name.toUpperCase();
  if (name) {
    const bottom = comp.length ? y0 - font.cap * spec.comp - 2.8 * MM : priceTop - 4 * MM;
    const t = fitTitle(font, name, inner, Math.max(10, bottom - P), spec);
    t.rows.forEach(r => put(r.text, r.size, P, P + r.y));
    titleSize = t.size;
    if (t.rows.some(r => r.size < spec.titleMin * .72) || t.size < spec.titleMin) warn.push('Название очень длинное, буквы мелкие');
  }
  if (missing.size) warn.push('В шрифте нет символов: ' + [...missing].join(' '));
  return { W, H, r: Math.min(spec.r, maxR(spec)) * MM, shape: spec.shape, runs, warn, titleSize };
}

/* ───── КБЖУ и разбор списка ─────
   Формат ценника: название / Состав: … / КБЖУ: … / цена. Состав и КБЖУ могут отсутствовать. */
// хранится как «500/45/12/65», печатается «КБЖУ: 500/45/12/65» одной неразрывной строкой
function kbjuNorm(v) {
  v = String(v || '').replace(/ /g, ' ').replace(/на\s*100\s*(?:грамм|гр|г|мл)[а-я]*\.?/gi, ' ').replace(/^\s*к\s*\/?\s*б\s*\/?\s*ж\s*\/?\s*у/i, '').replace(/^[\s:=—–-]+|[\s.;,]+$/g, '');
  const cut = x => (x.match(/\d+(?:[.,]\d+)?/) || [''])[0].replace('.', ',');
  let p = v.split('/');
  if (p.length !== 4) p = v.match(/\d+(?:[.,]\d+)?/g) || [];
  if (p.length < 4 && v.split(',').length === 4) p = v.split(',');
  p = [0, 1, 2, 3].map(i => cut(p[i] || ''));
  return p.some(Boolean) ? p.join('/') : '';
}
const kbjuFull = v => !v || v.split('/').filter(Boolean).length === 4;
const kbjuLine = v => { v = kbjuNorm(v); return v && 'КБЖУ: ' + v.split('/').map(x => x || '–').join('/'); };
const RE_KBJU = /^к\s*\/?\s*б\s*\/?\s*ж\s*\/?\s*у/i, RE_FOUR = /^\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?){3}\.?$/;
const RE_COMP = /^состав(?:\s*[:.—–-]\s*|\s+|$)/i, RE_NAME = /^(?:название|наименование)\s*[:—–-]\s*/i;
const RE_PRICE = /^(?:цена\s*[:=—–-]?\s*)?(\d{1,3}(?:\s?\d{3})*(?:[.,]\d{1,2})?)\s*(?:₽|р\.?|руб\.?|рублей|рубля)?$/i;
const cleanKbju = kbjuNorm;
function parseList(text) {
  const L = [];
  String(text || '').replace(/ /g, ' ').split(/\r?\n/).forEach(r => {
    const t = r.replace(/[ ]+/g, ' ').trim(), m = t.match(/^(.+?)[\s.,;]+(к\s?\/?\s?б\s?\/?\s?ж\s?\/?\s?у(?:\s|:|\d).*)$/i);
    if (m && !/\t|\|/.test(t)) L.push(m[1], m[2]); else L.push(t);          // «…, соль. КБЖУ: …» в одной строке
  });
  const kind = t => !t ? 'blank' : RE_PRICE.test(t) ? 'price' : RE_KBJU.test(t) || RE_FOUR.test(t) ? 'kbju' : RE_COMP.test(t) ? 'comp' : 'text';
  const out = []; let cur = null, gap = false;
  const push = () => { if (cur) out.push(cur); cur = null; };
  const start = name => { push(); cur = { name: name.replace(/^(?:\d{1,3}[.)]\s+|[-–—•*]\s+)/, '').replace(RE_NAME, ''), comp: '', kbju: '', price: '', ask: '' }; };
  const next = i => { for (let j = i + 1; j < L.length; j++) if (L[j]) return kind(L[j]); return 'end'; };
  L.forEach((t, i) => {
    const k = kind(t);
    if (k === 'blank') { gap = true; return; }
    const late = !cur && !gap && out[out.length - 1];                         // строка пришла после цены
    if (k === 'price') {
      const v = t.match(RE_PRICE)[1];
      if (cur) { cur.price = v; push(); } else if (late && !late.price) late.price = v; else { start(''); cur.price = v; push(); }
    } else if (k === 'comp' || k === 'kbju') {
      const key = k, v = k === 'comp' ? t.replace(RE_COMP, '') : cleanKbju(t);
      if (cur) cur[key] = cur[key] && k === 'comp' ? cur[key] + ' ' + v : v; else if (late && !late[key]) late[key] = v; else { start(''); cur[key] = v; }
    } else if (/[|\t]/.test(t)) {                                             // строка таблицы: название | цена | состав
      push(); const o = { name: '', comp: '', kbju: '', price: '', ask: '' };
      t.split(/\s*[|\t]\s*/).filter(Boolean).forEach(x => {
        const q = kind(x);
        if (q === 'price' && !o.price) o.price = x.match(RE_PRICE)[1]; else if (q === 'kbju') o.kbju = cleanKbju(x); else if (q === 'comp') o.comp = x.replace(RE_COMP, '');
        else if (!o.name) o.name = x; else o.comp = o.comp ? o.comp + ', ' + x : x;
      });
      out.push(o);
    } else if (!cur) {
      const m = t.match(/^(.*\S)[\s—–:;-]+(\d{2,5})\s*(?:₽|р\.?|руб\.?)?$/i);  // «Моти 240» одной строкой
      if (m && !['price', 'comp', 'kbju'].includes(next(i))) { start(m[1].replace(/[;:—–-]+$/, '').trim()); cur.price = m[2]; push(); } else start(t);
    } else if (gap || cur.kbju) start(t);                                     // пустая строка или конец блока: прошлый остался без цены
    else if (cur.comp) { if (next(i) === 'comp') start(t); else cur.comp += ' ' + t; }
    else if (next(i) === 'comp' || /^[«"]/.test(t)) cur.name += ' ' + t;      // название в две строки
    else if (/,/.test(t) || /^[a-zа-яё]/.test(t)) cur.comp = t;
    else if (next(i) === 'price' || next(i) === 'kbju') { cur.comp = t; cur.ask = 'Проверьте: это состав или вторая строка названия?'; }
    else start(t);
    gap = false;
  });
  push();
  out.forEach(o => { o.name = tidy(o.name); if (!o.name) o.ask = 'Нет названия'; else if (!o.price) o.ask = 'Нет цены'; else if (!kbjuFull(o.kbju)) o.ask = 'КБЖУ: нужно четыре числа'; });
  return out.filter(o => o.name || o.comp || o.price);
}

/* ───── Каталог: что из загруженного списка новое, а что обновляет уже сохранённое ───── */
const nameKey = v => String(v || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
function mergeList(tags, found) {
  const used = new Set(), out = [];
  for (const o of found) {
    const key = nameKey(o.name), twin = out.find(r => nameKey(r.o.name) === key && r.o.price === o.price && r.o.comp === o.comp && r.o.kbju === o.kbju);
    if (key && twin) { twin.n++; continue; }                                  // точный повтор в списке — ещё одна копия
    const same = key ? tags.filter(t => !used.has(t) && nameKey(t.name) === key) : [];
    const t = same.find(x => x.price === o.price) || same[0] || null, diff = [];
    if (t) {
      used.add(t);
      if (o.price && o.price !== t.price) diff.push(`цена ${t.price || '—'} → ${o.price}`);
      if (o.comp && nameKey(o.comp) !== nameKey(t.comp)) diff.push(t.comp ? 'новый состав' : 'добавится состав');
      if (o.kbju && o.kbju !== t.kbju) diff.push(t.kbju ? 'новое КБЖУ' : 'добавится КБЖУ');
    }
    out.push({ o, t, diff, n: 1 });
  }
  return out;
}

/* ───── Общий каталог: app/catalog.txt, одинаковый на всех устройствах ───── */
const BASE = ['name', 'price', 'comp', 'kbju'], pickBase = o => Object.fromEntries(BASE.map(k => [k, o[k] || '']));
const capital = v => v.charAt(0).toUpperCase() + v.slice(1);
function baseList(text) {
  const seen = {};
  return parseList(text).filter(o => o.name).map(o => { const k = nameKey(o.name); seen[k] = (seen[k] || 0) + 1; return { ...pickBase(o), comp: capital(o.comp), bid: k + (seen[k] > 1 ? '#' + seen[k] : '') }; });
}
// tags меняются на месте; правки, сделанные на устройстве, остаются; возвращает, что добавить и что убрать
function syncBase(tags, base, gone) {
  const mine = new Map(tags.filter(t => t.bid).map(t => [t.bid, t])), ids = new Set(base.map(b => b.bid)), res = { add: [], off: [], upd: 0 };
  let free = tags.filter(t => !t.bid);
  base.forEach(b => {
    let t = mine.get(b.bid);
    if (!t) {
      const same = free.filter(x => nameKey(x.name) === nameKey(b.name)); t = same.find(x => x.price === b.price) || same[0];
      if (t) { free = free.filter(x => x !== t); t.bid = b.bid; t.base = pickBase(b); } else if (!gone.includes(b.bid)) res.add.push(b);
      return;
    }
    let ch = 0; const was = t.base || {};
    BASE.forEach(k => { if (t[k] === was[k] && t[k] !== b[k]) { t[k] = b[k]; ch = 1; } });
    t.base = pickBase(b); res.upd += ch;
  });
  tags.forEach(t => {
    if (!t.bid || ids.has(t.bid)) return;
    if (!t.qty && !t.bg && t.base && BASE.every(k => t[k] === t.base[k])) res.off.push(t); else { delete t.bid; delete t.base; }
  });
  return res;
}
const listText = tags => tags.filter(t => (t.name || '').trim()).map(t => [t.name.trim(), t.comp && 'Состав: ' + t.comp.replace(/\s*\n\s*/g, ' ').trim(), kbjuLine(t.kbju).replace('\u00A0', ' '), t.price].filter(Boolean).join('\n')).join('\n\n') + '\n';

/* ───── Категория по названию и составу ───── */
const norm = s => ' ' + (s || '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9%-]+/g, ' ') + ' ';
function hits(text, kw) {
  let best = -1, n = 0;
  for (const raw of kw.split(',')) {
    const no = raw.trim()[0] === '!', k = norm(raw).trim(); if (!k) continue;
    let p = text.indexOf(' ' + k + (k.length <= 3 ? ' ' : ''));
    if (p < 0 && k.length > 3) p = text.indexOf('-' + k);
    if (p < 0) continue;
    if (no) return { n: 0, pos: -1 };
    n++; if (best < 0 || p < best) best = p;
  }
  return { n, pos: best };
}
function classify(tag, cats, by) {
  const name = norm(tag.name), comp = norm(tag.comp), cand = [];
  const W = by === 'type' ? { 1: 500, 2: 300, 3: 400 } : { 1: 500, 2: 400, 3: 300 };
  cats.forEach((c, i) => {
    const a = hits(name, c.kw), b = hits(comp, c.kw);
    let w = 0;
    if (c.tier === 0) w = a.n || b.n ? 1000 + a.n * 10 + b.n : 0;      // ПП и веган важнее всего
    else if (a.n) w = (W[c.tier] || 200) - a.pos / 100;
    else if (b.n && c.tier === 2) w = 50 + b.n * 5 - b.pos / 100;      // состав решает, если молчит название
    if (w) cand.push({ c, w, i });
  });
  cand.sort((x, y) => y.w - x.w || x.i - y.i);
  const def = cats.find(c => c.id === 'classic') || cats[cats.length - 1];
  return { main: cand[0] ? cand[0].c : def, second: cand[1] && cand[1].w >= 45 ? cand[1].c : null };
}

/* ───── Цвет с контролем читаемости ───── */
const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = a => { const f = a.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * f[0] + .7152 * f[1] + .0722 * f[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
const MIN = 4.6, WHITE = [255, 255, 255], DARK = [29, 27, 31];
function inkRGB(ink, base) {                              // белый всегда, если не попросили иначе
  if (ink === 'dark') return DARK;
  if (ink === 'auto') return contrast(base, WHITE) >= 2.6 ? WHITE : DARK;
  return ink && ink[0] === '#' ? rgb(ink) : WHITE;
}
function paint(cat, second, style, strict, ink) {
  // в дуэт идут только вкусы; ПП и веган всегда остаются своего цвета
  if (second && (cat.tier === 0 || second.tier !== 2 || second.id === cat.id)) second = null;
  const a = rgb(cat.c1), b = rgb(cat.c2), text = inkRGB(ink, a), to = lum(text) > .3 ? [0, 0, 0] : WHITE;
  let st = style === 'flat' ? [a, a] : style === 'duo' ? [a, second ? rgb(second.c1) : b] : style === 'glow' ? [mix(a, WHITE, .1), b] : [a, b];
  if (strict && style === 'flat') return { style, stops: [a, a], text, ratio: contrast(a, text) };
  const fix = c => { let k = 0; while (contrast(c, text) < MIN && k++ < 60) c = mix(c, to, .03); return c; };
  st = st.map(fix);
  for (let g = 0; g < 40; g++) {                       // и в середине градиента тоже
    if ([.25, .5, .75].every(t => contrast(mix(st[0], st[1], t), text) >= MIN - .1)) break;
    st = st.map(c => mix(c, to, .04));
  }
  const ratio = Math.min(...[0, .25, .5, .75, 1].map(t => contrast(mix(st[0], st[1], t), text)));
  return { style, stops: st, text, ratio };
}

/* ───── Перелив: поле из нескольких цветов, смешанных в OKLab ─────
   bg = { mode: flow|blob|swirl, p: резкость границ, warp: волна 0..1, ph: рисунок волны, guard: 4.5|3|0, pts: [{c,x,y,s}] } */
const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
const gam = v => 255 * (v <= .0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - .055);
function toLab(c) {
  const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), q = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  return [.2104542553 * l + .793617785 * m - .0040720468 * q, 1.9779984951 * l - 2.428592205 * m + .4505937099 * q, .0259040371 * l + .7827717662 * m - .808675766 * q];
}
function labLin(L, A, B) {
  const l = Math.pow(L + .3963377774 * A + .2158037573 * B, 3), m = Math.pow(L - .1055613458 * A - .0638541728 * B, 3), q = Math.pow(L - .0894841775 * A - 1.291485548 * B, 3);
  const k = v => v < 0 ? 0 : v > 1 ? 1 : v;
  return [k(4.0767416621 * l - 3.3077115913 * m + .2309699292 * q), k(-1.2684380046 * l + 2.6097574011 * m - .3413193965 * q), k(-.0041960863 * l - .7034186147 * m + 1.7076147010 * q)];
}
const labHex = (L, A, B) => hex(labLin(Math.max(0, Math.min(1, L)), A, B).map(gam));
function shade(h, dL, rot, k) {                          // сдвиг светлоты и оттенка
  const [L, A, B] = toLab(rgb(h)), c = Math.hypot(A, B) * (k || 1), t = Math.atan2(B, A) + (rot || 0) * Math.PI / 180;
  return labHex(L + dL, c * Math.cos(t), c * Math.sin(t));
}
function field(bg, text, cols, rows) {
  const out = new Float32Array(cols * rows * 3), TAU = 2 * Math.PI, asp = 1.4, w0 = bg.warp || 0, ph = bg.ph || 0, p = bg.p || 1.4;
  const P = bg.pts.map(q => ({ x: q.x, y: q.y, s: q.s * q.s, lab: toLab(rgb(q.c)) }));
  // запас читаемости: яркость фона мягко прижимается к границе контраста
  const tY = lum(text), g = bg.guard || 0, light = tY > .3;
  const cap = !g ? 0 : light ? Math.max(.015, (tY + .05) / (g + .05) - .05) : Math.max(.015, 1 - Math.min(.985, (tY + .05) * (g + .05) - .05)), knee = cap * .5;
  const squeeze = Y => Y <= knee ? 1 : (knee + (cap - knee) * (1 - Math.exp(-(Y - knee) / (cap - knee)))) / Y;
  let o = 0;
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const u = cols > 1 ? i / (cols - 1) : .5, v = rows > 1 ? j / (rows - 1) : .5; let x = u, y = v;
    if (w0) {
      if (bg.mode === 'swirl') {
        const dx = (u - .5) * asp, dy = v - .5, t = w0 * 4.2 * Math.exp(-(dx * dx + dy * dy) * 2.4) * (ph > .5 ? -1 : 1), c = Math.cos(t), n = Math.sin(t);
        x = .5 + (dx * c - dy * n) / asp; y = .5 + dx * n + dy * c;
      } else {
        x = u + w0 * (.17 * Math.sin(TAU * (v * .9 + ph)) + .06 * Math.sin(TAU * (v * 2.1 + u * .7 + ph * 1.7)));
        y = v + w0 * (.17 * Math.sin(TAU * (u * .8 + ph * 1.3 + .25)) + .06 * Math.sin(TAU * (u * 1.9 - v * .6 + ph * .6)));
      }
    }
    let L = 0, A = 0, B = 0, W = 0;
    for (const q of P) {
      const dx = (x - q.x) * asp, dy = y - q.y, d = dx * dx + dy * dy;
      const w = bg.mode === 'blob' ? Math.exp(-d * p / (.22 * q.s)) + 1e-5 : Math.pow(q.s / (d + .012), p);
      L += w * q.lab[0]; A += w * q.lab[1]; B += w * q.lab[2]; W += w;
    }
    let c = labLin(L / W, A / W, B / W);
    if (cap) {
      const Yof = () => .2126 * c[0] + .7152 * c[1] + .0722 * c[2], Y = Yof(), k = squeeze(light ? Y : 1 - Y);
      if (k < 1) {                                       // прижимая яркость, добавляем насыщенности, чтобы цвет не серел
        const n = light ? L / W * Math.cbrt(k) : 1 - (1 - L / W) * k, sat = light ? 1 + (1 - k) * .4 : 1, goal = light ? Y * k : 1 - (1 - Y) * k;
        c = labLin(n, A / W * sat, B / W * sat);
        const now = Yof();
        if (light && now > goal) { const z = goal / now; c = c.map(v => v * z); }
        if (!light && now < goal) { const z = (1 - goal) / (1 - now); c = c.map(v => 1 - (1 - v) * z); }
      }
    }
    out[o++] = gam(c[0]); out[o++] = gam(c[1]); out[o++] = gam(c[2]);
  }
  return out;
}
function meshPaint(bg, text) {
  const f = field(bg, text, 29, 21); let ratio = 99;
  for (let i = 0; i < f.length; i += 3) ratio = Math.min(ratio, contrast([f[i], f[i + 1], f[i + 2]], text));
  return { style: 'mesh', bg, text, ratio };
}
/* перелив из цветов категории; вкус-спутник добавляет своё пятно */
function autoMesh(cat, second, i) {
  if (second && (cat.tier === 0 || second.tier !== 2 || second.id === cat.id)) second = null;
  const [, A, B] = toLab(rgb(cat.c1)), hue = Math.atan2(B, A) * 180 / Math.PI, warm = hue > 20 && hue < 125 ? -1 : 1;   // тёплые уводим в красный, а не в оливковый
  const acc = second ? second.c1 : shade(cat.c1, .04, warm * 30 - (warm > 0 ? 62 : 8), 1.1), hi = shade(cat.c1, .12, warm * 20, 1.1), deep = shade(cat.c2, -.06, warm * 8);
  const pts = [[cat.c1, .04, .12, 1.15], [hi, .52, .06, .75], [cat.c2, .46, .62, 1], [acc, .98, .2, .85], [deep, .96, .98, 1.1], [shade(cat.c1, -.03, warm * 24), .05, 1, .85]];
  const fx = (i || 0) % 2 === 1;
  return { mode: 'flow', p: 1.5, warp: .45, ph: ((i || 0) * .137 + .1) % 1, guard: 4.5, pts: pts.map(([c, x, y, s]) => ({ c, x: fx ? +(1 - x).toFixed(2) : x, y, s })) };
}
function gradGeom(style, W, H) {
  if (style === 'glow') return { radial: true, c: [W * .95, 0, W * 1.05] };
  if (style === 'vert') return { c: [0, 0, 0, H] };
  return { c: [0, 0, W, H] };
}

/* ───── SVG ───── */
const n2 = v => String(+v.toFixed(2));
function runPath(font, r) {
  let d = ''; const k = r.size / font.upm;
  for (const { g, x } of r.gs) for (const c of font.glyph(g).cmds) {
    d += c[0];
    for (let i = 1; i < c.length; i += 2) d += (i > 1 ? ' ' : '') + n2(r.x + (x + c[i]) * k) + ' ' + n2(r.y - c[i + 1] * k);
  }
  return d;
}
const outlineD = (W, H, r, shape) => outline(W, H, r, shape).map(c => c[0] + c.slice(1).map(v => n2(v)).join(' ')).join('');
const cardD = L => outlineD(L.W, L.H, L.r, L.shape);
const textPath = (L, font) => L.runs.map(r => runPath(font, r)).join('');
function cardSVG(L, P, font, id) {
  const fill = P.style === 'mesh' ? '' : P.style === 'flat' ? hex(P.stops[0]) : `url(#g-${id})`;
  let def = '';
  if (P.style === 'mesh') return `<clipPath id="c-${id}"><path d="${cardD(L)}"/></clipPath><g clip-path="url(#c-${id})"><image width="${n2(L.W)}" height="${n2(L.H)}" preserveAspectRatio="none" href="${P.img || ''}"/></g><path fill="${hex(P.text)}" d="${textPath(L, font)}"/>`;
  if (P.style !== 'flat') {
    const g = gradGeom(P.style, L.W, L.H), s = `<stop offset="0" stop-color="${hex(P.stops[0])}"/><stop offset="1" stop-color="${hex(P.stops[1])}"/>`;
    def = g.radial ? `<radialGradient id="g-${id}" gradientUnits="userSpaceOnUse" cx="${n2(g.c[0])}" cy="${n2(g.c[1])}" r="${n2(g.c[2])}">${s}</radialGradient>`
      : `<linearGradient id="g-${id}" gradientUnits="userSpaceOnUse" x1="${n2(g.c[0])}" y1="${n2(g.c[1])}" x2="${n2(g.c[2])}" y2="${n2(g.c[3])}">${s}</linearGradient>`;
  }
  return `${def}<path d="${cardD(L)}" fill="${fill}"/><path fill="${hex(P.text)}" d="${L.runs.map(r => runPath(font, r)).join('')}"/>`;
}

/* ───── Раскладка на листы ───── */
function grid(paper, spec, dense) {
  let best = null;
  const gx = dense ? spec.denseX : spec.gapX, gy = dense ? spec.denseY : spec.gapY;
  for (const land of [true, false]) {
    const [a, b] = PAPER[paper], PW = land ? b : a, PH = land ? a : b;
    const cols = Math.max(0, Math.floor((PW - 2 * spec.margin + gx + 1e-6) / (spec.w + gx)));
    const rows = Math.max(0, Math.floor((PH - 2 * spec.margin + gy + 1e-6) / (spec.h + gy)));
    if (!best || cols * rows > best.n) best = { paper, land, PW, PH, cols, rows, gx, gy, n: cols * rows };
  }
  return best;
}
function sheets(items, mode, spec, dense) {
  const A4 = grid('A4', spec, dense), A5 = grid('A5', spec, dense), out = []; let i = 0;
  if (mode === 'auto') mode = items.length <= A5.n ? 'A5' : 'A4';      // весь тираж в одном формате, листов сколько нужно
  while (i < items.length) {
    const g = mode === 'A5' ? A5 : A4;
    if (!g.n) return [];
    const part = items.slice(i, i + g.n); i += part.length;
    const ox = (g.PW - g.cols * spec.w - (g.cols - 1) * g.gx) / 2, oy = (g.PH - g.rows * spec.h - (g.rows - 1) * g.gy) / 2;
    out.push({ ...g, cards: part.map((it, k) => ({ it, x: (ox + (k % g.cols) * (spec.w + g.gx)) * MM, y: (oy + Math.floor(k / g.cols) * (spec.h + g.gy)) * MM })) });
  }
  return out;
}

/* ───── PDF: только векторные контуры и градиенты ───── */
const n3 = v => String(+(+v).toFixed(3));
function pdf(pages, font, title) {
  const objs = []; const add = s => { objs.push(s); return objs.length; };
  const strm = (dict, body) => `<<${dict}/Length ${body.length}>>\nstream\n${body}\nendstream`;
  const catalog = add(''), tree = add(''), glyphs = new Map(), kids = [];
  const gx = g => {
    if (!glyphs.has(g)) {
      const G = font.glyph(g), op = { M: 'm', L: 'l', C: 'c', Z: 'h' };
      const body = G.cmds.map(c => c.slice(1).map(v => +v.toFixed(1)).join(' ') + ' ' + op[c[0]]).join('\n') + '\nf';
      glyphs.set(g, add(strm(`/Type/XObject/Subtype/Form/BBox[${G.x0 - 5} ${G.y0 - 5} ${G.x1 + 5} ${G.y1 + 5}]/Resources<<>>`, body)));
    }
    return glyphs.get(g);
  };
  const col = c => c.map(v => n3(v / 255)).join(' ');
  // перелив: полосы с осевым градиентом. Новая полоса начинается, когда цвет ушёл на полтора деления из 255.
  const meshes = new Map();
  const mesh = (P, W, H) => {
    const key = JSON.stringify([P.bg, P.text, W, H]); if (meshes.has(key)) return meshes.get(key);
    const C = 33, R = 441, f = field(P.bg, P.text, C, R), row = C * 3; let body = '', res = '', last = -1, k = 0;
    for (let r = 0; r < R; r++) {
      let d = last < 0 ? 9 : 0;
      if (last >= 0) for (let i = 0; i < row; i++) { const e = Math.abs(f[r * row + i] - f[last * row + i]); if (e > d) d = e; }
      if (d < 1.5) continue;
      let bin = ''; for (let i = 0; i < row; i++) bin += String.fromCharCode(Math.max(0, Math.min(255, Math.round(f[r * row + i]))));
      const fn = add(strm(`/FunctionType 0/Domain[0 1]/Range[0 1 0 1 0 1]/Size[${C}]/BitsPerSample 8`, bin)), y = r / (R - 1) * H;
      res += `/B${k}<</ShadingType 2/ColorSpace/DeviceRGB/Coords[0 0 ${n3(W)} 0]/Function ${fn} 0 R>>`;
      body += `q 0 0 ${n3(W)} ${n3(H - y)} re W n /B${k} sh Q\n`; last = r; k++;
    }
    const id = add(strm(`/Type/XObject/Subtype/Form/BBox[0 0 ${n3(W)} ${n3(H)}]/Resources<</Shading<<${res}>>>>`, body));
    meshes.set(key, id); return id;
  };
  for (const p of pages) {
    const PH = p.PH * MM, sh = {}, xo = {}; let out = '';
    p.cards.forEach(({ it, x, y }, i) => {
      const { L, P } = it, X = x, Y = PH - y - L.H, W = L.W, H = L.H;
      const path = outline(W, H, L.r, L.shape).map(c => { let o = ''; for (let i = 1; i < c.length; i += 2) o += n3(X + c[i]) + ' ' + n3(Y + H - c[i + 1]) + ' '; return o + { M: 'm', L: 'l', C: 'c', Z: 'h' }[c[0]]; }).join(' ');
      if (P.style === 'flat') out += `${col(P.stops[0])} rg ${path} f\n`;
      else if (P.style === 'mesh') { const id = mesh(P, W, H); xo['M' + id] = id; out += `q ${path} W n 1 0 0 1 ${n3(X)} ${n3(Y)} cm /M${id} Do Q\n`; }
      else {
        const g = gradGeom(P.style, W, H), fn = `<</FunctionType 2/Domain[0 1]/N 1/C0[${col(P.stops[0])}]/C1[${col(P.stops[1])}]>>`;
        const co = g.radial ? [X + g.c[0], Y + H - g.c[1], 0, X + g.c[0], Y + H - g.c[1], g.c[2]] : [X + g.c[0], Y + H - g.c[1], X + g.c[2], Y + H - g.c[3]];
        sh['S' + i] = add(`<</ShadingType ${g.radial ? 3 : 2}/ColorSpace/DeviceRGB/Coords[${co.map(n3).join(' ')}]/Extend[true true]/Function ${fn}>>`);
        out += `q ${path} W n /S${i} sh Q\n`;
      }
      out += `${col(P.text)} rg\n`;
      for (const r2 of L.runs) {
        const s = r2.size / font.upm;
        for (const { g, x: gxx } of r2.gs) { xo['G' + g] = gx(g); out += `q ${s.toFixed(6)} 0 0 ${s.toFixed(6)} ${n3(X + r2.x + gxx * s)} ${n3(Y + H - r2.y)} cm /G${g} Do Q\n`; }
      }
    });
    const ref = o => Object.entries(o).map(([k, v]) => `/${k} ${v} 0 R`).join('');
    const c = add(strm('', out));
    kids.push(add(`<</Type/Page/Parent ${tree} 0 R/MediaBox[0 0 ${n3(p.PW * MM)} ${n3(p.PH * MM)}]/Resources<</XObject<<${ref(xo)}>>/Shading<<${ref(sh)}>>>>/Contents ${c} 0 R>>`));
  }
  objs[catalog - 1] = `<</Type/Catalog/Pages ${tree} 0 R/ViewerPreferences<</PrintScaling/None/DisplayDocTitle true>>>>`;
  objs[tree - 1] = `<</Type/Pages/Count ${kids.length}/Kids[${kids.map(k => k + ' 0 R').join(' ')}]>>`;
  const u = 'FEFF' + [...(title || '')].map(c => c.charCodeAt(0).toString(16).padStart(4, '0')).join('');
  const info = add(`<</Title<${u}>/Producer(Cennik)>>`);
  let s = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'; const off = [];
  objs.forEach((o, i) => { off.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xr = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<</Size ${objs.length + 1}/Root ${catalog} 0 R/Info ${info} 0 R>>\nstartxref\n${xr}\n%%EOF\n`;
  const bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 255;
  return bytes;
}

root.Engine = { baseList, syncBase, listText, nameKey, mergeList, parseList, kbjuLine, kbjuNorm, CORNERS, maxR, outlineD, PRESETS, field, meshPaint, autoMesh, inkRGB, shade, rgb, textPath, MM, SPEC, PAPER, CATS, STYLES, parseFont, layout, classify, paint, cardSVG, grid, sheets, pdf, hex, contrast, tidy };
if (typeof module !== 'undefined') module.exports = root.Engine;
})(typeof self !== 'undefined' ? self : globalThis);
