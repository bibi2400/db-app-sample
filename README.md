# Db App Sample

Template per applicazioni desktop con **Angular** + **Electron** + **SQLite**.

## Setup

```bash
npm install
```

## Rinominare l'app

Questo progetto è un template. Per usarlo come base per una nuova app, rinomina il progetto con un singolo comando:

```bash
npm run rename-app -- <slug> "<Display Name>"
```

Esempio:

```bash
npm run rename-app -- my-cool-app "My Cool App"
```

Questo aggiornerà automaticamente il nome in tutti i file di configurazione (`package.json`, `angular.json`, `index.html`, ecc.).

> Dopo il rename, ricordati di aggiornare manualmente `publish.owner` in `package.json` con il tuo username/org GitHub, e di sostituire le icone e la splash screen in `src/assets/`.

## Development

```bash
npm run dev
```

Avvia Angular dev server e Electron in parallelo.

## Build di produzione (Windows)

```bash
npm run package:win
```
