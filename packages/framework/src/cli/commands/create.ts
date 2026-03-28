import * as fs from 'fs';
import * as path from 'path';
import { toKebabCase, toPascalCase } from '../helpers';

const PKG = '@bibi2400/electron-angular-framework';

/**
 * Scaffolds a new Electron + Angular + SQLite project using the framework.
 */
export function create(name: string | undefined): void {
  if (!name) {
    console.error('\nUso: eaf create <nome-progetto>\n');
    console.error('Esempio: eaf create my-app');
    process.exit(1);
  }

  const kebab = toKebabCase(name);
  const pascal = toPascalCase(name);
  const productName = pascal.replace(/([A-Z])/g, ' $1').trim();
  const dir = path.resolve(process.cwd(), kebab);

  if (fs.existsSync(dir)) {
    console.error(`\n❌ La cartella "${kebab}" esiste già.`);
    process.exit(1);
  }

  console.log(`\n🚀 Creazione progetto "${productName}" in ${dir}\n`);

  // Create directory structure
  const dirs = [
    '',
    'electron/src/controllers',
    'electron/src/services',
    'electron/src/db/entities',
    'src/app/pages/dashboard',
    'src/app/components',
    'src/app/services',
    'src/assets',
    'public',
    'build',
    '.vscode',
    '.github/workflows',
    '.github/instructions',
    'packages/framework',
  ];

  for (const d of dirs) {
    fs.mkdirSync(path.join(dir, d), { recursive: true });
  }

  // ─── Root files ──────────────────────────────────────────

  writeFile(dir, 'package.json', JSON.stringify({
    name: kebab,
    productName: productName,
    version: '1.0.0',
    main: 'electron/dist-electron/electron/main.js',
    author: '',
    workspaces: ['packages/*'],
    scripts: {
      ng: 'ng',
      start: 'ng serve --port 4202',
      dev: 'node scripts/dev.js',
      'dev:no-splash': 'node scripts/dev.js --no-splash',
      'build:all': 'npx eaf build',
      'package:win': 'npx eaf package',
      'package:win:noUpdateToken': 'npx eaf package --no-token',
    },
    build: {
      appId: `com.${kebab}.app`,
      productName: productName,
      artifactName: `${pascal}-Setup-\${version}.\${ext}`,
      asar: true,
      asarUnpack: ['node_modules/sqlite3/**'],
      directories: { output: 'release' },
      files: [
        'dist/**/*',
        'electron/dist-electron/**/*',
        'package.json',
        '!**/node_modules/*/{CHANGELOG.md,README.md,README,readme.md,readme}',
        '!**/node_modules/*/{test,__tests__,tests,powered-test,example,examples}',
        '!**/node_modules/*.d.ts',
        '!**/node_modules/.bin',
        '!**/*.{iml,o,hmap,jsbundle,jsdt,sber,nycrc,nyc_output,mk,bcmap,tsbuildinfo,map}',
        '!**/node_modules/sqlite3/deps/**',
        '!**/node_modules/sqlite3/build-tmp-napi-v6/**',
        '!**/node_modules/typeorm/browser/**',
        '!**/node_modules/typeorm/{docs,sample,test}/**',
      ],
      extraResources: [
        { from: 'src/assets/splash.html', to: 'splash.html' },
        { from: 'src/assets/splash.png', to: 'splash.png' },
        { from: 'changelog.txt', to: 'changelog.txt' },
      ],
      nsis: {
        oneClick: false,
        allowToChangeInstallationDirectory: false,
        include: `node_modules/${PKG}/src/cli/build/installer.nsh`,
      },
      win: { target: 'nsis', icon: 'src/assets/icon.png' },
      releaseInfo: { releaseNotesFile: 'changelog.txt' },
    },
    publish: {
      provider: 'github',
      owner: '',
      repo: kebab,
      private: true,
    },
    private: true,
    dependencies: {
      [`${PKG}`]: '*',
    },
    devDependencies: {
      '@angular/build': '^21.0.2',
      '@angular/cdk': '^21.0.2',
      '@angular/cli': '^21.0.2',
      '@angular/common': '^21.0.0',
      '@angular/compiler': '^21.0.0',
      '@angular/compiler-cli': '^21.0.0',
      '@angular/core': '^21.0.0',
      '@angular/forms': '^21.0.0',
      '@angular/material': '^21.0.2',
      '@angular/platform-browser': '^21.0.0',
      '@angular/router': '^21.0.0',
      'ag-grid-angular': '^35.0.0',
      'ag-grid-community': '^35.0.0',
      'electron': '^39.2.6',
      'electron-builder': '^26.0.12',
      'rxjs': '~7.8.0',
      'tslib': '^2.3.0',
      'tsx': '^4.21.0',
      'typescript': '~5.9.2',
    },
  }, null, 2));

  writeFile(dir, 'tsconfig.json', JSON.stringify({
    compileOnSave: false,
    compilerOptions: {
      baseUrl: '.',
      paths: {
        [`${PKG}/angular`]: ['packages/framework/src/angular/index.ts'],
      },
      strict: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      isolatedModules: true,
      importHelpers: true,
      target: 'ES2022',
      module: 'preserve',
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
      strictPropertyInitialization: false,
      resolveJsonModule: true,
    },
    angularCompilerOptions: {
      enableI18nLegacyMessageIdFormat: false,
      strictInjectionParameters: true,
      strictInputAccessModifiers: true,
      strictTemplates: true,
    },
    files: [],
    references: [
      { path: './tsconfig.app.json' },
      { path: './tsconfig.spec.json' },
    ],
  }, null, 2));

  writeFile(dir, 'tsconfig.app.json', JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: './out-tsc/app',
      types: [],
    },
    include: [
      'src/**/*.ts',
      'packages/framework/src/angular/**/*.ts',
      'packages/framework/src/shared/**/*.ts',
    ],
    exclude: ['src/**/*.spec.ts'],
  }, null, 2));

  writeFile(dir, 'tsconfig.spec.json', JSON.stringify({
    extends: './tsconfig.json',
    compilerOptions: {
      outDir: './out-tsc/spec',
      types: [],
    },
    include: ['src/**/*.spec.ts', 'src/**/*.d.ts'],
  }, null, 2));

  writeFile(dir, 'angular.json', JSON.stringify({
    $schema: './node_modules/@angular/cli/lib/config/schema.json',
    version: 1,
    cli: { packageManager: 'npm' },
    newProjectRoot: 'projects',
    projects: {
      [kebab]: {
        projectType: 'application',
        schematics: {
          '@schematics/angular:component': { style: 'scss' },
        },
        root: '',
        sourceRoot: 'src',
        prefix: 'app',
        architect: {
          build: {
            builder: '@angular/build:application',
            options: {
              browser: 'src/main.ts',
              tsConfig: 'tsconfig.app.json',
              inlineStyleLanguage: 'scss',
              baseHref: './',
              assets: [
                { glob: '**/*', input: 'public' },
                { glob: '**/*', input: 'src/assets', output: '/assets' },
              ],
              styles: ['src/styles.scss'],
            },
            configurations: {
              production: {
                budgets: [
                  { type: 'initial', maximumWarning: '2MB', maximumError: '3MB' },
                  { type: 'anyComponentStyle', maximumWarning: '10kB', maximumError: '20kB' },
                ],
                outputHashing: 'all',
              },
              development: {
                optimization: false,
                extractLicenses: false,
                sourceMap: true,
              },
            },
            defaultConfiguration: 'production',
          },
          serve: {
            builder: '@angular/build:dev-server',
            configurations: {
              production: { buildTarget: `${kebab}:build:production` },
              development: { buildTarget: `${kebab}:build:development` },
            },
            defaultConfiguration: 'development',
          },
          test: { builder: '@angular/build:unit-test' },
        },
      },
    },
  }, null, 2));

  // ─── Electron files ──────────────────────────────────────

  writeFile(dir, 'electron/main.ts', `\
import { AppBootstrap } from '${PKG}/electron';
import { MODELS } from './src/db/entities';
import './src/controllers'; // side-effect imports to register @Controller decorators
import { APP_SERVICES } from './src/services';

const bootstrap = new AppBootstrap({
  entities: MODELS,
  services: APP_SERVICES,
});

bootstrap.start();
`);

  writeFile(dir, 'electron/preload.ts', `\
// Framework preload — auto-configures electronAPI on import
import '${PKG}/preload';
`);

  writeFile(dir, 'electron/tsconfig.json', JSON.stringify({
    extends: '../tsconfig.json',
    compilerOptions: {
      sourceMap: true,
      outDir: './dist-electron',
      rootDir: '..',
      baseUrl: '..',
      paths: {
        [`${PKG}/electron`]: ['packages/framework/dist/electron/index'],
        [`${PKG}/preload`]: ['packages/framework/dist/preload/index'],
      },
      module: 'commonjs',
      target: 'es2020',
      types: ['node'],
      esModuleInterop: true,
      experimentalDecorators: true,
      emitDecoratorMetadata: true,
    },
    include: ['./**/*.ts'],
  }, null, 2));

  writeFile(dir, 'electron/src/controllers/index.ts', `\
// Import consumer controllers here (side-effect imports to trigger @Controller decorator registration)
// Example: import './my-custom.controller';
`);

  writeFile(dir, 'electron/src/services/index.ts', `\
// Consumer-specific Electron services
// Import and add custom services here.
// Example:
// import { MyCustomService } from "./my-custom.service";

export const APP_SERVICES = [
  // MyCustomService,
];
`);

  writeFile(dir, 'electron/src/db/entities/index.ts', `\
// Import and register TypeORM entities here.
// Example:
// import { MyEntity } from './my-entity';

export const MODELS = [
  // MyEntity,
];
`);

  // ─── Angular files ───────────────────────────────────────

  writeFile(dir, 'src/main.ts', `\
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
`);

  writeFile(dir, 'src/app/app.ts', `\
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FrameworkShell } from '${PKG}/angular';

@Component({
  selector: 'app-root',
  imports: [FrameworkShell],
  template: '<eaf-shell author="" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App { }
`);

  writeFile(dir, 'src/app/app.config.ts', `\
import { FrameworkConfig } from '${PKG}/angular';
import { routes } from './app.routes';

const frameworkConfig = new FrameworkConfig({ routes });

export const appConfig = frameworkConfig.toApplicationConfig();
`);

  writeFile(dir, 'src/app/app.routes.ts', `\
import { Routes } from '@angular/router';
import { FrameworkRoutes } from '${PKG}/angular';
import { Dashboard } from './pages/dashboard/dashboard';

const appRoutes: Routes = [
  {
    path: 'dashboard',
    component: Dashboard,
  },
];

export const routes = FrameworkRoutes.build(appRoutes, 'dashboard');
`);

  writeFile(dir, 'src/app/pages/dashboard/dashboard.ts', `\
import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  imports: [],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Dashboard {

}
`);

  writeFile(dir, 'src/app/pages/dashboard/dashboard.html', `\
<p>Benvenuto nella dashboard!</p>
`);

  writeFile(dir, 'src/app/pages/dashboard/dashboard.scss', `\
:host {
  display: block;
}
`);

  writeFile(dir, 'src/index.html', `\
<!doctype html>
<html lang="it">
<head>
  <meta charset="utf-8">
  <title>${productName}</title>
  <base href="./">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght@200;400;600" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
</head>
<body>
  <app-root></app-root>
</body>
</html>
`);

  writeFile(dir, 'src/styles.scss', `\
@use '@angular/material' as mat;
@import 'ag-grid-community/styles/ag-theme-material.css';

html {
  @include mat.theme((
    color: (
      primary: mat.$cyan-palette,
      tertiary: mat.$orange-palette,
    ),
    typography: Roboto,
    density: 0,
  ));
}

body {
  color-scheme: light;
  background-color: var(--mat-sys-surface);
  color: var(--mat-sys-on-surface);
  font: var(--mat-sys-body-medium);
  margin: 0;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
    Oxygen, Ubuntu, Cantarell, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #1a1d29;
  background: #f5f7fa;
}

html, body {
  height: 100%;
  margin: 0;
}
`);

  // ─── Assets ──────────────────────────────────────────────

  writeFile(dir, 'src/assets/splash.html', `\
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100vh;
        width: 100vw;
        background: #121947;
        overflow: hidden;
      }
      .splash-container {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
      }
      .splash-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .version {
        position: absolute;
        bottom: 20px;
        right: 20px;
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      }
    </style>
  </head>
  <body>
    <div class="splash-container">
      <img src="splash.png" class="splash-image">
    </div>
    <div class="version">v1.0.0</div>
  </body>
</html>
`);

  // ─── Build helper files ──────────────────────────────────

  writeFile(dir, 'changelog.txt', '');

  // ─── Dev scripts ─────────────────────────────────────────

  writeFile(dir, 'scripts/dev.js',
    `// Delegates to the framework's dev orchestrator\nrequire('${PKG}/scripts/dev');\n`);

  writeFile(dir, 'scripts/electron-dev.js',
    `// Delegates to the framework's Electron dev script\nrequire('${PKG}/scripts/electron-dev');\n`);

  // ─── CI/CD ───────────────────────────────────────────────

  writeFile(dir, '.github/workflows/build-and-release.yml', CI_WORKFLOW);

  // ─── VS Code config ─────────────────────────────────────

  writeFile(dir, '.vscode/tasks.json', JSON.stringify({
    version: '2.0.0',
    tasks: [
      {
        label: '🚀 DEV',
        type: 'npm',
        script: 'dev',
        isBackground: true,
        problemMatcher: {
          owner: 'typescript',
          pattern: '$tsc',
          background: {
            activeOnStart: true,
            beginsPattern: { regexp: '(.*?)' },
            endsPattern: { regexp: 'bundle generation complete' },
          },
        },
      },
      {
        label: '🥷🏼 DEV (No Splash)',
        type: 'npm',
        script: 'dev:no-splash',
        isBackground: true,
        problemMatcher: {
          owner: 'typescript',
          pattern: '$tsc',
          background: {
            activeOnStart: true,
            beginsPattern: { regexp: '(.*?)' },
            endsPattern: { regexp: 'bundle generation complete' },
          },
        },
      },
      {
        label: '📦 Package Win (No Update Token)',
        type: 'npm',
        script: 'package:win:noUpdateToken',
        problemMatcher: [],
      },
      {
        label: '🅰️ Angular: Nuova Pagina',
        type: 'shell',
        command: 'npx eaf generate angular-page ${input:angularPageName}',
        problemMatcher: [],
      },
      {
        label: '🅰️ Angular: Nuovo Componente',
        type: 'shell',
        command: 'npx eaf generate angular-component ${input:angularComponentName}',
        problemMatcher: [],
      },
      {
        label: '🅰️ Angular: Nuovo Service',
        type: 'shell',
        command: 'npx eaf generate angular-service ${input:angularServiceName}',
        problemMatcher: [],
      },
      {
        label: '🅰️ Angular: Nuova Pipe',
        type: 'shell',
        command: 'npx eaf generate angular-pipe ${input:angularPipeName}',
        problemMatcher: [],
      },
      {
        label: '⚡️ Electron: Nuovo Service',
        type: 'shell',
        command: 'npx eaf generate electron-service ${input:electronServiceName}',
        problemMatcher: [],
      },
      {
        label: '⚡️ Electron: Nuovo Controller',
        type: 'shell',
        command: 'npx eaf generate electron-controller ${input:electronControllerName}',
        problemMatcher: [],
      },
    ],
    inputs: [
      { id: 'angularPageName', type: 'promptString', description: 'Nome della pagina (es. user-profile)' },
      { id: 'angularComponentName', type: 'promptString', description: 'Nome del componente (es. data-table)' },
      { id: 'angularServiceName', type: 'promptString', description: 'Nome del service (es. auth)' },
      { id: 'angularPipeName', type: 'promptString', description: 'Nome della pipe (es. format-date)' },
      { id: 'electronServiceName', type: 'promptString', description: 'Nome del service Electron (es. auth)' },
      { id: 'electronControllerName', type: 'promptString', description: 'Nome del controller Electron (es. user)' },
    ],
  }, null, 2));

  // ─── .gitignore ──────────────────────────────────────────

  writeFile(dir, '.gitignore', `\
# Compiled output
/dist
/tmp
/out-tsc

# Node
/node_modules
npm-debug.log

# IDEs
.idea/
*.sublime-workspace

# VS Code
.vscode/*
!.vscode/settings.json
!.vscode/tasks.json
!.vscode/launch.json
!.vscode/extensions.json

# Miscellaneous
/.angular/cache
.sass-cache/
/coverage

# System files
.DS_Store
Thumbs.db

# Electron
electron/dist-electron
release
appdata

# Framework build output
packages/framework/dist

# Config
db-config.json
.env
`);

  // ─── Symlink placeholder for framework ───────────────────

  writeFile(dir, 'packages/framework/.gitkeep', '');

  // ─── npm registry config ──────────────────────────────

  writeFile(dir, '.npmrc', `@bibi2400:registry=https://npm.pkg.github.com\n`);

  console.log(`\n✨ Progetto "${productName}" creato con successo!\n`);
  console.log('Prossimi passi:');
  console.log(`  1. cd ${kebab}`);
  console.log('  2. Configura autenticazione GitHub Packages:');
  console.log('     npm login --scope=@bibi2400 --registry=https://npm.pkg.github.com');
  console.log('  3. npm install');
  console.log('  4. npm run dev');
  console.log('');
}

function writeFile(baseDir: string, relativePath: string, content: string): void {
  const fullPath = path.join(baseDir, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log(`  ✅ ${relativePath}`);
}

const CI_WORKFLOW = `\
name: Build and Release

on:
  push:
    branches:
      - main
      - staging
  workflow_dispatch:

jobs:
  build-and-release:
    runs-on: windows-latest
    permissions:
      contents: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Compute version and check tag
        id: version
        shell: bash
        run: |
          BASE_VERSION=\$(node -p "require('./package.json').version")
          if [ "\${{ github.ref_name }}" == "staging" ]; then
            FULL_VERSION="\${BASE_VERSION}-beta.\${{ github.run_number }}"
            npm --no-git-tag-version version \$FULL_VERSION
          else
            FULL_VERSION=\$BASE_VERSION
          fi
          TAG_NAME="v\$FULL_VERSION"
          echo "TAG_NAME=\$TAG_NAME" >> \$GITHUB_OUTPUT
          if git ls-remote --tags origin refs/tags/\$TAG_NAME | grep -q \$TAG_NAME; then
            echo "❌ Tag \$TAG_NAME already exists!"
            exit 1
          fi

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: npm ci

      - name: Generate changelog
        shell: bash
        env:
          TAG_NAME: \${{ steps.version.outputs.TAG_NAME }}
          BRANCH_NAME: \${{ github.ref_name }}
        run: |
          if [ "\$BRANCH_NAME" == "staging" ]; then
            PREV_TAG=\$(git tag --sort=-v:refname | grep -v "^\$TAG_NAME\$" | grep "beta" | head -n 1)
          else
            PREV_TAG=\$(git tag --sort=-v:refname | grep -v "^\$TAG_NAME\$" | grep -v "beta" | head -n 1)
          fi
          if [ -z "\$PREV_TAG" ]; then
            CHANGELOG=\$(git log --pretty=format:"- %s" --no-merges)
          else
            CHANGELOG=\$(git log \${PREV_TAG}..HEAD --pretty=format:"- %s" --no-merges)
          fi
          echo "\$CHANGELOG" > changelog.txt

      - name: Build Electron app
        run: npm run package:win
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          ELECTRON_UPDATE_TOKEN: \${{ secrets.ELECTRON_UPDATE_TOKEN }}

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          tag_name: \${{ steps.version.outputs.TAG_NAME }}
          name: Release \${{ steps.version.outputs.TAG_NAME }}
          prerelease: \${{ github.ref_name == 'staging' }}
          body_path: changelog.txt
          files: |
            release/*.exe
            release/*.zip
            release/*.blockmap
            release/*.yml
`;
