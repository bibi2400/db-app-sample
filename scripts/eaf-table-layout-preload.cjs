const { contextBridge } = require('electron');

// Dati della fixture in memoria: nessun IPC verso database o servizi dell'app.
contextBridge.exposeInMainWorld('electronAPI', {
  invoke: async (channel, args) => {
    if (channel === 'app:info') {
      return {
        success: true,
        data: { version: 'test', productName: 'EafTable layout test' },
      };
    }
    if (channel === 'db-migration:run' || channel === 'notification:enable') {
      return { success: true };
    }
    if (channel === 'tableDemo:get-rows') {
      const rows = Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        header1: index + 1,
        header2: `Cliente standard ${index + 1}`,
        header3: `Descrizione della commessa con testo esteso ${index + 1}`,
        header4: '2026-09-27',
        header5: '2026-09-27T10:00:00',
        header6: index % 2 === 0,
        header7: index + 0.5,
        header8: index + 0.75,
        header9: '1250.00',
      }));
      const start = args.pageIndex * args.pageSize;
      return { success: true,
        data: { items: rows.slice(start, start + args.pageSize), total: rows.length } };
    }
    throw new Error(`Unexpected fixture IPC: ${channel}`);
  },
  on() {},
  off() {},
  setZoomLevel() {},
});
