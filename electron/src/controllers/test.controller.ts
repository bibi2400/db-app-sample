import { ipcMain } from "electron";
import { TestService } from "../services/test.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";

export class TestController extends BaseController {
  private testService: TestService;

  constructor() {
    super("test");
    this.testService = new TestService();
  }

  @IpcHandler("test")
  test() {
    return this.success({ message: "Test successful!" });
  }
}
