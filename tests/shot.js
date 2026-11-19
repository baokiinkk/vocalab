/* Screenshot helper: node tests/shot.js <hash> <device|all> [outDir]
   e.g. node tests/shot.js '#/today' all /path/to/shots */
const { launch, open } = require('./pw');
(async () => {
  const [hash = '#/today', dev = 'all', out = __dirname + '/shots'] = process.argv.slice(2);
  require('fs').mkdirSync(out, { recursive: true });
  const b = await launch();
  for (const d of dev === 'all' ? ['laptop', 'ipad', 'iphone'] : [dev]) {
    const p = await open(b, d, hash);
    await p.waitForTimeout(300);
    const f = out + '/' + hash.replace(/[^a-z0-9]+/gi, '_') + '-' + d + '.png';
    await p.screenshot({ path: f, fullPage: true });
    console.log(f, p.errors.length ? 'ERRORS: ' + p.errors.join(' | ') : 'no console errors');
    await p.context().close();
  }
  await b.close();
})();
