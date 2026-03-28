export interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: string;
  /** ID dello shortcut registrato nel ShortcutService (es. 'nav.dashboard') */
  shortcutId?: string;
  /** Route a cui navigare prima di eseguire l'action */
  route?: string;
  action: () => void;
}
