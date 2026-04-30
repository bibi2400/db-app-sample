import { BrowserWindow, dialog, shell } from "electron";
import * as fs from "fs";
import { BaseController } from "./base.controller";
import { Controller } from "../decorators/controller.decorator";
import { IpcHandler } from "../decorators/ipc-handler.decorator";
import { UploadService } from "../services/system-services/upload.service";
import { UploadFileRequest, UploadOptions, AttachToOwnerOptions } from "../../shared/types/upload";

@Controller({ prefix: "upload" })
export class UploadController extends BaseController {
  constructor(private readonly uploadService: UploadService) {
    super();
  }

  @IpcHandler("files")
  async uploadFiles(files: UploadFileRequest[], options?: UploadOptions) {
    try {
      // Electron IPC may transfer Uint8Array as Buffer or as a plain object;
      // normalize back to Uint8Array.
      const normalized = (files ?? []).map((f) => ({
        ...f,
        data: this.toUint8Array(f.data as unknown),
      }));
      const result = await this.uploadService.uploadFiles(normalized, options ?? {});
      return this.success(result);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("list")
  async list(relativePath?: string) {
    try {
      const items = await this.uploadService.listAttachments(relativePath);
      return this.success(items);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("get")
  async get(id: number) {
    try {
      const item = await this.uploadService.getAttachment(id);
      return this.success(item);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete")
  async delete(id: number) {
    try {
      const ok = await this.uploadService.deleteAttachment(id);
      return this.success(ok);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("list-by-owner")
  async listByOwner(ownerType: string, ownerId: number) {
    try {
      const items = await this.uploadService.listByOwner(ownerType, ownerId);
      return this.success(items);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("owner-ids-with-attachments")
  async ownerIdsWithAttachments(ownerType: string) {
    try {
      const ids = await this.uploadService.getOwnerIdsWithAttachments(ownerType);
      return this.success(ids);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("attach-to-owner")
  async attachToOwner(id: number, ownerType: string, ownerId: number, options?: AttachToOwnerOptions) {
    try {
      const item = await this.uploadService.attachToOwner(id, ownerType, ownerId, options);
      return this.success(item);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("attach-many-to-owner")
  async attachManyToOwner(ids: number[], ownerType: string, ownerId: number, options?: AttachToOwnerOptions) {
    try {
      const items = await this.uploadService.attachManyToOwner(ids ?? [], ownerType, ownerId, options);
      return this.success(items);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("detach-from-owner")
  async detachFromOwner(id: number) {
    try {
      const item = await this.uploadService.detachFromOwner(id);
      return this.success(item);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("delete-by-owner")
  async deleteByOwner(ownerType: string, ownerId: number) {
    try {
      const count = await this.uploadService.deleteByOwner(ownerType, ownerId);
      return this.success(count);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("get-repository-path")
  async getRepositoryPath() {
    try {
      return this.success(this.uploadService.getRepositoryPath());
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("set-repository-path")
  async setRepositoryPath(newPath: string) {
    try {
      this.uploadService.setRepositoryPath(newPath);
      return this.success(this.uploadService.getRepositoryPath());
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("select-repository-path")
  async selectRepositoryPath() {
    try {
      const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
      const current = this.uploadService.getRepositoryPath();
      const opts: Electron.OpenDialogOptions = {
        title: "Seleziona la cartella repository upload",
        defaultPath: current,
        properties: ["openDirectory", "createDirectory"],
      };
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts);
      if (result.canceled || result.filePaths.length === 0) {
        return this.success(null);
      }
      this.uploadService.setRepositoryPath(result.filePaths[0]);
      return this.success(this.uploadService.getRepositoryPath());
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("open-repository")
  async openRepository() {
    try {
      const repo = this.uploadService.getRepositoryPath();
      shell.openPath(repo);
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  @IpcHandler("open-attachment")
  async openAttachment(id: number) {
    try {
      const att = await this.uploadService.getAttachment(id);
      if (!att || !fs.existsSync(att.fullPath)) {
        return this.error("File non trovato.");
      }
      shell.openPath(att.fullPath);
      return this.success(null);
    } catch (error) {
      return this.error(error);
    }
  }

  // ── helpers ────────────────────────────────────────────────────

  private toUint8Array(input: unknown): Uint8Array {
    if (input instanceof Uint8Array) return input;
    if (input instanceof ArrayBuffer) return new Uint8Array(input);
    if (Buffer.isBuffer(input)) {
      return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    }
    if (input && typeof input === "object" && "byteLength" in (input as object)) {
      // Object that survived structured clone (e.g. Node Buffer over IPC)
      const obj = input as { length?: number; [k: number]: number };
      const len = obj.length ?? (input as ArrayBufferView).byteLength;
      const out = new Uint8Array(len);
      for (let i = 0; i < len; i++) out[i] = obj[i];
      return out;
    }
    throw new Error("Formato dati file non supportato.");
  }
}
