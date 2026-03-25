import { ShortcutEntry } from '../types/shortcut';

/**
 * Registry dichiarativo degli shortcut dell'applicazione.
 * Per aggiungere un nuovo shortcut, aggiungi una entry a questo oggetto.
 *
 * Ogni chiave è l'ID univoco dello shortcut (convenzione: "categoria.azione").
 * I componenti si registrano tramite `shortcutService.on('id')`.
 */
export const SHORTCUT_REGISTRY: Record<string, ShortcutEntry> = {
  'nav.menu': {
    name: "Menu",
    description: "Apri/Chiudi Menu",
    category: "Navigazione",
    defaultBinding: { key: '\\' }
  },
  'nav.dashboard': {
    name: 'Dashboard',
    description: 'Vai alla Dashboard',
    category: 'Navigazione',
    defaultBinding: { key: 'd', ctrl: true, shift: true },
  },
  'nav.notifications': {
    name: 'Notifiche',
    description: 'Vai alle Notifiche',
    category: 'Navigazione',
    defaultBinding: { key: 'n', ctrl: true, shift: true },
  },
  'nav.backup': {
    name: 'Backup',
    description: 'Vai alla gestione Backup',
    category: 'Navigazione',
    defaultBinding: { key: 'b', ctrl: true, shift: true },
  },
  'nav.updates': {
    name: 'Aggiornamenti',
    description: 'Vai alla gestione Aggiornamenti',
    category: 'Navigazione',
    defaultBinding: { key: 'u', ctrl: true, shift: true },
  },
  'nav.shortcuts': {
    name: 'Scorciatoie',
    description: 'Vai alla gestione Scorciatoie',
    category: 'Navigazione',
    defaultBinding: { key: 'k', ctrl: true, shift: true },
  },
  'app.save': {
    name: 'Salva',
    description: 'Esegui l\'azione di salvataggio',
    category: 'Azioni',
    defaultBinding: { key: 's', ctrl: true },
  },
  'app.commandPalette': {
    name: 'Palette comandi',
    description: 'Apri la palette comandi',
    category: 'Azioni',
    defaultBinding: { key: 'p', ctrl: true },
  },
};
