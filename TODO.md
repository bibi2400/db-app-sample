# MIGHTY TODO
- [x] IMPORTANTISSIMO: testare procedura di auto update su citrix

- [x] trovare un modo per gestire nome app centralizzato (il più possibile)

- [x] revamp della procedura di installazione
  - [SETUP] tramite script NSIS richiedere alla prima installazione il path del database in modo da averlo pronto al primo avvio

- [x] migliorare servizi con dependency injection
  - [x] mettere la dependency injection automatica sui controller

- strutturazione servizi main Electron
  - [x] updater service (gestione updates)
  - [x] main render service (gestione main renderer, angular serving)
  - [x] splash service (gestione splash screen)
  - [x] controller service (registrazione controller, accesso a API sistema operativo)
  - [x] App data service (gestione file dentro %appdata%)
    - [x] cache service (gestione file di cache con TTL)
    - [x] config service (gestione generica file di configurazione JSON in %appdata%)
    - [x] db config service (gestione db-config.json tramite config service)
    - [x] app config service (info app da package.json + configurazioni inter-sessione tramite config service)
  - [x] lifecycle service (gestione graceful shutdown, vedi sotto)
  - [x] error notifier service (gestione errori nei log, notifiche e quant'altro, vedi sotto)

- strutturazione altre classi
  - [x] Logger

- [x] per implementare la progress bar di update serve strutturare un sistema di eventi da backend a frontend

- [x] strutturare aggiornamenti automatici con frontend
  l'utente deve essere notificato con la presenza di aggiornameti
  l'utente deve essere in grado di decidere quando effettuare gli aggiornamenti

  - [x] l'utente deve vedere il changelog della nuova versione prima di installarla

  Dettagli implentativi:
    - [ELECTRON] relegare autoUpdater in un service
    - [ELECTRON] creare dei controller per comunicare gli aggiornamenti col frontend dietro richiesta
    - [ELECTRON] creare sistema per notificare a frontend lo stato del download degli aggiornamenti
    - [ANGULAR] creare sezione aggiornamenti
    - [ANGULAR] mostrare versione attuale, aggiornamenti disponibili e stato aggiornamento corrente (progress bar)
    - [ANGULAR] implementare bottone check for updates
    - [ANGULAR] implementare bottone scarica ora quando un aggiornamento è rilevato
    - [ANGULAR] implementare bottone aggiorna ora quando un aggiornamento è scaricato

- [x] [ELECTRON] gestione chiusura gentile dell'app

- [x] [ELECTRON] gestione errori

- [x] check aggiornamenti automatico temporizzato

- [x] bottone reinstalla
  - questo risolve la necessità di gestire a video il path del database

- [ ] [ANGULAR] refactor struttura base di angular (app, sidebar, sidenav)
  - [x] componentizzare sidebar, sidenav
  - [ ] rivedere push event lato frontend
  - [ ] rivedere service api e wrapper risposte
  - [ ] standardizzare stili box, possibilmente a tutta pagina
  - [ ] aggiungere gestione errori

- [x] [ELECTRON][DEV] trovare il modo di avere l'hot reload anche su electron, come su angular, in modalità dev

- [x] [ELECTRON] rifare preload in modo che sia più generico e non ci sia da modificarlo per ogni contoller

- [ ] rivedere sistema di backup

- [x] [ANGULAR] - sistema di shortcut standardizzato

- [x] [ANGULAR] - command palette

## Bonus Tracks:

- [x] implementare gestione notifiche di sistema
  implementate notifiche interne all'app. va ben istes

- [x] implementare gestione multifinestra
  implementato parzialmente, è possibile aprire più istanze della stessa finestra che inizia con la dashboard, con navigazioni separate, ma non è possibile aprire finestre su pagine precise. richiede modifiche più strutturali che vediamo di fare dopo

- [ ] gestire DB path a interfaccia
  - vedi todo su config service
  - gestire caricamento "a caldo" del database
    - per ora non lo farei. per cambiare db path si può usare il bottone reinstalla

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file uploads (tipo file excel e altro)

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file downloads (tipo file excel, pdf, altro)

- [x] indagare su quali altre chicche riservano electron & le sue librerie satellite

- [ ] strutturare sistema di schedulazione task automatici quando programma è aperto

- [x] strutturare sistema di rilevazione tempi

- [ ] indagare su installazione come servizio... è possibile farlo in typescript?