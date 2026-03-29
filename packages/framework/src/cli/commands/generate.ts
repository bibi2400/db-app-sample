import * as fs from 'fs';
import * as path from 'path';
import { toKebabCase, toPascalCase, toCamelCase, writeIfNotExists } from '../helpers';

const PKG = '@bibi2400/electron-angular-framework';

// ─── Angular Page ────────────────────────────────────────────────────────────

function generateAngularPage(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const dir = path.join('angular', 'src', 'app', 'pages', kebab);

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
  console.log(`\n📝 Ricorda di aggiungere la route in angular/src/app/app.routes.ts:`);
  console.log(`   {`);
  console.log(`     path: '${kebab}',`);
  console.log(`     loadComponent: () => import('./pages/${kebab}/${kebab}').then(m => m.${pascal})`);
  console.log(`   }`);
}

// ─── Angular Component ──────────────────────────────────────────────────────

function generateAngularComponent(name: string): void {
  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const dir = path.join('angular', 'src', 'app', 'components', kebab);

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
  const filePath = path.join('angular', 'src', 'app', 'services', `${kebab}.service.ts`);

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
  const dir = path.join('angular', 'src', 'app', 'pipes');
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
import { Injectable } from '${PKG}/electron';

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
      // Add import before "export const"
      indexContent = indexContent.replace(
        /\nexport const/,
        `\n${importLine}\n\nexport const`
      );

      // Add to array before closing "]"
      indexContent = indexContent.replace(/\n\]/, `\n${arrayEntry}\n]`);

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
import { BaseController, Controller, IpcHandler } from '${PKG}/electron';

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
      // Add side-effect import after the last side-effect import
      const lastSideEffectImportRegex = /(import '\.\/[\w-]+\.controller';)\n/;
      const match = indexContent.match(lastSideEffectImportRegex);
      if (match) {
        indexContent = indexContent.replace(
          lastSideEffectImportRegex,
          `$1\n${sideEffectImport}\n`
        );
      } else {
        // Fallback: add at the top
        indexContent = `${sideEffectImport}\n${indexContent}`;
      }

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

const GENERATORS: Record<string, (name: string) => void> = {
  'angular-page': generateAngularPage,
  'angular-component': generateAngularComponent,
  'angular-service': generateAngularService,
  'angular-pipe': generateAngularPipe,
  'electron-service': generateElectronService,
  'electron-controller': generateElectronController,
};

export function generate(type: string | undefined, name: string): void {
  if (!type || !GENERATORS[type]) {
    console.error('\nUso: eaf generate <tipo> <nome>\n');
    console.error('Tipi disponibili:');
    Object.keys(GENERATORS).forEach(k => console.error(`  - ${k}`));
    console.error('\nEsempio: eaf generate angular-page user-profile');
    process.exit(1);
  }

  if (!name) {
    console.error(`\n❌ Specificare un nome per il ${type}`);
    process.exit(1);
  }

  GENERATORS[type](name);
}
