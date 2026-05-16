import { Injectable } from "@angular/core";
import type { IpcResponse } from "@bibi2400/electron-angular-framework/shared";
import type { EafTableResult, EafTableServerEvent } from "@bibi2400/electron-angular-framework/angular";
import type { Product } from "../types/product";

@Injectable({ providedIn: "root" })
export class ElectronProductService {
  async getRows(event: EafTableServerEvent): Promise<EafTableResult<Product>> {
    const r = await window.electronAPI.invoke<IpcResponse<EafTableResult<Product>>>(
      "product:get-rows",
      event,
    );
    if (!r.success || !r.data) throw new Error(r.error ?? "product:get-rows failed");
    return r.data;
  }

  async getById(id: number): Promise<Product | null> {
    const r = await window.electronAPI.invoke<IpcResponse<Product | null>>("product:get", id);
    return r.success && r.data ? r.data : null;
  }
}
