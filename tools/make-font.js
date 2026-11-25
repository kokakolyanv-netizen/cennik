/* Собирает app/font.js из TTF: оставляет только нужные знаки (русский, латиница, цифры, пунктуация).
   node tools/make-font.js путь/к/шрифту.ttf */
const fs = require('fs'), path = require('path');
const E = require('../app/engine.js');
const src = fs.readFileSync(process.argv[2]), u8 = new Uint8Array(src), buf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length);
const font = E.parseFont(buf), dv = new DataView(buf), T = {};
for (let i = 0; i < dv.getUint16(4); i++) { const o = 12 + 16 * i; T[src.toString('latin1', o, o + 4)] = { o: dv.getUint32(o + 8), l: dv.getUint32(o + 12) }; }
const need = new Set([0]), add = (a, b) => { for (let c = a; c <= (b || a); c++) need.add(font.gid(c)); };
add(0x20, 0x7E); add(0xA0, 0xFF); add(0x400, 0x45F); add(0x490, 0x491); add(0x2010, 0x2015); add(0x2018, 0x201E); add(0x2020, 0x2022); add(0x2026); add(0x2030); add(0x2039, 0x203A); add(0x20AC); add(0x20BD); add(0x2116); add(0x2122); add(0x2212);
const long = dv.getInt16(T.head.o + 50) === 1, n = dv.getUint16(T.maxp.o + 4), loca = g => long ? dv.getUint32(T.loca.o + 4 * g) : 2 * dv.getUint16(T.loca.o + 2 * g);
const parts = g => { const a = loca(g), b = loca(g + 1); if (a === b || dv.getInt16(T.glyf.o + a) >= 0) return; let o = T.glyf.o + a + 10, f; do { f = dv.getUint16(o); const s = dv.getUint16(o + 2); if (!need.has(s)) { need.add(s); parts(s); } o += 4 + (f & 1 ? 4 : 2) + (f & 8 ? 2 : f & 0x40 ? 4 : f & 0x80 ? 8 : 0); } while (f & 0x20); };
[...need].forEach(parts);
const glyf = [], off = Buffer.alloc(4 * (n + 1)); let at = 0;
for (let g = 0; g < n; g++) { off.writeUInt32BE(at, 4 * g); if (!need.has(g)) continue; const b = src.subarray(T.glyf.o + loca(g), T.glyf.o + loca(g + 1)), pad = (4 - b.length % 4) % 4; glyf.push(b, Buffer.alloc(pad)); at += b.length + pad; }
off.writeUInt32BE(at, 4 * n);
const out = {}; for (const t of Object.keys(T)) if (!['DSIG', 'GSUB', 'GDEF', 'hdmx', 'VDMX', 'LTSH'].includes(t)) out[t] = Buffer.from(src.subarray(T[t].o, T[t].o + T[t].l));
out.glyf = Buffer.concat(glyf); out.loca = off; out.head.writeInt16BE(1, 50); out.head.writeUInt32BE(0, 8);
const tags = Object.keys(out).sort(), k = Math.floor(Math.log2(tags.length)), head = Buffer.alloc(12 + 16 * tags.length), body = []; let pos = head.length;
head.writeUInt32BE(0x10000, 0); head.writeUInt16BE(tags.length, 4); head.writeUInt16BE(16 << k, 6); head.writeUInt16BE(k, 8); head.writeUInt16BE(16 * tags.length - (16 << k), 10);
const sum = b => { let s = 0; for (let i = 0; i < b.length; i += 4) s = (s + (b.readUInt32BE(i))) >>> 0; return s; };
tags.forEach((t, i) => { const l = out[t].length, b = Buffer.concat([out[t], Buffer.alloc((4 - l % 4) % 4)]); head.write(t, 12 + 16 * i, 'latin1'); head.writeUInt32BE(sum(b), 16 + 16 * i); head.writeUInt32BE(pos, 20 + 16 * i); head.writeUInt32BE(l, 24 + 16 * i); body.push(b); pos += b.length; });
const file = Buffer.concat([head, ...body]);
fs.writeFileSync(path.join(__dirname, '../app/font.js'), '/* Встроенный шрифт, собран tools/make-font.js */\nself.FONT_B64="' + file.toString('base64') + '";\n');
console.log('знаков:', need.size, 'из', n, '| было', src.length, 'стало', file.length);
