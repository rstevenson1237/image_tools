// variants.js - demonstrates T2's procedural payoff: N seeded hero variants on one sheet.
//   node variants.js [count]
const fs = require('fs'); const { createCanvas } = require('@napi-rs/canvas');
const hero = require('./techniques/t2/hero.v2.js');
const n = +(process.argv[2] || 8), S = 6, c = createCanvas(n * 32 * S, 32 * S), ctx = c.getContext('2d');
ctx.fillStyle = '#4f8a3c'; ctx.fillRect(0, 0, c.width, c.height); ctx.imageSmoothingEnabled = false;
for (let i = 0; i < n; i++) ctx.drawImage(hero.render(i + 1).toCanvas(S), i * 32 * S, 0);
fs.writeFileSync('out/t2-hero-variants.png', c.toBuffer('image/png')); console.log('out/t2-hero-variants.png');
