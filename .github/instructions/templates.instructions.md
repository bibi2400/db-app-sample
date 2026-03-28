---
applyTo: "packages/framework/src/cli/templates/**"
description: "Instructions for the EAF template system: project scaffolding templates, placeholder conventions, and the strict rule about template-only modifications."
---

# Template System Instructions

## ⚠️ Regola Fondamentale

I file nella directory `packages/framework/src/cli/templates/` sono **template di scaffolding** usati dal comando `eaf create <name>` per generare nuovi progetti consumer.

Modificare un template nella libreria **non ha alcun effetto** sui progetti già esistenti. I template vengono usati **una sola volta** al momento della creazione del progetto con `eaf create`.

### Quando modificare i template

- Si vuole cambiare la struttura iniziale per i **nuovi progetti futuri**
- Si aggiunge un nuovo file/configurazione che tutti i nuovi progetti dovranno avere
- Si corregge un errore nel template che produce progetti non funzionanti


## Come Funziona il Sistema di Template

### Comando `eaf create <name>`

Il comando `eaf create` in `packages/framework/src/cli/commands/create.ts`:

1. Crea la directory del progetto
2. Crea directory vuote extra (`src/app/components/`, `src/app/services/`, `public/`, `build/`)
3. Copia ricorsivamente tutti i file `.tmpl` dalla directory `templates/`
4. Sostituisce i placeholder nel contenuto
5. Rimuove l'estensione `.tmpl` dal nome file
6. Inizializza una repository Git con branch `main` e `staging` e un primo commit con i file generati

### Convenzione File `.tmpl`

- Solo i file con estensione `.tmpl` vengono processati
- L'estensione `.tmpl` viene rimossa nell'output (es. `package.json.tmpl` → `package.json`)
- I file senza `.tmpl` vengono ignorati durante il copy

### Placeholder

Quattro placeholder disponibili, sostituiti con valori derivati dal nome progetto:

| Placeholder | Descrizione | Esempio (`eaf create my-app`) |
|---|---|---|
| `{{KEBAB}}` | Nome in kebab-case | `my-app` |
| `{{PASCAL}}` | Nome in PascalCase | `MyApp` |
| `{{PRODUCT_NAME}}` | Nome leggibile (spazi tra maiuscole) | `My App` |
| `{{PKG}}` | Nome pacchetto framework (costante) | `@bibi2400/electron-angular-framework` |

### Struttura Template

```
packages/framework/src/cli/templates/
├── .editorconfig.tmpl
├── .gitignore.tmpl
├── .npmrc.tmpl
├── .github/workflows/build-and-release.yml.tmpl    → CI/CD pipeline
├── .vscode/
│   ├── extensions.json.tmpl
│   ├── launch.json.tmpl
│   ├── settings.json.tmpl
│   └── tasks.json.tmpl                             → VS Code tasks
├── angular.json.tmpl                                → Angular CLI config
├── changelog.txt.tmpl
├── electron/
│   ├── main.ts.tmpl                                 → Entry point Electron
│   ├── preload.ts.tmpl
│   ├── tsconfig.json.tmpl
│   └── src/
│       ├── controllers/index.ts.tmpl                → Registry controller
│       ├── db/entities/index.ts.tmpl                → Registry entità
│       └── services/index.ts.tmpl                   → Registry servizi
├── package.json.tmpl                                → Config root + electron-builder
├── packages/framework/.gitkeep.tmpl                 → Placeholder per symlink framework
├── scripts/
│   ├── dev.js.tmpl                                  → Orchestrator dev
│   └── electron-dev.js.tmpl                         → Watch Electron
├── src/
│   ├── index.html.tmpl
│   ├── main.ts.tmpl                                 → Bootstrap Angular
│   ├── styles.scss.tmpl                             → Stili globali
│   ├── assets/splash.html.tmpl                      → Splash screen
│   └── app/
│       ├── app.ts.tmpl                              → Root component
│       ├── app.config.ts.tmpl                       → Angular config
│       ├── app.routes.ts.tmpl                       → Routes
│       └── pages/dashboard/                         → Pagina default
│           ├── dashboard.ts.tmpl
│           ├── dashboard.html.tmpl
│           └── dashboard.scss.tmpl
├── tsconfig.json.tmpl
├── tsconfig.app.json.tmpl
└── tsconfig.spec.json.tmpl
```

## Code Generation (`eaf generate`)

Il comando `eaf generate` in `packages/framework/src/cli/commands/generate.ts` **non usa file `.tmpl`** ma genera il codice inline con template string. I generatori disponibili:

| Tipo | File creati | Auto-update barrel |
|---|---|---|
| `angular-page` | `src/app/pages/{name}/` (.ts, .html, .scss) | No |
| `angular-component` | `src/app/components/{name}/` (.ts, .html, .scss) | No |
| `angular-service` | `src/app/services/{name}.service.ts` | No |
| `angular-pipe` | `src/app/pipes/{name}.pipe.ts` | No |
| `electron-service` | `electron/src/services/{name}.service.ts` | Sì → `services/index.ts` |
| `electron-controller` | `electron/src/controllers/{name}.controller.ts` | Sì → `controllers/index.ts` |
