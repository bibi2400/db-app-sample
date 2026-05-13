# DB App Sample — Project Instructions

## Overview

Desktop app built with **Angular 21 + Electron + SQLite**, powered by the **@bibi2400/electron-angular-framework** package.
Monorepo with npm workspaces. Italian UI locale. Windows NSIS installer via electron-builder. GitHub-based auto-update with staging (beta) and production channels.

## Monorepo Structure

```
db-app-sample/                   ← Root (consumer app)
├── packages/
│   └── framework/               ← @bibi2400/electron-angular-framework (npm library)
│       ├── src/
│       │   ├── cli/             → CLI: eaf create, generate, build, package, inject-token, migrate
│       │   │   ├── commands/    → Command implementations (build.ts, create.ts, generate.ts, inject-token.ts, migrate.ts)
│       │   │   ├── migrations/  → Migration system (definitions, runner, registry, context)
│       │   │   ├── scripts/     → Dev orchestrator scripts (dev.js, electron-dev.js)
│       │   │   └── build/       → NSIS installer script (installer.nsh)
│       │   ├── electron/        → Electron framework: bootstrap, DI, controllers, services, decorators
│       │   ├── angular/         → Angular framework: shell, components, pages, services, types
│       │   ├── preload/         → Preload bridge (contextBridge)
│       │   └── shared/          → Shared code: Chronomancer, types (IPC, backup, update, etc.)
│       ├── dist/                → Compiled output (CommonJS) — excludes angular/
│       ├── tsconfig.json
│       └── package.json
├── electron/                    ← Consumer Electron main process
│   ├── main.ts                  → Entry point: loads bootstrap with app entities & services
│   ├── preload.ts               → Re-exports framework preload
│   └── src/
│       ├── controllers/         → App-specific IPC controllers
│       ├── services/            → App-specific business logic services
│       └── db/entities/         → App-specific TypeORM entities
├── angular/src/                 ← Consumer Angular frontend
│   ├── app/
│   │   ├── app.ts               → Root component (wraps FrameworkShell)
│   │   ├── app.config.ts        → Angular config (uses FrameworkConfig)
│   │   ├── app.routes.ts        → Routes: app pages + FrameworkRoutes
│   │   ├── pages/               → App-specific page components
│   │   ├── components/          → App-specific reusable components
│   │   ├── services/            → App-specific Angular services
│   │   └── types/               → App-specific TypeScript interfaces
│   ├── main.ts                  → Angular entry point
│   ├── styles.scss              → Global styles
│   └── assets/                  → Static assets (splash, icons)
├── scripts/
│   ├── dev.js                   → Thin wrapper → framework dev.js
│   ├── electron-dev.js          → Thin wrapper → framework electron-dev.js
│   └── sync-version.ts          → Pre-commit hook: syncs version to framework
├── .githooks/pre-commit         → Runs sync-version.ts
├── .github/workflows/           → CI/CD pipeline
├── .npmrc                       → GitHub Packages registry (@bibi2400 scope)
└── package.json                 → Consumer app config + electron-builder config
```

## Framework Package

The framework (`@bibi2400/electron-angular-framework`) provides:

| Export Path | Content | Compilation |
|---|---|---|
| `./electron` | Bootstrap, DI, services, controllers, decorators | Compiled to `dist/` (CommonJS) |
| `./angular` | Shell, components, pages, services, types | Distributed as TypeScript source |
| `./preload` | contextBridge security bridge | Compiled to `dist/` |
| `./shared` | Chronomancer, shared types | Compiled to `dist/` |
| `./scripts/dev` | Full dev orchestrator (ng serve + electron-dev) | Plain JS |
| `./scripts/electron-dev` | Framework build + tsc watch + Electron restart | Plain JS |

**CLI binary**: `eaf` — scaffolding, code generation, build orchestration.

### Dependency Strategy

- **Framework `dependencies`** (installed transitively for consumer): electron-log, electron-serve, electron-updater, electron-context-menu, electron-window-state, reflect-metadata, sqlite3, typeorm
- **Framework `peerDependencies`** (consumer must install): Angular, Electron, rxjs, ag-grid (optional)
- **Consumer `dependencies`**: only `@bibi2400/electron-angular-framework`
- **Consumer `devDependencies`**: Angular packages, Electron, electron-builder, typescript, tsx, rxjs

## Technology Stack

- **Angular 21** — standalone components, signals, OnPush, Angular Material, ag-Grid
- **Electron 39** — with preload security bridge (contextBridge)
- **TypeORM + SQLite3** — database with auto-sync enabled
- **mini-pie** — custom lightweight DI framework for Electron services
- **Chronomancer** — custom performance measurement (Node.js + browser)
- **RxJS** — reactive programming in Angular services
- **electron-log** — Electron logging
- **electron-updater** — auto-update with staging (beta.yml) + production (latest.yml) channels

## Build System & Scripts

### Consumer Scripts (package.json)

| Script | Command | Purpose |
|---|---|---|
| `dev` | `node scripts/dev.js` | Full dev: ng serve + tsc watch + Electron |
| `dev:no-splash` | `node scripts/dev.js --no-splash` | Dev without splash screen |
| `build:all` | `npx eaf build` | Build framework + Angular + Electron |
| `package:win` | `npx eaf package` | Full release: clean → inject-token → build → electron-builder |
| `package:win:noUpdateToken` | `npx eaf package --no-token` | Package without update token |

### EAF CLI Commands

| Command | Purpose |
|---|---|
| `eaf create <name>` | Scaffold a new project |
| `eaf generate <type> <name>` | Generate Angular/Electron components |
| `eaf build [target]` | Build framework/angular/electron (or all) |
| `eaf clean` | Remove release/ directory |
| `eaf package [--no-token]` | Full packaging pipeline |
| `eaf inject-token` | Inject GitHub update token |
| `eaf migrate` | Apply pending migrations to current project |
| `eaf migrate --list` | Show pending migrations |
| `eaf migrate --status` | Show full migration status (applied + pending) |
| `eaf migrate --dry-run` | Preview without applying |
| `eaf migrate --init` | Mark all migrations as applied (for existing projects) |

### Build Pipeline

```
eaf build:
  1. Framework:  cd packages/framework && tsc -p tsconfig.json
  2. Angular:    ng build → dist/
  3. Electron:   tsc -p electron/tsconfig.json → electron/dist-electron/
```

### Dev Pipeline

```
npm run dev → scripts/dev.js → framework dev.js:
  1. ng serve (port 4202)           — Angular dev server
  2. framework electron-dev.js:
     a. Build framework (tsc)       — if packages/framework exists
     b. tsc --watch electron/       — TypeScript watch
     c. Start Electron (--serve)    — restarts on changes
```

- No shell wrappers (avoids Windows cmd.exe hangs on Ctrl+C)
- Stdio piped through Node (prevents Chromium from corrupting console encoding)

## Communication: Angular ↔ Electron

### Request-Response (IPC invoke)

```
Angular Service → window.electronAPI.invoke('prefix:action', ...args)
  → preload → ipcMain.handle() → Controller.method()
  → returns IpcResponse<T> { success, data?, error? }
```

### Push Events (Main → Renderer)

```
Electron: PushEmitter.emit(data)
  → webContents.send('push:prefix:event', data)
  → preload (allows 'push:' prefix only)
  → Angular: ElectronPushService.on('push:prefix:event') → Observable<T>
```

## Naming Conventions

| Element | File Name | Class Name |
|---|---|---|
| Page | `kebab-case.ts` | `PascalCase` |
| Component | `kebab-case.ts` | `PascalCase` |
| Angular Service | `kebab-case.service.ts` | `PascalCaseService` |
| Electron Service | `kebab-case.service.ts` | `PascalCaseService` |
| Controller | `kebab-case.controller.ts` | `PascalCaseController` |
| Pipe | `kebab-case.pipe.ts` | `PascalCasePipe` |
| Entity | `kebab-case.ts` | `PascalCase` |
| IPC Channel | `prefix:action` | — |
| Push Channel | `push:prefix:event` | — |

## Key Patterns

### Electron Controller

```typescript
@Controller({ prefix: "backup" })
export class BackupController extends BaseController {
  constructor(private readonly backupService: BackupService) { super(); }

  @IpcHandler("create")
  async createBackup(options: BackupOptions) {
    try {
      const result = await this.backupService.createBackup(options);
      return this.success(result);
    } catch (error) {
      return this.error(error);
    }
  }
}
```

- Extend `BaseController`, use `this.success(data)` / `this.error(error)`
- Full channel: `{prefix}:{handlerName}` (e.g. `backup:create`)
- Register in `electron/src/controllers/index.ts` CONTROLLERS array

### Electron Service

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSourceService: DataSourceService
  ) {}
}
```

- `@Injectable()` (mini-pie DI, no parameters), constructor injection
- Singletons, topological sort load order
- Register in `electron/src/services/system-services/index.ts` SYSTEM_SERVICES array

### Angular Component/Page

```typescript
@Component({
  selector: 'app-my-page',
  imports: [MatButtonModule, ...],
  templateUrl: './my-page.html',
  styleUrl: './my-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyPage implements OnInit {
  private readonly someService = inject(SomeService);
  protected readonly data = signal<Data | null>(null);
}
```

- **Always standalone**, **always OnPush**
- `inject()` for DI, `signal()` for state, `input()` / `output()` for parent-child

### Angular Electron Wrapper Service

```typescript
@Injectable({ providedIn: 'root' })
export class ElectronBackupService {
  async createBackup(options: BackupOptions): Promise<BackupInfo | null> {
    const response = await window.electronAPI.invoke<IpcResponse<BackupInfo>>('backup:create', options);
    return response.success && response.data ? response.data : null;
  }
}
```

### Push Events (Electron → Angular)

Electron:
```typescript
@PushChannel('update')
@Injectable()
export class UpdaterService {
  @PushEvent('status-changed')
  statusEmitter = new PushEmitter<UpdateStatus>();
}
```

Angular:
```typescript
@Injectable({ providedIn: 'root' })
export class ElectronUpdateService {
  private readonly pushService = inject(ElectronPushService);
  statusChanged$ = this.pushService.on<UpdateStatus>('push:update:status-changed');
}
```

### TypeORM Entity

```typescript
@Entity()
export class MyEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;
}
```

- Register in `electron/src/db/entities/index.ts` MODELS array

## TypeScript Configuration

- `strict: true` everywhere
- `experimentalDecorators: true` + `emitDecoratorMetadata: true` (required for mini-pie DI and TypeORM)
- `strictPropertyInitialization: false` (for DI injected properties)
- Electron: `"module": "commonjs"`, `"target": "es2020"`
- Angular: `"module": "preserve"`, `"target": "ES2022"`
- Framework: `"module": "commonjs"`, `"target": "ES2022"`, outputs to `dist/`, excludes `src/angular/`

## Template System (Project Scaffolding)

The framework includes a template system in `packages/framework/src/cli/templates/` used by `eaf create <name>` to scaffold new consumer projects.

### ⚠️ Template vs Consumer: Regola Importante

I file nella directory `templates/` vengono usati **una sola volta** alla creazione del progetto.

- Modificare un template **non ha effetto** sui progetti già esistenti
- Per cambiare il progetto corrente → modificare il file nel progetto consumer (es. `package.json`, `angular.json`, `.vscode/tasks.json`)
- Per propagare una modifica ai template verso i progetti già esistenti → creare una **migrazione** in `packages/framework/src/cli/migrations/definitions/`
- Per cambiare la struttura di base dei nuovi progetti futuri → modificare il template corrispondente in `packages/framework/src/cli/templates/`

### Placeholder Template

| Placeholder | Descrizione | Esempio (`eaf create my-app`) |
|---|---|---|
| `{{KEBAB}}` | Nome kebab-case | `my-app` |
| `{{PASCAL}}` | Nome PascalCase | `MyApp` |
| `{{PRODUCT_NAME}}` | Nome leggibile | `My App` |
| `{{PKG}}` | Nome pacchetto framework | `@bibi2400/electron-angular-framework` |

## Migration System

Il sistema di migrazione permette di propagare modifiche ai template verso i progetti consumer già esistenti.

- Le migrazioni si trovano in `packages/framework/src/cli/migrations/definitions/`
- Lo stato delle migrazioni applicate è tracciato nel file `.eaf-migrations.json` alla root del progetto consumer
- Ogni migrazione ha un `id` univoco, una `description` e una funzione `up(ctx)` che riceve un `MigrationContext`
- Le migrazioni vengono eseguite in ordine e sono idempotenti (se già applicata, viene saltata)
- Il comando `eaf create` segna automaticamente tutte le migrazioni esistenti come applicate sui nuovi progetti

### Quando creare una migrazione

- Si modifica un template e si vuole che la modifica arrivi ai progetti esistenti
- Si aggiunge un nuovo file di configurazione che tutti i progetti devono avere
- Si rinomina/sposta un file che i progetti esistenti hanno nella vecchia posizione

### Regola: template + migrazione

Quando si modifica un template, creare **sempre** anche la migrazione corrispondente se la modifica deve essere propagata ai progetti esistenti.

## Code Generation

Use VS Code tasks or CLI:
```bash
npx eaf generate angular-page <name>
npx eaf generate angular-component <name>
npx eaf generate angular-service <name>
npx eaf generate angular-pipe <name>
npx eaf generate electron-service <name>
npx eaf generate electron-controller <name>
```

These auto-create files with correct structure and update barrel files.

## Important Registration Points

When adding new elements, remember to register them:
1. **Electron Services** → add to `SYSTEM_SERVICES` in `electron/src/services/system-services/index.ts`
2. **Controllers** → add to `CONTROLLERS` in `electron/src/controllers/index.ts`
3. **Entities** → add to `MODELS` in `electron/src/db/entities/index.ts`
4. **Angular Routes** → add to `angular/src/app/app.routes.ts`

## CI/CD Pipeline

**Trigger**: push to `main` or `staging`, or manual dispatch.

### Version Strategy
- **main**: uses `package.json` version as-is (e.g. `2.0.1`)
- **staging**: appends `-beta.{run_number}` (e.g. `2.0.1-beta.25`)

### Pipeline Steps
1. Checkout (full history for tags)
2. Compute version + check tag uniqueness
3. Setup Node 20 (with GitHub Packages registry) + Python 3.12
4. `npm ci` (triggers framework `prepare` → tsc)
5. Generate changelog from git log between previous tag and HEAD
6. `npm run package:win` (clean → inject-token → build → electron-builder)
7. Publish framework to GitHub Packages (`npm publish`)
8. Create GitHub Release with installer, blockmap, yml, tgz

### Git Branching Model
- Feature branches → merge into `staging` → beta releases
- `staging` → merge into `main` → production releases
- VS Code tasks: "🔀 Merge in Staging", "🚢 Publish Branch (Staging)", "🔀 Merge in Main", "🚢 Publish Branch"

## Dev rules
- Use `eaf generate` for Angular/Electron components
- Tell me if I need to launch `eaf migrate` after your template-related changes.
- For any modification and fix, prepare a implementation plan and share it with me before starting to code, so we can align on the approach and I can give you feedback before you invest time in coding.
- Write in the framework's code comments and examples about functionalities usage, so I can learn and Copilot in consumers' codebase can suggest the right usage patterns.