import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Tracks which runtime DB migrations have been applied to this installation.
 * Managed exclusively by DbMigrationService — do not manipulate directly.
 */
@Entity("_eaf_db_migrations")
export class DbMigrationRecord {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Stable unique ID matching DbMigrationDefinition.id */
  @Index({ unique: true })
  @Column({ type: "varchar" })
  migrationId!: string;

  /** ISO timestamp of when the migration was applied */
  @Column({ type: "varchar" })
  appliedAt!: string;

  /** Human-readable description copied from DbMigrationDefinition.description */
  @Column({ type: "varchar", nullable: true })
  description!: string | null;
}
