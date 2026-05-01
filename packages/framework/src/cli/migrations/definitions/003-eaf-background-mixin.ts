import { Migration } from '../types';

/**
 * Aggiunge l'invocazione del mixin `eaf-background` al `styles.scss` del consumer
 * (se non già presente) e rimuove il `background` hard-coded dal `body`.
 *
 * Idempotente: se `eaf-background` è già presente, non fa nulla.
 */
export const migration: Migration = {
  id: '003',
  description: 'Aggiunge il mixin eaf-background per personalizzare lo sfondo globale dell\'app',
  up: (ctx) => {
    const path = 'angular/src/styles.scss';
    if (!ctx.fileExists(path)) {
      ctx.warn(`File ${path} non trovato, migrazione saltata.`);
      return;
    }

    let content = ctx.readFile(path);

    if (content.includes('eaf-background')) {
      ctx.log('styles.scss usa già eaf-background, nessuna azione.');
      return;
    }

    if (!content.includes('eaf-severity-themes')) {
      ctx.warn(
        `Impossibile aggiornare automaticamente ${path}: blocco eaf-severity-themes non trovato. ` +
        `Aggiungi manualmente: @include eaf.eaf-background($color: #f5f7fa);`
      );
      return;
    }

    const insertSnippet = `

// Sfondo globale dell'applicazione. Sostituire i parametri per personalizzarlo.
// Per usare un'immagine con overlay chiaro (simula opacity ~0.3):
//   @include eaf.eaf-background(
//     $color: #f5f7fa,
//     $image: url('/assets/form-background.png'),
//     $overlay: rgba(245, 247, 250, 0.7),
//     $size: 451px,
//     $repeat: repeat,
//   );
@include eaf.eaf-background($color: #f5f7fa);
`;

    // Inserisce il mixin subito dopo la chiusura del blocco eaf-severity-themes(...).
    const severityCloseRegex = /(@include\s+eaf\.eaf-severity-themes\([\s\S]*?\);)/m;
    if (!severityCloseRegex.test(content)) {
      ctx.warn(
        `Impossibile localizzare la chiusura di eaf-severity-themes in ${path}. ` +
        `Aggiungi manualmente: @include eaf.eaf-background($color: #f5f7fa);`
      );
      return;
    }

    content = content.replace(severityCloseRegex, `$1${insertSnippet}`);

    // Rimuove background-color/background dal body, se hard-coded col valore default.
    content = content.replace(/^\s*background-color:\s*var\(--mat-sys-surface\);\s*\n/m, '');
    content = content.replace(/^\s*background:\s*#f5f7fa;\s*\n/m, '');

    ctx.writeFile(path, content);
    ctx.log('styles.scss aggiornato con eaf-background.');
  },
};
