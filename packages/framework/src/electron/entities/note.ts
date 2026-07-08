import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

/**
 * Nota testuale associata a un owner polimorfico (ownerType + ownerId).
 *
 * Le note sono gestite dal framework tramite NoteService e NoteController.
 * Questa entity è auto-registrata in FRAMEWORK_ENTITIES — non è necessario
 * aggiungerla al MODELS array del consumer.
 *
 * Pattern di ownership:
 * ```ts
 * // Creare una nota per un product con id=5
 * await noteService.createNote({
 *   content: 'Nota sul prodotto',
 *   noteDate: new Date().toISOString(),
 *   ownerType: 'product',
 *   ownerId: 5,
 * });
 *
 * // Recuperare tutte le note di quel prodotto
 * const notes = await noteService.listByOwner('product', 5);
 * ```
 */
@Entity()
@Index("IDX_note_owner", ["ownerType", "ownerId"])
export class Note {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Contenuto testuale della nota. */
  @Column({ type: "text" })
  content!: string;

  /** Data/ora della nota. Può essere impostata nel passato. */
  @Column({ type: "datetime" })
  noteDate!: Date;

  /** Se true, la nota è pinnata in cima alla lista. */
  @Column({ type: "boolean", default: false })
  pinned!: boolean;

  /** Tipo dell'entità owner (es. 'product', 'customer'). Nullable per note orfane. */
  @Index()
  @Column({ type: "varchar", nullable: true })
  ownerType!: string | null;

  /** ID dell'entità owner. Nullable per note orfane. */
  @Column({ type: "integer", nullable: true })
  ownerId!: number | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
