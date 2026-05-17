import { DbMigrationDefinition } from "@bibi2400/electron-angular-framework/shared";
import type { DataSource } from "typeorm";
import { Product } from "../entities/product";

const NOW = new Date().toISOString();

const DEMO_PRODUCTS: Partial<Product>[] = [
  { name: "Monitor UltraWide 34\"", category: "Elettronica", price: 549.99, stock: 12, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Tastiera Meccanica RGB", category: "Elettronica", price: 89.9, stock: 34, rating: 5, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Mouse Ergonomico Wireless", category: "Elettronica", price: 59.99, stock: 0, rating: 4, status: "esaurito", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Webcam 4K", category: "Elettronica", price: 119.0, stock: 7, rating: 3, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Cuffie Over-Ear ANC", category: "Elettronica", price: 199.0, stock: 5, rating: 5, status: "in_arrivo", active: false, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Scarpe Running Pro", category: "Sport", price: 129.95, stock: 20, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Zaino Trekking 40L", category: "Sport", price: 74.9, stock: 9, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Felpa Tecnica Antipioggia", category: "Abbigliamento", price: 64.0, stock: 15, rating: 3, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "T-Shirt Organica", category: "Abbigliamento", price: 24.99, stock: 50, rating: 5, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Olio EVO Biologico 5L", category: "Alimentari", price: 32.5, stock: 100, rating: 5, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Pasta di Semola 1kg", category: "Alimentari", price: 2.9, stock: 200, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Lampada da Scrivania LED", category: "Casa", price: 44.0, stock: 18, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Set Asciugamani Cotone", category: "Casa", price: 38.9, stock: 30, rating: 3, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Notebook A4 Righe 200pg", category: "Casa", price: 7.5, stock: 75, rating: 4, status: "disponibile", active: true, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
  { name: "Diffusore Aromi Ultrasonico", category: "Casa", price: 29.9, stock: 0, rating: 3, status: "esaurito", active: false, createdAt: new Date(NOW), updatedAt: new Date(NOW) },
];

export class SeedProductsMigration extends DbMigrationDefinition {
  readonly id = "006_seed_products";
  readonly description = "Seed: inserisce prodotti demo per la pagina Prodotti";

  async up(dataSource: DataSource): Promise<void> {
    await dataSource.query(`
      CREATE TABLE IF NOT EXISTS product (
        id        INTEGER PRIMARY KEY AUTOINCREMENT,
        name      VARCHAR NOT NULL,
        category  VARCHAR NOT NULL,
        price     REAL    NOT NULL,
        stock     INTEGER NOT NULL,
        rating    INTEGER NOT NULL,
        status    VARCHAR NOT NULL,
        active    BOOLEAN NOT NULL,
        createdAt DATETIME NOT NULL,
        updatedAt DATETIME NOT NULL
      )
    `);

    const repo = dataSource.getRepository(Product);
    const existing = await repo.count();
    if (existing > 0) return; // Già popolata, non re-inserire

    // Chunk da 5 per rispettare il limite SQLite (~999 parametri per statement)
    const CHUNK = 5;
    for (let i = 0; i < DEMO_PRODUCTS.length; i += CHUNK) {
      await repo.insert(DEMO_PRODUCTS.slice(i, i + CHUNK) as Product[]);
    }
  }
}
