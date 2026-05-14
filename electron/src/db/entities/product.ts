import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * Entit\u00e0 Product per la pagina di demo `table-demo`.
 * Usata per dimostrare la modalit\u00e0 server-side di `EafTable` con
 * paginazione/filtri/ordinamento delegati a TypeORM via `buildFindOptions`.
 */
@Entity()
export class Product {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  name!: string;

  @Column()
  category!: string;

  @Column("real")
  price!: number;

  @Column()
  stock!: number;

  @Column()
  rating!: number;

  @Column()
  status!: string;

  @Column()
  active!: boolean;

  @Column({ type: "datetime" })
  createdAt!: Date;

  @Column({ type: "datetime" })
  updatedAt!: Date;
}
