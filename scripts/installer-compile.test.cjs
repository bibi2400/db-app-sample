const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const prepareInstaller = require('../packages/framework/dist/cli/build/prepare-installer').default;

const compiler = process.argv[2];
assert.ok(compiler, 'Pass the cached makensis.exe path as the first argument');

for (const mode of ['hidden', 'visible', 'default']) {
  test(`NSIS compiles ${mode} mode with the correct number of installer pages`, async t => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'eaf-installer-test-'));
    t.after(async () => {
      assert.equal(path.dirname(path.resolve(root)), path.resolve(os.tmpdir()));
      assert.ok(path.basename(root).startsWith('eaf-installer-test-'));
      await fs.rm(root, { recursive: true, force: true });
    });
    const resources = path.join(root, 'build');
    if (mode !== 'default') {
      await fs.writeFile(path.join(root, 'eaf.config.json'), JSON.stringify({
        databaseUi: { enabled: mode === 'visible' },
      }));
      prepareInstaller({ packager: { projectDir: root, info: { buildResourcesDir: resources } } });
    } else {
      await fs.mkdir(resources);
    }
    const include = path.resolve('packages/framework/src/cli/build/installer.nsh');
    const output = path.join(root, 'installer.exe');
    const script = path.join(root, 'installer.nsi');
    await fs.writeFile(script, [
      'Unicode true',
      'Name "EAF Database Test"',
      `OutFile "${output}"`,
      'InstallDir "$TEMP\\EafDatabaseTest"',
      '!define PRODUCT_NAME "EAF Database Test"',
      `!define BUILD_RESOURCES_DIR "${resources}"`,
      `!include "${include}"`,
      '!insertmacro customPageAfterChangeDir',
      'Page instfiles',
      'Section "Application"',
      '!insertmacro customInstall',
      'SectionEnd',
      '',
    ].join('\n'));
    const result = spawnSync(compiler, ['/V4', '/INPUTCHARSET', 'UTF8', script], { encoding: 'utf8' });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, (result.stdout + result.stderr).slice(-2500));
    const pages = result.stdout.match(/Install: (\d+) page/);
    assert.equal(Number(pages?.[1]), mode === 'hidden' ? 1 : 2);
    await fs.access(output);
  });
}
