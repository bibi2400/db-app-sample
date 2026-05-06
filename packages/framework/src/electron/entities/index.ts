import { Constructor } from "../helpers/mini-pie/types";
import { Attachment } from "./attachment";
import { DbMigrationRecord } from "./db-migration-record";

/**
 * Built-in TypeORM entities provided by the framework.
 * Automatically merged with consumer entities by AppBootstrap.
 */
export const FRAMEWORK_ENTITIES: Constructor[] = [
  Attachment,
  DbMigrationRecord,
];

export { Attachment };
export { DbMigrationRecord };
