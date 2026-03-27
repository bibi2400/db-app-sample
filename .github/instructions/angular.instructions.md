---
applyTo: "src/**"
description: "Instructions for Angular frontend code: standalone components, pages, services, signals, Electron API wrappers, routing, pipes."
---

# Angular Frontend Instructions

## Component/Page Pattern

All components and pages follow the same pattern:

```typescript
@Component({
  selector: 'app-my-component',
  imports: [MatButtonModule, MatIconModule, ...],
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyComponent implements OnInit {
  // Dependencies via inject()
  private readonly myService = inject(MyService);

  // Reactive state via signals
  protected readonly data = signal<MyData | null>(null);
  protected readonly loading = signal(false);

  // Inputs/Outputs via signal functions
  title = input<string>('');
  closed = output<void>();

  ngOnInit() {
    this.loadData();
  }
}
```

Rules:
- **Always standalone** — no NgModule, imports are in `@Component.imports`
- **Always OnPush** — `changeDetection: ChangeDetectionStrategy.OnPush`
- **inject()** — never constructor injection
- **signal()** — for component state (not plain properties)
- **input() / output()** — for parent-child communication (not @Input/@Output decorators)
- Pages go in `src/app/pages/<name>/` with `.ts`, `.html`, `.scss`
- Components go in `src/app/components/<name>/` with `.ts`, `.html`, `.scss`

## Routing

Routes in `src/app/app.routes.ts`:

```typescript
export const routes: Routes = [
  { path: '', component: Dashboard },               // eager default
  { path: 'backup', loadComponent: () =>             // lazy loaded
    import('./pages/backup-management/backup-management').then(m => m.BackupManagement)
  },
];
```

- Dashboard is eager-loaded (default route)
- All other pages are lazy-loaded via `loadComponent`

## Angular Services

### Standard Service

```typescript
@Injectable({ providedIn: 'root' })
export class MyService {
  private readonly data = signal<Data[]>([]);

  getData() { return this.data(); }
  setData(d: Data[]) { this.data.set(d); }
}
```

### Electron Wrapper Service (IPC calls)

Wraps `window.electronAPI.invoke()` for type-safe communication:

```typescript
@Injectable({ providedIn: 'root' })
export class ElectronBackupService {
  async createBackup(options: BackupOptions): Promise<BackupInfo | null> {
    const response = await window.electronAPI.invoke<IpcResponse<BackupInfo>>('backup:create', options);
    return response.success && response.data ? response.data : null;
  }

  async listBackups(): Promise<BackupInfo[]> {
    const response = await window.electronAPI.invoke<IpcResponse<BackupInfo[]>>('backup:list');
    return response.success && response.data ? response.data : [];
  }
}
```

Pattern: invoke → check `response.success` → return `response.data` or fallback.

### Push Event Subscription Service

Subscribes to real-time events from Electron:

```typescript
@Injectable({ providedIn: 'root' })
export class ElectronUpdateService {
  private readonly pushService = inject(ElectronPushService);

  statusChanged$ = this.pushService.on<UpdateStatus>('push:update:status-changed');
}
```

- `ElectronPushService.on<T>(channel)` returns `Observable<T>`
- Automatically runs inside NgZone for change detection
- Channel format: `push:{prefix}:{eventName}`

## Key Angular Services Reference

| Service | Purpose |
|---------|---------|
| `NavigationService` | Sidebar menu items, active links, toolbar actions |
| `ElectronAppService` | App info, window control, paths IPC calls |
| `ElectronBackupService` | Backup create/list/restore IPC calls |
| `ElectronUpdateService` | Subscribe to update push events |
| `ElectronPushService` | Generic Observable wrapper for push channels |
| `ChronoService` | Angular-side Chronomancer performance timing |
| `NotificationService` | UI notification display and management |
| `ShortcutService` | Keyboard shortcut registration |
| `CommandPaletteService` | Command palette state (Ctrl+K) |

## Type Definitions

Shared types live in `src/app/types/`:

| File | Types |
|------|-------|
| `global.ts` | `IpcResponse<T>`, `window.electronAPI` type |
| `backup.ts` | `BackupInfo`, `BackupOptions`, `RestoreResult`, `BackupStats` |
| `update.ts` | `UpdateStatus`, `UpdateStatusType`, `DownloadProgress`, `ChangelogEntry` |
| `notification.ts` | Notification system types |
| `shortcut.ts` | Keyboard shortcut types |
| `command-palette.ts` | Command palette types |

## Pipe Pattern

```typescript
@Pipe({ name: 'myPipe', standalone: true })
export class MyPipe implements PipeTransform {
  transform(value: string, ...args: unknown[]): string {
    return /* transformed value */;
  }
}
```

## UI Framework

- **Angular Material** — primary UI library (MatButton, MatIcon, MatDialog, MatList, etc.)
- **ag-Grid** — data tables
- **SCSS** — styling with component-scoped styles
- **Italian locale** — all user-facing strings in Italian
