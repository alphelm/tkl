const fs = require('fs');
const path = require('path');

let header = fs.readFileSync('header.html', 'utf8');
const footer = fs.readFileSync('footer.html', 'utf8');
const bundle = fs.readFileSync('dist/bundle.js', 'utf8');

const b64 = (p) => fs.readFileSync(p, 'utf8').trim();
header = header
  .replace('__FRAUNCES_600__', b64('b64/fraunces-600.txt'))
  .replace('__FRAUNCES_900__', b64('b64/fraunces-900.txt'))
  .replace('__JBMONO_400__', b64('b64/jbmono-400.txt'))
  .replace('__JBMONO_600__', b64('b64/jbmono-600.txt'));

const out = header + '\n<script>\n' + bundle + '\n</script>\n' + footer;
fs.writeFileSync('dist/coffee-cooling-station.html', out);
console.log('wrote dist/coffee-cooling-station.html', (out.length / 1024).toFixed(0) + 'KB');
