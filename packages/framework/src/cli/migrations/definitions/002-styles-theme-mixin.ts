import { Migration } from '../types';

const NEW_STYLES = `// Include theming for Angular Material with \`mat.theme()\`.
// This Sass mixin will define CSS variables that are used for styling Angular Material
// components according to the Material 3 design spec.
// Learn more about theming and how to use it for your application's
// custom components at https://material.angular.dev/guide/theming
@use '@angular/material' as mat;
@use '@bibi2400/electron-angular-framework/styles/theme' as eaf;

// Tema principale dell'applicazione.
// Sovrascrivi le palette qui per personalizzare il tema (cfr. mat.$*-palette).
html {
  @include eaf.eaf-base(
    $primary: mat.$cyan-palette,
    $tertiary: mat.$orange-palette,
  );
}

// Temi alternativi per livelli di severità (rosso/arancione/verde/azzurro).
// Uso: <button matButton="filled" color="primary" class="theme-danger">…</button>
@include eaf.eaf-severity-themes(
  $danger:  mat.$red-palette,
  $warning: mat.$orange-palette,
  $success: mat.$green-palette,
  $info:    mat.$azure-palette,
);
`;

export const migration: Migration = {
  id: '002',
  description: 'Refactor styles.scss per usare i mixin di theming del framework (eaf-base, eaf-severity-themes)',
  up: (ctx) => {
    const path = 'angular/src/styles.scss';
    if (!ctx.fileExists(path)) {
      ctx.warn(`File ${path} non trovato, migrazione saltata.`);
      return;
    }

    const content = ctx.readFile(path);

    // Già migrato?
    if (content.includes("@bibi2400/electron-angular-framework/styles/theme")) {
      ctx.log('styles.scss già migrato al partial del framework, nessuna azione.');
      return;
    }

    // Pattern del template originale: blocco @use mat + mat.theme(...) iniziale.
    const headerRegex =
      /@use\s+'@angular\/material'\s+as\s+mat;\s*\n+html\s*\{\s*@include\s+mat\.theme\(\([\s\S]*?\)\);\s*\}\s*/m;

    if (headerRegex.test(content)) {
      ctx.replaceInFile(path, headerRegex, NEW_STYLES);
      ctx.log('styles.scss aggiornato per usare i mixin del framework.');
    } else {
      ctx.warn(
        `Impossibile aggiornare automaticamente ${path}: la sezione @use/mat.theme iniziale è stata personalizzata. ` +
        `Aggiorna manualmente per usare '@bibi2400/electron-angular-framework/styles/theme' (mixin eaf-base e eaf-severity-themes).`
      );
    }
  },
};
