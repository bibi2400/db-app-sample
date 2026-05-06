import { Controller } from "../decorators/controller.decorator";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { DbMigrationService } from "../services/system-services/db-migration.service";
import { BaseController } from "./base.controller";

@Controller({ prefix: "db-migration" })
export class DbMigrationController extends BaseController {
  constructor(private readonly dbMigrationService: DbMigrationService) {
    super();
  }

  /** Run all pending migrations. Blocks until complete. */
  @IpcHandler("run")
  async run() {
    return this.dbMigrationService.runPendingMigrations();
  }
}
