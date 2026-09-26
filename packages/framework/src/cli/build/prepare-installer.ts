import * as fs from 'fs';
import * as path from 'path';
import { parseConsumerConfig } from '../../shared/consumer-config';

interface InstallerBuildContext {
  packager: {
    projectDir: string;
    info: { buildResourcesDir: string };
  };
}

/** electron-builder beforePack hook: regenerate NSIS policy from the consumer config. */
export default function prepareInstaller(context: InstallerBuildContext): void {
  const file = path.join(context.packager.projectDir, 'eaf.config.json');
  const config = parseConsumerConfig(fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : {});
  const directory = context.packager.info.buildResourcesDir;
  fs.mkdirSync(directory, { recursive: true });
  const enabled = config.databaseUi?.enabled !== false ? 1 : 0;
  fs.writeFileSync(
    path.join(directory, 'eaf-database.nsh'),
    `; Generated from eaf.config.json by the framework.\n!define EAF_DATABASE_UI_ENABLED ${enabled}\n`,
  );
}
