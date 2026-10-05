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

async function capture(filename) {
  window.webContents.invalidate();
  await settle();
  await fs.writeFile(path.join(artifacts, filename),
    (await window.webContents.capturePage()).toPNG());
}

async function verifyNoticeIcons(expectedIcons) {
  const notices = await evaluate(() => [...document.querySelectorAll('.toolbar-notice')].map(notice => {
    const icon = notice.querySelector('mat-icon');
    const label = notice.querySelector('.toolbar-notice-label').getBoundingClientRect();
    const bounds = notice.getBoundingClientRect();
    const iconBounds = icon?.getBoundingClientRect();
    return {
      icon: icon?.textContent.trim() ?? null,
      hidden: icon?.getAttribute('aria-hidden'),
      color: getComputedStyle(notice).color,
      iconColor: icon ? getComputedStyle(icon).color : null,
      iconWidth: iconBounds?.width,
      iconHeight: iconBounds?.height,
      gap: iconBounds ? label.left - iconBounds.right : null,
      centerOffset: iconBounds ? (iconBounds.top + iconBounds.bottom - label.top - label.bottom) / 2 : null,
      clipped: notice.scrollWidth > notice.clientWidth + 1 ||
        notice.scrollHeight > notice.clientHeight + 1 ||
        label.right > bounds.right + 1,
    };
  }));
  if (expectedIcons) assert.deepEqual(notices.map(notice => notice.icon), expectedIcons);
  for (const notice of notices) {
    assert.equal(notice.clipped, false, JSON.stringify(notice));
    if (!notice.icon) continue;
    assert.equal(notice.hidden, 'true');
    assert.equal(notice.iconColor, notice.color);
    assert.equal(notice.iconWidth, 20);
    assert.equal(notice.iconHeight, 20);
    assert.ok(Math.abs(notice.gap - 8) < 1, JSON.stringify(notice));
    assert.ok(Math.abs(notice.centerOffset) < 1, JSON.stringify(notice));
  }
}

async function verifyBackgroundLogo() {
  const geometry = await evaluate(() => {
    const toolbar = document.querySelector('eaf-toolbar mat-toolbar');
    const logo = toolbar.querySelector('.toolbar-center-logo');
    const image = logo.querySelector('img');
    const bounds = toolbar.getBoundingClientRect();
    const imageBounds = image.getBoundingClientRect();
    const controls = [...toolbar.querySelectorAll('button, a')];
    const before = controls.map(control => control.getBoundingClientRect().toJSON());
    const reachable = controls.every(control => {
      const rect = control.getBoundingClientRect();
      const target = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return control.contains(target);
    });
    logo.style.display = 'none';
    const withoutLogo = toolbar.getBoundingClientRect().toJSON();
    const after = controls.map(control => control.getBoundingClientRect().toJSON());
    logo.style.removeProperty('display');
    return {
      loaded: image.complete && image.naturalWidth > 0,
      centerX: (imageBounds.left + imageBounds.right - bounds.left - bounds.right) / 2,
      centerY: (imageBounds.top + imageBounds.bottom - bounds.top - bounds.bottom) / 2,
      width: imageBounds.width,
      height: imageBounds.height,
      hidden: logo.getAttribute('aria-hidden'),
      pointerEvents: getComputedStyle(image).pointerEvents,
      backgroundLayer: getComputedStyle(logo).zIndex,
      isolated: getComputedStyle(toolbar).isolation,
      withLogo: bounds.toJSON(),
      withoutLogo,
      before,
      after,
      reachable,
    };
  });
  assert.equal(geometry.loaded, true);
  assert.ok(Math.abs(geometry.centerX) < 1, JSON.stringify(geometry));
  assert.ok(Math.abs(geometry.centerY) < 1, JSON.stringify(geometry));
  assert.ok(geometry.width > 0 && geometry.height > 0 && geometry.height <= 40);
  assert.equal(geometry.hidden, 'true');
  assert.equal(geometry.pointerEvents, 'none');
  assert.equal(geometry.backgroundLayer, '-1');
  assert.equal(geometry.isolated, 'isolate');
  assert.deepEqual(geometry.withLogo, geometry.withoutLogo);
  assert.deepEqual(geometry.before, geometry.after);
  assert.equal(geometry.reachable, true);
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
  assert.equal(await evaluate(() => document.querySelector('.update-notice .toolbar-notice-label')?.textContent),
    'Aggiornamento pronto da installare');
  await evaluate(() => {
    const toolbar = ng.getComponent(document.querySelector('eaf-toolbar'));
    const nav = toolbar.navigationService;
    nav.setTitle('Titolo della pagina molto lungo con informazioni aggiuntive');
    nav.toolbarNotices.set([
      {
        id: 'one',
        label: 'Avviso custom con un testo lungo e leggibile',
        icon: 'warning_amber',
        callback: () => {},
      },
      { id: 'two', label: 'AvvisoSenzaSpazi'.repeat(5), callback: () => {} },
    ]);
    nav.setToolbarActions(() => {}, () => {}, [
      { label: 'Azione custom', icon: 'info', callback: () => {} },
    ]);
  });
  const measurements = [];
  const variants = ['title', 'center', 'right'].flatMap(position =>
    ['rectangle', 'rounded', 'pill'].flatMap(shape =>
      ['#ffffff', '#111111', '#f4dc00', '#123faf'].map(color => ({ position, shape, color })),
    ),
  );
  for (const width of [1440, 960, 801, 800, 600, 360, 320]) {
    window.setContentSize(width, 1000);
    await settle();
    for (const { position, shape, color } of variants) {
      await evaluate((position, shape, color) => {
        const nav = ng.getComponent(document.querySelector('eaf-toolbar')).navigationService;
        nav.toolbarNoticePosition.set(position);
        nav.toolbarNoticeShape.set(shape);
        nav.toolbarColor.set(color);
        nav.toolbarTextColor.set(color === '#ffffff' || color === '#f4dc00' ? '#111111' : '#ffffff');
      }, position, shape, color);
      await settle();
      const geometry = await evaluate(() => {
        const toolbar = document.querySelector('eaf-toolbar mat-toolbar');
        const rect = toolbar.getBoundingClientRect();
        const elements = [...toolbar.querySelectorAll(
          ':scope > *, :scope > .toolbar-leading > *, :scope > .toolbar-commands > *',
        )].filter(element => {
          const bounds = element.getBoundingClientRect();
          return bounds.width > 0 && bounds.height > 0 &&
            !element.classList.contains('toolbar-center-logo');
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
            if (element.contains(other) || other.contains(element)) continue;
            const b = other.getBoundingClientRect();
            if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 &&
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1) {
              overlap.push([element.className, other.className]);
            }
          }
        });
        const notice = document.querySelector('.update-notice');
        const group = document.querySelector('.toolbar-notices').getBoundingClientRect();
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
          centerOffset: (group.left + group.right) / 2 - innerWidth / 2,
          radius: style.borderTopLeftRadius,
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
      assert.equal(geometry.radius, { rectangle: '0px', rounded: '6px', pill: '999px' }[shape]);
      if (position === 'center') {
        assert.ok(Math.abs(geometry.centerOffset) < 1, JSON.stringify(geometry));
      }
      assert.deepEqual(geometry.overflow, [], JSON.stringify(geometry));
      assert.deepEqual(geometry.overlap, [], JSON.stringify(geometry));
      assert.equal(geometry.clippedNotices, false, JSON.stringify(geometry));
      assert.ok(geometry.contrast >= 4.5, JSON.stringify(geometry));
      assert.ok(geometry.contentTop >= geometry.toolbarBottom - 1, JSON.stringify(geometry));
      await verifyNoticeIcons(['system_update', 'warning_amber', null]);
      await verifyBackgroundLogo();
      measurements.push({ position, shape, color, ...geometry });
      if (shape === 'rounded' && color === '#123faf') {
        await capture(`toolbar-${position}-${width}.png`);
      }
    }
    await capture(`toolbar-${width}.png`);
  }
  await evaluate(() => {
    const toolbar = document.querySelector('eaf-toolbar');
    const properties = {
      background: '#fff3cd',
      color: '#332701',
      border: '2px dashed #332701',
      'border-radius': '10px',
      'font-size': '16px',
      'line-height': '24px',
      'min-height': '48px',
      'max-width': '240px',
      'padding-block': '10px',
      'padding-inline': '18px',
      gap: '12px',
      'group-padding-inline': '4px',
    };
    for (const [name, value] of Object.entries(properties)) {
      toolbar.style.setProperty(`--eaf-toolbar-notice-${name}`, value);
    }
  });
  await settle();
  const styled = await evaluate(() => {
    const notices = [...document.querySelectorAll('.toolbar-notice')];
    const group = getComputedStyle(document.querySelector('.toolbar-notices'));
    return {
      gap: group.gap,
      groupPadding: group.paddingInlineStart,
      notices: notices.map(notice => {
        const style = getComputedStyle(notice);
        return {
          color: style.color,
          background: style.backgroundColor,
          borderWidth: style.borderTopWidth,
          borderStyle: style.borderTopStyle,
          radius: style.borderTopLeftRadius,
          fontSize: style.fontSize,
          lineHeight: style.lineHeight,
          paddingBlock: style.paddingBlockStart,
          paddingInline: style.paddingInlineStart,
          minHeight: style.minHeight,
          width: notice.getBoundingClientRect().width,
          clipped: notice.scrollWidth > notice.clientWidth + 1,
        };
      }),
    };
  });
  assert.equal(styled.gap, '12px');
  assert.equal(styled.groupPadding, '4px');
  for (const notice of styled.notices) {
    assert.ok(notice.width <= 240);
    assert.equal(notice.clipped, false);
    const { width, clipped, ...style } = notice;
    assert.deepEqual(style, {
      color: 'rgb(51, 39, 1)',
      background: 'rgb(255, 243, 205)',
      borderWidth: '2px',
      borderStyle: 'dashed',
      radius: '10px',
      fontSize: '16px',
      lineHeight: '24px',
      paddingBlock: '10px',
      paddingInline: '18px',
      minHeight: '48px',
    });
  }
  await verifyNoticeIcons(['system_update', 'warning_amber', null]);
  await evaluate(() => {
    const toolbar = document.querySelector('eaf-toolbar');
    toolbar.style.removeProperty('--eaf-toolbar-notice-border-radius');
    toolbar.style.removeProperty('--eaf-toolbar-notice-max-width');
    const nav = ng.getComponent(toolbar).navigationService;
    nav.toolbarNoticePosition.set('center');
    nav.toolbarNoticeShape.set('pill');
  });
  const iconVariants = [
    { update: 'system_update', custom: 'warning_amber' },
    { update: 'download', custom: undefined },
    { update: null, custom: 'warning_amber' },
    { update: null, custom: undefined },
  ];
  let iconScenarios = 0;
  window.webContents.debugger.attach('1.3');
  await window.webContents.debugger.sendCommand('Accessibility.enable');
  for (const width of [1440, 960, 801, 800, 600, 360, 320]) {
    window.setContentSize(width, 1000);
    for (const status of ['available', 'downloaded']) {
      for (const icons of iconVariants) {
        await evaluate((status, icons) => {
          const nav = ng.getComponent(document.querySelector('eaf-toolbar')).navigationService;
          window.toolbarFixture.push(status);
          nav.updateNoticeIcon.set(icons.update);
          nav.toolbarNotices.set([{
            id: 'logistic-data-issues',
            label: 'Dati da verificare: 2 avvisi',
            icon: icons.custom,
            callback: () => { window.noticeClicks = (window.noticeClicks ?? 0) + 1; },
          }]);
        }, status, icons);
        await settle();
        await verifyNoticeIcons([icons.update, icons.custom ?? null]);
        const { nodes } = await window.webContents.debugger.sendCommand('Accessibility.getFullAXTree');
        const label = status === 'available'
          ? 'Aggiornamento disponibile'
          : 'Aggiornamento pronto da installare';
        assert.equal(nodes.filter(node => node.role?.value === 'link' && node.name?.value === label).length, 1);
        assert.equal(nodes.filter(node => node.role?.value === 'button' &&
          node.name?.value === 'Dati da verificare: 2 avvisi').length, 1);
        await evaluate(() => document.querySelector('button.toolbar-notice').click());
        iconScenarios++;
        assert.equal(await evaluate(() => window.noticeClicks), iconScenarios);
        if (status === 'downloaded' && icons.update === 'system_update') {
          await capture(`toolbar-icons-pill-${width}.png`);
        }
      }
    }
  }
  window.webContents.debugger.detach();
  for (const status of ['idle', 'checking', 'available', 'not-available', 'downloading', 'downloaded', 'error']) {
    await evaluate(status => window.toolbarFixture.push(status), status);
    await settle();
    const label = await evaluate(() =>
      document.querySelector('.update-notice .toolbar-notice-label')?.textContent ?? null);
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
  await evaluate(() => {
    const nav = ng.getComponent(document.querySelector('eaf-toolbar')).navigationService;
    nav.showUpdateNotice.set(false);
    nav.toolbarNotices.set([]);
  });
  for (const width of [1440, 800, 320]) {
    window.setContentSize(width, 1000);
    await settle();
    await verifyBackgroundLogo();
    await capture(`toolbar-background-${width}.png`);
  }
  assert.deepEqual(await evaluate(() => window.toolbarFixture.calls().filter(channel =>
    ['update:check', 'update:download', 'update:install'].includes(channel))), []);
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(artifacts, 'measurements.json'), JSON.stringify(measurements, null, 2));
  console.log(`PASS: 252 layout/shape/contrast scenarios and ${iconScenarios} icon/accessibility scenarios`);
  console.log('PASS: window centering, CSS overrides, states, callbacks and navigation');
  console.log('PASS: centered background logo, unchanged layout and reachable controls with and without notices');
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
