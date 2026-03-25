import { NotificationService } from "../services/notification.service";
import { BaseController } from "./base.controller";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { Controller } from "../decorators/controller.decorator";

@Controller({ prefix: "notification" })
export class NotificationController extends BaseController {
  constructor(private readonly notificationService: NotificationService) {
    super();
  }

  @IpcHandler("enable")
  enable() {
    this.notificationService.enable();
    return this.success(null);
  }
}
