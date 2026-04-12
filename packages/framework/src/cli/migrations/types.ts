export interface Migration {
  /** Identificativo univoco della migrazione (es. '001', '002', ...) */
  id: string;
  /** Descrizione della migrazione */
  description: string;
  /** Funzione che applica la migrazione */
  up: (ctx: MigrationContext) => void | Promise<void>;
}

export interface MigrationContext {
  /** Directory root del progetto consumer */
  projectDir: string;

  /** Crea un file (errore se esiste già) */
  createFile(relativePath: string, content: string): void;

  /** Scrive un file (crea o sovrascrive) */
  writeFile(relativePath: string, content: string): void;

  /** Legge il contenuto di un file */
  readFile(relativePath: string): string;

  /** Verifica se un file esiste */
  fileExists(relativePath: string): boolean;

  /** Elimina un file */
  deleteFile(relativePath: string): void;

  /** Legge, trasforma e riscrive un file JSON */
  updateJson<T = any>(relativePath: string, fn: (json: T) => T): void;

  /** Sostituisce testo in un file */
  replaceInFile(relativePath: string, search: string | RegExp, replace: string): void;

  /** Inserisce contenuto dopo la prima riga che corrisponde al pattern */
  insertAfter(relativePath: string, search: string | RegExp, content: string): void;

  /** Inserisce contenuto prima della prima riga che corrisponde al pattern */
  insertBefore(relativePath: string, search: string | RegExp, content: string): void;

  /** Log informativo */
  log(message: string): void;

  /** Log di warning */
  warn(message: string): void;
}

export interface MigrationRecord {
  id: string;
  appliedAt: string;
}

export interface MigrationState {
  appliedMigrations: MigrationRecord[];
}
