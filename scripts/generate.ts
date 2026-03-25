import * as fs from 'fs';
import * as path from 'path';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function toPascalCase(str: string): string {
  return toKebabCase(str)
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function writeIfNotExists(filePath: string, content: string): void {
  if (fs.existsSync(filePath)) {
    console.error(`❌ Il file esiste già: ${path.relative(process.cwd(), filePath)}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log(`  ✅ ${path.relative(process.cwd(), filePath)}`);
}

// ─── Angular Page ────────────────────────────────────────────────────────────

function generateAngularPage(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const dir = path.join('src', 'app', 'pages', kebab);

  console.log(`\n🔵 Generazione pagina Angular: ${pascal}\n`);

  writeIfNotExists(path.join(dir, `${kebab}.ts`), `\
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-${kebab}',
  imports: [],
  templateUrl: './${kebab}.html',
  styleUrl: './${kebab}.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${pascal} {

}
`);

  writeIfNotExists(path.join(dir, `${kebab}.html`), `\
<p>${kebab} works!</p>
`);

  writeIfNotExists(path.join(dir, `${kebab}.scss`), `\
:host {
  display: block;
}
`);

  console.log(`\n✨ Pagina "${pascal}" creata in ${dir}`);
  console.log(`\n📝 Ricorda di aggiungere la route in src/app/app.routes.ts:`);
  console.log(`   {`);
  console.log(`     path: '${kebab}',`);
  console.log(`     loadComponent: () => import('./pages/${kebab}/${kebab}').then(m => m.${pascal})`);
  console.log(`   }`);
}

// ─── Angular Component ──────────────────────────────────────────────────────

function generateAngularComponent(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const dir = path.join('src', 'app', 'components', kebab);

  console.log(`\n🔵 Generazione componente Angular: ${pascal}\n`);

  writeIfNotExists(path.join(dir, `${kebab}.ts`), `\
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-${kebab}',
  imports: [],
  templateUrl: './${kebab}.html',
  styleUrl: './${kebab}.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${pascal} {

}
`);

  writeIfNotExists(path.join(dir, `${kebab}.html`), `\
<p>${kebab} works!</p>
`);

  writeIfNotExists(path.join(dir, `${kebab}.scss`), `\
:host {
  display: block;
}
`);

  console.log(`\n✨ Componente "${pascal}" creato in ${dir}`);
}

// ─── Angular Service ─────────────────────────────────────────────────────────

function generateAngularService(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const filePath = path.join('src', 'app', 'services', `${kebab}.service.ts`);

  console.log(`\n🔵 Generazione service Angular: ${pascal}Service\n`);

  writeIfNotExists(filePath, `\
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class ${pascal}Service {

}
`);

  console.log(`\n✨ Service "${pascal}Service" creato`);
}

// ─── Angular Pipe ────────────────────────────────────────────────────────────

function generateAngularPipe(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const camel = toCamelCase(name);
  const dir = path.join('src', 'app', 'pipes');
  const filePath = path.join(dir, `${kebab}.pipe.ts`);

  console.log(`\n🔵 Generazione pipe Angular: ${pascal}Pipe\n`);

  writeIfNotExists(filePath, `\
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: '${camel}',
  standalone: true,
})
export class ${pascal}Pipe implements PipeTransform {
  transform(value: unknown, ...args: unknown[]): unknown {
    return value;
  }
}
`);

  console.log(`\n✨ Pipe "${pascal}Pipe" creata`);
  console.log(`\n📝 Usa la pipe nel template: {{ valore | ${camel} }}`);
}

// ─── Electron Service ────────────────────────────────────────────────────────

function generateElectronService(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const filePath = path.join('electron', 'src', 'services', `${kebab}.service.ts`);
  const indexPath = path.join('electron', 'src', 'services', 'index.ts');

  console.log(`\n🟡 Generazione service Electron: ${pascal}Service\n`);

  writeIfNotExists(filePath, `\
import { Injectable } from '../helpers/mini-pie/decorators';

@Injectable()
export class ${pascal}Service {

}
`);

  // Update index.ts barrel
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    const importLine = `import { ${pascal}Service } from "./${kebab}.service";`;
    const arrayEntry = `  ${pascal}Service,`;

    if (indexContent.includes(importLine)) {
      console.log(`  ⚠️  Import già presente in index.ts`);
    } else {
      // Add import before "export const SERVICES"
      indexContent = indexContent.replace(
        /\nexport const SERVICES/,
        `\n${importLine}\n\nexport const SERVICES`
      );

      // Add to SERVICES array before the closing "]"
      // Insert before the last entry comment block or before AppBootstrapService
      const bootstrapComment = '  // Bootstrap service (must be last, depends on all others)';
      if (indexContent.includes(bootstrapComment)) {
        indexContent = indexContent.replace(
          bootstrapComment,
          `${arrayEntry}\n\n${bootstrapComment}`
        );
      } else {
        // Fallback: insert before the closing bracket
        indexContent = indexContent.replace(/\n\]/, `\n${arrayEntry}\n]`);
      }

      fs.writeFileSync(indexPath, indexContent);
      console.log(`  ✅ ${path.relative(process.cwd(), indexPath)} (aggiornato)`);
    }
  }

  console.log(`\n✨ Service Electron "${pascal}Service" creato`);
}

// ─── Electron Controller ─────────────────────────────────────────────────────

function generateElectronController(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const filePath = path.join('electron', 'src', 'controllers', `${kebab}.controller.ts`);
  const indexPath = path.join('electron', 'src', 'controllers', 'index.ts');

  console.log(`\n🟡 Generazione controller Electron: ${pascal}Controller\n`);

  writeIfNotExists(filePath, `\
import { BaseController } from './base.controller';
import { IpcHandler } from '../decorators/ipc-handler.decorator';
import { Controller } from '../decorators/controller.decorator';

@Controller({ prefix: '${kebab}' })
export class ${pascal}Controller extends BaseController {
  constructor() {
    super();
  }
}
`);

  // Update index.ts barrel
  if (fs.existsSync(indexPath)) {
    let indexContent = fs.readFileSync(indexPath, 'utf-8');
    const sideEffectImport = `import './${kebab}.controller';`;

    if (indexContent.includes(sideEffectImport)) {
      console.log(`  ⚠️  Import già presente in index.ts`);
    } else {
      // Add side-effect import after the last side-effect import block
      const lastSideEffectImportRegex = /(import '\.\/[\w-]+\.controller';)\n\n/;
      indexContent = indexContent.replace(
        lastSideEffectImportRegex,
        `$1\n${sideEffectImport}\n\n`
      );

      fs.writeFileSync(indexPath, indexContent);
      console.log(`  ✅ ${path.relative(process.cwd(), indexPath)} (aggiornato)`);
    }
  }

  console.log(`\n✨ Controller Electron "${pascal}Controller" creato`);
  console.log(`\n📝 Aggiungi i tuoi @IpcHandler nel controller:`);
  console.log(`   @IpcHandler('action')`);
  console.log(`   async myAction() {`);
  console.log(`     try {`);
  console.log(`       return this.success(data);`);
  console.log(`     } catch (error) {`);
  console.log(`       return this.error(error);`);
  console.log(`     }`);
  console.log(`   }`);
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

const COMMANDS: Record<string, (name: string) => void> = {
  'angular-page': generateAngularPage,
  'angular-component': generateAngularComponent,
  'angular-service': generateAngularService,
  'angular-pipe': generateAngularPipe,
  'electron-service': generateElectronService,
  'electron-controller': generateElectronController,
};

const [,, command, ...nameParts] = process.argv;
const name = nameParts.join(' ');

if (!command || !COMMANDS[command]) {
  console.error('\nUso: tsx scripts/generate.ts <tipo> <nome>\n');
  console.error('Tipi disponibili:');
  Object.keys(COMMANDS).forEach(k => console.error(`  - ${k}`));
  console.error('\nEsempio: tsx scripts/generate.ts angular-page user-profile');
  process.exit(1);
}

if (!name) {
  console.error(`\n❌ Specificare un nome per il ${command}`);
  process.exit(1);
}

COMMANDS[command](name);
