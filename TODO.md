# MIGHTY TODO
- [ ] IMPORTANTISSIMO: testare procedura di auto update su citrix

- [x] trovare un modo per gestire nome app centralizzato (il più possibile)

- [x] revamp della procedura di installazione
  - [SETUP] tramite script NSIS richiedere alla prima installazione il path del database in modo da averlo pronto al primo avvio

- [x] migliorare servizi con dependency injection
  - [ ] mettere la dependency injection automatica sui controller

- strutturazione servizi main Electron
  - [x] updater service (gestione updates)
  - [ ] main render service (gestione main renderer, angular serving)
  - [ ] splash service (gestione splash screen)
  - [ ] electron service (?) (registrazione controller, accesso a API sistema operativo)
  - [ ] App file service (gestione file dentro %appdata%)
    - [ ] config service (gestione configurazione, prevedere file di configurazione?)
  - [ ] shutdown service (gestione graceful shutdown, vedi sotto)
  - [ ] error notifier service (gestione errori nei log, notifiche e quant'altro, vedi sotto)

- [x] strutturazione altre classi
  - Logger

- [x] per implementare la progress bar di update serve strutturare un sistema di eventi da backend a frontend

- [x] strutturare aggiornamenti automatici con frontend
  l'utente deve essere notificato con la presenza di aggiornameti
  l'utente deve essere in grado di decidere quando effettuare gli aggiornamenti

  - [ ] l'utente deve vedere il changelog della nuova versione prima di installarla

  Dettagli implentativi:
    - creare diagramma di flusso del processo di aggiornamento
    - [ELECTRON] relegare autoUpdater in un service
    - [ELECTRON] creare dei controller per comunicare gli aggiornamenti col frontend dietro richiesta
    - [ELECTRON] creare sistema per notificare a frontend lo stato del download degli aggiornamenti
    - [ANGULAR] creare sezione aggiornamenti
    - [ANGULAR] mostrare versione attuale, aggiornamenti disponibili e stato aggiornamento corrente (progress bar)
    - [ANGULAR] implementare bottone check for updates
    - [ANGULAR] implementare bottone scarica ora quando un aggiornamento è rilevato
    - [ANGULAR] implementare bottone aggiorna ora quando un aggiornamento è scaricato

- [ ] gestione chiusura gentile dell'app

- [ ] gestione errori

- [ ] refactor struttura base di angular (app, sidebar, sidenav)

- [ ] trovare il modo di avere l'hot reload anche su electron, come su angular, in modalità dev

- [ ][ELECTRON] rifare preload in modo che sia più generico e non ci sia da modificarlo per ogni contoller

## Bonus Tracks:

- [ ] implementare gestione notifiche di sistema

- [ ] implementare gestione multifinestra

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file uploads (tipo file excel e altro)

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file downloads (tipo file excel, pdf, altro)

- [ ] indagare su quali altre chicche riservano electron & le sue librerie satellite
