import {
  BaseController,
  Controller,
  IpcHandler,
} from "@bibi2400/electron-angular-framework/electron";
import type { EafTableServerEvent } from "@bibi2400/electron-angular-framework/shared";
import { ProductService } from "../services/product.service";

@Controller({ prefix: "product" })
export class ProductController extends BaseController {
  constructor(private readonly productService: ProductService) {
    super();
  }

  @IpcHandler("get-rows")
  async getRows(event: EafTableServerEvent) {
    try {
      return this.success(await this.productService.getRows(event));
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("get")
  async get(id: number) {
    try {
      return this.success(await this.productService.getById(id));
    } catch (error) {
      return this.error(error);
    }
  }
}
