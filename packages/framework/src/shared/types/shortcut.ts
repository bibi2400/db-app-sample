export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
}

export interface ShortcutEntry {
  name: string;
  description: string;
  category: string;
  defaultBinding: KeyBinding;
}

export interface ShortcutDefinition extends ShortcutEntry {
  id: string;
  currentBinding: KeyBinding;
}
