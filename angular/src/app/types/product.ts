/** Modello shared con il backend Electron (entit\u00e0 `Product`). */
export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
  rating: number;
  status: string;
  active: boolean;
  /** ISO string serializzata via IPC. */
  createdAt: string;
  /** ISO string serializzata via IPC. */
  updatedAt: string;
}
