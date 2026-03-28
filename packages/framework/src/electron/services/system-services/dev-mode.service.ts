import { Injectable } from "../../helpers/mini-pie/decorators";

/**
 * Servizio che gestisce la rilevazione della modalità di sviluppo.
 * Iniettabile tramite DI da qualunque servizio che necessiti di
 * comportamenti diversi tra dev e produzione.
 */
@Injectable()
export class DevModeService {
  readonly isDev: boolean;
  readonly noSplash: boolean;

  constructor() {
    const args = process.argv.slice(1);
    this.isDev = args.some(val => val === '--serve');
    this.noSplash = args.some(val => val === '--no-splash');
  }
}
