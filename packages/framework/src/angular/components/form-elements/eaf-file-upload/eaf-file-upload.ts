import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostBinding,
  HostListener,
  computed,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ElectronUploadService } from '../../../services/electron-api/electron-upload.service';
import { AttachmentInfo, UploadProgress } from '../../../types/upload';

export type EafFileUploadMode = 'dropzone' | 'button';

/**
 * Reusable file upload widget.
 *
 * - Standalone, OnPush, signal-based.
 * - `dropzone` mode accepts drag & drop and uploads selected files.
 * - `button` mode only returns local `File` objects without uploading them.
 * - Configurable accepted MIME types and target relative path inside the
 *   application's upload repository.
 * - Implements `ControlValueAccessor` so it can be used inside a Reactive Form
 *   (`formControlName`/`formControl`) or a template-driven form (`ngModel`),
 *   but it also works standalone via the `(uploaded)` output and `value` input.
 *
 * The form value is the full list of `AttachmentInfo` representing the files
 * currently associated with this control.
 */
@Component({
  selector: 'eaf-file-upload',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
  ],
  templateUrl: './eaf-file-upload.html',
  styleUrl: './eaf-file-upload.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EafFileUpload),
      multi: true,
    },
  ],
})
export class EafFileUpload implements ControlValueAccessor {
  // ── Inputs ─────────────────────────────────────────────────────

  /** Label visible inside the drop zone. */
  readonly label = input('Trascina qui i file o clicca per selezionarli');

  /** Icon shown in the drop zone or picker button. */
  readonly icon = input('cloud_upload');

  /**
   * `dropzone` uploads and persists files as before. `button` only emits the
   * selected browser `File` objects through `filesSelected`.
   */
  readonly mode = input<EafFileUploadMode>('dropzone');

  /** Accepted MIME types or extensions, comma separated (e.g. 'image/*,.pdf'). */
  readonly accept = input<string>('');

  /** Allow selecting/dropping multiple files. */
  readonly multiple = input(true);

  /** Relative folder inside the upload repository (e.g. 'images/avatars'). */
  readonly relativePath = input<string>('');

  /**
   * Polymorphic owner type for uploaded attachments (e.g. 'journal', 'tools').
   * When provided together with `ownerId`, every uploaded attachment is
   * associated to the owner.
   */
  readonly ownerType = input<string | null>(null);

  /** Polymorphic owner primary key. Required if `ownerType` is provided. */
  readonly ownerId = input<number | null>(null);

  /** When false, completely disables interaction. */
  readonly disabled = input(false);

  /** Maximum size per file in bytes (0 = no limit). */
  readonly maxSizeBytes = input(0);

  // ── Outputs ────────────────────────────────────────────────────

  /** Emitted after each successful upload with the freshly uploaded attachments. */
  readonly uploaded = output<AttachmentInfo[]>();

  /** Emitted when the user removes an attachment. */
  readonly removed = output<AttachmentInfo>();

  /** Validation/upload error messages. */
  readonly errored = output<string>();

  /** Files selected locally in button mode. No upload or persistence occurs. */
  readonly filesSelected = output<File[]>();

  // ── State ──────────────────────────────────────────────────────

  /** Current attachments associated with the control. */
  readonly value = signal<AttachmentInfo[]>([]);

  protected readonly isDragging = signal(false);
  protected readonly currentUploadId = signal<string | null>(null);
  protected readonly currentProgress = signal<UploadProgress | null>(null);
  protected readonly uploading = computed(() => this.currentUploadId() !== null);

  protected readonly cvaDisabled = signal(false);
  protected readonly isDisabled = computed(() => this.disabled() || this.cvaDisabled());
  /**
   * Ids of files added through THIS instance during the current session
   * (i.e. not coming from `writeValue` / form initialization). Used by
   * `discardUnsaved()` so the consumer can intentionally clean up files when
   * the user abandons a form without saving, and by `commitToOwner()` to
   * transfer draft uploads to a freshly-created entity.
   *
   * Includes both freshly-uploaded files AND deduplicated files that resulted
   * in a brand-new Attachment row (i.e. `isNewRow === true`). Reused existing
   * rows are NOT tracked, because deleting them would affect other owners.
   */
  private readonly sessionUploadedIds = new Set<number>();

  /**
   * Ids of files added in this session that were served from an EXISTING
   * Attachment row (dedup hit, no new row created). The consumer can read
   * them via {@link getSessionAttachmentIds} for tracking purposes; they are
   * intentionally NOT deleted by `discardUnsaved()` and NOT reassigned by
   * `commitToOwner()` (they already belong to their original owner, or are
   * pre-existing orphans).
   */
  private readonly sessionReusedIds = new Set<number>();
  // ── Deps ───────────────────────────────────────────────────────

  private readonly uploadService = inject(ElectronUploadService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);

  // ── ControlValueAccessor ───────────────────────────────────────

  private onChange: (value: AttachmentInfo[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: AttachmentInfo[] | null): void {
    // External value (e.g. form patch from localStorage): treat as already
    // persisted, so it's NOT part of the discardable session set.
    this.value.set(Array.isArray(value) ? value : []);
    this.sessionUploadedIds.clear();
    this.sessionReusedIds.clear();
  }
  registerOnChange(fn: (value: AttachmentInfo[]) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this.cvaDisabled.set(isDisabled);
  }

  // ── Drag & drop ────────────────────────────────────────────────

  @HostBinding('class.eaf-file-upload-disabled')
  get disabledClass(): boolean {
    return this.isDisabled();
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this.mode() !== 'dropzone' || this.isDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (this.mode() !== 'dropzone') return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (this.mode() !== 'dropzone') return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
    if (this.isDisabled()) return;
    const files = event.dataTransfer?.files;
    if (files && files.length) this.handleFiles(Array.from(files));
  }

  // ── File picker ────────────────────────────────────────────────

  protected onPickerChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    input.value = ''; // allow selecting the same file again

    if (!files.length || this.isDisabled()) return;
    if (this.mode() === 'button') {
      this.filesSelected.emit(files);
      return;
    }

    void this.handleFiles(files);
  }

  // ── Core upload flow ───────────────────────────────────────────

  private async handleFiles(files: File[]): Promise<void> {
    if (this.isDisabled() || this.uploading()) return;

    // Validate accepted types
    const accepted = this.accept().trim();
    if (accepted) {
      const invalid = files.find(f => !this.matchesAccept(f, accepted));
      if (invalid) {
        const msg = `Tipo di file non consentito: ${invalid.name}`;
        this.errored.emit(msg);
        return;
      }
    }

    // Validate size
    const max = this.maxSizeBytes();
    if (max > 0) {
      const tooBig = files.find(f => f.size > max);
      if (tooBig) {
        const msg = `File troppo grande: ${tooBig.name}`;
        this.errored.emit(msg);
        return;
      }
    }

    // Generate an upload id so we can filter progress events
    const uploadId = this.makeUploadId();
    this.currentUploadId.set(uploadId);
    this.currentProgress.set(null);

    const sub = this.uploadService.progress$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((p) => {
        if (p.uploadId === uploadId) {
          this.currentProgress.set(p);
          this.cdr.markForCheck();
        }
      });

    try {
      const result = await this.uploadService.uploadFiles(files, {
        uploadId,
        relativePath: this.relativePath(),
        ownerType: this.ownerType(),
        ownerId: this.ownerId(),
      });

      if (result.success && result.data) {
        // Track every newly-created Attachment row from this session (fresh
        // upload OR dedup that produced a new row): these are safe to delete
        // on intentional discard and to reassign via commitToOwner. Reused
        // existing rows go into a separate set for visibility only.
        for (const a of result.data.attachments) {
          if (a.isNewRow) this.sessionUploadedIds.add(a.id);
          else if (a.deduplicated) this.sessionReusedIds.add(a.id);
        }
        const next = this.multiple()
          ? [...this.value(), ...result.data.attachments]
          : result.data.attachments.slice(-1);
        this.value.set(next);
        this.onChange(next);
        this.onTouched();
        this.uploaded.emit(result.data.attachments);

        if (result.data.errors.length) {
          this.errored.emit(
            result.data.errors.map(e => `${e.fileName}: ${e.error}`).join('\n'),
          );
        }
      } else {
        this.errored.emit(result.error ?? 'Errore sconosciuto durante upload.');
      }
    } finally {
      sub.unsubscribe();
      this.currentUploadId.set(null);
      this.currentProgress.set(null);
    }
  }

  protected async removeAttachment(att: AttachmentInfo): Promise<void> {
    if (this.isDisabled()) return;
    const result = await this.uploadService.delete(att.id);
    if (result.success) {
      const next = this.value().filter(a => a.id !== att.id);
      this.value.set(next);
      this.sessionUploadedIds.delete(att.id);
      this.sessionReusedIds.delete(att.id);
      this.onChange(next);
      this.onTouched();
      this.removed.emit(att);
    } else {
      this.errored.emit(result.error ?? 'Errore durante eliminazione.');
    }
  }

  // ── Public API (callable via @ViewChild) ───────────────────────

  /**
   * Returns the ids of files uploaded during this session (not yet committed).
   * Useful when the consumer wants to persist them (e.g. localStorage) and
   * call `adoptIds()` later instead of discarding.
   */
  getUnsavedAttachmentIds(): number[] {
    return Array.from(this.sessionUploadedIds);
  }

  /**
   * Returns the full session breakdown:
   *  - `uploaded`: ids of new Attachment rows created in this session (safe to
   *    delete on discard and to reassign via {@link commitToOwner}). Same as
   *    {@link getUnsavedAttachmentIds}.
   *  - `reused`: ids of pre-existing Attachment rows returned via dedup
   *    without creating a new row (NOT touched by discard/commit).
   */
  getSessionAttachmentIds(): { uploaded: number[]; reused: number[] } {
    return {
      uploaded: Array.from(this.sessionUploadedIds),
      reused: Array.from(this.sessionReusedIds),
    };
  }

  /**
   * Marks the currently uploaded files as committed (e.g. after a successful
   * form save). They will no longer be deleted by `discardUnsaved()`.
   */
  commit(): void {
    this.sessionUploadedIds.clear();
    this.sessionReusedIds.clear();
  }

  /**
   * Create-mode helper: associates every file uploaded in this session to the
   * given owner (typically the id of an entity that has just been created),
   * atomically. After a successful call the session is considered committed.
   *
   * Equivalent to calling `attachManyToOwner(getUnsavedAttachmentIds(), ...)`
   * followed by `commit()`, but in a single transactional IPC roundtrip.
   *
   * Defaults to safe mode: throws if any session row is already owned by a
   * different entity (which should not happen in normal create-mode usage,
   * but protects against double-commit and similar bugs).
   */
  async commitToOwner(
    ownerType: string,
    ownerId: number,
    options?: { mode?: 'safe' | 'claim' },
  ): Promise<AttachmentInfo[]> {
    const ids = Array.from(this.sessionUploadedIds);
    if (ids.length === 0) {
      this.sessionReusedIds.clear();
      return [];
    }
    const result = await this.uploadService.attachManyToOwner(ids, ownerType, ownerId, options);
    if (!result.success) {
      throw new Error(result.error ?? 'commitToOwner: errore sconosciuto.');
    }
    const updated = result.data ?? [];
    const map = new Map(updated.map(a => [a.id, a]));
    const next = this.value().map(a => map.get(a.id) ?? a);
    this.value.set(next);
    this.onChange(next);
    this.sessionUploadedIds.clear();
    this.sessionReusedIds.clear();
    return updated;
  }

  /**
   * Deletes all files uploaded during this session that are not yet committed.
   * Call this when the user intentionally abandons the form without saving.
   * Returns the list of deleted ids.
   */
  async discardUnsaved(): Promise<number[]> {
    const ids = Array.from(this.sessionUploadedIds);
    const deleted: number[] = [];
    for (const id of ids) {
      const result = await this.uploadService.delete(id);
      if (result.success) deleted.push(id);
    }
    this.sessionUploadedIds.clear();
    // Reused rows are NOT deleted (they belong to other owners or are
    // pre-existing orphans), but we drop them from the value() too: the
    // caller is discarding the whole session.
    const reused = Array.from(this.sessionReusedIds);
    this.sessionReusedIds.clear();
    const dropped = new Set([...ids, ...reused]);
    const next = this.value().filter(a => !dropped.has(a.id));
    this.value.set(next);
    this.onChange(next);
    return deleted;
  }

  /** Alias of {@link discardUnsaved} for create-mode readability. */
  discardDraft(): Promise<number[]> {
    return this.discardUnsaved();
  }

  /**
   * Adopts a previously-uploaded set of ids (e.g. restored from localStorage)
   * as the current session set, so they can be discarded later. Also fetches
   * their `AttachmentInfo` and sets the value accordingly.
   */
  async adoptIds(ids: number[]): Promise<AttachmentInfo[]> {
    const restored: AttachmentInfo[] = [];
    for (const id of ids) {
      const result = await this.uploadService.get(id);
      if (result.success && result.data) restored.push(result.data);
    }
    this.value.set(restored);
    this.sessionUploadedIds.clear();
    this.sessionReusedIds.clear();
    for (const a of restored) this.sessionUploadedIds.add(a.id);
    this.onChange(restored);
    return restored;
  }

  protected formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  protected openAttachment(att: AttachmentInfo): void {
    void this.uploadService.openAttachment(att.id);
  }

  // ── helpers ────────────────────────────────────────────────────

  /**
   * Matches a File against an HTML `accept` value (mime types, wildcards, extensions).
   */
  private matchesAccept(file: File, accept: string): boolean {
    const tokens = accept.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (!tokens.length) return true;
    const fileName = file.name.toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    return tokens.some((tok) => {
      if (tok.startsWith('.')) return fileName.endsWith(tok);
      if (tok.endsWith('/*')) return fileType.startsWith(tok.slice(0, -1));
      return fileType === tok;
    });
  }

  private makeUploadId(): string {
    return `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
