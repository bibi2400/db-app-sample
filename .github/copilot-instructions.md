# DB App Sample — Project Instructions

## Overview

Template desktop app: **Angular 21 frontend + Electron backend + SQLite database**.
Monorepo structure. Italian UI locale. Windows NSIS installer via electron-builder. GitHub-based auto-update.

## Project Structure

```
electron/          → Electron main process (TypeScript → CommonJS via tsc)
  src/
    controllers/   → IPC request handlers (@Controller + @IpcHandler)
    services/      → Business logic (@Injectable via mini-pie DI)
    db/entities/   → TypeORM entities
    decorators/    → @Controller, @IpcHandler, @PushChannel, @PushEvent
    helpers/       → mini-pie DI framework, PushEmitter, Logger
    config/        → Runtime configuration
src/app/           → Angular frontend (standalone components)
  pages/           → Routable page components (lazy-loaded)
  components/      → Reusable UI components
  services/        → Angular services + Electron API wrappers
  types/           → Shared TypeScript interfaces
  pipes/           → Angular pipes
shared/            → Code shared between Electron and Angular (@shared/* alias)
  chronomancer/    → Performance measurement utility
scripts/           → Code generation and build utilities
```

## Technology Stack

- **Angular 21** — standalone components, signals, OnPush change detection, Angular Material, ag-Grid
- **Electron** — with preload security bridge (contextBridge)
- **TypeORM + SQLite3** — database with auto-sync enabled
- **mini-pie** — custom lightweight DI framework for Electron services
- **Chronomancer** — custom performance measurement (works in both Node.js and browser)
- **RxJS** — reactive programming in Angular services
- **electron-log** — Electron logging
- **electron-updater** — auto-update system

## Build System

- `npm run dev` — concurrent Angular dev server + Electron watch
- `npm run build:all` — Angular build + Electron TypeScript compilation
- `npm run package:win` — Windows installer with update token
- Electron TypeScript compiled with `tsc` (NOT bundled), outputs to `electron/dist-electron/`
- Angular compiled with `ng build`, outputs to `dist/`

## Communication: Angular ↔ Electron

### Request-Response (IPC invoke)

```
Angular Service → window.electronAPI.invoke('prefix:action', ...args)
  → ipcMain.handle() → Controller.method()
  → returns IpcResponse<T> { success, data?, error? }
```

### Push Events (Main → Renderer)

```
Electron: PushEmitter.emit(data)
  → webContents.send('push:prefix:event', data)
  → Angular: ElectronPushService.on('push:prefix:event') → Observable<T>
```

Security: preload only allows channels starting with `push:` for `.on()/.off()`.

## Naming Conventions

| Element               | File Name                 | Class Name               |
|-----------------------|---------------------------|--------------------------|
| Page                  | `kebab-case.ts`           | `PascalCase`             |
| Component             | `kebab-case.ts`           | `PascalCase`             |
| Angular Service       | `kebab-case.service.ts`   | `PascalCaseService`      |
| Electron Service      | `kebab-case.service.ts`   | `PascalCaseService`      |
| Controller            | `kebab-case.controller.ts`| `PascalCaseController`   |
| Pipe                  | `kebab-case.pipe.ts`      | `PascalCasePipe`         |
| Entity                | `kebab-case.ts`           | `PascalCase`             |
| IPC Channel           | `prefix:action`           | —                        |
| Push Channel          | `push:prefix:event`       | —                        |

## Key Patterns

### Electron Controller Pattern

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

- Always extend `BaseController`
- Use `this.success(data)` / `this.error(error)` for responses
- Full channel: `{prefix}:{handlerName}` (e.g. `backup:create`)
- Register controller in `electron/src/controllers/index.ts` CONTROLLERS array

### Electron Service Pattern

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSourceService: DataSourceService
  ) {}
}
```

- Decorated with `@Injectable()` (mini-pie DI, no parameters)
- Dependencies injected via constructor (type-based resolution)
- Singletons — one instance per app lifetime
- Register in `electron/src/services/system-services/index.ts` SYSTEM_SERVICES array
- Load order: automatic topological sort by dependency graph

### Angular Component/Page Pattern

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

  ngOnInit() { /* ... */ }
}
```

- **Always standalone** (no NgModule)
- **Always OnPush** change detection
- Use `inject()` not constructor injection
- Use `signal()` for reactive state
- Use `input()` / `output()` for parent-child communication (not @Input/@Output)

### Angular Electron Wrapper Service Pattern

```typescript
@Injectable({ providedIn: 'root' })
export class ElectronBackupService {
  async createBackup(options: BackupOptions): Promise<BackupInfo | null> {
    const response = await window.electronAPI.invoke<IpcResponse<BackupInfo>>('backup:create', options);
    return response.success && response.data ? response.data : null;
  }
}
```

### Push Event Pattern (Electron → Angular)

Electron side:
```typescript
@PushChannel('update')
export class UpdaterService {
  @PushEvent('status-changed')
  statusEmitter = new PushEmitter<UpdateStatus>();
  // Emit: this.statusEmitter.emit(status);
}
```

Angular side:
```typescript
@Injectable({ providedIn: 'root' })
export class ElectronUpdateService {
  private readonly pushService = inject(ElectronPushService);
  statusChanged$ = this.pushService.on<UpdateStatus>('push:update:status-changed');
}
```

### TypeORM Entity Pattern

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

## Code Generation

Use the VS Code tasks or CLI:
```bash
npx tsx scripts/generate.ts angular-page <name>
npx tsx scripts/generate.ts angular-component <name>
npx tsx scripts/generate.ts angular-service <name>
npx tsx scripts/generate.ts angular-pipe <name>
npx tsx scripts/generate.ts electron-service <name>
npx tsx scripts/generate.ts electron-controller <name>
```

These auto-create files with correct structure and update barrel files.

## Important Registration Points

When adding new elements, remember to register them:
1. **Electron Services** → add to `SYSTEM_SERVICES` in `electron/src/services/system-services/index.ts`
2. **Controllers** → add to `CONTROLLERS` in `electron/src/controllers/index.ts`
3. **Entities** → add to `MODELS` in `electron/src/db/entities/index.ts`
4. **Angular Routes** → add to `src/app/app.routes.ts`
