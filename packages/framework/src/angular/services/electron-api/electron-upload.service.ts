import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ElectronPushService } from './electron-push.service';
import { IpcResponse } from '../../types/global';
import {
  AttachmentInfo,
  AttachToOwnerOptions,
  UploadFileRequest,
  UploadOptions,
  UploadProgress,
  UploadResult,
} from '../../types/upload';

/**
 * Angular wrapper around the Electron `upload:*` IPC handlers and the
 * `push:upload:progress` channel.
 */
@Injectable({ providedIn: 'root' })
export class ElectronUploadService {
  private readonly pushService = inject(ElectronPushService);

  /** Stream of upload progress events from the main process. */
  readonly progress$: Observable<UploadProgress> =
    this.pushService.on<UploadProgress>('push:upload:progress');

  /**
   * Reads each File as an ArrayBuffer and ships it to Electron for storage.
   * Use {@link progress$} to track per-file/overall progress.
   */
  async uploadFiles(
    files: File[],
    options: UploadOptions = {},
  ): Promise<{ success: boolean; data?: UploadResult; error?: string }> {
    try {
      const payload: UploadFileRequest[] = await Promise.all(
        files.map(async (f) => ({
          name: f.name,
          mimeType: f.type || undefined,
          data: new Uint8Array(await f.arrayBuffer()),
        })),
      );
      const response = await window.electronAPI.invoke<IpcResponse<UploadResult>>(
        'upload:files',
        payload,
        options,
      );
      if (response.success && response.data) {
        return { success: true, data: response.data };
      }
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async list(relativePath?: string): Promise<{ success: boolean; data?: AttachmentInfo[]; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo[]>>(
        'upload:list',
        relativePath,
      );
      return response.success && response.data
        ? { success: true, data: response.data }
        : { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async get(id: number): Promise<{ success: boolean; data?: AttachmentInfo | null; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo | null>>(
        'upload:get',
        id,
      );
      if (response.success) return { success: true, data: response.data ?? null };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async delete(id: number): Promise<{ success: boolean; data?: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<boolean>>('upload:delete', id);
      if (response.success) return { success: true, data: response.data ?? false };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Lists all attachments belonging to the given polymorphic owner. */
  async listByOwner(
    ownerType: string,
    ownerId: number,
  ): Promise<{ success: boolean; data?: AttachmentInfo[]; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo[]>>(
        'upload:list-by-owner',
        ownerType,
        ownerId,
      );
      return response.success && response.data
        ? { success: true, data: response.data }
        : { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Associates an existing attachment to an owner (typically used to claim an
   * orphan or to commit a draft upload). Defaults to safe mode: refuses to
   * reassign rows already owned by someone else.
   */
  async attachToOwner(
    id: number,
    ownerType: string,
    ownerId: number,
    options?: AttachToOwnerOptions,
  ): Promise<{ success: boolean; data?: AttachmentInfo | null; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo | null>>(
        'upload:attach-to-owner',
        id,
        ownerType,
        ownerId,
        options,
      );
      if (response.success) return { success: true, data: response.data ?? null };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /**
   * Atomically associates many attachments to the same owner (transactional).
   * Use this to commit a batch of draft uploads to a newly-created entity.
   */
  async attachManyToOwner(
    ids: number[],
    ownerType: string,
    ownerId: number,
    options?: AttachToOwnerOptions,
  ): Promise<{ success: boolean; data?: AttachmentInfo[]; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo[]>>(
        'upload:attach-many-to-owner',
        ids,
        ownerType,
        ownerId,
        options,
      );
      if (response.success) return { success: true, data: response.data ?? [] };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Removes the owner association from an attachment, leaving it orphan. */
  async detachFromOwner(
    id: number,
  ): Promise<{ success: boolean; data?: AttachmentInfo | null; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<AttachmentInfo | null>>(
        'upload:detach-from-owner',
        id,
      );
      if (response.success) return { success: true, data: response.data ?? null };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Deletes all attachments belonging to the given owner. Returns the count deleted. */
  async deleteByOwner(
    ownerType: string,
    ownerId: number,
  ): Promise<{ success: boolean; data?: number; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<number>>(
        'upload:delete-by-owner',
        ownerType,
        ownerId,
      );
      if (response.success) return { success: true, data: response.data ?? 0 };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async getRepositoryPath(): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<string>>('upload:get-repository-path');
      if (response.success && response.data) return { success: true, data: response.data };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async setRepositoryPath(newPath: string): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<string>>('upload:set-repository-path', newPath);
      if (response.success && response.data) return { success: true, data: response.data };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  /** Opens a folder picker; returns the new repository path or null if cancelled. */
  async selectRepositoryPath(): Promise<{ success: boolean; data?: string | null; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<string | null>>('upload:select-repository-path');
      if (response.success) return { success: true, data: response.data ?? null };
      return { success: false, error: response.error ?? 'Unknown error' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async openRepository(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<void>>('upload:open-repository');
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async openAttachment(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await window.electronAPI.invoke<IpcResponse<void>>('upload:open-attachment', id);
      return { success: response.success, error: response.error };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }
}
