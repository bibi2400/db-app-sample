import { Injectable } from "@angular/core";
import type { IpcResponse } from "@bibi2400/electron-angular-framework/shared";
import type { EafTableResult, EafTableServerEvent } from "@bibi2400/electron-angular-framework/angular";
import type { MightyTableRow } from "../types/mighty-table";

@Injectable({ providedIn: "root" })
export class ElectronTableDemoService {
  async getRows(event: EafTableServerEvent): Promise<EafTableResult<MightyTableRow>> {
    const response = await window.electronAPI.invoke<IpcResponse<EafTableResult<MightyTableRow>>>(
      "tableDemo:get-rows",
      event,
    );
    if (!response.success || !response.data) {
      throw new Error(response.error ?? "tableDemo:get-rows failed");
    }
    return response.data;
  }
}