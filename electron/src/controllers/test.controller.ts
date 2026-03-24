import { TestService } from "../services/test.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";

@Controller({ prefix: "test" })
export class TestController extends BaseController {
  constructor(private testService: TestService) {
    super();
  }

  @IpcHandler("test")
  test() {
    return this.success({ message: "Test successful!" });
  }
}
