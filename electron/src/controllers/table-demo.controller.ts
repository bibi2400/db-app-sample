import {
  BaseController,
  Controller,
  IpcHandler,
} from "@bibi2400/electron-angular-framework/electron";
import type { EafTableServerEvent } from "@bibi2400/electron-angular-framework/shared";
import { TableDemoService } from "../services/table-demo.service";

@Controller({ prefix: "tableDemo" })
export class TableDemoController extends BaseController {
  constructor(private readonly tableDemoService: TableDemoService) {
    super();
  }

  @IpcHandler("get-rows")
  async getRows(event: EafTableServerEvent) {
    try {
      return this.success(await this.tableDemoService.getRows(event));
    } catch (error) {
      return this.error(error);
    }
  }
}