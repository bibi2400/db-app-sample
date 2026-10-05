/** Posizione del gruppo di avvisi nel normale flusso della toolbar. */
export type ToolbarNoticePosition = 'title' | 'center' | 'right';

/** Forma comune all'avviso aggiornamenti e agli avvisi custom. */
export type ToolbarNoticeShape = 'rectangle' | 'rounded' | 'pill';

/** Avviso testuale nella toolbar; id deve essere univoco tra gli avvisi custom. */
export interface ToolbarNotice {
  id: string;
  label: string;
  icon?: string;
  callback: () => void;
}
