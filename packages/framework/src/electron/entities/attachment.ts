import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/**
 * Represents a file uploaded into the application's file repository.
 * Created automatically by the framework's UploadService.
 */
@Entity()
@Index("IDX_attachment_owner", ["ownerType", "ownerId"])
export class Attachment {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Stored file name (timestamped, unique). */
  @Column({ type: "varchar" })
  fileName!: string;

  /** Original file name as provided by the user. */
  @Column({ type: "varchar" })
  originalName!: string;

  /** Relative folder inside the repository (no leading slash). May be empty. */
  @Index()
  @Column({ type: "varchar", default: "" })
  relativePath!: string;

  /** File size in bytes. */
  @Column({ type: "integer" })
  size!: number;

  /** MIME type (nullable). */
  @Column({ type: "varchar", nullable: true })
  mimeType!: string | null;

  /** SHA-256 checksum of the file content (hex, lowercase). */
  @Index()
  @Column({ type: "varchar", length: 64 })
  checksum!: string;

  /**
   * Polymorphic owner: name of the table/entity that owns this attachment.
   * The referenced entity lives outside the framework (consumer-defined).
   * Nullable to allow orphan/temporary uploads before being attached to an owner.
   */
  @Column({ type: "varchar", nullable: true })
  ownerType!: string | null;

  /**
   * Polymorphic owner: primary key of the owning record in `ownerType`.
   * No FK constraint is declared because the target table is not known at framework level.
   */
  @Column({ type: "integer", nullable: true })
  ownerId!: number | null;

  /** Upload timestamp. */
  @CreateDateColumn()
  uploadDate!: Date;
}
