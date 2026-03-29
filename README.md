# Db App Sample

Applicazione desktop di esempio costruita con **Angular 21 + Electron + SQLite**, basata sul framework [`@bibi2400/electron-angular-framework`](https://github.com/bibi2400/db-app-sample/tree/main/packages/framework).

Questo repository funge sia da **app di esempio** (il consumer) sia da **monorepo** che ospita il framework.

---

## Creare un nuovo progetto

Il modo consigliato per creare una nuova app è usare la CLI `eaf`:

### 1. Installa la CLI globalmente

```bash
npm install -g @bibi2400/electron-angular-framework
```

> Il pacchetto è pubblicato su **GitHub Packages**. Prima di installarlo, configura l'autenticazione:
>
> ```bash
> npm login --scope=@bibi2400 --registry=https://npm.pkg.github.com
> ```
>
> Oppure crea un file `.npmrc` nella tua home con:
>
> ```
> @bibi2400:registry=https://npm.pkg.github.com
> //npm.pkg.github.com/:_authToken=IL_TUO_TOKEN
> ```

### 2. Crea il progetto

```bash
eaf create <nome-progetto>
```

**Esempio:**

```bash
eaf create my-cool-app
```

Oppure, dopo aver configurato l'.npmrc lancia direttamente

```bash
npx @bibi2400/electron-angular-framework create <nome-progetto>
```

Questo comando:

1. Crea la cartella `my-cool-app/` nella directory corrente
2. Genera tutti i file del progetto a partire dai template interni del framework
3. Sostituisce automaticamente i placeholder con il nome del progetto:

   | Placeholder | Valore generato |
   |---|---|
   | `{{KEBAB}}` | `my-cool-app` |
   | `{{PASCAL}}` | `MyCoolApp` |
   | `{{PRODUCT_NAME}}` | `My Cool App` |
   | `{{PKG}}` | `@bibi2400/electron-angular-framework` |

4. Inizializza un repository Git con branch `main` e `staging`

### 3. Avvia

```bash
cd my-cool-app
npm run dev
```

### Struttura del progetto generato

```
my-cool-app/
├── electron/              ← Main process Electron
│   ├── main.ts            → Entry point
│   ├── preload.ts         → Re-export del preload del framework
│   └── src/
│       ├── controllers/   → Controller IPC dell'app
│       ├── services/      → Service Electron dell'app
│       └── db/entities/   → Entità TypeORM
├── src/app/               ← Frontend Angular
│   ├── app.ts             → Componente root (wrappa FrameworkShell)
│   ├── app.config.ts      → Configurazione Angular
│   ├── app.routes.ts      → Route app + FrameworkRoutes
│   ├── pages/dashboard/   → Pagina iniziale di esempio
│   ├── components/        → Componenti riutilizzabili
│   └── services/          → Service Angular
├── scripts/               ← Script di sviluppo
├── packages/framework/    ← Placeholder per link locale al framework
├── .github/               ← CI/CD + Copilot instructions
├── .vscode/               ← Tasks, launch config, estensioni
├── package.json
├── angular.json
└── tsconfig*.json
```

### Dopo la creazione

Dopo aver generato il progetto, ricorda di:

- **Aggiornare `publish.owner`** in `package.json` con il tuo username/org GitHub
- **Sostituire le icone** e la splash screen in `src/assets/`
- **Configurare il repository GitHub** per gli auto-update (impostare `publish.repo` in `package.json`)

---

## Code generation

La CLI `eaf` offre anche comandi per generare componenti:

```bash
# Pagine Angular
npx eaf generate angular-page user-profile

# Componenti Angular
npx eaf generate angular-component user-card

# Service Angular
npx eaf generate angular-service auth

# Pipe Angular
npx eaf generate angular-pipe format-date

# Service Electron
npx eaf generate electron-service file-manager

# Controller Electron
npx eaf generate electron-controller file
```

Ogni comando crea i file con la struttura corretta e aggiorna i barrel file (`index.ts`) automaticamente.

---

## Development

```bash
npm run dev
```

Avvia Angular dev server (porta 4202) e Electron in parallelo, con hot-reload.

```bash
npm run dev:no-splash    # Senza splash screen
```

---

## Build di produzione (Windows)

```bash
npm run package:win
```

Pipeline completa: clean → inject-token → build (framework + Angular + Electron) → electron-builder (NSIS installer).

```bash
npm run package:win:noUpdateToken    # Senza token per auto-update
```

---

## Script disponibili

| Script | Comando | Descrizione |
|---|---|---|
| `dev` | `node scripts/dev.js` | Dev completo: ng serve + tsc watch + Electron |
| `dev:no-splash` | `node scripts/dev.js --no-splash` | Dev senza splash screen |
| `build:all` | `npx eaf build` | Build framework + Angular + Electron |
| `package:win` | `npx eaf package` | Release completa con installer |
| `package:win:noUpdateToken` | `npx eaf package --no-token` | Package senza token update |

---

## CLI `eaf` — Comandi completi

| Comando | Descrizione |
|---|---|
| `eaf create <nome>` | Crea un nuovo progetto |
| `eaf generate <tipo> <nome>` | Genera componenti Angular/Electron |
| `eaf build [target]` | Build framework/angular/electron (o tutti) |
| `eaf clean` | Rimuove la directory `release/` |
| `eaf package [--no-token]` | Pipeline completa di packaging |
| `eaf inject-token` | Inietta il token GitHub per auto-update |

---

## Stack tecnologico

- **Angular 21** — standalone components, signals, OnPush, Angular Material, ag-Grid
- **Electron 39** — con preload security bridge (contextBridge)
- **TypeORM + SQLite3** — database con auto-sync
- **electron-updater** — auto-update con canali staging (beta) e production
- **electron-builder** — installer NSIS per Windows
