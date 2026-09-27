const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const { app, BrowserWindow } = require('electron');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'dist', 'db-app-sample', 'browser');
const artifacts = path.join(root, '.tmp-eaf-table-browser');
const types = {
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
  await evaluate(async () => {
    await new Promise(resolve => setTimeout(resolve, 75));
    // Le animazioni CSS possono restare sospese in una finestra nascosta.
    for (const animation of document.getAnimations()) {
      if (animation.effect.getComputedTiming().iterations !== Infinity) {
        animation.finish();
      }
    }
    await new Promise(resolve => setTimeout(resolve, 0));
  });
}

async function resizeWindow(width, height) {
  window.setSize(width, height);
  const [contentWidth, contentHeight] = window.getContentSize();
  // Il renderer riceve il nuovo viewport dopo il ridimensionamento nativo.
  for (let attempt = 0; attempt < 20; attempt++) {
    await settle();
    const size = await evaluate(() => [innerWidth, innerHeight]);
    if (size[0] === contentWidth && size[1] === contentHeight) {
      await evaluate(() => new Promise(resolve => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }));
      await settle();
      return;
    }
  }
  throw new Error('The renderer did not receive the resized viewport');
}

function shellGeometry() {
  return evaluate(() => {
    const main = document.querySelector('.main-container');
    const shell = document.querySelector('mat-sidenav-content');
    const toolbarElement = document.querySelector('eaf-toolbar');
    const toolbar = toolbarElement.getBoundingClientRect();
    const viewport = main.getBoundingClientRect();
    const heading = main.querySelector('h2').getBoundingClientRect();
    return {
      toolbar: { top: toolbar.top, bottom: toolbar.bottom, left: toolbar.left,
        right: toolbar.right, height: toolbar.height },
      toolbarControlHeight: parseFloat(getComputedStyle(
        toolbarElement.querySelector('mat-toolbar')).height),
      viewport: { top: viewport.top, bottom: viewport.bottom },
      headingTop: heading.top,
      scrollTop: main.scrollTop,
      maxScroll: main.scrollHeight - main.clientHeight,
      shellScrollTop: shell.scrollTop,
      documentScrollTop: document.scrollingElement.scrollTop,
      windowWidth: innerWidth,
      windowHeight: innerHeight,
    };
  });
}

async function verifyPageScroll(baseUrl) {
  // Verifica anche i filtri EafTable durante lo scroll del nuovo contenitore.
  await resizeWindow(1280, 640);
  const filter = await filterGeometry();
  await evaluate(() => {
    const main = document.querySelector('.main-container');
    main.scrollTop = 60;
    main.dispatchEvent(new Event('scroll'));
  });
  await settle();
  const movedFilter = await evaluate(() => {
    const trigger = document.querySelector('[aria-expanded="true"]')
      .getBoundingClientRect();
    const popup = document.querySelector('.eaf-filter-dropdown')
      .getBoundingClientRect();
    return { top: popup.top, anchorBottom: trigger.bottom };
  });
  assert.ok(movedFilter.top < filter.top);
  assert.ok(Math.abs(movedFilter.top - movedFilter.anchorBottom - 4) < 2);

  await resizeWindow(960, 640);
  await window.loadURL(`${baseUrl}/form-upload-demo`);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(() => !!document.querySelector('app-form-upload-demo'))) break;
    await settle();
  }
  await settle();
  for (const factor of [1, Math.pow(1.2, -3), Math.pow(1.2, 3)]) {
    window.webContents.setZoomFactor(factor);
    await evaluate(factor => {
      document.documentElement.style.setProperty('--eaf-content-zoom', String(factor));
      const main = document.querySelector('.main-container');
      main.scrollTop = 0;
      main.dispatchEvent(new Event('scroll'));
    }, factor);
    await settle();
    const before = await shellGeometry();
    assert.ok(Math.abs(before.toolbar.top) < 1);
    assert.ok(Math.abs(before.toolbar.left) < 1);
    assert.ok(Math.abs(before.toolbar.right - before.windowWidth) < 1.5);
    assert.ok(Math.abs(before.toolbar.height * factor - before.toolbarControlHeight) < 1.5,
      `Toolbar zoom compensation: ${JSON.stringify(before)}`);
    assert.ok(Math.abs(before.viewport.top - before.toolbar.bottom) < 1.5);
    assert.ok(Math.abs(before.viewport.bottom - before.windowHeight) < 1.5);
    assert.ok(before.maxScroll > 0, `Form should overflow: ${JSON.stringify(before)}`);
    await evaluate(() => {
      const main = document.querySelector('.main-container');
      main.scrollTop = Math.min(200, main.scrollHeight - main.clientHeight);
      main.dispatchEvent(new Event('scroll'));
    });
    await settle();
    const after = await shellGeometry();
    assert.ok(after.scrollTop > 0);
    assert.deepEqual(after.toolbar, before.toolbar);
    assert.deepEqual(after.viewport, before.viewport);
    assert.ok(Math.abs(before.headingTop - after.headingTop - after.scrollTop) < 1.5);
    assert.equal(after.shellScrollTop, 0);
    assert.equal(after.documentScrollTop, 0);
    if (factor === 1) {
      await click('eaf-toolbar button');
      const sidebar = await evaluate(() => {
        const rect = document.querySelector('mat-sidenav').getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, windowHeight: innerHeight };
      });
      assert.ok(Math.abs(sidebar.top) < 1);
      assert.ok(Math.abs(sidebar.bottom - sidebar.windowHeight) < 1.5);
      await click('.mat-drawer-backdrop');
    }
    await evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const screenshot = await window.webContents.capturePage();
    await fs.writeFile(path.join(artifacts,
      `page-scroll-app-${Math.round(factor * 100)}.png`), screenshot.toPNG());
  }
}

async function verifyDefaultTable(baseUrl) {
  window.webContents.setZoomFactor(1);
  await resizeWindow(1280, 700);
  await window.loadURL(`${baseUrl}/table-demo`);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(() => !!document.querySelector('tr.mat-mdc-row'))) break;
    await settle();
  }
  await settle();
  const defaults = await evaluate(() => {
    const table = document.querySelector('.eaf-table-wrapper table');
    return { zoom: getComputedStyle(table).zoom,
      compact: table.classList.contains('eaf-table-compact') };
  });
  assert.equal(defaults.zoom, '1');
  assert.equal(defaults.compact, false);
  const header = await headerGeometry();
  const footer = await paginatorGeometry();
  assertHeader(header);
  assertPaginator(footer);
  await click('.eaf-table-header-viewport mat-checkbox input');
  assert.equal(await evaluate(() => [...document.querySelectorAll(
    '.eaf-table-wrapper mat-checkbox input')].every(input => input.checked)), true);
  await click('.eaf-table-header-viewport mat-checkbox input');
  await click('.mat-mdc-paginator-navigation-next');
  assert.equal(await evaluate(() => document.querySelector(
    'tr.mat-mdc-row .mat-column-id').textContent.trim()), '11');
  assert.match(await evaluate(() => document.querySelector(
    '.mat-mdc-paginator-range-label').textContent), /11\s*–\s*20 di 40/);
  await evaluate(() => {
    const viewport = document.querySelector('.eaf-table-wrapper');
    viewport.scrollTo(150, 100);
    viewport.dispatchEvent(new Event('scroll'));
  });
  await settle();
  const scrolledHeader = await headerGeometry();
  const scrolledFooter = await paginatorGeometry();
  assertHeader(scrolledHeader);
  assertPaginator(scrolledFooter);
  assert.equal(scrolledHeader.top, header.top);
  assert.equal(scrolledFooter.top, footer.top);
  const filter = await filterGeometry();
  assert.ok(Math.abs(filter.top - filter.triggerBottom - 4) < 2);
  await click('.table-demo-page h2');
  await evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const screenshot = await window.webContents.capturePage();
  await fs.writeFile(path.join(artifacts, 'table-default-server.png'), screenshot.toPNG());
}

async function click(selector) {
  await evaluate(selector => {
    const element = document.querySelector(selector);
    if (!element) throw new Error(`Missing element: ${selector}`);
    element.click();
  }, selector);
  await settle();
}

async function select(index, label) {
  await click(
    `.table-controls mat-form-field:nth-of-type(${index + 1}) mat-select`,
  );
  await evaluate(label => {
    const option = [...document.querySelectorAll('mat-option')]
      .find(element => element.textContent.trim() === label);
    if (!option) throw new Error(`Missing option: ${label}`);
    option.click();
  }, label);
  await settle();
}

async function button(label) {
  await evaluate(label => {
    const element = [...document.querySelectorAll('.table-controls button')]
      .find(element => element.textContent.trim() === label);
    if (!element) throw new Error(`Missing button: ${label}`);
    element.click();
  }, label);
  await settle();
}

function metrics() {
  return evaluate(() => {
    const wrapper = document.querySelector('.eaf-table-wrapper');
    const viewport = wrapper.getBoundingClientRect();
    const cells = [...document.querySelectorAll('th')];
    const coverage = cells.reduce((total, cell) => {
      const rect = cell.getBoundingClientRect();
      const visible = Math.max(0,
        Math.min(rect.right, viewport.right) -
        Math.max(rect.left, viewport.left));
      return total + visible / rect.width;
    }, 0);
    const row = document.querySelector('tr.mat-mdc-row');
    const cell = document.querySelector('td');
    const paginator = document.querySelector('mat-paginator');
    const select = document.querySelector('.table-controls mat-select');
    const toolbar = document.querySelector('eaf-toolbar');
    const filter = document.querySelector('.eaf-filter-btn');
    const filterRect = filter.getBoundingClientRect();
    return {
      viewportWidth: wrapper.clientWidth,
      tableWidth: wrapper.querySelector('table').getBoundingClientRect().width,
      availableWidth: document.querySelector('.eaf-table-container').clientWidth,
      scrollWidth: wrapper.scrollWidth,
      coverage,
      fullyVisibleColumns: cells.filter(cell => {
        const rect = cell.getBoundingClientRect();
        return rect.left >= viewport.left && rect.right <= viewport.right;
      }).length,
      rowHeight: row.getBoundingClientRect().height,
      fontSize: getComputedStyle(cell).fontSize,
      cellPadding: getComputedStyle(cell).paddingLeft,
      paginatorHeight: paginator.getBoundingClientRect().height,
      selectHeight: select.getBoundingClientRect().height,
      toolbarHeight: toolbar?.getBoundingClientRect().height,
      tableZoom: getComputedStyle(wrapper.querySelector('table')).zoom,
      htmlZoom: getComputedStyle(document.documentElement).zoom,
      filterCount: document.querySelectorAll('.eaf-filter-btn').length,
      filterButtonWidth: filterRect.width,
      filterButtonHeight: filterRect.height,
      columnWidths: cells.map(cell => cell.getBoundingClientRect().width),
      hasVerticalBorders: cells.some(cell =>
        parseFloat(getComputedStyle(cell).borderInlineEndWidth) > 0),
    };
  });
}

async function headerGeometry() {
  return evaluate(() => {
    const viewport = document.querySelector('.eaf-table-wrapper');
    const header = document.querySelector('.eaf-table-header-viewport');
    if (!header) return null;
    const surface = header.closest('.eaf-table-header-surface');
    const a = header.getBoundingClientRect();
    const b = viewport.getBoundingClientRect();
    const c = surface.getBoundingClientRect();
    const table = viewport.querySelector('table').getBoundingClientRect();
    const headerCells = [...header.querySelectorAll('th')];
    const bodyCells = [...viewport.querySelectorAll('tr.mat-mdc-row:first-of-type td')];
    return {
      inViewport: !!header.closest('.eaf-table-wrapper'),
      top: a.top,
      bottom: a.bottom,
      viewportTop: b.top,
      surfaceLeft: c.left,
      surfaceRight: c.right,
      viewportLeft: b.left,
      viewportRight: b.right,
      surfaceBackground: getComputedStyle(surface).backgroundColor,
      tableBackground: getComputedStyle(header.querySelector('table')).backgroundColor,
      dividerWidth: parseFloat(getComputedStyle(surface, '::after').borderBottomWidth),
      blankBeforeScrollbar: viewport.clientWidth - Math.min(
        table.width, viewport.clientWidth),
      columns: headerCells.map((cell, index) => {
        const x = cell.getBoundingClientRect();
        const y = bodyCells[index]?.getBoundingClientRect();
        return { left: x.left, width: x.width,
          bodyLeft: y?.left, bodyWidth: y?.width };
      }),
    };
  });
}

function assertHeader(geometry, compact = false) {
  assert.ok(geometry);
  assert.equal(geometry.inViewport, false);
  assert.ok(Math.abs(geometry.bottom - geometry.viewportTop) < 1);
  assert.ok(Math.abs(geometry.surfaceLeft - geometry.viewportLeft) < 1);
  assert.ok(Math.abs(geometry.surfaceRight - geometry.viewportRight) < 1,
    `Header scrollbar coverage: ${JSON.stringify(geometry)}`);
  assert.equal(geometry.surfaceBackground, geometry.tableBackground);
  assert.ok(geometry.dividerWidth > 0);
  for (const column of geometry.columns) {
    assert.ok(Math.abs(column.left - column.bodyLeft) < 1.5,
      `Column position: ${JSON.stringify(column)}`);
    assert.ok(Math.abs(column.width - column.bodyWidth) < 1.5,
      `Column width: ${JSON.stringify(column)}`);
  }
  if (compact) assert.ok(geometry.blankBeforeScrollbar < 1.5,
    `Scrollbar gap: ${JSON.stringify(geometry)}`);
}

async function paginatorGeometry() {
  return evaluate(() => {
    const viewport = document.querySelector('.eaf-table-wrapper');
    const paginator = document.querySelector('mat-paginator');
    const frame = document.querySelector('.eaf-table-container');
    const maxHeight = parseFloat(getComputedStyle(
      document.querySelector('.eaf-table-surface')).maxHeight);
    const a = viewport.getBoundingClientRect();
    const b = paginator.getBoundingClientRect();
    const c = frame.getBoundingClientRect();
    return {
      inViewport: !!paginator.closest('.eaf-table-wrapper'),
      left: b.left,
      top: b.top,
      right: b.right,
      bottom: b.bottom,
      width: b.width,
      height: b.height,
      expectedLeft: a.left,
      expectedRight: a.right,
      expectedWidth: a.width,
      viewportBottom: a.bottom,
      frameBottom: c.bottom,
      frameHeight: c.height,
      heightLimit: Number.isFinite(maxHeight) ? maxHeight : null,
    };
  });
}

function assertPaginator(geometry) {
  assert.equal(geometry.inViewport, false);
  assert.ok(Math.abs(geometry.left - geometry.expectedLeft) < 1);
  assert.ok(Math.abs(geometry.right - geometry.expectedRight) < 1);
  assert.ok(Math.abs(geometry.width - geometry.expectedWidth) < 1,
    `Paginator alignment: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.top - geometry.viewportBottom) < 1);
  assert.ok(geometry.bottom <= geometry.frameBottom);
  if (geometry.heightLimit != null) {
    assert.ok(geometry.frameHeight <= geometry.heightLimit + 1);
  }
}

async function filterGeometry() {
  await evaluate(() => {
    const wrapper = document.querySelector('.eaf-table-wrapper');
    const viewport = wrapper.getBoundingClientRect();
    const trigger = [...document.querySelectorAll('.eaf-filter-btn')]
      .find(element => {
        const rect = element.getBoundingClientRect();
        return rect.left >= viewport.left && rect.right <= viewport.right;
      });
    if (!trigger) throw new Error('No visible filter trigger');
    trigger.click();
  });
  await settle();
  return evaluate(() => {
    const trigger = document.querySelector('[aria-expanded="true"]');
    const dropdown = document.querySelector('.eaf-filter-dropdown');
    const a = trigger.getBoundingClientRect();
    const b = dropdown.getBoundingClientRect();
    return {
      triggerBottom: a.bottom,
      left: b.left,
      top: b.top,
      right: b.right,
      width: b.width,
      height: b.height,
      viewportWidth: innerWidth,
      inTable: !!dropdown.closest('table'),
      transform: getComputedStyle(dropdown).transform,
      opacity: getComputedStyle(dropdown).opacity,
      paneStyle: dropdown.parentElement.getAttribute('style'),
    };
  });
}

async function dragFirstColumn() {
  const points = await evaluate(() => {
    const headers = [...document.querySelectorAll('th')];
    return headers.slice(0, 2).map(element => {
      const rect = element.getBoundingClientRect();
      return { x: Math.round(rect.left + 24), y: Math.round(rect.top + 20) };
    });
  });
  const [from, to] = points;
  // Eventi DOM attraversano il CDK reale anche senza focus del desktop.
  await evaluate(from => {
    document.querySelector('th').dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 0,
      buttons: 1,
      detail: 1,
      clientX: from.x,
      clientY: from.y,
    }));
  }, from);
  for (let step = 1; step <= 10; step++) {
    const point = {
      x: Math.round(from.x + (to.x - from.x) * step / 10),
      y: from.y,
    };
    await evaluate(point => {
      document.dispatchEvent(new MouseEvent('mousemove', {
        bubbles: true,
        cancelable: true,
        view: window,
        buttons: 1,
        clientX: point.x,
        clientY: point.y,
      }));
    }, point);
    await settle();
  }
  assert.equal(await evaluate(() =>
    !!document.querySelector('.cdk-drag-preview')), true, 'Drag did not start');
  await evaluate(to => {
    document.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      view: window,
      button: 0,
      clientX: to.x,
      clientY: to.y,
    }));
  }, to);
  for (let attempt = 0; attempt < 20; attempt++) {
    await settle();
    if (!await evaluate(() =>
      !!document.querySelector('.cdk-drag-preview'))) return;
  }
  throw new Error('Drag animation did not complete');
}

async function run() {
  await fs.access(path.join(build, 'index.html'));
  await fs.mkdir(artifacts, { recursive: true });
  app.setPath('userData', path.join(artifacts, 'profile'));
  await app.whenReady();
  server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '');
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
      response.setHeader('Content-Type',
        types[path.extname(filename)] ?? 'application/octet-stream');
      response.end(data);
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  window = new BrowserWindow({
    show: false,
    width: 1280,
    height: 1000,
    webPreferences: {
      preload: path.join(__dirname, 'eaf-table-layout-preload.cjs'),
      partition: 'eaf-table-layout-test',
      backgroundThrottling: false,
    },
  });
  window.webContents.on('console-message', event => {
    if (event.level === 'error') console.error('Renderer:', event.message);
  });
  const address = server.address();
  await window.loadURL(`http://127.0.0.1:${address.port}/table-layout-demo`);
  for (let attempt = 0; attempt < 40; attempt++) {
    if (await evaluate(() => !!document.querySelector('table'))) break;
    await settle();
  }
  await evaluate(() => document.fonts.ready.then(() => undefined));
  await settle();
  const measurements = [];
  let baseline;
  let baselineFilter;
  for (const density of ['Standard', 'Compatta']) {
    await select(0, density);
    for (const zoom of [1, 0.9, 0.8]) {
      await select(1, `${Math.round(zoom * 100)}%`);
      await evaluate(() => {
        const viewport = document.querySelector('.eaf-table-wrapper');
        viewport.scrollTo(0, 0);
        viewport.dispatchEvent(new Event('scroll'));
      });
      await settle();
      const current = await metrics();
      measurements.push({ density, zoom, ...current });
      console.log(`Checking ${density} at ${zoom * 100}%`);
      baseline ??= current;
      assert.equal(current.viewportWidth, baseline.viewportWidth);
      assert.equal(current.filterCount, 12);
      assert.equal(current.fontSize, baseline.fontSize);
      assert.equal(current.selectHeight, baseline.selectHeight);
      assert.equal(current.paginatorHeight, baseline.paginatorHeight);
      assert.equal(current.toolbarHeight, baseline.toolbarHeight);
      assert.equal(current.htmlZoom, baseline.htmlZoom);
      assert.equal(current.hasVerticalBorders, density === 'Compatta');
      assert.ok(Math.abs(current.filterButtonHeight / zoom -
        baseline.filterButtonHeight) < 1);
      assert.equal(window.webContents.getZoomFactor(), 1);
      if (zoom < 1) assert.ok(current.coverage > baseline.coverage);
      if (density === 'Compatta' && zoom === 1) {
        assert.equal(current.rowHeight, baseline.rowHeight);
        assert.ok(current.scrollWidth <= baseline.scrollWidth * 0.86,
          `Compact width: ${JSON.stringify({ current, baseline })}`);
        assert.ok(current.filterButtonWidth >= 32);
      }
      const footer = await paginatorGeometry();
      const header = await headerGeometry();
      assertPaginator(footer);
      assertHeader(header, density === 'Compatta');
      const filter = await filterGeometry();
      baselineFilter ??= filter;
      assert.equal(filter.inTable, false);
      assert.equal(filter.width, baselineFilter.width);
      assert.equal(filter.height, baselineFilter.height);
      assert.ok(Math.abs(filter.top - filter.triggerBottom - 4) < 2,
        JSON.stringify({ density, zoom, filter, current }));
      assert.ok(filter.left >= 8 && filter.right <= filter.viewportWidth - 8);
      await evaluate(() => document.querySelector('.table-layout-demo-page h2')
        .click());
      await settle();
      await evaluate(() => {
        const wrapper = document.querySelector('.eaf-table-wrapper');
        wrapper.scrollTo(150, 100);
        wrapper.dispatchEvent(new Event('scroll'));
      });
      await settle();
      const scrolledFooter = await paginatorGeometry();
      assertPaginator(scrolledFooter);
      assert.equal(scrolledFooter.top, footer.top);
      assert.equal(scrolledFooter.left, footer.left);
      const scrolledHeader = await headerGeometry();
      assertHeader(scrolledHeader, density === 'Compatta');
      assert.equal(scrolledHeader.top, header.top);
      const scrolledFilter = await filterGeometry();
      assert.ok(Math.abs(
        scrolledFilter.top - scrolledFilter.triggerBottom - 4,
      ) < 2);
      await evaluate(() => {
        const wrapper = document.querySelector('.eaf-table-wrapper');
        wrapper.scrollBy(25, 30);
        wrapper.dispatchEvent(new Event('scroll'));
      });
      await settle();
      const repositioned = await evaluate(() => {
        const a = document.querySelector('[aria-expanded="true"]')
          .getBoundingClientRect();
        const b = document.querySelector('.eaf-filter-dropdown')
          .getBoundingClientRect();
        return b.top - a.bottom;
      });
      assert.ok(Math.abs(repositioned - 4) < 2);
      assertHeader(await headerGeometry(), density === 'Compatta');
      await evaluate(() => document.querySelector('.table-layout-demo-page h2')
        .click());
      await settle();
    }
  }
  await fs.writeFile(path.join(artifacts, 'measurements.json'),
    JSON.stringify(measurements, null, 2) + '\n');
  console.log(JSON.stringify(measurements, null, 2));
  await evaluate(() => {
    const header = document.querySelector('.eaf-table-header-viewport');
    header.scrollLeft = 200;
    header.dispatchEvent(new Event('scroll'));
  });
  await settle();
  assertHeader(await headerGeometry(), true);
  await button('Chiudi tabella');
  assert.equal(await evaluate(() => !!document.querySelector('table')), false);
  await button('Riapri tabella');
  const restored = await metrics();
  assert.equal(restored.tableZoom, '0.8');
  assert.equal(restored.cellPadding, '4px');
  await button('Ripristina stato');
  const reset = await metrics();
  assert.equal(reset.tableZoom, '1');
  assert.equal(reset.cellPadding, baseline.cellPadding);
  for (const zoom of [1, 0.9, 0.8]) {
    await button('Ripristina stato');
    await select(1, `${Math.round(zoom * 100)}%`);
    if (zoom === 0.8) await select(0, 'Compatta');
    await evaluate(() => {
      const viewport = document.querySelector('.eaf-table-wrapper');
      viewport.scrollTo(0, 0);
      viewport.dispatchEvent(new Event('scroll'));
    });
    await settle();
    await dragFirstColumn();
    const order = await evaluate(() =>
      JSON.parse(localStorage.getItem('eaf-table:demo-table-layout'))
        .columns.map(column => column.key));
    assert.equal(order[0], 'customer', `Drag order at ${zoom}: ${order}`);
  }
  await click('tr.mat-mdc-row');
  const feedback = await evaluate(() =>
    document.querySelector('.row-feedback').textContent);
  assert.match(feedback, /Riga selezionata: 1/);
  await click('[aria-label="Filtra ID"]');
  await evaluate(() => {
    const input = document.querySelector('.eaf-filter-dropdown input');
    input.value = '2';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
  assert.equal(await evaluate(() =>
    document.querySelectorAll('tr.mat-mdc-row').length), 1);
  await click('.table-layout-demo-page h2');
  await click('tr.mat-mdc-row');
  assert.match(await evaluate(() =>
    document.querySelector('.row-feedback').textContent), /Riga selezionata: 2/);
  // Screenshot del filtro attivo per la verifica visiva nelle due densità.
  for (const [density, zoom] of [['Compatta', '80%'], ['Standard', '100%']]) {
    await select(0, density);
    await select(1, zoom);
    await evaluate(() => document.querySelector('.eaf-filter-active')
      .dispatchEvent(new MouseEvent('mouseenter')));
    await settle();
    await evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const filteredScreenshot = await window.webContents.capturePage();
    await fs.writeFile(path.join(artifacts,
      `table-filter-active-${density.toLowerCase()}.png`),
      filteredScreenshot.toPNG());
    await evaluate(() => document.querySelector('.eaf-filter-active')
      .dispatchEvent(new MouseEvent('mouseleave')));
    await settle();
  }
  await click('.eaf-filter-active');
  await evaluate(() => {
    const input = document.querySelector('.eaf-filter-dropdown input');
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await settle();
  await click('.table-layout-demo-page h2');
  await evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const clearedScreenshot = await window.webContents.capturePage();
  await fs.writeFile(path.join(artifacts, 'table-filter-cleared.png'),
    clearedScreenshot.toPNG());
  await button('Ripristina stato');
  await select(0, 'Compatta');
  await select(1, '80%');
  const narrowCompact = await metrics();
  await resizeWindow(1920, 1000);
  const wideCompact = await metrics();
  assert.ok(wideCompact.viewportWidth > narrowCompact.viewportWidth,
    JSON.stringify({ narrowCompact, wideCompact }));
  assert.ok(wideCompact.tableWidth < wideCompact.viewportWidth,
    'Compact columns should not expand to fill the viewport');
  assert.ok(Math.abs(wideCompact.tableWidth - narrowCompact.tableWidth) < 1);
  wideCompact.columnWidths.forEach((width, index) => {
    assert.ok(Math.abs(width - narrowCompact.columnWidths[index]) < 1,
      `Column ${index} expands when the viewport grows`);
  });
  console.log('Wide compact viewport:', JSON.stringify(wideCompact));
  assertPaginator(await paginatorGeometry());
  assertHeader(await headerGeometry(), true);
  await click('.mat-mdc-paginator-navigation-next');
  assertHeader(await headerGeometry(), true);
  assert.match(await evaluate(() => document.querySelector('tr.mat-mdc-row')
    .textContent), /Cliente 26/);
  await click('.mat-mdc-paginator-navigation-previous');
  assertHeader(await headerGeometry(), true);
  assert.match(await evaluate(() => document.querySelector('tr.mat-mdc-row')
    .textContent), /Cliente 1 /);
  await evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const wideScreenshot = await window.webContents.capturePage();
  await fs.writeFile(path.join(artifacts, 'table-wide-80.png'),
    wideScreenshot.toPNG());
  for (const factor of [0.83, Math.pow(1.2, -3)]) {
    window.webContents.setZoomFactor(factor);
    await evaluate(factor => document.documentElement.style.setProperty(
      '--eaf-content-zoom', String(factor)), factor);
    await settle();
    assertPaginator(await paginatorGeometry());
    assertHeader(await headerGeometry(), true);
    const filter = await filterGeometry();
    assert.ok(Math.abs(filter.width - baselineFilter.width) < 1);
    assert.ok(Math.abs(filter.top - filter.triggerBottom - 4) < 2);
    await click('.table-layout-demo-page h2');
    await evaluate(() => new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    }));
    const appZoomScreenshot = await window.webContents.capturePage();
    await fs.writeFile(path.join(artifacts,
      `table-wide-app-${Math.round(factor * 100)}.png`), appZoomScreenshot.toPNG());
  }
  window.webContents.setZoomFactor(1);
  await evaluate(() => document.documentElement.style.setProperty(
    '--eaf-content-zoom', '1'));
  await settle();
  await select(0, 'Standard');
  await select(1, '100%');
  await resizeWindow(3000, 1000);
  const wideStandard = await metrics();
  assert.ok(Math.abs(wideStandard.tableWidth - wideStandard.viewportWidth) < 1,
    `Standard density should fill its viewport: ${JSON.stringify(wideStandard)}`);
  await select(0, 'Compatta');
  await select(1, '80%');
  await resizeWindow(1280, 1000);
  await evaluate(() => new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }));
  const screenshot = await window.webContents.capturePage();
  await fs.writeFile(path.join(artifacts, 'table-80.png'), screenshot.toPNG());
  await verifyPageScroll(`http://127.0.0.1:${address.port}`);
  await verifyDefaultTable(`http://127.0.0.1:${address.port}`);
  console.log(
    'PASS: layout, overlays, sticky, persistence, reset, drag, filters, row click, page scroll',
  );
}

const deadline = setTimeout(() => {
  console.error('EafTable browser test timed out');
  app.exit(1);
}, 90000);

run().then(() => {
  clearTimeout(deadline);
  server?.close();
  window?.destroy();
  app.exit(0);
}).catch(async error => {
  console.error(error);
  if (window && !window.isDestroyed()) {
    const screenshot = await window.webContents.capturePage();
    await fs.writeFile(path.join(artifacts, 'failure.png'), screenshot.toPNG());
  }
  clearTimeout(deadline);
  server?.close();
  window?.destroy();
  app.exit(1);
});
