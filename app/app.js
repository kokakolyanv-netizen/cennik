'use strict';
(() => {
const VERSION = '1.1';
const E = Engine, $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }, del(k) { try { localStorage.removeItem(k); } catch (e) {} } };
const b64buf = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
const plural = (n, a, b, c) => n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c;

/* пример — позиции из шаблона «ценники на новую точку» */
const DEMO = [
  ['Моти', 240, ''],
  ['Кукис карамельный', 270, 'Разрыхлитель, мука, яйца, сливочное масло 82,5%, мука, сахар тростниковый, творожный сыр, сливки 33%, глюкозный сироп, молочный бельгийский шоколад, арахис'],
  ['Эклер ванильный', 280, 'Мука пшеничная, вода, молоко, соль, сахар, масло сливочное 82,5%, яйцо куриное, сливки животного происхождения 33%, ванильный сахар, крахмал кукурузный, сыр творожный сливочный'],
  ['Крем чизкейк ПП', 330, ''],
  ['Торт шпинатный', 390, 'Мука, яйцо, сахар белый, соль, шпинат, масло растительное подсолнечное, лимонный сок, малина, клубника, кукурузный крахмал, творожный сыр, сливки 33%, разрыхлитель теста'],
  ['Трайфл «Красный бархат»', 320, 'Мука пшеничная, сода, разрыхлитель, соль, сахар, масло растительное, кефир 2,5%, яйцо куриное, какао, вишня, крахмал кукурузный, сливки животного происхождения 33%, сыр творожный', '323/5,7/21,5/35,7'],
  ['Торт лавандовый', 390, 'Мука пшеничная, сахар, яйцо куриное, сливки, цветы лаванды, масло лаванды натуральное, пищевой краситель фиолетовый, разрыхлитель, сливки 33%, творожный сыр (молоко цельное, сливки, молочный белок, стабилизаторы (камедь рожкового дерева), мальтодекстрин, соль пищевая (ферроцианид калия), ягоды черной смородины, кукурузный крахмал, соль'],
  ['Торт шоколадный', 390, 'Мука, яйца, сахар, крахмал кукурузный, разрыхлитель, какао порошок, молоко, шоколад темный, сливки 33%'],
  ['Торт лимонно-маковый', 390, 'Яйцо куриное, сахар, мука пшеничная, масло сливочное, мак, разрыхлитель, молоко цельное, творожный сыр, сливки 33%, лимонный сок, крахмал кукурузный'],
  ['Торт «Медовик»', 390, 'Мёд, масло сливочное 82,5%, мука, сода пищевая, яйцо куриное, сахар белый, сметана 25%, сливки 33%'],
  ['Эклер фисташковый', 280, 'Мука пшеничная, вода, молоко, соль, сахар, масло сливочное 82,5%, яйцо куриное, сливки животного происхождения 33%, ванильный сахар, крахмал кукурузный, сыр творожный сливочный, фисташковая паста натуральная'],
  ['Торт «Молочная девочка»', 390, 'Яйцо, сгущенное молоко, масло сливочное, разрыхлитель, мука, творожный сыр, сливки 33%, сахарная пудра, сгущенное молоко'],
  ['Кофе в дрип-пакете', 150, '']
].map(([name, price, comp, kbju]) => ({ id: uid(), name, price: String(price), comp, kbju: kbju || '', qty: 1, cat: 'auto', style: '' }));

const DEF = { v: 2, format: 'auto', dense: false, style: 'mesh', ink: 'white', bg: null, catBg: {}, catInk: {}, by: 'taste', upper: true, strict: false, cats: {}, spec: {}, font: '' };
// приводит сохранённые данные любой версии к текущему виду; новые поля добавляйте в DEF и сюда
function tune(s) {
  if (!s || !Array.isArray(s.tags)) s = { tags: DEMO, set: {} };
  s.set = s.set || {};
  if (s.set.v !== 2) Object.assign(s.set, { v: 2, style: 'mesh' });
  s.set = Object.assign({}, DEF, s.set);
  if (s.set.format !== 'A4') s.set.format = 'auto';
  s.tags.forEach(t => {                              // КБЖУ из последней строки состава переезжает в своё поле
    const m = t.kbju ? null : (t.comp || '').match(/^(?:([\s\S]*?)\n)?\s*(к\s*\/?\s*б\s*\/?\s*ж\s*\/?\s*у[^\n]*)\s*$/i);
    if (m && E.kbjuNorm(m[2])) { t.comp = (m[1] || '').trim(); t.kbju = m[2]; }
    t.kbju = E.kbjuNorm(t.kbju); t.qty = Math.max(0, Math.round(+t.qty) || 0); t.name = t.name || ''; t.price = t.price || ''; t.comp = t.comp || '';
  });
  return s;
}
let S; try { S = JSON.parse(store.get('cennik') || 'null'); } catch (e) {}
S = tune(S);
const isDemo = t => t.qty <= 1 && !t.bg && DEMO.some(d => d.name === t.name && d.price === t.price && d.comp === t.comp);
let openId = null;
const save = () => { if (!store.set('cennik', JSON.stringify(S))) toast('Не удалось сохранить: в браузере закрыто хранилище'); };

const spec = () => Object.assign({}, E.SPEC, S.set.spec);
const cats = () => E.CATS.map(c => Object.assign({}, c, S.set.cats[c.id]));
const byId = id => S.tags.find(t => t.id === id);

/* шрифт */
let FONT, fontTitle = 'Geometria Bold';
function useFont(b64) {
  const buf = b64buf(b64); FONT = E.parseFont(buf.slice(0));
  if (window.FontFace) new FontFace('Tag', buf).load().then(f => document.fonts.add(f)).catch(() => {});
}
useFont(FONT_B64);
const own = store.get('cennik-font');
if (own) try { useFont(own); fontTitle = S.set.font || 'Свой шрифт'; } catch (e) { store.del('cennik-font'); }

/* растровая картинка перелива — только для экрана, в PDF идёт вектор */
const imgs = new Map(), cv = document.createElement('canvas');
function drawField(canvas, bg, text, w, h) {
  canvas.width = w; canvas.height = h;
  const c = canvas.getContext('2d'), d = c.createImageData(w, h), f = E.field(bg, text, w, h);
  for (let i = 0, j = 0; i < f.length; i += 3, j += 4) { d.data[j] = f[i]; d.data[j + 1] = f[i + 1]; d.data[j + 2] = f[i + 2]; d.data[j + 3] = 255; }
  c.putImageData(d, 0, 0);
}
function fieldURL(bg, text) {
  const key = JSON.stringify([bg, text]); let u = imgs.get(key);
  if (!u) { drawField(cv, bg, text, 112, 80); u = cv.toDataURL(); if (imgs.size > 300) imgs.clear(); imgs.set(key, u); }
  return u;
}

/* расчёт одного ценника */
const cache = new Map();
function look(t) {                                   // категория, фон и цвет букв
  const C = cats(), auto = E.classify(t, C, S.set.by), main = t.cat === 'auto' ? auto.main : C.find(x => x.id === t.cat) || auto.main;
  const second = t.cat === 'auto' ? auto.second : (auto.main.id !== main.id ? auto.main : auto.second);
  const ink = t.ink || S.set.catInk[main.id] || S.set.ink;
  const style = t.bg ? 'own' : t.style || (S.set.catBg[main.id] ? 'cat' : S.set.style);
  const bg = t.bg || (style === 'cat' ? S.set.catBg[main.id] : style === 'own' ? S.set.bg : null);
  const mesh = bg || E.autoMesh(main, second, C.findIndex(x => x.id === main.id));
  return { auto: auto.main, main, second, ink, style, mesh, isMesh: !!bg || style === 'mesh' || style === 'own', text: E.inkRGB(ink, E.rgb(main.c1)) };
}
function calc(t) {
  const K = S.set, key = JSON.stringify([t.name, t.price, t.comp, t.kbju, t.cat, t.style, t.bg, t.ink, K.style, K.by, K.upper, K.strict, K.cats, K.spec, K.ink, K.bg, K.catBg, K.catInk, fontTitle]);
  const c = cache.get(t.id); if (c && c.key === key) return c;
  const v = look(t), L = E.layout(t, FONT, spec(), K.upper);
  const P = v.isMesh ? E.meshPaint(v.mesh, v.text) : E.paint(v.main, v.second, v.style, K.strict, v.ink);
  if (v.isMesh) P.img = fieldURL(P.bg, P.text);
  const r = { key, L, P, main: v.main, auto: v.auto, svg: E.cardSVG(L, P, FONT, t.id) };
  cache.set(t.id, r); return r;
}
function symbol(t) {
  const c = calc(t), id = 's-' + t.id; let el = $(id);
  if (!el) { el = document.createElementNS('http://www.w3.org/2000/svg', 'symbol'); el.id = id; $('defs').appendChild(el); }
  if (el._k !== c.key) { el.setAttribute('viewBox', `0 0 ${c.L.W} ${c.L.H}`); el.innerHTML = c.svg; el._k = c.key; }
  return c;
}
const use = t => `<svg viewBox="0 0 ${calc(t).L.W} ${calc(t).L.H}" aria-hidden="true"><use href="#s-${t.id}"/></svg>`;
const sub = t => { const c = calc(t); return c.L.warn.length ? `<span class="bad">${esc(c.L.warn[0])}</span>` : `<span>${esc(t.price || 'без цены')} · ${esc(c.main.name)}</span>`; };

const INKS = [['white', 'Белые'], ['dark', 'Тёмные'], ['auto', 'По фону']];

/* список */
/* S.tags — это каталог: все ценники. На листе те, у кого qty > 0. */
const onSheet = () => S.tags.filter(t => t.qty > 0);
function editor(t, inCat) {
  const C = cats();
  return `<div class="edit" data-id="${t.id}">
    <div class="big">${use(t)}</div><div class="meta" data-meta></div>
    <label>Название<input type="text" id="n-${t.id}" data-f="name" value="${esc(t.name)}" autocomplete="off" placeholder="Торт «Медовик»"></label>
    <label>Состав<textarea id="c-${t.id}" data-f="comp" placeholder="Мука, масло сливочное, мёд">${esc(t.comp)}</textarea></label>
    <div class="fld" role="group" aria-label="КБЖУ">КБЖУ<div class="kb">${['Ккал', 'Белки', 'Жиры', 'Углев.'].map((n, i) => `<label>${n}<input type="text" id="b${i}-${t.id}" data-f="kb" data-i="${i}" inputmode="decimal" autocomplete="off" value="${esc((t.kbju || '').split('/')[i] || '')}"></label>`).join('')}</div></div>
    <div class="two"><label>Цена<input type="text" id="p-${t.id}" data-f="price" inputmode="decimal" value="${esc(t.price)}" autocomplete="off"></label>
    <label>Категория<select id="k-${t.id}" data-f="cat"></select></label></div>
    <div class="two"><label>Фон<select id="y-${t.id}" data-f="style"></select></label>
    <label>Буквы<span class="inkrow"><select id="i-${t.id}" data-f="ink"></select><input type="color" id="ic-${t.id}" data-f="inkc" aria-label="Свой цвет букв"></span></label></div>
    <button class="btn" data-a="bg">Редактор фона</button>
    <div class="foot">${inCat ? '<button class="btn ghost" data-a="del">Удалить из каталога</button>' : '<button class="btn ghost" data-a="off">Убрать с листа</button><button class="btn" data-a="dup">Копия</button>'}<button class="btn" data-a="close">Свернуть</button></div></div>`;
}
function fillEditor(t) {
  const box = document.querySelector(($('dCat').open ? '#catList ' : '#list ') + `.edit[data-id="${t.id}"]`); if (!box) return;
  const c = calc(t), sel = box.querySelector('[data-f=cat]'), m = box.querySelector('[data-meta]');
  sel.innerHTML = `<option value="auto">Авто: ${esc(c.auto.name)}</option>` + cats().map(x => `<option value="${x.id}"${t.cat === x.id ? ' selected' : ''}>${esc(x.name)}</option>`).join('');
  const opt = (v, n, on) => `<option value="${v}"${on ? ' selected' : ''}>${n}</option>`, own = t.ink && t.ink[0] === '#';
  box.querySelector('[data-f=style]').innerHTML = opt('', 'Как у всех', !t.bg && !t.style) + (t.bg ? opt('own', 'Свой', true) : '') + E.STYLES.map(([v, n]) => opt(v, n, !t.bg && t.style === v)).join('');
  box.querySelector('[data-f=ink]').innerHTML = opt('', 'Как у всех', !t.ink) + INKS.map(([v, n]) => opt(v, n, t.ink === v)).join('') + opt('own', 'Свой цвет', own);
  box.querySelector('[data-f=inkc]').value = E.hex(c.P.text);
  const f = v => v.toFixed(1).replace('.', ',').replace(',0', ''), sp = spec();
  m.className = 'meta' + (c.L.warn.length ? ' bad' : '');
  m.textContent = c.L.warn.length ? c.L.warn.join('. ') : `Название ${f(c.L.titleSize)} pt · состав ${f(sp.comp)} pt · цена ${f(sp.price)} pt · контраст ${f(c.P.ratio)}`;
}
function rowHTML(t) {
  return `<div class="tag${openId === t.id ? ' open' : ''}" id="r-${t.id}" data-id="${t.id}"><div class="row">
    <button class="thumb" data-a="open" aria-label="Открыть ${esc(t.name || 'ценник')}">${use(t)}</button>
    <button class="who" data-a="open" aria-expanded="${openId === t.id}"><b>${esc(t.name || 'Без названия')}</b>${sub(t)}</button>
    <div class="qty"><button data-a="minus" aria-label="Меньше копий">−</button><b>${t.qty}</b><button data-a="plus" aria-label="Больше копий">+</button></div></div>${openId === t.id ? editor(t) : ''}</div>`;
}
function renderList() {
  const now = onSheet(), alive = new Set(S.tags.map(t => 's-' + t.id)); now.forEach(symbol);
  [...$('defs').children].forEach(e => { if (!alive.has(e.id)) e.remove(); });
  if (openId && !now.some(t => t.id === openId)) openId = null;
  $('list').innerHTML = now.length ? now.map(rowHTML).join('') : `<div class="empty">${S.tags.length ? 'На листе пока ничего нет. Выберите ценники из каталога.' : 'Пока пусто. Добавьте первый ценник или вставьте весь список сразу.'}</div>`;
  $('demo').hidden = !S.tags.some(isDemo);
  const n = S.tags.filter(t => t.name.trim()).length; $('bCat').textContent = 'Каталог' + (n ? ' ' + n : '');
  if (openId) fillEditor(byId(openId));
}

/* листы */
let PAGES = [], lastPages = 0;
function renderSheets() {
  const items = []; onSheet().forEach(symbol); onSheet().forEach(t => { for (let i = 0; i < t.qty; i++) items.push(t); });
  PAGES = E.sheets(items, S.set.format, spec(), S.set.dense);
  const mm = E.MM;
  $('sheets').innerHTML = PAGES.map((p, i) => `<figure class="${p.paper === 'A5' ? 'a5' : ''}"><figcaption>Лист ${i + 1} · ${p.paper} ${p.land ? 'альбомный' : 'книжный'} · ${p.cards.length} из ${p.n}</figcaption>
    <svg viewBox="0 0 ${p.PW * mm} ${p.PH * mm}" role="img" aria-label="Лист ${i + 1}">${p.cards.map(c => { const L = calc(c.it).L; return `<use href="#s-${c.it.id}" x="${c.x}" y="${c.y}" width="${L.W}" height="${L.H}"/>`; }).join('')}</svg></figure>`).join('')
    || `<div class="empty">${items.length ? 'Ценник не помещается на выбранный лист. Проверьте размеры в настройках.' : 'Здесь появится лист для печати.'}</div>`;
  if (PAGES.length > lastPages && lastPages) { const r = document.querySelector('.right'); requestAnimationFrame(() => r.scrollTo({ top: r.scrollHeight, behavior: 'smooth' })); }
  lastPages = PAGES.length;
  const cnt = {}; PAGES.forEach(p => cnt[p.paper] = (cnt[p.paper] || 0) + 1);
  $('sum').textContent = items.length ? `${items.length} ${plural(items.length, 'ценник', 'ценника', 'ценников')} · ` + Object.entries(cnt).map(([k, v]) => `${k}${v > 1 ? ' × ' + v : ''}`).join(' + ') : '';
  $('bPdf').disabled = !PAGES.length;
}
function segs() {
  const seg = (id, key, opts) => { $(id).innerHTML = opts.map(([v, n]) => `<button data-k="${key}" data-v="${v}" aria-pressed="${String(S.set[key]) === String(v)}">${n}</button>`).join(''); };
  seg('sFormat', 'format', [['auto', 'Авто: до 4 — A5, больше — A4'], ['A4', 'Только A4']]);
  const g = d => E.grid('A4', spec(), d), a = g(false), b = g(true);
  seg('sDense', 'dense', [[false, `${a.cols}×${a.rows} шаблон`], [true, `${b.cols}×${b.rows} плотно`]]);
  seg('sStyle', 'style', S.set.bg ? [['own', 'Свой'], ...E.STYLES] : E.STYLES);
  seg('sInk', 'ink', INKS); $('inkAll').value = S.set.ink[0] === '#' ? S.set.ink : '#ffffff';
  seg('sBy', 'by', [['taste', 'по вкусу'], ['type', 'по виду']]);
}
/* углы */
function corners(segToo) {
  const sp = spec(), m = E.maxR(sp), r = Math.min(sp.r, m), f = v => String(+v.toFixed(1)).replace('.', ',');
  if (segToo) $('sShape').innerHTML = Object.entries(E.CORNERS).map(([k, [n]]) => `<button data-shape="${k}" aria-pressed="${sp.shape === k}" aria-label="${n}" title="${n}"><svg viewBox="-1 -1 32 24" aria-hidden="true"><path d="${E.outlineD(30, 22, k === 'smooth' ? 8 : 7, k)}"/></svg></button>`).join('');
  const el = $('rad'); el.max = m; el.value = r; $('radOut').textContent = f(r) + ' мм';
  $('radName').textContent = 'Углы: ' + E.CORNERS[sp.shape][0].toLowerCase();
  $('radBack').hidden = sp.shape === E.SPEC.shape && r === E.SPEC.r;
  $('stageClipP').setAttribute('d', E.outlineD(sp.w, sp.h, r, sp.shape)); $('stageClipP').setAttribute('transform', `scale(${1 / sp.w} ${1 / sp.h})`);
}
let radRaf = 0;
$('rad').addEventListener('input', e => { S.set.spec.r = +e.target.value; corners(false); cancelAnimationFrame(radRaf); radRaf = requestAnimationFrame(() => onSheet().forEach(symbol)); });
$('rad').addEventListener('change', () => { onSheet().forEach(symbol); save(); });
$('sShape').addEventListener('click', e => { const b = e.target.closest('[data-shape]'); if (!b) return; S.set.spec.shape = b.dataset.shape; all(); save(); });
$('radBack').onclick = () => { delete S.set.spec.r; delete S.set.spec.shape; all(); save(); };

function all() {
  corners(true); segs(); renderList(); renderSheets(); if ($('dCat').open) renderCat();
}
function refresh() { renderList(); renderSheets(); if ($('dCat').open) renderCat(); save(); }

/* обновление одного ценника без потери фокуса */
let raf = 0;
function touch(t) {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    symbol(t); const r = $('r-' + t.id), k = $('cr-' + t.id);
    if (k) k.querySelector('.who').innerHTML = catWho(t);
    if (r) { const w = r.querySelector('.who'); w.innerHTML = `<b>${esc(t.name || 'Без названия')}</b>${sub(t)}`; }
    fillEditor(t); save();
  });
}

function onEdit(e) {
  const f = e.target.dataset.f; if (!f) return;
  const t = byId(e.target.closest('[data-id]').dataset.id), v = e.target.value;
  if (f === 'inkc') t.ink = v;
  else if (f === 'kb') {
    const box = [...e.target.closest('.kb').querySelectorAll('input')];
    if (/[\/;]|КБЖУ/i.test(v)) E.kbjuNorm(v).split('/').forEach((x, i) => { if (box[i]) box[i].value = x; });      // вставили всё сразу: 500/45/12/65
    t.kbju = E.kbjuNorm(box.map(b => b.value.replace(/[^\d.,]/g, '')).join('/'));
  }
  else if (f === 'ink') t.ink = v === 'own' ? E.hex(calc(t).P.text) : v;
  else if (f === 'style') { if (v !== 'own') { t.bg = null; t.style = v; } }
  else t[f] = v;
  touch(t);
}
function setQty(t, q) {
  const was = t.qty; t.qty = Math.max(0, Math.min(99, q));
  if (!was && t.qty) { S.tags.splice(S.tags.indexOf(t), 1); S.tags.push(t); }      // выбранный из каталога встаёт в конец листа
}
function takeOff(t) {                                // с листа долой, в каталоге остаётся; совсем пустой ценник удаляется
  const i = S.tags.indexOf(t), q = t.qty, blank = !(t.name + t.price + t.comp).trim();
  if (blank) S.tags.splice(i, 1); else t.qty = 0;
  refresh(); toast(blank ? 'Пустой ценник удалён' : 'Убран с листа, остался в каталоге', () => { if (blank) S.tags.splice(i, 0, t); t.qty = q; refresh(); });
}
function onTap(e) {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const t = byId(b.closest('[data-id]').dataset.id), a = b.dataset.a, inCat = e.currentTarget.id === 'catList'; if (!t) return;
  if (a === 'open' || a === 'close') {
    if (inCat) { catOpen = a === 'open' && catOpen !== t.id ? t.id : null; renderCat(); const r = $('cr-' + t.id); if (catOpen && r) r.scrollIntoView({ block: 'nearest' }); }
    else { openId = a === 'open' && openId !== t.id ? t.id : null; renderList(); if (openId) $('r-' + t.id).scrollIntoView({ block: 'nearest' }); }
  }
  if (a === 'bg') bgOpen(t, 'tag');
  if (a === 'plus' || a === 'minus') {
    const q = t.qty + (a === 'plus' ? 1 : -1);
    if (!inCat && q < 1) return takeOff(t);
    setQty(t, q);
    if (inCat) { catRow(t); catSum(); renderList(); renderSheets(); } else { $('r-' + t.id).querySelector('.qty b').textContent = t.qty; renderSheets(); }
    save();
  }
  if (a === 'off') takeOff(t);
  if (a === 'dup') { const n = Object.assign({}, t, { id: uid(), at: Date.now() }); S.tags.splice(S.tags.indexOf(t) + 1, 0, n); openId = n.id; refresh(); }
  if (a === 'del') { const i = S.tags.indexOf(t); S.tags.splice(i, 1); catOpen = null; refresh(); toast('Удалён из каталога', () => { S.tags.splice(i, 0, t); refresh(); }); }
}
['list', 'catList'].forEach(id => { $(id).addEventListener('input', onEdit); $(id).addEventListener('click', onTap); });

/* ───── Каталог ───── */
let catOpen = null, catSort = 'name', catSeen = [];
const catMain = t => look(t).main;
const catWho = t => { const m = catMain(t); return `<b>${esc(t.name || 'Без названия')}</b><span>${esc(t.price || 'без цены')} · ${esc(m.name)}</span>${t.comp ? `<span>${esc(t.comp)}</span>` : ''}`; };
const catQty = t => t.qty ? `<div class="qty"><button data-a="minus" aria-label="Меньше копий">−</button><b>${t.qty}</b><button data-a="plus" aria-label="Больше копий">+</button></div>` : '<button class="btn pick" data-a="plus">На лист</button>';
function catRowHTML(t) {
  const m = catMain(t), open = catOpen === t.id;
  return `<div class="tag${open ? ' open' : ''}${t.qty ? ' picked' : ''}" id="cr-${t.id}" data-id="${t.id}"><div class="row">
    <button class="thumb lazy" data-a="open" aria-label="Изменить ${esc(t.name || 'ценник')}" style="background:linear-gradient(135deg,${m.c1},${m.c2})"></button>
    <button class="who" data-a="open" aria-expanded="${open}">${catWho(t)}</button>${catQty(t)}</div>${open ? editor(t, true) : ''}</div>`;
}
// миниатюры рисуются, только когда строка попала на экран
const lazy = new IntersectionObserver(list => list.forEach(x => {
  if (!x.isIntersecting) return; lazy.unobserve(x.target);
  const t = byId(x.target.closest('[data-id]').dataset.id); if (!t) return;
  symbol(t); x.target.innerHTML = use(t); x.target.style.background = 'none'; x.target.classList.remove('lazy');
}), { rootMargin: '200px' });
const catLazy = root => root.querySelectorAll('.lazy').forEach(e => lazy.observe(e));
function catFilter() {
  const words = E.nameKey($('catFind').value).split(' ').filter(Boolean), cat = $('catCat').value;
  const r = S.tags.filter(t => t.name.trim() && (!cat || catMain(t).id === cat) && words.every(w => (' ' + E.nameKey(t.name + ' ' + t.comp)).includes(' ' + w)));
  return r.sort(catSort === 'new' ? (a, b) => (b.at || 0) - (a.at || 0) || a.name.localeCompare(b.name, 'ru') : (a, b) => a.name.localeCompare(b.name, 'ru'));
}
function catSum() {
  const n = onSheet().reduce((k, t) => k + t.qty, 0), all = S.tags.filter(t => t.name.trim()).length, rest = catSeen.filter(t => !t.qty).length;
  $('catInfo').textContent = `В каталоге ${all}` + (catSeen.length !== all ? `, найдено ${catSeen.length}` : '') + `, на листе ${n}`;
  $('catAll').disabled = !rest; $('catAll').textContent = rest ? `Все найденные на лист (${rest})` : 'Все найденные на листе'; $('catNone').disabled = !n;
}
function renderCat() {
  const cnt = {}; S.tags.forEach(t => { if (t.name.trim()) { const id = catMain(t).id; cnt[id] = (cnt[id] || 0) + 1; } });
  const was = $('catCat').value; $('catCat').innerHTML = '<option value="">Все категории</option>' + cats().filter(c => cnt[c.id]).map(c => `<option value="${c.id}">${esc(c.name)} (${cnt[c.id]})</option>`).join(''); $('catCat').value = cnt[was] ? was : '';
  $('catSort').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.o === catSort));
  catSeen = catFilter(); if (catOpen && !catSeen.some(t => t.id === catOpen)) catOpen = null;
  const y = $('dCat').scrollTop;
  $('catList').innerHTML = catSeen.length ? catSeen.map(catRowHTML).join('') : `<div class="empty">${S.tags.some(t => t.name.trim()) ? 'Ничего не нашлось. Измените поиск или категорию.' : 'Каталог пуст. Загрузите список, и ценники появятся здесь.'}</div>`;
  catLazy($('catList')); $('dCat').scrollTop = y; catSum(); if (catOpen) { symbol(byId(catOpen)); fillEditor(byId(catOpen)); }
}
function catRow(t) { const r = $('cr-' + t.id); if (!r) return; const q = r.querySelector('.qty,.pick'); q.outerHTML = catQty(t); r.classList.toggle('picked', t.qty > 0); }
function catShow() { openId = null; renderList(); catOpen = null; $('catFind').value = ''; $('dCat').showModal(); renderCat(); $('dCat').scrollTop = 0; }
$('bCat').onclick = catShow; $('tabCat').onclick = catShow;
$('catFind').addEventListener('input', renderCat); $('catCat').addEventListener('change', renderCat);
$('catSort').addEventListener('click', e => { const o = e.target.dataset.o; if (o) { catSort = o; renderCat(); } });
$('catAll').onclick = () => { const add = catSeen.filter(t => !t.qty); add.forEach(t => setQty(t, 1)); refresh(); toast(`Добавлено на лист: ${add.length}`, () => { add.forEach(t => { t.qty = 0; }); refresh(); }); };
$('catNone').onclick = () => { const old = onSheet().map(t => [t, t.qty]); old.forEach(([t]) => { t.qty = 0; }); refresh(); toast('Лист очищен, каталог на месте', () => { old.forEach(([t, q]) => { t.qty = q; }); refresh(); }); };
$('catLoad').onclick = () => { $('dCat').close(); $('bBulk').click(); };
$('catOk').onclick = () => $('dCat').close();
$('dCat').addEventListener('close', () => { catOpen = null; renderList(); });

$('bAdd').onclick = () => {
  const t = { id: uid(), name: '', price: '', comp: '', kbju: '', qty: 1, cat: 'auto', style: '', at: Date.now() };
  S.tags.unshift(t); openId = t.id; view('list'); renderList(); renderSheets(); save(); $('left').scrollTop = 0; const n = $('n-' + t.id); if (n) n.focus();
};
$('bClear').onclick = () => { const old = S.tags; S.tags = S.tags.filter(t => !isDemo(t)); openId = null; refresh(); toast('Пример убран, ваши ценники остались', () => { S.tags = old; refresh(); }); };
document.querySelector('.bar').addEventListener('click', e => {
  const b = e.target.closest('[data-k]'); if (!b) return;
  const v = b.dataset.v; S.set[b.dataset.k] = v === 'true' ? true : v === 'false' ? false : v; all(); save();
});
$('inkAll').addEventListener('input', e => { S.set.ink = e.target.value; document.querySelectorAll('#sInk button').forEach(b => b.setAttribute('aria-pressed', 'false')); renderSheets(); if (openId) fillEditor(byId(openId)); save(); });
function view(v) { $('app').dataset.view = v; document.querySelectorAll('.tabs [data-view]').forEach(b => b.setAttribute('aria-pressed', b.dataset.view === v)); }
document.querySelector('.tabs').addEventListener('click', e => { if (e.target.dataset.view) view(e.target.dataset.view); });

/* ───── Редактор фона ───── */
let D = null;                                        // черновик: { t, bg, ink, scope, sel, main }
const clone = o => JSON.parse(JSON.stringify(o)), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function bgOpen(t, scope) {
  t = t || byId(openId) || onSheet()[0] || S.tags[0] || { id: 'sample', name: 'Торт «Медовик»', price: '390', comp: 'Мёд, масло сливочное, мука', cat: 'auto', style: '' };
  const v = look(t); D = { t, bg: clone(v.mesh), ink: v.ink, scope: S.tags.includes(t) ? scope : 'all', sel: 0, main: v.main, auto: v };
  $('bgText').setAttribute('viewBox', `0 0 ${calc(t).L.W} ${calc(t).L.H}`);
  $('bgScope').innerHTML = [['tag', 'Этому ценнику'], ['cat', 'Категории «' + v.main.name + '»'], ['all', 'Всем']].filter(x => x[0] !== 'tag' || S.tags.includes(t)).map(([k, n]) => `<button data-sc="${k}">${esc(n)}</button>`).join('');
  $('bgPre').innerHTML = `<button data-pre="auto"><canvas></canvas><span>Категория</span></button>` + E.PRESETS.map((p, i) => `<button data-pre="${i}"><canvas></canvas><span>${p.name}</span></button>`).join('');
  bgDraw(true); $('dBg').showModal();
}
const bgText = () => E.inkRGB(D.ink, E.rgb(D.main.c1));
function bgPresets() {
  const tx = bgText();
  [...$('bgPre').children].forEach(b => { const bg = b.dataset.pre === 'auto' ? autoBg() : E.PRESETS[+b.dataset.pre].bg; drawField(b.firstChild, Object.assign({}, bg, { guard: D.bg.guard }), tx, 42, 30); });
}
const autoBg = () => E.autoMesh(D.main, D.auto.second, cats().findIndex(x => x.id === D.main.id));
let bgRaf = 0;
function bgDraw(full) {
  cancelAnimationFrame(bgRaf);
  const run = () => {
    const tx = bgText(), P = E.meshPaint(D.bg, tx), pt = D.bg.pts[D.sel];
    drawField($('bgCv'), D.bg, tx, 154, 110);
    $('bgText').innerHTML = `<path fill="${E.hex(tx)}" d="${E.textPath(calc(D.t).L, FONT)}"/>`;
    if (full) $('bgDots').innerHTML = D.bg.pts.map((p, i) => `<button class="dot" data-i="${i}" aria-label="Цвет ${i + 1}"></button>`).join('');
    [...$('bgDots').children].forEach((b, i) => { const p = D.bg.pts[i]; b.style.left = p.x * 100 + '%'; b.style.top = p.y * 100 + '%'; b.style.background = p.c; b.classList.toggle('on', i === D.sel); });
    $('bgC').value = pt.c; $('bgS').value = pt.s; $('bgP').value = D.bg.p; $('bgW').value = D.bg.warp;
    $('bgDel').disabled = D.bg.pts.length < 3; $('bgAdd').disabled = D.bg.pts.length >= 12;
    const press = (id, k, v) => [...$(id).querySelectorAll('button')].forEach(b => b.setAttribute('aria-pressed', String(b.dataset[k]) === String(v)));
    press('bgMode', 'm', D.bg.mode); press('bgGuard', 'g', D.bg.guard); press('bgScope', 'sc', D.scope); press('bgInk', 'ik', D.ink);
    $('bgInkC').value = E.hex(tx);
    const r = P.ratio, ok = r >= 4.4, m = $('bgRatio');
    m.className = 'meta' + (r < 2.95 ? ' bad' : '');
    m.textContent = `Контраст букв ${r.toFixed(1).replace('.', ',')}: ` + (ok ? 'состав хорошо читается' : r >= 2.95 ? 'название и цена читаются, состав хуже' : 'буквы местами теряются на фоне');
    if (full) bgPresets();
  };
  if (full) run(); else bgRaf = requestAnimationFrame(run);
}
$('bgDots').addEventListener('pointerdown', e => {
  const b = e.target.closest('.dot'); if (!b) return; e.preventDefault();
  D.sel = +b.dataset.i; bgDraw();
  const box = $('bgDots').getBoundingClientRect(), p = D.bg.pts[D.sel], dx = e.clientX - box.left - p.x * box.width, dy = e.clientY - box.top - p.y * box.height;
  const move = ev => { p.x = +clamp((ev.clientX - dx - box.left) / box.width, 0, 1).toFixed(3); p.y = +clamp((ev.clientY - dy - box.top) / box.height, 0, 1).toFixed(3); bgDraw(); };
  const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up); };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});
$('bgDots').addEventListener('keydown', e => {
  const b = e.target.closest('.dot'), k = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!b || !k) return; e.preventDefault();
  const p = D.bg.pts[D.sel = +b.dataset.i]; p.x = clamp(p.x + k[0] * .03, 0, 1); p.y = clamp(p.y + k[1] * .03, 0, 1); bgDraw();
});
$('bgC').oninput = e => { D.bg.pts[D.sel].c = e.target.value; bgDraw(); };
$('bgS').oninput = e => { D.bg.pts[D.sel].s = +e.target.value; bgDraw(); };
$('bgP').oninput = e => { D.bg.p = +e.target.value; bgDraw(); };
$('bgW').oninput = e => { D.bg.warp = +e.target.value; bgDraw(); };
$('bgAdd').onclick = () => {
  const n = D.bg.pts.length, c = E.shade(D.bg.pts[D.sel].c, .06, 40, 1.1);
  // в самое свободное место
  let best = [0, .5, .5]; for (let y = .1; y < 1; y += .2) for (let x = .1; x < 1; x += .1) { const d = Math.min(...D.bg.pts.map(p => Math.hypot((p.x - x) * 1.4, p.y - y))); if (d > best[0]) best = [d, x, y]; }
  D.bg.pts.push({ c, x: +best[1].toFixed(2), y: +best[2].toFixed(2), s: 1 }); D.sel = n; bgDraw(true);
};
$('bgDel').onclick = () => { D.bg.pts.splice(D.sel, 1); D.sel = 0; bgDraw(true); };
$('bgMix').onclick = () => {
  const n = D.bg.pts.length, cols = Math.ceil(Math.sqrt(n * 1.4)), rows = Math.ceil(n / cols), cell = [...Array(cols * rows).keys()].sort(() => Math.random() - .5);
  D.bg.pts.forEach((p, i) => { p.x = +clamp((cell[i] % cols + Math.random()) / cols, 0, 1).toFixed(2); p.y = +clamp((Math.floor(cell[i] / cols) + Math.random()) / rows, 0, 1).toFixed(2); });
  D.bg.ph = +Math.random().toFixed(2); bgDraw();
};
$('bgNew').onclick = () => {
  const h = Math.random() * 360, step = [24, 34, 52, 150][Math.floor(Math.random() * 4)];
  D.bg.pts.forEach((p, i) => { p.c = E.shade('#C84B6E', -.12 + Math.random() * .22, h + (i % 3) * step + Math.random() * 14, .75 + Math.random() * .6); }); bgDraw();
};
$('bgPic').onclick = () => $('bgFile').click();
$('bgFile').onchange = async e => {                  // цвета и их места с картинки
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const url = URL.createObjectURL(f), im = new Image();
  try {
    await new Promise((ok, no) => { im.onload = ok; im.onerror = no; im.src = url; });
    const w = 40, h = 30, c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data, pts = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) {
      const X = Math.round((.03 + i / 3 * .94) * (w - 1)), Y = Math.round((.03 + j / 2 * .94) * (h - 1)), a = [0, 0, 0]; let n = 0;
      for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) { const xx = X + r, yy = Y + q; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const o = (yy * w + xx) * 4; a[0] += d[o]; a[1] += d[o + 1]; a[2] += d[o + 2]; n++; }
      pts.push({ c: E.hex(a.map(v => v / n)), x: +(i / 3).toFixed(2), y: j / 2, s: 1 });
    }
    Object.assign(D.bg, { pts, mode: 'flow', p: 1.8, warp: 0 }); D.sel = 0; bgDraw(true);
  } catch (err) { $('bgRatio').className = 'meta bad'; $('bgRatio').textContent = 'Не удалось открыть картинку. Подойдут JPG и PNG.'; }
  URL.revokeObjectURL(url);
};
$('dBg').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
  if (d.m) { D.bg.mode = d.m; bgDraw(); }
  if (d.g !== undefined) { D.bg.guard = +d.g; bgDraw(true); }
  if (d.sc) { D.scope = d.sc; bgDraw(); }
  if (d.ik) { D.ink = d.ik; bgDraw(true); }
  if (d.pre) { const g = D.bg.guard; D.bg = Object.assign(clone(d.pre === 'auto' ? autoBg() : E.PRESETS[+d.pre].bg), { guard: g }); D.sel = 0; bgDraw(true); }
});
$('bgInkC').oninput = e => { D.ink = e.target.value; bgDraw(); };
$('bgNo').onclick = () => $('dBg').close();
$('bgReset').onclick = () => {
  if (D.scope === 'tag') { D.t.bg = null; D.t.ink = ''; D.t.style = ''; }
  else if (D.scope === 'cat') { delete S.set.catBg[D.main.id]; delete S.set.catInk[D.main.id]; }
  else { S.set.bg = null; S.set.ink = 'white'; S.set.style = 'mesh'; }
  $('dBg').close(); all(); save();
};
$('bgOk').onclick = () => {
  const bg = clone(D.bg), def = S.set.ink;
  if (D.scope === 'tag') { D.t.bg = bg; D.t.ink = D.ink === def ? '' : D.ink; }
  else if (D.scope === 'cat') { S.set.catBg[D.main.id] = bg; if (D.ink === def) delete S.set.catInk[D.main.id]; else S.set.catInk[D.main.id] = D.ink; if (D.t.bg) { D.t.bg = null; D.t.ink = ''; } D.t.style = ''; }
  else { S.set.bg = bg; S.set.style = 'own'; S.set.ink = D.ink; S.set.catBg = {}; S.set.catInk = {}; S.tags.forEach(t => { t.bg = null; t.style = ''; t.ink = ''; }); }
  $('dBg').close(); all(); save();
};
$('bBg').onclick = () => bgOpen(null, 'all');

/* вставка списком */
const toTag = o => ({ id: uid(), name: o.name, price: o.price, comp: o.comp.charAt(0).toUpperCase() + o.comp.slice(1), kbju: o.kbju, qty: 0, cat: 'auto', style: '', at: Date.now() });
let found = [], merged = [];
function bulkView() {
  found = E.parseList($('bulk').value); const C = cats(), bad = found.filter(o => o.ask).length;
  merged = E.mergeList(S.tags.filter(t => !isDemo(t)), found);
  const fresh = merged.filter(r => !r.t).length, upd = merged.filter(r => r.diff.length).length;
  $('bulkSum').className = 'meta' + (bad ? ' bad' : '');
  $('bulkSum').textContent = found.length ? `Распознано: ${found.length}. Новых: ${fresh}` + (upd ? `, обновится: ${upd}` : '') + (merged.length - fresh - upd ? `, без изменений: ${merged.length - fresh - upd}` : '') + (bad ? `. Проверьте: ${bad}` : '') : '';
  $('bulkList').innerHTML = merged.map(({ o, t, diff, n }) => `<li class="${o.ask && !(t && o.ask === 'Нет цены') ? 'ask' : ''}"><i style="background:${E.classify(o, C, S.set.by).main.c1}"></i><div><b>${esc(o.name || '—')}${n > 1 ? ` × ${n}` : ''}</b>${o.comp ? `<span>Состав: ${esc(o.comp)}</span>` : t && t.comp ? '<span>состав из каталога</span>' : '<span>без состава</span>'}${o.kbju ? `<span>${esc(E.kbjuLine(o.kbju))}</span>` : ''}${t ? `<span class="upd">${diff.length ? 'Обновится: ' + esc(diff.join(', ')) : 'Уже в каталоге'}</span>` : ''}${o.ask && !(t && t.price && o.ask === 'Нет цены') ? `<em>${esc(o.ask)}</em>` : ''}</div><strong>${esc(o.price || (t && t.price) || '—')}</strong></li>`).join('');
  $('bulkOk').disabled = !found.length; $('bulkOk').textContent = found.length ? `Загрузить ${found.length}` : 'Загрузить';
  $('bulkNew').disabled = !$('bulkPut').checked;
}
$('bulkPut').addEventListener('change', bulkView);
$('bulk').addEventListener('input', bulkView);
$('bBulk').onclick = () => { $('dBulk').returnValue = ''; $('bulkNew').checked = false; $('bulkPut').checked = true; bulkView(); $('dBulk').showModal(); };
$('bulkPick').onclick = () => $('bulkFile').click();
$('bulkFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  const b = await f.arrayBuffer(); let t; try { t = new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (err) { t = new TextDecoder('windows-1251').decode(b); }
  $('bulk').value = t.replace(/^﻿/, ''); bulkView();
};
$('dBulk').querySelector('form').addEventListener('submit', e => {
  if (!e.submitter || e.submitter.id !== 'bulkOk') return;
  e.preventDefault(); if (!found.length) return; $('dBulk').close();
  const old = JSON.stringify(S.tags), lay = $('bulkPut').checked; let fresh = 0, upd = 0;
  S.tags = S.tags.filter(t => !isDemo(t));
  const rows = E.mergeList(S.tags, found);
  if (lay && $('bulkNew').checked) S.tags.forEach(t => { t.qty = 0; });
  rows.forEach(({ o, t, diff, n }) => {
    const v = toTag(o);
    if (!t) { t = v; S.tags.push(t); fresh++; } else if (diff.length) { if (o.price) t.price = o.price; if (o.comp) t.comp = v.comp; if (o.kbju) t.kbju = o.kbju; upd++; }
    if (lay) setQty(t, Math.max(t.qty, n));
  });
  $('bulk').value = ''; openId = null; all(); save();
  toast(`Новых в каталоге: ${fresh}` + (upd ? `, обновлено: ${upd}` : ''), () => { S.tags = JSON.parse(old); cache.clear(); all(); save(); });
});

/* PDF */
$('bPdf').onclick = async () => {
  renderSheets(); if (!PAGES.length) return;
  const pages = PAGES.map(p => Object.assign({}, p, { cards: p.cards.map(c => ({ x: c.x, y: c.y, it: calc(c.it) })) }));
  const d = new Date().toLocaleDateString('sv-SE'), name = `ценники ${d}.pdf`;
  const file = new File([E.pdf(pages, FONT, 'Ценники ' + d)], name, { type: 'application/pdf' });
  await deliver(file, 'PDF готов. Печатайте в масштабе 100%');
};
// на телефоне и планшете — меню «Поделиться», на компьютере — обычная загрузка
async function deliver(file, msg) {
  if (matchMedia('(pointer:coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  toast(msg);
}

/* перенос на другое устройство: список, фоны, настройки и свой шрифт одним файлом */
$('copySave').onclick = () => {
  const data = { app: 'cennik', v: 1, version: VERSION, state: S }, own = store.get('cennik-font');
  if (own) data.font = { name: fontTitle, b64: own };
  deliver(new File([JSON.stringify(data)], `ценники ${new Date().toLocaleDateString('sv-SE')}.json`, { type: 'application/json' }), 'Файл сохранён. Откройте его на другом устройстве');
};
const okHex = v => /^#[0-9a-f]{6}$/i.test(v), str = v => typeof v === 'string' ? v : v == null ? '' : String(v);
const INK = v => v === 'white' || v === 'dark' || v === 'auto' || okHex(v) ? v : '';
const okBg = b => b && Array.isArray(b.pts) && b.pts.length > 1 && b.pts.length <= 12 && b.pts.every(p => okHex(p.c) && [p.x, p.y, p.s].every(Number.isFinite))
  ? { mode: ['flow', 'blob', 'swirl'].includes(b.mode) ? b.mode : 'flow', p: +b.p || 1.5, warp: +b.warp || 0, ph: +b.ph || 0, guard: +b.guard || 0, pts: b.pts.map(p => ({ c: p.c, x: p.x, y: p.y, s: p.s })) } : null;
function readState(raw) {                            // берём из файла только то, что понимаем
  const q = raw.set || {}, set = {}, has = (o, k) => Object.prototype.hasOwnProperty.call(o || {}, k);
  ['dense', 'upper', 'strict'].forEach(k => { if (typeof q[k] === 'boolean') set[k] = q[k]; });
  if (['auto', 'A4'].includes(q.format)) set.format = q.format;
  if (['taste', 'type'].includes(q.by)) set.by = q.by;
  if (q.style === 'own' || E.STYLES.some(x => x[0] === q.style)) set.style = q.style;
  set.ink = INK(q.ink) || 'white'; set.bg = okBg(q.bg); set.v = 2; set.cats = {}; set.catBg = {}; set.catInk = {}; set.spec = {};
  if (set.style === 'own' && !set.bg) set.style = 'mesh';
  E.CATS.forEach(({ id }) => {
    const c = has(q.cats, id) ? q.cats[id] : null, o = {}; if (c) { if (okHex(c.c1)) o.c1 = c.c1; if (okHex(c.c2)) o.c2 = c.c2; if (typeof c.kw === 'string') o.kw = c.kw; set.cats[id] = o; }
    if (has(q.catBg, id) && okBg(q.catBg[id])) set.catBg[id] = okBg(q.catBg[id]);
    if (has(q.catInk, id) && INK(q.catInk[id])) set.catInk[id] = INK(q.catInk[id]);
  });
  Object.keys(E.SPEC).forEach(k => { const v = (q.spec || {})[k]; if (k === 'shape' ? E.CORNERS[v] : Number.isFinite(v) && v >= 0) set.spec[k] = v; });
  return tune({ set, tags: raw.tags.slice(0, 2000).map(t => ({ id: uid(), name: str(t.name), price: str(t.price), comp: str(t.comp), kbju: str(t.kbju), qty: clamp(Math.round(+t.qty) || 0, 0, 99),
    cat: E.CATS.some(c => c.id === t.cat) ? t.cat : 'auto', style: E.STYLES.some(x => x[0] === t.style) ? t.style : '', ink: INK(t.ink), bg: okBg(t.bg), at: +t.at || 0 })) });
}
$('copyOpen').onclick = () => $('copyFile').click();
$('copyFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const d = JSON.parse(await f.text()); if (d.app !== 'cennik' || !d.state || !Array.isArray(d.state.tags)) throw 0;
    const old = S, next = readState(d.state);
    if (d.font && typeof d.font.b64 === 'string') try { useFont(d.font.b64); fontTitle = str(d.font.name) || 'Свой шрифт'; next.set.font = fontTitle; store.set('cennik-font', d.font.b64); } catch (err) { useFont(store.get('cennik-font') || FONT_B64); }
    S = next; cache.clear(); openId = null; $('dSet').close(); all(); save();
    toast(`Открыто ценников: ${S.tags.length}`, () => { S = old; cache.clear(); all(); save(); });
  } catch (err) { $('copyMsg').textContent = 'Это не файл «Ценников». Нужен файл, сохранённый кнопкой слева.'; }
};

/* настройки */
const SPEC_L = [['w', 'Ширина, мм'], ['h', 'Высота, мм'], ['pad', 'Отступ, мм'], ['price', 'Цена, pt'], ['comp', 'Состав, pt'], ['titleMax', 'Название до, pt'], ['titleMin', 'Название от, pt']];
/* установка */
let installEvt = null;
const alone = () => matchMedia('(display-mode: standalone)').matches || !!navigator.standalone;
const HOW = {
  ios: ['iPad и iPhone', ['Откройте эту страницу в Safari', 'Нажмите «Поделиться» (квадрат со стрелкой вверх)', 'Выберите «На экран “Домой”», затем «Добавить»']],
  android: ['Телефон Android', ['Откройте эту страницу в Chrome', 'Откройте меню ⋮ и выберите «Установить приложение» или «Добавить на главный экран»', 'Подтвердите установку']],
  win: ['Компьютер Windows', ['Откройте эту страницу в Chrome, Edge или Яндекс Браузере', 'Нажмите значок установки справа в адресной строке. В Edge он есть и в меню: «Приложения», «Установить этот сайт как приложение»', 'Ярлык появится в меню «Пуск» и на рабочем столе']],
  mac: ['Компьютер Mac', ['В Safari: меню «Файл», «Добавить в Dock»', 'В Chrome: значок установки справа в адресной строке']]
};
const platform = () => { const u = navigator.userAgent; return /iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1) ? 'ios' : /Android/.test(u) ? 'android' : /Macintosh/.test(u) ? 'mac' : 'win'; };
function instShow() {
  const me = platform(), ol = k => `<ol>${HOW[k][1].map(x => `<li>${x}</li>`).join('')}</ol>`;
  $('instBody').innerHTML = (installEvt ? '<button class="btn main" id="instBtn">Установить на это устройство</button>' : `<p>${HOW[me][0]}</p>${ol(me)}`)
    + (me === 'ios' || me === 'android' ? '<p>Если страница открылась внутри Telegram или другого приложения, сначала выберите «Открыть в браузере».</p>' : '')
    + Object.keys(HOW).filter(k => k !== me || installEvt).map(k => `<details><summary>${HOW[k][0]}</summary>${ol(k)}</details>`).join('');
  const b = $('instBtn'); if (b) b.onclick = async () => { const ev = installEvt; installEvt = null; ev.prompt(); await ev.userChoice.catch(() => {}); $('dInst').close(); };
  if (!$('dInst').open) $('dInst').showModal();
}
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if ($('dInst').open) instShow(); });
addEventListener('appinstalled', () => { $('bInst').hidden = true; toast('Приложение установлено'); });
$('bInst').hidden = alone();
$('bInst').onclick = instShow;
$('instClose').onclick = () => $('dInst').close();
$('instCopy').onclick = async e => {
  const url = location.href.split(/[?#]/)[0];
  try { await navigator.clipboard.writeText(url); e.target.textContent = 'Ссылка скопирована'; } catch (err) { $('instUrl').textContent = url; }
};
if (alone() && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

function renderSet() {
  $('inst').textContent = (alone() ? 'Приложение установлено и работает без интернета. ' : '') + 'Версия ' + VERSION; $('copyMsg').textContent = '';
  $('upper').checked = S.set.upper; $('strict').checked = S.set.strict; $('fontName').textContent = 'Сейчас: ' + fontTitle;
  $('cats').innerHTML = cats().map(c => `<div class="cat" data-c="${c.id}"><input type="color" data-p="c1" value="${c.c1}" aria-label="Основной цвет: ${esc(c.name)}"><input type="color" data-p="c2" value="${c.c2}" aria-label="Второй цвет: ${esc(c.name)}"><div><b>${esc(c.name)}</b>${c.id === 'classic' ? '<p style="font-size:13px">Если ничего не подошло</p>' : `<textarea rows="2" data-p="kw" aria-label="Слова: ${esc(c.name)}">${esc(c.kw)}</textarea>`}</div></div>`).join('');
  const sp = spec(); $('spec').innerHTML = SPEC_L.map(([k, n]) => `<label>${n}<input type="number" step="0.1" min="0.5" id="sp-${k}" data-s="${k}" value="${sp[k]}"></label>`).join('');
}
$('bSet').onclick = () => { renderSet(); $('dSet').showModal(); };
$('setClose').onclick = () => $('dSet').close();
$('dSet').addEventListener('close', () => { all(); save(); });
$('upper').onchange = e => { S.set.upper = e.target.checked; };
$('strict').onchange = e => { S.set.strict = e.target.checked; };
$('cats').addEventListener('input', e => { const id = e.target.closest('[data-c]').dataset.c; S.set.cats[id] = Object.assign({}, S.set.cats[id], { [e.target.dataset.p]: e.target.value }); });
$('spec').addEventListener('input', e => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0) S.set.spec[e.target.dataset.s] = v; });
$('catReset').onclick = () => { S.set.cats = {}; renderSet(); };
$('specReset').onclick = () => { S.set.spec = {}; renderSet(); };
$('fontPick').onclick = () => $('fontFile').click();
$('fontFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try {
    const u = new Uint8Array(await f.arrayBuffer()); let s = ''; for (let i = 0; i < u.length; i += 8192) s += String.fromCharCode.apply(null, u.subarray(i, i + 8192));
    const b = btoa(s); useFont(b); fontTitle = f.name; S.set.font = f.name; cache.clear();
    if (!store.set('cennik-font', b)) toast('Шрифт работает до закрытия: не хватило места для сохранения');
    renderSet();
  } catch (err) { $('fontName').textContent = err.message; }
};
$('fontReset').onclick = () => { store.del('cennik-font'); useFont(FONT_B64); fontTitle = 'Geometria Bold'; cache.clear(); renderSet(); };

let tT = 0;
function toast(msg, undo) {
  const el = $('toast'), b = el.querySelector('button'), top = [...document.querySelectorAll('dialog[open]')].pop(); (top || document.body).appendChild(el); el.querySelector('span').textContent = msg; b.hidden = !undo; el.hidden = false;
  b.onclick = () => { el.hidden = true; undo(); }; clearTimeout(tT); tT = setTimeout(() => el.hidden = true, 6000);
}

document.querySelectorAll('dialog').forEach(d => d.addEventListener('close', () => { if (d.contains($('toast'))) document.body.appendChild($('toast')); }));
view('list'); all();
window.__app = { get S() { return S; }, calc, pages: () => PAGES, font: () => FONT };
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
