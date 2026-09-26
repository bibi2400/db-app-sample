const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');

let appRoot;
const handlers = new Map();
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'electron') {
    return {
      app: { isPackaged: false, getAppPath: () => appRoot },
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
    };
  }
  if (name === 'electron-log') return { debug() {}, info() {}, warn() {}, error() {} };
  if (name === '../../controllers' && args[0].filename.endsWith('app-bootstrap.service.js')) {
    return { registerAllControllers() {} };
  }
  return originalLoad.call(this, name, ...args);
};
const base = '../packages/framework/dist/electron/services/system-services/';
const { AppDataService } = require(`${base}app-data.service`);
const { ConfigService } = require(`${base}config.service`);
const { ConsumerConfigService } = require(`${base}consumer-config.service`);
const { DbConfigService } = require(`${base}db-config.service`);
const { DataSourceService } = require(`${base}data-source.service`);
const { BackupService } = require(`${base}backup.service`);
const { MaintenanceService } = require(`${base}maintenance.service`);
const { ControllerService } = require(`${base}controller.service`);
const { AppBootstrapService } = require(`${base}app-bootstrap.service`);
const { DbMigrationService } = require(`${base}db-migration.service`);
const { IpcHandler } = require('../packages/framework/dist/electron/decorators/ipc-handler.decorator');
const prepareInstaller = require('../packages/framework/dist/cli/build/prepare-installer').default;
Module._load = originalLoad;

async function fixture(t, databaseUi = { enabled: false, showTechnicalInfo: true }) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eaf-database-test-'));
  appRoot = root;
  if (databaseUi) {
    await fs.writeFile(path.join(root, 'eaf.config.json'), JSON.stringify({ databaseUi }));
  }
  const appData = new AppDataService({ isDev: true });
  const config = new ConfigService(appData);
  const policy = new ConsumerConfigService();
  const dbConfig = new DbConfigService(config, appData, policy);
  const dataSources = [];
  t.after(async () => {
    for (const ds of dataSources) await ds.destroy();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('eaf-database-test-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  async function open(dbConfigToUse = dbConfig) {
    const ds = new DataSourceService(dbConfigToUse);
    dataSources.push(ds);
    await ds.initialize();
    return ds;
  }
  return { root, appData, config, policy, dbConfig, open };
}

async function populate(ds, value) {
  await ds.dataSource.query('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)');
  await ds.dataSource.query('INSERT INTO sample VALUES (1, ?)', [value]);
}

async function value(ds) {
  return (await ds.dataSource.query('SELECT value FROM sample'))[0].value;
}

test('hidden database is created inside app data and supports ordinary queries and backups', async t => {
  const f = await fixture(t);
  const ds = await f.open();
  await populate(ds, 'internal');
  assert.equal(f.dbConfig.dbPath, path.join(f.root, '.appdata', 'database', 'database.sqlite'));
  assert.equal(await value(ds), 'internal');
  assert.throws(() => { f.dbConfig.dbPath = path.join(f.root, 'external.sqlite'); }, /gestito/);
  const repository = f.appData.resolve('uploads');
  await fs.mkdir(repository);
  const backup = await new BackupService(
    f.dbConfig, ds, { getRepositoryPath: () => repository }, new MaintenanceService(),
  ).autoBackup();
  assert.equal(backup.includesAttachments, true);
});

test('existing external WAL database is copied and verified without deleting the source', async t => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external.sqlite');
  const source = await f.open({ dbPath: external, resolveDbPath: async () => external });
  await source.dataSource.query('PRAGMA journal_mode = WAL');
  await source.dataSource.query('PRAGMA wal_autocheckpoint = 0');
  await populate(source, 'external data');
  f.config.write('db-config.json', { dbPath: external });
  const internal = await f.open();
  assert.equal(await value(internal), 'external data');
  assert.equal(await value(source), 'external data');
  await fs.access(external);
  assert.equal(f.config.read('db-config.json').dbPath, f.dbConfig.dbPath);
});

test('a pre-existing internal database is preserved when older config still points outside', async t => {
  const f = await fixture(t);
  const internal = await f.open();
  await populate(internal, 'preserved');
  await internal.destroy();
  const external = path.join(f.root, 'external.sqlite');
  const source = await f.open({ dbPath: external, resolveDbPath: async () => external });
  await populate(source, 'different data');
  f.config.write('db-config.json', { dbPath: external });
  const reopened = await f.open();
  assert.equal(await value(reopened), 'preserved');
  assert.equal(await value(source), 'different data');
});

test('a damaged external database stops migration and preserves the original configuration', async t => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external.sqlite');
  await fs.writeFile(external, 'SQLite format 3\0broken');
  f.config.write('db-config.json', { dbPath: external });
  await assert.rejects(f.open());
  await assert.rejects(fs.access(f.dbConfig.dbPath));
  assert.equal(f.config.read('db-config.json').dbPath, external);
  assert.equal(await fs.readFile(external, 'utf8'), 'SQLite format 3\0broken');
});

test('visible database UI retains the external path and supports changing it', async t => {
  const f = await fixture(t, { enabled: true });
  const external = path.join(f.root, 'external.sqlite');
  f.dbConfig.dbPath = external;
  const source = await f.open();
  await populate(source, 'visible');
  assert.equal(source.dataSource.options.database, external);
  await assert.rejects(fs.access(f.appData.resolve('database', 'database.sqlite')));
});

test('consumers without a configuration retain the previous database behavior', async t => {
  const f = await fixture(t, null);
  assert.equal(f.policy.databaseUiEnabled, true);
  assert.equal(f.dbConfig.dbPath, './database/database.sqlite');
});

test('installer preparation refreshes NSIS settings for hidden, visible and default modes', async t => {
  const f = await fixture(t);
  const resources = path.join(f.root, 'build');
  const context = { packager: { projectDir: f.root, info: { buildResourcesDir: resources } } };
  prepareInstaller(context);
  const generated = path.join(resources, 'eaf-database.nsh');
  assert.match(await fs.readFile(generated, 'utf8'), /EAF_DATABASE_UI_ENABLED 0/);
  await fs.writeFile(path.join(f.root, 'eaf.config.json'), '{"databaseUi":{"enabled":true}}');
  prepareInstaller(context);
  assert.match(await fs.readFile(generated, 'utf8'), /EAF_DATABASE_UI_ENABLED 1/);
  await fs.unlink(path.join(f.root, 'eaf.config.json'));
  prepareInstaller(context);
  assert.match(await fs.readFile(generated, 'utf8'), /EAF_DATABASE_UI_ENABLED 1/);
});

test('invalid consumer flags stop runtime and installer generation', async t => {
  const f = await fixture(t);
  await fs.writeFile(path.join(f.root, 'eaf.config.json'), '{"databaseUi":{"enabled":"false"}}');
  assert.throws(() => new ConsumerConfigService(), /booleano/);
  assert.throws(() => prepareInstaller({
    packager: { projectDir: f.root, info: { buildResourcesDir: path.join(f.root, 'build') } },
  }), /booleano/);
});

for (const enabled of [false, true]) {
  for (const scenario of [
    { noSplash: false, failBackup: false },
    { noSplash: true, failBackup: false },
    { noSplash: false, failBackup: true },
    { noSplash: false, failBackup: false, freshDatabase: true },
  ]) {
    const { noSplash, failBackup, freshDatabase = false } = scenario;
    test(`startup IPC succeeds with database UI ${enabled}, no splash ${noSplash}, ` +
      `backup failure ${failBackup}, fresh database ${freshDatabase}`, async t => {
      const f = await fixture(t, { enabled });
      if (enabled) f.dbConfig.dbPath = path.join(f.root, 'external.sqlite');
      const ds = await f.open();
      if (!freshDatabase) await populate(ds, 'startup data');
      const migrations = new DbMigrationService(ds);
      const repository = f.appData.resolve('uploads');
      await fs.mkdir(repository);
      const maintenance = new MaintenanceService();
      const backup = new BackupService(
        f.dbConfig, ds, { getRepositoryPath: () => repository }, maintenance,
      );
      const reported = [];
      const errors = {
        reportBootstrapError: (...args) => reported.push(args),
        reportControllerError: (...args) => reported.push(args),
      };
      const controllers = new ControllerService(errors, maintenance);
      class ConsumerController {
        async status() {
          return ControllerService.success(await value(ds));
        }
      }
      IpcHandler('status')(ConsumerController.prototype, 'status');
      controllers.registerIpcHandlers(new ConsumerController(), 'logistic-source');

      let release;
      const paused = new Promise(resolve => { release = resolve; });
      let started;
      const backupStarted = new Promise(resolve => { started = resolve; });
      const failure = new Error('injected startup backup failure');
      let windowCreated = false;
      let splashVisible = false;
      let updateChecks = 0;
      let cleanup;
      const win = {};
      const bootstrap = new AppBootstrapService(
        {
          init() {},
          getInfo: () => ({
            name: 'Consumer', version: '1.0.0',
            splashScreen: { width: 600, height: 400 },
            mainWindow: { width: 1200, height: 800 },
          }),
        },
        { create: async () => { splashVisible = true; }, setVersion() {} },
        {
          create: async () => {
            windowCreated = true;
            assert.deepEqual(await migrations.runPendingMigrations(), { success: true });
            if (freshDatabase) await populate(ds, 'startup data');
            const response = await handlers.get('logistic-source:status')({});
            assert.deepEqual(response, { success: true, data: 'startup data' });
            return win;
          },
          setTitle() {},
        },
        { setWindow: window => assert.equal(window, win) },
        { init() {}, onCleanup: callback => { cleanup = callback; } },
        controllers,
        {
          autoBackup: () => maintenance.runExclusive(async () => {
            started();
            await paused;
            if (failBackup) throw failure;
            return backup.autoBackup();
          }),
        },
        {
          onStatusChange() {},
          checkForUpdates: async () => { updateChecks++; },
          startPeriodicCheck() {}, stopPeriodicCheck() {},
        },
        { isDev: false, noSplash },
        errors,
        { init: async () => {} },
        ds,
        migrations,
      );
      await ds.destroy();
      const booting = bootstrap.bootstrap();
      t.after(() => release());
      await backupStarted;
      assert.equal(windowCreated, false);
      assert.equal(splashVisible, !noSplash);
      assert.equal(updateChecks, 0);
      await assert.rejects(maintenance.runRequest(async () => 'write'), /Manutenzione/);
      release();
      assert.equal(await booting, win);
      assert.equal(bootstrap.getMainWindow(), win);
      assert.equal(updateChecks, 1);
      assert.equal(typeof cleanup, 'function');
      assert.deepEqual(reported, failBackup ? [['Backup automatico', failure]] : []);
      const backups = await backup.listBackups();
      assert.equal(backups.length, failBackup ? 0 : 1);
      if (!failBackup) {
        assert.equal(backups[0].type, 'auto');
        if (!freshDatabase) assert.equal(await backup.autoBackup(), null);
      }
      await maintenance.runRequest(() => ds.dataSource.query(
        "UPDATE sample SET value = 'after startup' WHERE id = 1",
      ));
      assert.equal(await value(ds), 'after startup');
    });
  }
}
