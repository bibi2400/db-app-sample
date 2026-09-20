# MIGHTY TODO

- [ ] rivedere sistema di backup

- [ ] cambiare nome DB App Maker

- [ ] ⁠sidebar non ha scroll

- [ ] ⁠input a volte smettono di inputtare

- [ ] ⁠gestione shortcut

- [ ] ⁠quando cambi path del db non si aggiorna per bene (necessario riavvio manuale)

- [x] ⁠in Info App, Percorso Installazione punta all'archivio asar

- [ ] aggiunta di esempi di configurazione del menu e dei comandi/shortcut nei template

- [x] rendere la pagina aggiornamenti guidata per stato con download e installazione in un unico flusso

- [x] bloccare l'applicazione anche durante il download degli aggiornamenti

- [x] mostrare l'avanzamento del download solo nell'overlay bloccante

- [ ] collaudare il flusso aggiornamenti completo su una release Windows pacchettizzata

## Bonus Tracks:

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file uploads (tipo file excel e altro)

- [ ] pensare ad un modo ganzo agnostico per gestire centralizzati i file downloads (tipo file excel, pdf, altro)

- [ ] indagare su installazione come servizio... è possibile farlo in typescript?
  - per ora non lo farei, non ci vedo troppe potenzialità in relazione all'effort richiesto.
  - quando lo implementiamo:
    - vedere di implementare shortcut tramite electron per farli andare anche a finestra ridotta
    - implementare notifiche tramite sistema operativo per vedere le norifiche anche a finestra ridotta
    - implementare sistema di schedulazione task automatici anche con finestra ridotta
    - implementare tray icon
