import * as fs from 'fs';
import * as path from 'path';
import { MigrationContext } from './types';

export function createMigrationContext(projectDir: string): MigrationContext {
  return {
    projectDir,

    createFile(relativePath: string, content: string): void {
      const fullPath = path.join(projectDir, relativePath);
      if (fs.existsSync(fullPath)) {
        throw new Error(`Il file esiste già: ${relativePath}`);
      }
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      this.log(`  ✅ Creato: ${relativePath}`);
    },

    writeFile(relativePath: string, content: string): void {
      const fullPath = path.join(projectDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      this.log(`  ✅ Scritto: ${relativePath}`);
    },

    readFile(relativePath: string): string {
      const fullPath = path.join(projectDir, relativePath);
      return fs.readFileSync(fullPath, 'utf-8');
    },

    fileExists(relativePath: string): boolean {
      return fs.existsSync(path.join(projectDir, relativePath));
    },

    deleteFile(relativePath: string): void {
      const fullPath = path.join(projectDir, relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        this.log(`  🗑️  Eliminato: ${relativePath}`);
      }
    },

    updateJson<T = any>(relativePath: string, fn: (json: T) => T): void {
      const fullPath = path.join(projectDir, relativePath);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const json = JSON.parse(content);
      const updated = fn(json);
      fs.writeFileSync(fullPath, JSON.stringify(updated, null, 2) + '\n');
      this.log(`  ✅ Aggiornato: ${relativePath}`);
    },

    replaceInFile(relativePath: string, search: string | RegExp, replace: string): void {
      const fullPath = path.join(projectDir, relativePath);
      let content = fs.readFileSync(fullPath, 'utf-8');
      if (typeof search === 'string') {
        content = content.split(search).join(replace);
      } else {
        content = content.replace(search, replace);
      }
      fs.writeFileSync(fullPath, content);
      this.log(`  ✅ Modificato: ${relativePath}`);
    },

    insertAfter(relativePath: string, search: string | RegExp, content: string): void {
      const fullPath = path.join(projectDir, relativePath);
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      const idx = lines.findIndex(line =>
        typeof search === 'string' ? line.includes(search) : search.test(line)
      );
      if (idx === -1) {
        throw new Error(`Pattern non trovato in ${relativePath}: ${search}`);
      }
      lines.splice(idx + 1, 0, content);
      fs.writeFileSync(fullPath, lines.join('\n'));
      this.log(`  ✅ Inserito dopo riga ${idx + 1} in: ${relativePath}`);
    },

    insertBefore(relativePath: string, search: string | RegExp, content: string): void {
      const fullPath = path.join(projectDir, relativePath);
      const fileContent = fs.readFileSync(fullPath, 'utf-8');
      const lines = fileContent.split('\n');
      const idx = lines.findIndex(line =>
        typeof search === 'string' ? line.includes(search) : search.test(line)
      );
      if (idx === -1) {
        throw new Error(`Pattern non trovato in ${relativePath}: ${search}`);
      }
      lines.splice(idx, 0, content);
      fs.writeFileSync(fullPath, lines.join('\n'));
      this.log(`  ✅ Inserito prima di riga ${idx + 1} in: ${relativePath}`);
    },

    log(message: string): void {
      console.log(message);
    },

    warn(message: string): void {
      console.warn(`  ⚠️  ${message}`);
    },
  };
}
