---
draft: true
---

# EafTable: densità orizzontale e zoom locale

`horizontalDensity` e `tableZoom` sono input signal opzionali di `EafTable`. Si possono usare insieme o separatamente, senza CSS applicativo che acceda agli elementi interni della tabella.

| Input | Tipo | Valori e default |
| --- | --- | --- |
| `horizontalDensity` | `EafTableHorizontalDensity` | `'standard'` oppure `'compact'`; default effettivo `'standard'` |
| `tableZoom` | `number` | Qualsiasi numero finito nell'intervallo `[0.8, 1]`, estremi inclusi; default effettivo `1` |

`EafTableHorizontalDensity` è esportato da `@bibi2400/electron-angular-framework/angular`. `1`, `0.9` e `0.8` corrispondono rispettivamente al 100%, 90% e 80%. Numeri fuori intervallo, `NaN`, infinito e valori di tipo errato vengono normalizzati a `1`, senza eccezioni. Densità non riconosciute nello stato salvato diventano `'standard'`.

La densità compatta cambia esclusivamente gli spazi orizzontali: porta il padding laterale delle celle a 4 px, azzera gli spazi tra etichetta, filtro e ordinamento e riduce la larghezza del pulsante filtro a 32 px. Conserva font, altezza delle righe, altezza dei pulsanti e dimensione delle icone, con separatori verticali da 1 px tra le colonne in modalità compatta. Il target aggiuntivo Material viene contenuto nei 32 px del pulsante, evitando che invada l'etichetta ordinabile. La tabella compatta usa la larghezza richiesta dai contenuti (`max-content`): le colonne non si allargano per redistribuire lo spazio libero del viewport. Il recupero di larghezza dipende dalle definizioni delle colonne: una larghezza minima esplicita, per esempio `width: '250px'`, viene rispettata anche in modalità compatta. Non nasconde colonne o dati e non disabilita filtri.

Lo zoom usa la proprietà CSS nativa `zoom` solo sul `<table>`. Non forza la larghezza al reciproco dello zoom, che sui viewport ampi distribuirebbe spazio aggiuntivo tra le colonne. Il contenitore conserva le dimensioni disponibili e le barre di scorrimento restano normali. La densità standard mantiene il consueto riempimento della larghezza disponibile. Paginazione, controlli esterni e filtri non ricevono lo zoom locale. I filtri, inclusi i template `eafFilterDef`, sono resi tramite un overlay CDK esterno alla superficie zoomata, ancorato al pulsante e riposizionato durante lo scorrimento e dopo variazioni di zoom/densità. Si chiudono cliccando fuori o premendo Escape. Lo zoom della finestra e dell'applicazione non viene modificato.

In tutte le visualizzazioni EafTable, incluse Standard al 100% e tabelle senza i nuovi input, la paginazione rimane sempre visibile sotto lo scroll delle righe. Con `stickyHeader` attivo (default), anche l'intestazione è fuori dallo scroll verticale. Intestazione e righe usano MatTable native e larghezze di colonna condivise tramite `colgroup`, con scorrimento orizzontale sincronizzato in entrambe le direzioni. Il comportamento vale per tabelle client-side e server-side, con checkbox e colonne azioni, senza modificare i singoli utilizzi nell'app. Ordinamento, filtri, selezione e trascinamento restano disponibili. `stickyHeader=false` mantiene l'intestazione nell'area scorrevole; la paginazione resta comunque esterna.

Il contenitore esterno conserva tutto lo spazio disponibile. La superficie compatta occupa solo la larghezza necessaria a contenuti e scrollbar, fino al limite disponibile: la barra verticale rimane accanto all'ultima colonna anche con zoom locale e zoom dell'app ridotti. In Standard la tabella continua a riempire la larghezza disponibile. In ogni modalità, sfondo e divisore dell'intestazione e paginazione coprono l'intera superficie, compreso lo spazio della scrollbar, senza lasciare una fascia scoperta sul bordo destro. Il viewport interno dell'intestazione mantiene la larghezza dell'area delle celle, così le colonne rimangono allineate durante lo scroll. Le misure seguono dati, zoom e ridimensionamenti tramite `ResizeObserver`, e vengono ricalcolate quando terminano i caricamenti dei font. Con un valore di `height`, il limite comprende intestazione, area scorrevole e paginazione; lo scroll verticale riguarda solo le righe. Cambiare zoom o densità conserva la pagina corrente.

In FrameworkShell lo scroll delle pagine riguarda solo `.main-container`, sotto la toolbar: la scrollbar parte sotto le barre dell'app e la toolbar mantiene la sua fascia anche durante lo scroll orizzontale. Il contenitore principale è registrato come `CdkScrollable`, così i popup e i filtri ricevono anche gli eventi di scroll della pagina. La toolbar e la sidebar continuano a compensare lo zoom dell'app; lo sfondo della pagina resta quello configurato nel tema.

Il CDK usa le coordinate del trigger ottenute dal layout del browser; `getBoundingClientRect()` include già lo zoom CSS, quindi non occorre moltiplicare nuovamente queste coordinate. Riferimenti: [CSS zoom](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/zoom), [coordinate e zoom CSS](https://developer.mozilla.org/en-US/docs/Web/API/Element/currentCSSZoom), [overlay CDK](https://material.angular.dev/cdk/overlay/overview).

## Utilizzo nell'app

Le colonne con un filtro attivo hanno l'intestazione colorata con i colori del tema Material, una linea di accento interna e il pulsante filtro pieno con icona a contrasto. Il tooltip e l'etichetta accessibile indicano «Filtro attivo su» seguito dal titolo della colonna. L'evidenza si applica automaticamente a tutte le EafTable, anche senza input di densità o zoom e con `stickyHeader=false`, e scompare quando il filtro viene cancellato. Non modifica dimensioni, ordinamento o comportamento dei filtri.

L'evidenza dei filtri è stata verificata il 27 settembre 2026 con build Angular di produzione, 23 test EafTable esistenti e prova Chromium sulle sei combinazioni di densità/zoom. Gli screenshot mostrano il filtro attivo con tooltip in Standard al 100% e Compatta all'80%, e il ritorno all'aspetto normale dopo la cancellazione del valore. Le immagini sono salvate in `.tmp-eaf-table-browser/table-filter-active-standard.png`, `table-filter-active-compatta.png` e `table-filter-cleared.png`.

Nel TypeScript del componente:

```ts
import { EafTable } from '@bibi2400/electron-angular-framework/angular';
import type {
  EafTableHorizontalDensity,
} from '@bibi2400/electron-angular-framework/angular';

// Aggiungi EafTable agli imports del componente.
protected readonly density: EafTableHorizontalDensity = 'compact';
protected readonly zoom = 0.9;
```

Nel file HTML separato:

```html
<eaf-table
  tableId="orders"
  tableStateStorageType="local"
  height="420px"
  [columns]="columns"
  [data]="rows"
  [horizontalDensity]="density"
  [tableZoom]="zoom"
/>
```

Per lasciare che lo stato salvato determini l'aspetto, ometti gli input oppure passa `undefined`. Non inizializzare i selettori dell'app con `1` e `'standard'` se vuoi ripristinare le preferenze: quei valori sono input espliciti e hanno precedenza. L'esempio `TableLayoutDemo` inizializza i relativi signal a `undefined` e sincronizza i selettori con `(stateChange)`.

## Persistenza, precedenza e ripristino

`EafTableState` aggiunge proprietà opzionali e tipizzate:

```ts
horizontalDensity?: EafTableHorizontalDensity;
tableZoom?: number;
```

`getState()` e `(stateChange)` includono i valori effettivi normalizzati. La persistenza usa il servizio esistente e la stessa chiave `eaf-table:<tableId>`. Non sono necessarie migrazioni: gli stati precedenti, senza le nuove proprietà, usano i default.

Per ogni proprietà, la precedenza è **input esplicito → proprietà in `initialState` → proprietà salvata → default**. Un input esplicito non valido viene normalizzato al default, anziché cedere la precedenza allo storage. `initialState` viene letto durante l'inizializzazione e il ripristino, come per le altre proprietà; gli input invece reagiscono anche alle modifiche successive. Rimuovere un input esplicito riattiva il valore caricato all'inizializzazione o all'ultimo ripristino.

Come già avviene per lo stato della tabella, `tableStateStorageType="local"` persiste tra riaperture, `"session"` per la sessione, `"none"` non legge né salva. Se omesso, vale la configurazione globale, altrimenti il default è `none`. Cambiare zoom o densità salva lo stato ed emette `stateChange`, ma non richiede nuovi dati server-side.

`resetState()` elimina lo stato salvato da entrambi gli storage e riapplica la configurazione corrente, compreso `initialState`. Per queste preferenze rispetta gli input espliciti; in loro assenza usa `initialState` e poi i default. Il normale ciclo di persistenza salva lo stato ripristinato. Per riportare anche input controllati ai default, imposta i relativi signal a `undefined` e richiama `resetState()`, come nel pulsante dell'esempio.

## Esempio e verifiche

La pagina `/table-layout-demo`, disponibile dal menu **Demo Densità Tabella**, contiene 12 colonne, 40 righe con testi lunghi, filtri testo/numero/select-distinct, ordinamento, drag & drop, intestazione fissa e scorrimento. I selettori permettono Standard/Compatta e 100%/90%/80%. I pulsanti Chiudi/Riapri ricreano EafTable con lo stesso `tableId`, per verificare il ripristino delle preferenze. Lo scroll usa la persistenza di sessione esistente. I testi sono mantenuti interi, tramite il template pubblico `eafCellDef`, senza regole sugli interni del componente.

Comandi Windows:

```powershell
npm.cmd run build --workspace packages/framework
npm.cmd run ng -- build
npm.cmd run ng -- test --watch=false
npm.cmd run test:table-layout:browser
```

I test unitari verificano compatibilità con gli stati precedenti, normalizzazione, precedenza, persistenza locale/sessione, ripristino, emissione dello stato senza richieste server, filtri in overlay esterno, ordinamento e click sulle righe. Il layout reale richiede un motore browser con supporto CSS `zoom` (presente nel Chromium di Electron usato dal progetto); jsdom non calcola geometrie, zoom o sticky.

La prova browser serve la build Angular di produzione in una finestra Electron nascosta, con sessione separata e IPC della shell simulati: non accede al database dell'app. Verifica tutte le sei combinazioni di densità/zoom, dimensioni invarianti dei controlli esterni e dei filtri, ancoraggio dei filtri prima/dopo lo scroll e durante lo scroll, header sticky, chiusura/riapertura, ripristino, trascinamento tramite eventi mouse del CDK reale, filtro numerico e click sulle righe. Verifica la paginazione sempre visibile e ferma durante lo scroll, il suo allineamento su viewport ampio, il cambio pagina e la combinazione di zoom locale 80% con zoom app 83%. Controlla inoltre i separatori verticali presenti solo in compatta e che ogni colonna compatta mantenga la stessa larghezza allargando il viewport; la modalità standard continua a riempire la larghezza disponibile. Completa le animazioni nella fixture nascosta prima di misurare. Richiede prima `npm.cmd run ng -- build` e non aggiunge dipendenze. Salva misure e screenshot in `.tmp-eaf-table-browser/`.

Verifica effettuata il 26 settembre 2026: build framework e Angular di produzione riuscite, 67 test unitari passati, prova browser riuscita, `git diff --check` riuscito. La build segnala l'avviso della configurazione esistente `isolatedModules`/`emitDecoratorMetadata`, non modificata da questa funzionalità.

Il 27 settembre 2026 la modalità compatta è stata resa più incisiva. Sono passati la build Angular di produzione, i 23 test EafTable e la prova browser completa, inclusi ripristino, filtri e trascinamento. Nella fixture browser si verifica anche che la sola densità compatta recuperi almeno il 14% di larghezza e mantenga l'altezza dei pulsanti filtro.

Con viewport invariato di 1159 px, nell'ultima verifica della demo sono state misurate:

| Densità | Zoom | Larghezza tabella (px) | Colonne completamente visibili |
| --- | --- | --- | --- |
| Standard | 100% | 2440 | 5 |
| Standard | 90% | 2196 | 6 |
| Standard | 80% | 1952 | 7 |
| Compatta | 100% | 2078 | 6 |
| Compatta | 90% | 1871 | 8 |
| Compatta | 80% | 1664 | 9 |

La sola densità compatta recupera circa il 15% della larghezza nella demo e mantiene righe da 52 px, font da 14 px e pulsanti filtro alti 40 px; paginazione, selettori, toolbar e popup dei filtri mantengono le dimensioni iniziali anche con zoom locale ridotto. Con 1816 px disponibili nella pagina, Compatta all'80% conserva la larghezza di 1664 px e mostra tutte le 12 colonne: lo spazio libero resta a destra senza allargare le colonne. Il padding di 4 px per lato conserva uno spazio leggibile tra i testi adiacenti. Il numero di colonne visibili dipende naturalmente dai contenuti e dalle larghezze configurate. La verifica del layout è stata eseguita sul Chromium di Electron 39, non su altri motori browser.

L'ultimo intervento su intestazione, paginazione e scrollbar è stato verificato il 27 settembre 2026: build Angular di produzione riuscita, suite completa con 69 test passati (23 EafTable), prova Chromium riuscita anche con zoom app 83% e con il minimo dell'app (circa 58%), insieme a zoom tabella 80%. Le verifiche includono larghezze e posizioni delle colonne, scroll verticale con header e footer fermi, scroll orizzontale sincronizzato, posizione della scrollbar e filtri agli zoom minimi.

L'estensione di intestazione e paginazione fino al bordo destro è stata verificata con una nuova build Angular e la prova Chromium completa. Le misure controllano che entrambe le superfici coprano anche il gutter della scrollbar, che lo sfondo dell'intestazione segua il tema Material e che le colonne rimangano allineate, anche con zoom app al minimo e zoom tabella 80%.

Il layout di FrameworkShell è stato verificato con build Angular e prova Chromium complete, includendo una pagina form lunga, una finestra ridimensionata, zoom app 100%, minimo (circa 58%) e massimo (circa 173%). La prova controlla che scorra solo il contenuto, che toolbar e viewport restino fermi, che la sidebar copra ancora la finestra e che i filtri EafTable si riposizionino durante lo scroll della pagina.

Il layout comune a tutte le EafTable è stato verificato il 27 settembre 2026: build Angular di produzione riuscita, 69 test unitari passati e prova Chromium completa riuscita. La prova controlla intestazione e paginazione esterne, copertura del gutter e allineamento delle colonne in tutte le sei combinazioni di densità/zoom, compresa Standard al 100%. Aggiunge la pagina server-side `/table-demo` senza input di densità o zoom, con dati della fixture in memoria, selezione multipla, colonna azioni fissa, cambio pagina, filtri e scroll verticale/orizzontale. I singoli utilizzi di EafTable nelle pagine Prodotti, Note e nelle demo non richiedono modifiche. La fixture attende i font prima di confrontare le geometrie.
