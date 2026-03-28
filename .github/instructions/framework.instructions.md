---
applyTo: "packages/framework/**"
description: "Instructions for the @bibi2400/electron-angular-framework package: CLI, exports, build system, Angular/Electron framework code, shared types."
---

# Framework Package Instructions

## Overview

`@bibi2400/electron-angular-framework` is an npm package that provides everything needed to build Electron + Angular + SQLite desktop apps. Published to GitHub Packages (`npm.pkg.github.com`).

## Directory Structure

```
packages/framework/
├── package.json                 → Package config, exports, bin, dependencies
├── tsconfig.json                → TypeScript config (commonjs, ES2022, excludes angular/)
├── src/
│   ├── cli/                     → EAF CLI (binary: "eaf")
│   │   ├── index.ts             → CLI entry point — routes to commands
│   │   ├── helpers.ts           → toKebabCase, toPascalCase, toCamelCase, writeIfNotExists
│   │   ├── commands/
│   │   │   ├── build.ts         → build(), clean(), packageWin() — build orchestration
│   │   │   ├── create.ts        → eaf create <name> — full project scaffolding
│   │   │   ├── generate.ts      → eaf generate <type> <name> — code generation
│   │   │   └── inject-token.ts  → Injects ELECTRON_UPDATE_TOKEN into runtime-config.ts
│   │   ├── scripts/
│   │   │   ├── dev.js           → Full dev orchestrator (ng serve + electron-dev)
│   │   │   └── electron-dev.js  → Framework build + tsc watch + Electron restart
│   │   └── build/
│   │       └── installer.nsh    → NSIS installer script (custom DB path page)
│   ├── electron/                → Electron framework code
│   │   ├── index.ts             → Public API exports (bootstrap, DI, services, decorators)
│   │   ├── bootstrap.ts         → AppBootstrap entry point
│   │   ├── config/
│   │   │   └── runtime-config.ts → Generated: contains GH_TOKEN for auto-update
│   │   ├── controllers/         → Built-in controllers (app, backup, update, notification, test)
│   │   │   ├── base.controller.ts → BaseController with success()/error()
│   │   │   └── index.ts         → FRAMEWORK_CONTROLLERS array
│   │   ├── decorators/
│   │   │   ├── controller.decorator.ts → @Controller({ prefix })
│   │   │   ├── ipc-handler.decorator.ts → @IpcHandler(name)
│   │   │   └── push-channel.decorator.ts → @PushChannel(prefix), @PushEvent(name)
│   │   ├── helpers/
│   │   │   ├── logger.ts        → Electron-log wrapper
│   │   │   ├── chronomancer.adapter.ts → Node.js Chronomancer setup
│   │   │   ├── mini-pie/        → DI framework: @Injectable, Injector, topological sort
│   │   │   └── push/            → PushEmitter, PushService internals
│   │   ├── services/
│   │   │   ├── index.ts         → All framework service exports
│   │   │   └── system-services/ → 18+ core services (config, DB, backup, update, window, etc.)
│   │   └── db/
│   │       └── entities/        → Framework-level entities (if any)
│   ├── angular/                 → Angular framework code (NOT compiled, distributed as TS source)
│   │   ├── index.ts             → Public API exports (config, shell, components, services, types)
│   │   ├── config.ts            → FrameworkConfig (Angular providers)
│   │   ├── routes.ts            → FrameworkRoutes (backup, updates, notifications, shortcuts, app-info)
│   │   ├── components/
│   │   │   ├── framework-shell/ → Main app layout (sidebar + toolbar + content + panels)
│   │   │   ├── sidebar/         → Navigation sidebar
│   │   │   ├── toolbar/         → Top toolbar
│   │   │   ├── notification-panel/ → Notification system UI
│   │   │   ├── command-palette/ → Ctrl+K command palette
│   │   │   ├── fullscreen-loader/ → Loading overlay
│   │   │   └── dialogs/         → Confirm dialog, shortcut record dialog
│   │   ├── pages/               → Built-in pages
│   │   │   ├── app-info/        → App information page
│   │   │   ├── backup-management/ → Backup management page
│   │   │   ├── update-management/ → Update management page
│   │   │   ├── notifications/   → Notification history page
│   │   │   └── shortcut-management/ → Keyboard shortcut config page
│   │   ├── services/
│   │   │   ├── navigation.service.ts → Sidebar menu + toolbar actions
│   │   │   ├── notification.service.ts → Notification management
│   │   │   ├── shortcut.service.ts → Keyboard shortcut handling
│   │   │   ├── command-palette.service.ts → Command palette state
│   │   │   ├── chrono.service.ts → Browser-side Chronomancer
│   │   │   ├── shortcut-registry.ts → Shortcut store
│   │   │   └── electron-api/    → Electron IPC wrapper services
│   │   │       ├── electron-app.service.ts → App info, window control
│   │   │       ├── electron-backup.service.ts → Backup operations
│   │   │       ├── electron-update.service.ts → Update status subscription
│   │   │       └── electron-push.service.ts → Generic push event Observable wrapper
│   │   └── types/               → Angular-specific type definitions
│   ├── preload/                 → Electron preload bridge
│   │   ├── index.ts             → Re-exports preload setup
│   │   └── preload.ts           → contextBridge.exposeInMainWorld('electronAPI', ...)
│   └── shared/                  → Code shared between Electron and Angular
│       ├── index.ts             → Exports Chronomancer + shared types
│       ├── chronomancer/        → Performance measurement utility
│       │   ├── chronomancer.ts  → Core implementation (timer, table report)
│       │   ├── chronomancer.types.ts → Type definitions
│       │   └── index.ts
│       └── types/               → Shared type definitions (used by both sides)
│           ├── ipc.ts           → IpcResponse<T>
│           ├── backup.ts        → BackupInfo, BackupOptions, RestoreResult
│           ├── update.ts        → UpdateStatus, DownloadProgress, ChangelogEntry
│           ├── notification.ts  → AppNotification types
│           ├── shortcut.ts      → Shortcut types
│           └── command-palette.ts → CommandPaletteItem types
└── dist/                        → Compiled output (CommonJS) — excludes angular/
```

## Package Exports

| Export Path | Points To | Compilation |
|---|---|---|
| `./electron` | `dist/electron/index.js` | Compiled (CommonJS) |
| `./angular` | `src/angular/index.ts` | Source (TypeScript) — compiled by consumer's `ng build` |
| `./preload` | `dist/preload/index.js` | Compiled (CommonJS) |
| `./shared` | `dist/shared/index.js` | Compiled (CommonJS) |
| `./scripts/dev` | `src/cli/scripts/dev.js` | Plain JS |
| `./scripts/electron-dev` | `src/cli/scripts/electron-dev.js` | Plain JS |

**Binary**: `"eaf": "./dist/cli/index.js"` — CLI executable after `npm install`.

## Dependency Strategy

```
dependencies (installed transitively for consumers):
  electron-context-menu, electron-log, electron-serve, electron-updater,
  electron-window-state, reflect-metadata, sqlite3, typeorm

peerDependencies (consumer must install):
  @angular/core, @angular/router, @angular/common, @angular/material, @angular/cdk,
  electron, rxjs, ag-grid-community (optional), ag-grid-angular (optional)
```

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "commonjs",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "strictPropertyInitialization": false
  },
  "exclude": ["dist", "node_modules", "src/angular/**"]
}
```

Key: `src/angular/` is excluded from compilation — it's distributed as TypeScript source and compiled by the consumer's Angular CLI.

## Scripts

| Script | Purpose |
|---|---|
| `prepare` | `tsc -p tsconfig.json` — auto-runs after `npm install` / `npm ci` |
| `build` | `tsc -p tsconfig.json` — manual build |
| `build:watch` | `tsc -p tsconfig.json --watch` — watch mode |

## Published Files

The `"files"` array controls what's included in the npm package:
- `dist/` — compiled JS + declarations (electron, preload, shared, CLI)
- `src/angular/` — Angular source (TypeScript, HTML, SCSS)
- `src/cli/scripts/` — dev orchestrator scripts (dev.js, electron-dev.js)
- `src/cli/build/` — NSIS installer script

## CLI Commands

### `eaf create <name>`
Scaffolds a complete project with:
- `package.json` with scripts, electron-builder config, publish config
- Angular app (root component wrapping FrameworkShell, config, routes, dashboard)
- Electron main process (main.ts, preload.ts, controller/service/entity registries)
- TypeScript configs (root, app, electron)
- VS Code tasks + launch configs
- GitHub Actions CI/CD workflow
- Assets (splash screen, styles, index.html)

### `eaf generate <type> <name>`
Generates code with correct patterns:

| Type | Creates | Auto-updates |
|---|---|---|
| `angular-page` | `.ts`, `.html`, `.scss` in `src/app/pages/` | — |
| `angular-component` | `.ts`, `.html`, `.scss` in `src/app/components/` | — |
| `angular-service` | `.service.ts` in `src/app/services/` | — |
| `angular-pipe` | `.pipe.ts` in `src/app/pipes/` | — |
| `electron-service` | `.service.ts` in `electron/src/services/` | `services/index.ts` barrel |
| `electron-controller` | `.controller.ts` in `electron/src/controllers/` | `controllers/index.ts` imports |

### `eaf build [target]`
- `eaf build` — all three: framework → Angular → Electron
- `eaf build framework` — only `cd packages/framework && tsc`
- `eaf build angular` — only `ng build`
- `eaf build electron` — only `tsc -p electron/tsconfig.json`

### `eaf clean`
Removes `release/` directory.

### `eaf package [--no-token]`
Full packaging pipeline:
1. Clean release directory
2. Inject update token (unless `--no-token`)
3. Build all (framework + Angular + Electron)
4. `electron-builder build --win`

### `eaf inject-token`
Reads `ELECTRON_UPDATE_TOKEN` env var and writes it to `packages/framework/src/electron/config/runtime-config.ts`.

## Dev Scripts (Plain JS)

### dev.js — Full Dev Orchestrator
Spawns in parallel:
1. `ng serve --port 4202` (Angular dev server)
2. `electron-dev.js` (framework build + tsc watch + Electron)

Features:
- No shell wrappers — spawns directly via `process.execPath` (avoids Windows cmd.exe Ctrl+C hangs)
- Stdio piped through Node (prevents Chromium from corrupting Windows console code page / UTF-8)
- Clean shutdown: `taskkill /F /T` on Windows, `SIGKILL` process group on Unix
- Supports `--no-splash` flag

### electron-dev.js — Electron Watch Mode
1. Builds framework (if `packages/framework/tsconfig.json` exists) — spawns tsc directly
2. Starts `tsc --watch` on `electron/tsconfig.json`
3. On "Found 0 errors" → starts/restarts Electron with `--serve` flag
4. Electron stdout/stderr piped through Node

## Version Sync

`scripts/sync-version.ts` (run by `.githooks/pre-commit`):
- Reads root `package.json` version
- Writes it to `packages/framework/package.json`
- Ensures both versions are always in sync

## Template System

I template in `src/cli/templates/` vengono usati dal comando `eaf create <name>` per generare nuovi progetti consumer. Vedere le istruzioni dedicate in `.github/instructions/templates.instructions.md` per i dettagli.

**Regola fondamentale**: i file template vengono usati una sola volta alla creazione del progetto.

## Publishing

- Published to GitHub Packages: `@bibi2400:registry=https://npm.pkg.github.com`
- CI publishes via `npm publish` with `NODE_AUTH_TOKEN` from `GITHUB_TOKEN`
- Framework tarball also uploaded to GitHub Release as backup
