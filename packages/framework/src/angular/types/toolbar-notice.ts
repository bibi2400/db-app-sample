/** Avviso testuale nella toolbar; id deve essere univoco tra gli avvisi custom. */
export interface ToolbarNotice {
  id: string;
  label: string;
  callback: () => void;
}
