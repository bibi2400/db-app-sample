const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '../../..');
const build = path.join(root, 'dist/db-app-sample/browser');
const artifacts = path.join(root, '.tmp-toolbar-browser');
const contentTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
};
let window;
let server;

function evaluate(fn, ...args) {
  return window.webContents.executeJavaScript(
    `(${fn.toString()})(...${JSON.stringify(args)})`,
  );
}

async function settle() {
  await evaluate(() => new Promise(resolve => setTimeout(resolve, 80)));
}

async function run() {
  await fs.access(path.join(build, 'index.html'));
  await fs.mkdir(artifacts, { recursive: true });
  app.setPath('userData', path.join(artifacts, 'profile'));
  await app.whenReady();
  server = http.createServer(async (request, response) => {
    try {
      const relative = new URL(request.url, 'http://localhost').pathname.replace(/^\/+/, '');
      const filename = path.resolve(build, relative || 'index.html');
      if (!filename.startsWith(build + path.sep)) {
        response.writeHead(403).end();
        return;
      }
      let data;
      try {
        data = await fs.readFile(filename);
      } catch {
        if (path.extname(filename)) {
          response.writeHead(404).end();
          return;
        }
        response.setHeader('Content-Type', 'text/html');
        response.end(await fs.readFile(path.join(build, 'index.html')));
        return;
      }
      response.setHeader('Content-Type', contentTypes[path.extname(filename)] ?? 'application/octet-stream');
      response.end(data);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  window = new BrowserWindow({
    show: false,
    width: 1440,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'toolbar-preload.cjs'),
      partition: 'toolbar-notice-test',
      backgroundThrottling: false,
    },
  });
  const errors = [];
  window.webContents.on('console-message', event => {
    if (event.level === 'error') errors.push(event.message);
  });
  await window.loadURL(`http://127.0.0.1:${server.address().port}/updates`);
  for (let attempt = 0; attempt < 50; attempt++) {
    if (await evaluate(() => !!document.querySelector('.update-notice'))) break;
    await settle();
  }
  assert.equal(await evaluate(() => document.querySelector('.update-notice')?.textContent.trim()),
    'Aggiornamento pronto da installare');
  await evaluate(() => {
    const toolbar = ng.getComponent(document.querySelector('eaf-toolbar'));
    const nav = toolbar.navigationService;
    nav.setTitle('Titolo della pagina molto lungo con informazioni aggiuntive');
    nav.toolbarNotices.set([
      { id: 'one', label: 'Avviso custom con un testo lungo e leggibile', callback: () => {} },
      { id: 'two', label: 'AvvisoSenzaSpazi'.repeat(5), callback: () => {} },
    ]);
    nav.setToolbarActions(() => {}, () => {}, [
      { label: 'Azione custom', icon: 'info', callback: () => {} },
    ]);
  });
  const measurements = [];
  for (const width of [1440, 960, 600, 360, 320]) {
    window.setContentSize(width, 1000);
    await settle();
    for (const color of ['#ffffff', '#111111', '#f4dc00', '#123faf']) {
      await evaluate(color => {
        const nav = ng.getComponent(document.querySelector('eaf-toolbar')).navigationService;
        nav.toolbarColor.set(color);
        nav.toolbarTextColor.set(color === '#ffffff' || color === '#f4dc00' ? '#111111' : '#ffffff');
      }, color);
      await settle();
      const geometry = await evaluate(() => {
        const toolbar = document.querySelector('eaf-toolbar mat-toolbar');
        const rect = toolbar.getBoundingClientRect();
        const elements = [...toolbar.children].filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0;
        });
        const overflow = elements.filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.left < rect.left - 1 || bounds.right > rect.right + 1 ||
            bounds.bottom > rect.bottom + 1;
        }).map(element => element.className);
        const overlap = [];
        elements.forEach((element, index) => {
          const a = element.getBoundingClientRect();
          for (const other of elements.slice(index + 1)) {
            const b = other.getBoundingClientRect();
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
              overlap.push([element.className, other.className]);
            }
          }
        });
        const notice = document.querySelector('.update-notice');
        const style = getComputedStyle(notice);
        const luminance = color => {
          const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
            const channel = value / 255;
            return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const values = [luminance(style.color), luminance(style.backgroundColor)].sort((a, b) => a - b);
        return {
          width: innerWidth,
          height: rect.height,
          overflow,
          overlap,
          contrast: (values[1] + 0.05) / (values[0] + 0.05),
          contentTop: document.querySelector('.main-container').getBoundingClientRect().top,
          toolbarBottom: rect.bottom,
          clippedNotices: [...document.querySelectorAll('.toolbar-notice')].some(element =>
            element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1),
        };
      });
      assert.equal(geometry.width, width);
      assert.deepEqual(geometry.overflow, [], JSON.stringify(geometry));
      assert.deepEqual(geometry.overlap, [], JSON.stringify(geometry));
      assert.equal(geometry.clippedNotices, false, JSON.stringify(geometry));
      assert.ok(geometry.contrast >= 4.5, JSON.stringify(geometry));
      assert.ok(geometry.contentTop >= geometry.toolbarBottom - 1, JSON.stringify(geometry));
      measurements.push({ color, ...geometry });
    }
    await fs.writeFile(path.join(artifacts, `toolbar-${width}.png`),
      (await window.webContents.capturePage()).toPNG());
  }
  for (const status of ['idle', 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'error']) {
    await evaluate(status => window.toolbarFixture.push(status), status);
    await settle();
    const label = await evaluate(() => document.querySelector('.update-notice')?.textContent.trim() ?? null);
    assert.equal(label, status === 'available' ? 'Aggiornamento disponibile' :
      status === 'downloaded' ? 'Aggiornamento pronto da installare' : null);
  }
  await evaluate(() => {
    const nav = ng.getComponent(document.querySelector('eaf-toolbar')).navigationService;
    nav.router.navigate(['/shortcuts']);
    window.toolbarFixture.push('available');
  });
  await settle();
  await evaluate(() => document.querySelector('.update-notice').click());
  await settle();
  assert.equal(await evaluate(() => location.pathname), '/updates');
  assert.deepEqual(await evaluate(() => window.toolbarFixture.calls().filter(channel =>
    ['update:check', 'update:download', 'update:install'].includes(channel))), []);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(artifacts, 'measurements.json'), JSON.stringify(measurements, null, 2));
  console.log('PASS: 20 layout/contrast scenarios, 7 states, navigation without updater operations');
}

const deadline = setTimeout(() => {
  console.error('Toolbar browser test timed out');
  app.exit(1);
}, 60000);

run().then(() => {
  clearTimeout(deadline);
  server?.close();
  window?.destroy();
  app.exit(0);
}).catch(error => {
  console.error(error);
  clearTimeout(deadline);
  server?.close();
  window?.destroy();
  app.exit(1);
});
