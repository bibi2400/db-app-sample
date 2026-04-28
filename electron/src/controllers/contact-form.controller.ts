import {
  BaseController,
  Controller,
  IpcHandler,
  Logger,
} from "@bibi2400/electron-angular-framework/electron";

/**
 * Payload del form di esempio inviato dal renderer.
 */
export interface ContactFormPayload {
  name: string;
  email: string;
  attachments: { id: number; originalName: string; size: number }[];
}

@Controller({ prefix: "contactForm" })
export class ContactFormController extends BaseController {

  @IpcHandler("save")
  async save(payload: ContactFormPayload) {
    try {
      // Finta persistenza: log dei dati ricevuti
      Logger.info("[ContactForm] Form ricevuto:", JSON.stringify(payload, null, 2));

      // Simula latenza di un salvataggio a database
      await new Promise(resolve => setTimeout(resolve, 400));

      const fakeId = Math.floor(Math.random() * 100000);
      Logger.info(`[ContactForm] Form salvato con id fittizio ${fakeId}`);

      return this.success({ id: fakeId, savedAt: new Date().toISOString() });
    } catch (error) {
      return this.error(error);
    }
  }
}
