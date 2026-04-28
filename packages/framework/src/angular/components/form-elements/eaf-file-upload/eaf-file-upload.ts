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

/**
 * Reusable file upload widget.
 *
 * - Standalone, OnPush, signal-based.
 * - Accepts drag & drop and file picker.
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

  /** Accepted MIME types or extensions, comma separated (e.g. 'image/*,.pdf'). */
  readonly accept = input<string>('');

  /** Allow selecting/dropping multiple files. */
  readonly multiple = input(true);

  /** Relative folder inside the upload repository (e.g. 'images/avatars'). */
  readonly relativePath = input<string>('');

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
   * Ids of files uploaded through THIS instance during the current session
   * (i.e. not coming from `writeValue` / form initialization). Used by
   * `discardUnsaved()` so the consumer can intentionally clean up files when
   * the user abandons a form without saving. Deduplicated attachments (files
   * already present in the repository before this session) are NOT tracked,
   * because deleting them would remove the original.
   */
  private readonly sessionUploadedIds = new Set<number>();
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
    if (this.isDisabled()) return;
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(true);
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging.set(false);
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
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
    if (!input.files || !input.files.length) return;
    this.handleFiles(Array.from(input.files));
    input.value = ''; // allow re-uploading same file later
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
      });

      if (result.success && result.data) {
        // Track only freshly uploaded files (skip dedup hits) so they can be
        // deleted on intentional discard.
        for (const a of result.data.attachments) {
          if (!a.deduplicated) this.sessionUploadedIds.add(a.id);
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
   * Marks the currently uploaded files as committed (e.g. after a successful
   * form save). They will no longer be deleted by `discardUnsaved()`.
   */
  commit(): void {
    this.sessionUploadedIds.clear();
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
    const next = this.value().filter(a => !ids.includes(a.id));
    this.value.set(next);
    this.onChange(next);
    return deleted;
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
