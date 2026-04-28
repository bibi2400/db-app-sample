import { Constructor } from "../helpers/mini-pie/types";
import { Attachment } from "./attachment";

/**
 * Built-in TypeORM entities provided by the framework.
 * Automatically merged with consumer entities by AppBootstrap.
 */
export const FRAMEWORK_ENTITIES: Constructor[] = [
  Attachment,
];

export { Attachment };
