const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
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
  if (name === 'electron-log') {
    return { debug() {}, info() {}, warn() {}, error() {} };
  }
  return originalLoad.call(this, name, ...args);
};
const serviceRoot = '../packages/framework/dist/electron/services/system-services/';
const { BackupService } = require(`${serviceRoot}backup.service`);
const { MaintenanceService } = require(`${serviceRoot}maintenance.service`);
const { DataSourceService } = require(`${serviceRoot}data-source.service`);
const { ControllerService } = require(`${serviceRoot}controller.service`);
const { BackupController } = require('../packages/framework/dist/electron/controllers/backup.controller');
const { inspectBackup } = require('../packages/framework/dist/electron/helpers/backup-files');
Module._load = originalLoad;

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eaf-backup-test-'));
  appRoot = root;
  const dbPath = path.join(root, 'database.sqlite');
  const repository = path.join(root, 'uploads');
  await fs.mkdir(repository);
  const config = { dbPath, resolveDbPath: async () => config.dbPath };
  const dataSource = new DataSourceService(config);
  await dataSource.initialize();
  await dataSource.dataSource.query('CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT)');
  await dataSource.dataSource.query("INSERT INTO sample VALUES (1, 'original')");
  await dataSource.dataSource.query(
    'CREATE TABLE attachment (fileName TEXT, relativePath TEXT, checksum TEXT)',
  );
  const maintenance = new MaintenanceService();
  const upload = { getRepositoryPath: () => repository };
  const service = new BackupService(config, dataSource, upload, maintenance);
  t.after(async () => {
    await dataSource.destroy();
    const resolved = path.resolve(root);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('eaf-backup-test-'));
    await fs.rm(resolved, { recursive: true, force: true });
  });
  return { root, dbPath, repository, config, dataSource, maintenance, upload, service };
}

async function addAttachment(f, name = 'file.txt', text = 'original attachment') {
  const checksum = createHash('sha256').update(text).digest('hex');
  await fs.writeFile(path.join(f.repository, name), text);
  await f.dataSource.dataSource.query(
    'INSERT INTO attachment VALUES (?, ?, ?)', [name, '', checksum],
  );
}

async function value(f) {
  const rows = await f.dataSource.dataSource.query('SELECT value FROM sample WHERE id = 1');
  return rows[0].value;
}

test('snapshot includes WAL transactions, attachments and their disk usage', async t => {
  const f = await fixture(t);
  await f.dataSource.dataSource.query('PRAGMA journal_mode = WAL');
  await f.dataSource.dataSource.query('PRAGMA wal_autocheckpoint = 0');
  await addAttachment(f);
  const backup = await f.service.createBackup();
  assert.equal(backup.includesAttachments, true);
  assert.equal((await inspectBackup(backup.path)).attachments.length, 1);
  assert.equal(await fs.readFile(`${backup.path}.assets/files/file.txt`, 'utf8'), 'original attachment');
  const stats = await f.service.getBackupStats();
  assert.equal(stats.count, 1);
  assert.ok(stats.totalSize > (await fs.stat(backup.path)).size);
});

test('restores data and deleted attachments, reopens the database and saves safety backup', async t => {
  const f = await fixture(t);
  await addAttachment(f);
  const backup = await f.service.createBackup();
  await f.dataSource.dataSource.query("UPDATE sample SET value = 'changed'");
  // An attachment legitimately deleted after the backup must be recovered from the bundle.
  await f.dataSource.dataSource.query('DELETE FROM attachment');
  await fs.unlink(path.join(f.repository, 'file.txt'));
  const result = await f.service.restoreBackup(backup.path);
  assert.equal(result.success, true);
  assert.equal(result.reloadRequired, true);
  assert.equal(f.dataSource.isInitialized, true);
  assert.equal(await value(f), 'original');
  assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), 'original attachment');
  assert.ok(result.backupCreated.includes('pre-restore'));
  await inspectBackup(result.backupCreated);
});

test('failed initialization rolls database and replaced attachments back', async t => {
  const f = await fixture(t);
  await addAttachment(f);
  const backup = await f.service.createBackup();
  await f.dataSource.dataSource.query("UPDATE sample SET value = 'changed'");
  const text = 'changed attachment';
  await fs.writeFile(path.join(f.repository, 'file.txt'), text);
  await f.dataSource.dataSource.query('UPDATE attachment SET checksum = ?', [
    createHash('sha256').update(text).digest('hex'),
  ]);
  const initialize = f.dataSource.initialize.bind(f.dataSource);
  let calls = 0;
  f.dataSource.initialize = async () => {
    if (++calls === 1) throw new Error('injected initialization failure');
    await initialize();
  };
  await assert.rejects(f.service.restoreBackup(backup.path), /injected initialization/);
  assert.equal(await value(f), 'changed');
  assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), text);
  assert.equal(calls, 2);
});

test('failed rollback preserves recovery files and blocks subsequent IPC', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  f.dataSource.initialize = async () => { throw new Error('injected repeated failure'); };
  await assert.rejects(f.service.restoreBackup(backup.path), /recupero automatico/);
  await assert.rejects(f.maintenance.runRequest(async () => 'write'), /recupero automatico/);
  const manual = await fs.readdir(path.join(f.root, 'backups', 'manual'));
  assert.ok(manual.some(name => name.includes('pre-restore') && name.endsWith('.sqlite')));
});

test('header-only corrupted database is rejected without changing live data', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  await fs.writeFile(backup.path, Buffer.from('SQLite format 3\0not a database'));
  await assert.rejects(f.service.restoreBackup(backup.path));
  assert.equal(await value(f), 'original');
});

test('incompatible schema is rejected before creating safety backup or closing live database', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  await f.dataSource.dataSource.query('ALTER TABLE sample ADD COLUMN extra TEXT');
  await assert.rejects(f.service.restoreBackup(backup.path), /schema incompatibile/);
  assert.equal(f.dataSource.isInitialized, true);
  assert.equal((await f.service.listBackups()).length, 1);
});

test('corrupted backup attachment is rejected before altering live files', async t => {
  const f = await fixture(t);
  await addAttachment(f);
  const backup = await f.service.createBackup();
  await fs.writeFile(`${backup.path}.assets/files/file.txt`, 'tampered');
  await assert.rejects(f.service.restoreBackup(backup.path), /checksum/);
  assert.equal(await value(f), 'original');
  assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), 'original attachment');
});

test('legacy database-only backup restores only when its attachments are still valid', async t => {
  const f = await fixture(t);
  await addAttachment(f);
  const backup = await f.service.createBackup();
  const legacy = path.join(path.dirname(backup.path), 'database_legacy.sqlite');
  await fs.rename(backup.path, legacy);
  await fs.rm(`${backup.path}.assets`, { recursive: true });
  assert.equal((await f.service.listBackups())[0].includesAttachments, false);
  await f.service.restoreBackup(legacy);
  await fs.unlink(path.join(f.repository, 'file.txt'));
  await assert.rejects(f.service.restoreBackup(legacy), /ENOENT/);
  assert.equal(f.dataSource.isInitialized, true);
});

test('incomplete bundle is rejected instead of treated as legacy', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  await fs.unlink(`${backup.path}.assets/manifest.json`);
  await assert.rejects(f.service.restoreBackup(backup.path), /incompleto/);
});

test('options, external paths and attachment traversal are rejected', async t => {
  const f = await fixture(t);
  for (const options of [null, [], { name: '../escape' }, { type: 'invalid' }, { maxBackups: 0 }]) {
    await assert.rejects(f.service.createBackup(options));
  }
  await assert.rejects(f.service.deleteBackup(f.dbPath), /backup gestiti/);
  await assert.rejects(f.service.restoreBackup(f.dbPath), /backup gestiti/);
  await f.dataSource.dataSource.query('INSERT INTO attachment VALUES (?, ?, ?)', [
    'secret.txt', '../', '0'.repeat(64),
  ]);
  await assert.rejects(f.service.createBackup(), /Metadati/);
  assert.equal((await f.service.listBackups()).length, 0);
});

test('symlinks are never listed, restored or deleted as backups', async t => {
  const f = await fixture(t);
  await f.service.listBackups();
  const link = path.join(f.root, 'backups', 'manual', 'link.sqlite');
  try {
    await fs.symlink(f.dbPath, link);
  } catch (error) {
    if (error.code === 'EPERM') return t.skip('Windows requires symlink privileges');
    throw error;
  }
  assert.equal((await f.service.listBackups()).length, 0);
  await assert.rejects(f.service.deleteBackup(link), /collegamenti/);
  await assert.rejects(f.service.restoreBackup(link), /collegamenti/);
  assert.equal(await value(f), 'original');
});

test('concurrent backups have unique names; automatic rotation deletes complete bundles', async t => {
  const f = await fixture(t);
  const backups = await Promise.all([
    f.service.createBackup({ type: 'auto', maxBackups: 1 }),
    f.service.createBackup({ type: 'auto', maxBackups: 1 }),
  ]);
  assert.notEqual(backups[0].path, backups[1].path);
  assert.equal((await f.service.listBackups()).length, 1);
  await assert.rejects(fs.access(backups[0].path));
  await assert.rejects(fs.access(`${backups[0].path}.assets`));
});

test('daily automatic backup survives service recreation and recreates damaged snapshots', async t => {
  const f = await fixture(t);
  const first = await f.service.autoBackup();
  const next = new BackupService(f.config, f.dataSource, f.upload, f.maintenance);
  assert.equal(await next.autoBackup(), null);
  await fs.writeFile(first.path, 'corrupt');
  const replacement = await next.autoBackup();
  assert.ok(replacement);
  assert.notEqual(replacement.path, first.path);
});

test('delete removes database and bundled files; a missing file returns an error', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  assert.equal(await f.service.deleteBackup(backup.path), true);
  await assert.rejects(fs.access(`${backup.path}.assets`));
  await assert.rejects(f.service.deleteBackup(backup.path), /ENOENT/);
});

test('maintenance drains active requests, rejects new ones and releases after failure', async () => {
  const gate = new MaintenanceService();
  let release;
  const pending = gate.runRequest(() => new Promise(resolve => { release = resolve; }));
  let entered = false;
  const exclusive = gate.runExclusive(async () => {
    entered = true;
    throw new Error('maintenance failed');
  });
  await assert.rejects(gate.runRequest(async () => 'write'), /Manutenzione/);
  assert.equal(entered, false);
  release();
  await pending;
  await assert.rejects(exclusive, /maintenance failed/);
  assert.equal(await gate.runRequest(async () => 'ok'), 'ok');
});

test('IPC uses a single failure flag, reports errors and gates concurrent requests', async t => {
  const f = await fixture(t);
  const reported = [];
  const controllerService = new ControllerService({
    reportControllerError: (...args) => reported.push(args),
  }, f.maintenance);
  controllerService.registerIpcHandlers(new BackupController(f.service), 'backup');
  const response = await handlers.get('backup:restore')({}, f.dbPath);
  assert.equal(response.success, false);
  assert.ok(response.error);
  assert.equal(response.data, undefined);
  assert.equal(reported[0][0], 'backup:restore');
  const successful = await handlers.get('backup:create')({}, { type: 'manual' });
  assert.equal(successful.success, true);
  assert.equal(successful.data.includesAttachments, true);
});

test('initialization requests wait for maintenance while application writes are rejected', async () => {
  const gate = new MaintenanceService();
  let release;
  const exclusive = gate.runExclusive(() => new Promise(resolve => { release = resolve; }));
  let initialized = false;
  const initialization = gate.runRequest(async () => { initialized = true; }, true);
  await assert.rejects(gate.runRequest(async () => 'write'), /Manutenzione/);
  assert.equal(initialized, false);
  release();
  await exclusive;
  await initialization;
  assert.equal(initialized, true);
});

test('junction bundles cannot escape managed directories or delete repository files', async t => {
  const f = await fixture(t);
  await addAttachment(f);
  const backup = await f.service.createBackup();
  const assets = `${backup.path}.assets`;
  await fs.rm(assets, { recursive: true });
  await fs.symlink(f.repository, assets, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(f.service.deleteBackup(backup.path), /collegamenti/);
  await assert.rejects(f.service.restoreBackup(backup.path), /collegamenti/);
  assert.equal(await fs.readFile(path.join(f.repository, 'file.txt'), 'utf8'), 'original attachment');
});

test('daily snapshot is renewed when the application schema changes', async t => {
  const f = await fixture(t);
  const first = await f.service.autoBackup();
  await f.dataSource.dataSource.query('ALTER TABLE sample ADD COLUMN extra TEXT');
  const renewed = await f.service.autoBackup();
  assert.ok(renewed);
  assert.notEqual(renewed.path, first.path);
});

test('pending database path changes cannot restore over the wrong database', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  const destination = path.join(f.root, 'other.sqlite');
  f.config.dbPath = destination;
  await assert.rejects(f.service.restoreBackup(backup.path), /Chiudi e riapri/);
  await assert.rejects(f.service.createBackup(), /Chiudi e riapri/);
  await assert.rejects(fs.access(destination));
  assert.equal(await value(f), 'original');
});

test('a new backup without its attachment folder cannot masquerade as a legacy snapshot', async t => {
  const f = await fixture(t);
  const backup = await f.service.createBackup();
  await fs.rm(`${backup.path}.assets`, { recursive: true });
  await assert.rejects(f.service.restoreBackup(backup.path), /cartella degli allegati/);
  assert.match((await f.service.listBackups())[0].attachmentError, /cartella degli allegati/);
  assert.equal(await value(f), 'original');
});

test('consumer IPC handlers can create backups without waiting on their own request', async t => {
  const f = await fixture(t);
  const result = await f.maintenance.runRequest(async () => {
    const backup = await f.service.createBackup();
    assert.equal(await value(f), 'original');
    return backup;
  });
  assert.equal(result.includesAttachments, true);
  assert.equal(await f.maintenance.runRequest(async () => 'released'), 'released');
});
