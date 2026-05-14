export interface MightyTableRow {
  id: number;
  header1: number;
  header2: string;
  header3: string;
  header4: string;   // DATE → 'YYYY-MM-DD'
  header5: string;   // DATETIME → 'YYYY-MM-DD HH:mm:ss'
  header6: boolean;
  header7: number;
  header8: number;
  header9: string;   // DECIMAL → TypeORM ritorna string da SQLite
}