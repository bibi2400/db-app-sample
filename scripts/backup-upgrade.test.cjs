const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const Module = require('node:module');

let environment;
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name === 'electron') {
    return {
      app: {
        isPackaged: true,
        getAppPath: () => environment.application,
        getPath: key => {
          if (key === 'exe') return path.join(environment.installation, 'Consumer.exe');
          if (key === 'userData') return environment.userData;
          throw new Error(`Unexpected app path: ${key}`);
        },
      },
    };
  }
  if (name === 'electron-log') return { debug() {}, info() {}, warn() {}, error() {} };
  return originalLoad.call(this, name, ...args);
};
const base = '../packages/framework/dist/electron/services/system-services/';
const { AppDataService } = require(`${base}app-data.service`);
const { ConfigService } = require(`${base}config.service`);
const { ConsumerConfigService } = require(`${base}consumer-config.service`);
const { DbConfigService } = require(`${base}db-config.service`);
const { DataSourceService } = require(`${base}data-source.service`);
const { DbMigrationService } = require(`${base}db-migration.service`);
const { BackupService } = require(`${base}backup.service`);
const { MaintenanceService } = require(`${base}maintenance.service`);
Module._load = originalLoad;

async function fixture(t, { portable = false, enabled } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eaf-upgrade-test-'));
  const locations = {
    application: path.join(root, 'installation', 'resources', 'application'),
    installation: path.join(root, 'installation'),
    userData: path.join(root, 'AppData', 'Consumer'),
  };
  environment = locations;
  const database = path.join(root, 'Dati già esistenti', 'database.sqlite');
  const repository = path.join(locations.userData, 'uploads');
  await fs.mkdir(locations.application, { recursive: true });
  await fs.mkdir(path.dirname(database), { recursive: true });
  await fs.mkdir(repository, { recursive: true });
  if (portable) await fs.writeFile(path.join(locations.installation, 'portable'), '');
  if (enabled !== undefined) {
    await fs.writeFile(path.join(locations.application, 'eaf.config.json'), JSON.stringify({
      databaseUi: { enabled },
    }));
  }
  const configPath = path.join(locations.userData, 'db-config.json');
  const previousConfig = JSON.stringify({ dbPath: database }, null, 2);
  await fs.writeFile(configPath, previousConfig);
  const appData = new AppDataService({ isDev: false });
  const config = new ConfigService(appData);
  const policy = new ConsumerConfigService();
  const dbConfig = new DbConfigService(config, appData, policy);
  const sources = [];
  async function open(configuration) {
    const ds = new DataSourceService(configuration);
    sources.push(ds);
    await ds.initialize();
    return ds;
  }
  t.after(async () => {
    for (const ds of sources) await ds.destroy();
    assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('eaf-upgrade-test-'));
    await fs.rm(root, { recursive: true, force: true });
  });
  const previous = await open({ dbPath: database, resolveDbPath: async () => database });
  await previous.dataSource.query('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)');
  await previous.dataSource.query("INSERT INTO sample VALUES (1, 'installed data')");
  assert.deepEqual(await new DbMigrationService(previous).runPendingMigrations(), { success: true });
  const content = 'existing attachment';
  await fs.writeFile(path.join(repository, 'file.txt'), content);
  await previous.dataSource.query(
    'INSERT INTO attachment (fileName, originalName, size, checksum) VALUES (?, ?, ?, ?)',
    ['file.txt', 'file.txt', content.length, createHash('sha256').update(content).digest('hex')],
  );
  // Previous releases copied the database file into these same directories.
  await previous.destroy();
  const backupRoot = path.join(portable ? locations.installation : locations.userData, 'backups');
  const legacy = path.join(backupRoot, 'manual', 'database_pre-update_2026-09-25.sqlite');
  await fs.mkdir(path.dirname(legacy), { recursive: true });
  await fs.copyFile(database, legacy);
  const originalSnapshot = await fs.readFile(legacy);
  await fs.mkdir(path.join(backupRoot, 'auto'));
  await fs.copyFile(database, path.join(backupRoot, 'auto', 'database_2026-09-26.sqlite'));
  const maintenance = new MaintenanceService();
  async function upgraded() {
    const ds = await open(dbConfig);
    return {
      ds,
      backup: new BackupService(dbConfig, ds, { getRepositoryPath: () => repository }, maintenance),
    };
  }
  return {
    database, repository, configPath, previousConfig, originalSnapshot,
    backupRoot, legacy, upgraded, open, previous, dbConfig, maintenance,
  };
}

async function value(ds) {
  return (await ds.dataSource.query('SELECT value FROM sample WHERE id = 1'))[0].value;
}

for (const portable of [false, true]) {
  for (const enabled of [undefined, true, false]) {
    test(`installed upgrade preserves data and legacy backups: portable ${portable}, ` +
      `database UI ${enabled ?? 'default'}`, async t => {
      const f = await fixture(t, { portable, enabled });
      const { ds, backup } = await f.upgraded();
      assert.equal(await value(ds), 'installed data');
      assert.equal((await ds.dataSource.query('SELECT COUNT(*) AS count FROM attachment'))[0].count, 1);
      if (enabled === false) {
        assert.equal(ds.dataSource.options.database, path.join(
          environment.userData, 'database', 'database.sqlite',
        ));
        const external = await f.open({
          dbPath: f.database, resolveDbPath: async () => f.database,
        });
        assert.equal(await value(external), 'installed data');
        await external.destroy();
      } else {
        assert.equal(ds.dataSource.options.database, f.database);
        assert.equal(await fs.readFile(f.configPath, 'utf8'), f.previousConfig);
      }
      const listed = await backup.listBackups();
      assert.equal(listed.length, 2);
      assert.ok(listed.every(item => item.includesAttachments === false));
      const automatic = await backup.autoBackup();
      assert.equal(path.dirname(automatic.path), path.join(f.backupRoot, 'auto'));
      assert.equal(automatic.includesAttachments, true);
      assert.equal(await backup.autoBackup(), null);
      await ds.dataSource.query("UPDATE sample SET value = 'changed after upgrade'");
      const restored = await backup.restoreBackup(f.legacy);
      assert.equal(restored.success, true);
      assert.equal(await value(ds), 'installed data');
      assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), 'existing attachment');
      assert.deepEqual(await fs.readFile(f.legacy), f.originalSnapshot);
      await ds.destroy();
      const reopened = await f.upgraded();
      assert.equal(await value(reopened.ds), 'installed data');
      assert.equal(await reopened.backup.autoBackup(), null);
    });
  }
}

test('old schema backup stays listed but cannot be restored after a schema migration', async t => {
  const f = await fixture(t);
  const { ds, backup } = await f.upgraded();
  await ds.dataSource.query('ALTER TABLE sample ADD COLUMN extra TEXT');
  await assert.rejects(backup.restoreBackup(f.legacy), /schema incompatibile/);
  assert.equal(await value(ds), 'installed data');
  assert.ok((await backup.listBackups()).some(item => item.path === f.legacy));
});

test('an existing missing attachment stops new backups without damaging the live database', async t => {
  const f = await fixture(t);
  const { ds, backup } = await f.upgraded();
  await fs.unlink(path.join(f.repository, 'file.txt'));
  await assert.rejects(backup.autoBackup(), /ENOENT/);
  assert.equal(await value(ds), 'installed data');
  assert.deepEqual(await fs.readFile(f.legacy), f.originalSnapshot);
  assert.equal((await backup.listBackups()).length, 2);
  assert.equal(await f.maintenance.runRequest(async () => 'available'), 'available');
});

test('a valid bundle repairs a missing live attachment and marks the safety snapshot incomplete', async t => {
  const f = await fixture(t);
  const { ds, backup } = await f.upgraded();
  const complete = await backup.createBackup();
  await ds.dataSource.query("UPDATE sample SET value = 'current data'");
  await fs.unlink(path.join(f.repository, 'file.txt'));
  const restored = await backup.restoreBackup(complete.path);
  assert.equal(restored.success, true);
  assert.equal(await value(ds), 'installed data');
  assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), 'existing attachment');
  const safety = (await backup.listBackups()).find(item => item.path === restored.backupCreated);
  assert.equal(safety.includesAttachments, false);
  assert.match(safety.attachmentError, /mancanti o danneggiati/);
  await assert.rejects(backup.restoreBackup(safety.path), /non consente un ripristino completo/);
  assert.equal(await fs.readFile(`${complete.path}.assets/files/file.txt`, 'utf8'), 'existing attachment');
  assert.equal(await f.maintenance.runRequest(async () => 'available'), 'available');
});
