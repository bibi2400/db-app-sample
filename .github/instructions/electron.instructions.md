---
applyTo: "electron/**"
description: "Instructions for Electron main process code: controllers, services, DI, IPC handlers, push events, TypeORM entities, mini-pie framework."
---

# Electron Main Process Instructions

## Bootstrap Flow

```
electron/main.ts
  → app.whenReady()
  → Injector.load(SERVICES) — topologically sorted DI
  → AppBootstrapService.bootstrap()
    → Init Chronomancer (performance tracking)
    → Load app config from package.json
    → Initialize DataSource (TypeORM + SQLite)
    → Register all controllers (IPC handlers)
    → Create splash window (if enabled)
    → Create main window
    → Init context menu
    → Run startup tasks (backup, updates)
    → Print performance report
```

## mini-pie DI System

Custom lightweight dependency injection in `electron/src/helpers/mini-pie/`.

- `@Injectable()` decorator marks a class for DI (no parameters)
- `Injector.load(classes)` performs topological sort and instantiates singletons
- `Injector.inject(Class)` retrieves the singleton instance
- Dependencies resolved via constructor parameter types using `reflect-metadata`
- Requires `emitDecoratorMetadata: true` in tsconfig
- Circular dependencies are detected and throw errors
- Max load timeout: 1 second

## Controller Pattern

Controllers handle IPC requests from Angular renderer.

```typescript
@Controller({ prefix: "myPrefix" })
export class MyController extends BaseController {
  constructor(private readonly myService: MyService) { super(); }

  @IpcHandler("action")
  async handleAction(arg1: string, arg2: number) {
    try {
      const result = await this.myService.doSomething(arg1, arg2);
      return this.success(result);
    } catch (error) {
      return this.error(error);
    }
  }
}
```

Rules:
- Always extend `BaseController`
- Use `this.success(data)` and `this.error(error)` — never return raw objects
- Full IPC channel: `{prefix}:{handlerName}` (e.g. `myPrefix:action`)
- Every handler should try/catch and return error via `this.error()`
- Register in `CONTROLLERS` array in `electron/src/controllers/index.ts`

## Service Pattern

Services contain business logic and are auto-injected.

```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly configService: ConfigService,
    private readonly dataSourceService: DataSourceService
  ) {}

  async doSomething(): Promise<Result> {
    const repo = this.dataSourceService.model(MyEntity);
    return repo.find();
  }
}
```

Rules:
- Always `@Injectable()` with no parameters
- Constructor injection only (type-based resolution)
- Register in `SYSTEM_SERVICES` array in `electron/src/services/system-services/index.ts`
- Services are singletons — one instance for entire app lifetime

## Push Events Pattern (Main → Renderer)

For sending real-time events from Electron to Angular.

```typescript
@PushChannel('myChannel')
@Injectable()
export class MyService {
  @PushEvent('data-changed')
  dataEmitter = new PushEmitter<MyData>();

  async updateData() {
    const data = await this.fetchData();
    this.dataEmitter.emit(data); // Sends to Angular as 'push:myChannel:data-changed'
  }
}
```

- `@PushChannel(prefix)` on class level — defines channel group
- `@PushEvent(name)` on property level — defines event name
- Property must be typed `PushEmitter<T>`
- Full channel: `push:{prefix}:{eventName}`
- PushService automatically initializes emitters via metadata reflection

## TypeORM Entities

```typescript
@Entity()
export class MyEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description?: string;
}
```

- Register in `MODELS` array in `electron/src/db/entities/index.ts`
- Access via `this.dataSourceService.model(MyEntity)` → returns TypeORM Repository
- `synchronize: true` — schema updates automatically (dev-friendly, not for production)

## Important Services Reference

| Service | Purpose |
|---------|---------|
| `AppConfigService` | App info from package.json + persistent settings |
| `DataSourceService` | TypeORM DataSource init + `.model(Entity)` for repositories |
| `ControllerService` | Registers controllers' IPC handlers on ipcMain |
| `PushService` | Initializes PushEmitters, sends events to renderer |
| `BackupService` | DB backup/restore (auto + manual), integrity check |
| `UpdaterService` | Check/download/install updates, status push events |
| `ConfigService` | Persistent JSON config file read/write |
| `DbConfigService` | Database file path configuration |
| `AppDataService` | App data directory paths |
| `DevModeService` | Development mode detection (`ELECTRON_IS_DEV` env) |
| `LifecycleService` | App quit/window close handlers |
| `CacheService` | In-memory caching |
| `ElectronMainWindowService` | Main BrowserWindow creation |
| `ElectronSplashWindowService` | Splash screen window |

## IpcResponse Type

All controller methods must return this shape:
```typescript
interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
```

## Database Path Logic

- **Development**: `app.getAppPath()/database/`
- **Installed**: `app.getPath('userData')/database/`
- **Portable**: `path.dirname(app.getPath('exe'))/database/` (detected via marker file)
