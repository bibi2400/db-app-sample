import "reflect-metadata";

const OWNS_ATTACHMENTS_KEY = Symbol.for("eaf:owns-attachments");

/**
 * Marks a TypeORM entity as the polymorphic owner of `Attachment` rows
 * identified by the given `ownerType` string.
 *
 * The framework registers a global TypeORM subscriber that, on `afterRemove`
 * of any entity decorated with `@OwnsAttachments(...)`, automatically calls
 * `UploadService.deleteByOwner(ownerType, entity.id)` to clean up the
 * associated attachments (DB rows + physical files when no longer referenced).
 *
 * The decorated entity is expected to expose a numeric `id` primary key.
 *
 * @example
 *   @Entity()
 *   @OwnsAttachments("journal")
 *   export class Journal {
 *     @PrimaryGeneratedColumn() id!: number;
 *     // ...
 *   }
 */
export function OwnsAttachments(ownerType: string): ClassDecorator {
  if (!ownerType || !ownerType.trim()) {
    throw new Error("OwnsAttachments: ownerType non può essere vuoto.");
  }
  return (target) => {
    Reflect.defineMetadata(OWNS_ATTACHMENTS_KEY, ownerType, target);
  };
}

/** Returns the `ownerType` declared with `@OwnsAttachments(...)`, if any. */
export function getOwnsAttachmentsType(target: Function | undefined | null): string | undefined {
  if (!target) return undefined;
  return Reflect.getMetadata(OWNS_ATTACHMENTS_KEY, target);
}
