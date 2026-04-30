import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  AttachmentInfo,
  EafFileUpload,
  ElectronUploadService,
  IpcResponse,
  NavigationService,
} from '@bibi2400/electron-angular-framework/angular';

interface ContactFormPayload {
  name: string;
  email: string;
  attachments: { id: number; originalName: string; size: number }[];
}

interface SaveResult {
  id: number;
  savedAt: string;
}

const DRAFT_KEY = 'form-upload-demo:draft';

/** Owner statico per testare la relazione polimorfica del framework. */
const DEMO_OWNER_TYPE = 'contact-form';
const DEMO_OWNER_ID = 1;

interface DraftState {
  name: string;
  email: string;
  attachmentIds: number[];
}

@Component({
  selector: 'app-form-upload-demo',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    EafFileUpload,
  ],
  templateUrl: './form-upload-demo.html',
  styleUrl: './form-upload-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormUploadDemo implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly snackBar = inject(MatSnackBar);
  private readonly navigationService = inject(NavigationService);
  private readonly uploadService = inject(ElectronUploadService);

  protected readonly demoOwnerType = DEMO_OWNER_TYPE;
  protected readonly demoOwnerId = DEMO_OWNER_ID;

  /** Riferimento al componente di upload per chiamare discardUnsaved/adoptIds. */
  protected readonly fileUpload = viewChild.required(EafFileUpload);

  protected readonly saving = signal(false);
  protected readonly lastSaved = signal<SaveResult | null>(null);
  protected readonly hasDraft = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    attachments: this.fb.nonNullable.control<AttachmentInfo[]>(
      [],
      [Validators.required],
    ),
  });

  ngOnInit(): void {
    this.navigationService.clearToolbarActions();
    this.hasDraft.set(localStorage.getItem(DRAFT_KEY) !== null);
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    try {
      const value = this.form.getRawValue();
      const payload: ContactFormPayload = {
        name: value.name,
        email: value.email,
        attachments: value.attachments.map(a => ({
          id: a.id,
          originalName: a.originalName,
          size: a.size,
        })),
      };
      const response = await window.electronAPI.invoke<IpcResponse<SaveResult>>(
        'contactForm:save',
        payload,
      );
      if (response.success && response.data) {
        this.lastSaved.set(response.data);
        this.snackBar.open(
          `Form salvato (id ${response.data.id})`,
          'Chiudi',
          { duration: 3000 },
        );
        // Allegati ora persistiti dal backend reale: marcali come committati
        // così discardUnsaved() non li cancellerà.
        this.fileUpload().commit();
        localStorage.removeItem(DRAFT_KEY);
        this.hasDraft.set(false);
        this.form.reset({ name: '', email: '', attachments: [] });
      } else {
        this.snackBar.open(
          `Errore: ${response.error ?? 'sconosciuto'}`,
          'Chiudi',
          { duration: 4000 },
        );
      }
    } finally {
      this.saving.set(false);
    }
  }

  protected onUploadError(message: string): void {
    this.snackBar.open(message, 'Chiudi', { duration: 4000 });
  }

  /** Test: elenca tutti gli allegati associati all'owner statico. */
  protected async testListByOwner(): Promise<void> {
    const result = await this.uploadService.listByOwner(DEMO_OWNER_TYPE, DEMO_OWNER_ID);
    if (result.success && result.data) {
      const list = result.data;
      console.log(`[testListByOwner] ${DEMO_OWNER_TYPE}/${DEMO_OWNER_ID} →`, list);
      const summary = list.length
        ? list.map((a) => `#${a.id} ${a.originalName}`).join(', ')
        : '(nessuno)';
      this.snackBar.open(
        `Allegati owner ${DEMO_OWNER_TYPE}/${DEMO_OWNER_ID}: ${list.length} — ${summary}`,
        'Chiudi',
        { duration: 6000 },
      );
    } else {
      this.snackBar.open(`Errore list-by-owner: ${result.error ?? 'sconosciuto'}`, 'Chiudi', {
        duration: 4000,
      });
    }
  }

  /** Test: cancella tutti gli allegati associati all'owner statico. */
  protected async testDeleteByOwner(): Promise<void> {
    const result = await this.uploadService.deleteByOwner(DEMO_OWNER_TYPE, DEMO_OWNER_ID);
    if (result.success) {
      this.snackBar.open(
        `Cancellati ${result.data ?? 0} allegati per ${DEMO_OWNER_TYPE}/${DEMO_OWNER_ID}.`,
        'Chiudi',
        { duration: 4000 },
      );
    } else {
      this.snackBar.open(`Errore delete-by-owner: ${result.error ?? 'sconosciuto'}`, 'Chiudi', {
        duration: 4000,
      });
    }
  }

  /**
   * Annulla intenzionalmente la compilazione: cancella dal repository i file
   * caricati durante questa sessione e svuota il form.
   */
  protected async discardAndExit(): Promise<void> {
    const deleted = await this.fileUpload().discardUnsaved();
    localStorage.removeItem(DRAFT_KEY);
    this.hasDraft.set(false);
    this.form.reset({ name: '', email: '', attachments: [] });
    this.snackBar.open(
      deleted.length
        ? `Bozza scartata. Rimossi ${deleted.length} allegati.`
        : 'Bozza scartata.',
      'Chiudi',
      { duration: 3000 },
    );
  }

  /**
   * Salva la bozza in localStorage memorizzando solo gli id degli allegati.
   * NON chiama discardUnsaved(): i file restano sul disco e potranno essere
   * ripristinati in futuro tramite restoreDraft().
   */
  protected saveDraft(): void {
    const value = this.form.getRawValue();
    const draft: DraftState = {
      name: value.name,
      email: value.email,
      attachmentIds: value.attachments.map(a => a.id),
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    this.hasDraft.set(true);
    this.snackBar.open('Bozza salvata in localStorage.', 'Chiudi', { duration: 2500 });
  }

  /**
   * Ripristina la bozza dal localStorage: ricostruisce gli AttachmentInfo a
   * partire dagli id e li adotta come sessione corrente, così un successivo
   * "Annulla" potrà cancellarli definitivamente.
   */
  protected async restoreDraft(): Promise<void> {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const draft = JSON.parse(raw) as DraftState;
    const attachments = await this.fileUpload().adoptIds(draft.attachmentIds);
    this.form.patchValue({
      name: draft.name,
      email: draft.email,
    });
    this.form.controls.attachments.setValue(attachments);
    this.snackBar.open(
      `Bozza ripristinata (${attachments.length} allegati).`,
      'Chiudi',
      { duration: 3000 },
    );
  }
}
