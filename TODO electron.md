## Quello che usate oggi

| Libreria / API | Uso |
|---|---|
| `electron-log` | Logging su file |
| `electron-updater` | Auto-update da GitHub |
| `BrowserWindow`, `ipcMain/Renderer`, `contextBridge` | Finestre + IPC |
| `protocol` | Custom protocol `app://` per SPA |
| `net` | HTTP per scaricare release notes/installer |
| Config custom (JSON manuale) | App settings |

---

## API native di Electron non sfruttate

### 1. **`Tray`** — Icona nella system tray
Minimizza l'app nella tray invece di chiuderla, mostra un menu contestuale (status, azioni rapide, quit). Molto utile per app "always on" come la vostra con backup automatici.

### 2. **`Menu` / `globalShortcut`**
Avete già un sistema di shortcut in Angular (`shortcut.service.ts`), ma `globalShortcut` funziona **anche quando l'app non è in focus**. E `Menu` vi dà il menu nativo dell'app (File, Edit, View...) gratis.

### 3. **`dialog`** — Dialoghi nativi dell'OS
`showOpenDialog`, `showSaveDialog`, `showMessageBox`. Utile per: scegliere dove salvare un backup, confermare un restore, selezionare un DB esterno.

### 4. **`shell`** — Interazione con l'OS
`shell.openExternal(url)` per aprire link, `shell.showItemInFolder(path)` per mostrare il file di backup nel Finder/Explorer. Banale da aggiungere, molto utile per l'utente.

### 5. **`Notification`** — Notifiche native dell'OS
Avete le notifiche in-app, ma le native dell'OS appaiono anche quando l'app è in background. Perfette per: "Backup completato", "Aggiornamento disponibile".

### 6. **`nativeTheme`** — Dark/Light mode
Rileva il tema dell'OS e reagisce ai cambiamenti. Angular Material lo supporta bene, sarebbe un'integrazione pulita.

### 7. **`powerMonitor`** — Eventi di sistema
Rileva `suspend`, `resume`, `lock-screen`, `unlock-screen`, `on-ac`, `on-battery`. Potreste: fare un backup prima del suspend, oppure saltare l'update check se su batteria.

### 8. **`safeStorage`** — Crittografia con keychain dell'OS
Cripta/decripta stringhe usando il keychain nativo (Keychain su macOS, Credential Manager su Windows). Ideale per token, password DB, API keys. Molto più sicuro di salvarli in JSON.

### 9. **`crashReporter`** — Report dei crash
Raccoglie dump dei crash nativi, utilissimo per debug in produzione.

### 10. **`clipboard`** — Accesso agli appunti
Lettura/scrittura dalla clipboard di sistema. Utile per copiare info rapidamente (es. path del DB, dettagli errore).

---

## Librerie satellite interessanti

### 1. **`electron-store`** ⭐
Rimpiazza il vostro `AppConfigService` custom con JSON. Offre: **schema validation**, **migrazioni** tra versioni, **encryption** dei dati, watch dei cambiamenti. Molto più robusto della gestione manuale.

### 2. **`electron-window-state`**
Ricorda **posizione e dimensioni** della finestra tra i riavvii. Due righe di codice, zero manutenzione.

### 3. **`electron-context-menu`**
Menu contestuale (tasto destro) con Copy/Paste/Inspect. Di default Electron non lo ha — l'utente fa tasto destro e non succede nulla.

### 4. **`electron-dl`**
Gestione download con progress bar, resume, retry. Se in futuro doveste scaricare file oltre all'updater.

### 5. **`electron-devtools-installer`**
Installa le DevTools di Angular/Chrome automaticamente in dev mode.

### 6. **`electron-serve`** (di Sindre Sorhus)
Alternativa più pulita al vostro custom `ElectronProtocolService`. Fa la stessa cosa del protocol `app://` ma in modo battle-tested.

---

## Le più impattanti per il vostro progetto

Se dovessi dare priorità, queste 5 hanno il miglior rapporto effort/valore per un'app con DB + backup + update come la vostra:

| Feature | Perché | Effort |
|---|---|---|
| **`shell.showItemInFolder`** | "Mostra backup nel Finder" — 5 righe | Minimo |
| **`Notification` nativa** | Backup/update notifiche anche in background | Basso |
| **`dialog`** | Dialoghi nativi per restore/export | Basso |
| **`Tray`** | App sempre presente, minimizza in tray | Medio |
| **`safeStorage`** | Credenziali sicure nel keychain | Medio |