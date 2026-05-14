import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Mappa la tabella `mightyTable` creata dalla migrazione 004.
 * `synchronize: false` impedisce a TypeORM di modificare la tabella esistente.
 * Tipi colonne (ciclo di 9): INT, VARCHAR, TEXT, DATE, DATETIME, BOOLEAN, FLOAT, DOUBLE, DECIMAL
 */
@Entity({ name: 'mightyTable', synchronize: false })
export class MightyTableRow {
  @PrimaryGeneratedColumn() id!: number;

  @Column({ type: 'int', nullable: true })                              header1!: number;
  @Column({ type: 'varchar', nullable: true })                          header2!: string;
  @Column({ type: 'text', nullable: true })                             header3!: string;
  @Column({ type: 'date', nullable: true })                             header4!: string;
  @Column({ type: 'datetime', nullable: true })                         header5!: string;
  @Column({ type: 'boolean', nullable: true })                          header6!: boolean;
  @Column({ type: 'float', nullable: true })                            header7!: number;
  @Column({ type: 'double', nullable: true })                           header8!: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) header9!: string;

  @Column({ type: 'int', nullable: true })                              header10!: number;
  @Column({ type: 'varchar', nullable: true })                          header11!: string;
  @Column({ type: 'text', nullable: true })                             header12!: string;
  @Column({ type: 'date', nullable: true })                             header13!: string;
  @Column({ type: 'datetime', nullable: true })                         header14!: string;
  @Column({ type: 'boolean', nullable: true })                          header15!: boolean;
  @Column({ type: 'float', nullable: true })                            header16!: number;
  @Column({ type: 'double', nullable: true })                           header17!: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) header18!: string;

  @Column({ type: 'int', nullable: true })                              header19!: number;
  @Column({ type: 'varchar', nullable: true })                          header20!: string;
  @Column({ type: 'text', nullable: true })                             header21!: string;
  @Column({ type: 'date', nullable: true })                             header22!: string;
  @Column({ type: 'datetime', nullable: true })                         header23!: string;
  @Column({ type: 'boolean', nullable: true })                          header24!: boolean;
  @Column({ type: 'float', nullable: true })                            header25!: number;
  @Column({ type: 'double', nullable: true })                           header26!: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) header27!: string;

  @Column({ type: 'int', nullable: true })                              header28!: number;
  @Column({ type: 'varchar', nullable: true })                          header29!: string;
  @Column({ type: 'text', nullable: true })                             header30!: string;
  @Column({ type: 'date', nullable: true })                             header31!: string;
  @Column({ type: 'datetime', nullable: true })                         header32!: string;
  @Column({ type: 'boolean', nullable: true })                          header33!: boolean;
  @Column({ type: 'float', nullable: true })                            header34!: number;
  @Column({ type: 'double', nullable: true })                           header35!: number;
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true }) header36!: string;

  @Column({ type: 'int', nullable: true })                              header37!: number;
  @Column({ type: 'varchar', nullable: true })                          header38!: string;
  @Column({ type: 'text', nullable: true })                             header39!: string;
  @Column({ type: 'date', nullable: true })                             header40!: string;
}