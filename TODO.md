# MIGHTY TODO

- [ ] revamp della procedura di installazione
  - [SETUP] tramite NSIS richiedere alla prima installazione il path del database in modo da averlo pronto al primo avvio

- [ ] migliorare servizi con dependency injection

- [ ] strutturazione servizi main Electron
  - updater service (gestione updates)
  - main render service (gestione main renderer, angular serving)
  - splash service (gestione splash screen)
  - db service (gestione db)
  - electron service (?) (registrazione controller, accesso a API sistema operativo)
  - config service (gestione configurazione, prevedere file di configurazione?)
  - shutdown service (gestione graceful shutdown, vedi sotto)
  - error notifier service (gestione errori nei log, notifiche e quant'altro, vedi sotto)

- [ ] strutturazione altre classi
  - Logger

- [ ] strutturare aggiornamenti automatici con frontend
  l'utente deve essere notificato con la presenza di aggiornameti
  l'utente deve essere in grado di decidere quando effettuare gli aggiornamenti

  Dettagli implentativi:
    - [ELECTRON] relegare autoUpdater in un service
    - [ELECTRON] creare dei controller per comunicare gli aggiornamenti col frontend dietro richiesta
    - [ANGULAR] creare sezione aggiornamenti
    - [ANGULAR] mostrare versione attuale, aggiornamenti disponibili e stato aggiornamento corrente
    - [ANGULAR] implementare bottone check for updates
    - [ANGULAR] implementare bottone aggiorna ora

- [ ] valutare uso di electron-store per gestire gli app file come la configurazione o la cache

- [ ] gestione chiusura gentile dell'app

- [ ] gestione errori

## Bonus Tracks:

- [ ] implementare gestione notifiche di sistema

- [ ] implementare gestione multifinestra

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file uploads (tipo file excel e altro)

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file downloads (tipo file excel, pdf, altro)

- [ ] indagare su quali altre chicche riservano electron & le sue librerie satellite
