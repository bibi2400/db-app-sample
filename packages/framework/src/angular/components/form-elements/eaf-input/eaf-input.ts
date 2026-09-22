import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  NgControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { merge } from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldAppearance, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'eaf-input',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    NgClass,
    NgStyle,
  ],
  templateUrl: './eaf-input.html',
  styleUrl: './eaf-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // NG_VALUE_ACCESSOR non è usato come provider per evitare la dipendenza circolare:
  //   FormControlName → NG_VALUE_ACCESSOR → EafInput → NgControl → FormControlName
  // La registrazione del CVA avviene manualmente nel costruttore (ngControl.valueAccessor = this).
})
export class EafInput implements ControlValueAccessor, OnInit {
  /** Label del form field */
  readonly label = input('');

  /** Unità di misura mostrata come suffisso (es. mm, kg). Nascosta se null/empty. */
  readonly unit = input<string | null>(null);

  /** Stile inline opzionale per lo span del suffisso */
  readonly unitStyle = input<Partial<CSSStyleDeclaration> | null>(null);

  /** Classe CSS opzionale per lo span del suffisso */
  readonly unitClass = input<string>('');

  /** Placeholder del campo */
  readonly placeholder = input('');

  /** Tipo input HTML (default: number) */
  readonly type = input('number');

  /** Se impostato, renderizza un textarea con il numero di righe specificato */
  readonly rows = input<number | null>(null);

  /** Campo obbligatorio */
  readonly required = input(false);

  /** Testo hint sotto il campo */
  readonly hint = input<string>('');

  /** Appearance del mat-form-field */
  readonly appearance = input<MatFormFieldAppearance>('outline');

  /** Disabilita il componente */
  readonly disabled = input(false);

  /** Rende il controllo non modificabile senza disabilitarlo */
  readonly readOnly = input(false, { alias: 'readonly' });

  /**
   * Mappa di chiavi di errore validator → messaggi leggibili.
   * Il componente controlla il FormControl padre per questi errori e mostra
   * il messaggio corrispondente quando il campo è touched.
   *
   * La chiave 'required' viene gestita automaticamente con "Campo obbligatorio"
   * anche se non inclusa qui, purché il FormControl padre abbia l'errore required.
   *
   * Esempio:
   * ```html
   * <eaf-input
   *   formControlName="qty"
   *   [errorMessages]="{ min: 'Il valore non può essere negativo', max: 'Valore troppo alto' }"
   * />
   * ```
   */
  readonly errorMessages = input<Record<string, string>>({});

  // ─── ControlValueAccessor ────────────────────────────────────────────────

  /** FormControl interno usato dal template */
  protected readonly internalControl = new FormControl<string | number | null>(null);

  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly isDisabled = signal(false);

  // ─── NgControl & reactive error state ────────────────────────────────────

  /**
   * NgControl iniettato con self:true per accedere al FormControl padre e ai suoi validatori.
   * Non usiamo NG_VALUE_ACCESSOR come provider per evitare la dipendenza circolare con NgControl;
   * il CVA viene registrato manualmente nel costruttore tramite ngControl.valueAccessor = this.
   */
  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);

  /** Contatore incrementato ad ogni statusChanges/valueChanges del controllo padre,
   *  usato come dipendenza reattiva in activeErrors. */
  private readonly controlRevision = signal(0);

  /** Diventa true al primo blur; si resetta se il controllo padre viene resettato (touched → false). */
  private readonly isTouched = signal(false);

  /**
   * Custom ErrorStateMatcher per Angular Material: attiva lo stato di errore del mat-form-field
   * quando activeErrors() ha voci. Necessario perché matInput è legato a internalControl
   * (senza validatori), quindi Angular Material non mostrerebbe mai mat-error di default.
   */
  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.activeErrors().length > 0,
  };

  /**
   * Lista degli errori attivi da mostrare nel mat-form-field.
   *
   * Controlla il FormControl padre usando le chiavi di errorMessages.
   * Fallback automatico per 'required' → "Campo obbligatorio" se non già in errorMessages.
   *
   * Reattivo a: blur (isTouched), cambi di validità/valore del controllo padre (controlRevision),
   * e modifiche all'input errorMessages.
   */
  protected readonly activeErrors = computed(() => {
    void this.controlRevision(); // dipendenza reattiva sullo stato di validità
    if (!this.isTouched()) return [];

    const ctrl = this.ngControl?.control;
    const messages = this.errorMessages();
    const errors: { key: string; message: string }[] = [];

    if (ctrl) {
      // Controlla le chiavi configurate in errorMessages contro il FormControl padre
      for (const [key, message] of Object.entries(messages)) {
        if (ctrl.hasError(key)) {
          errors.push({ key, message });
        }
      }
      // Fallback required: se non già in errorMessages ma il controllo ha l'errore required
      if (!('required' in messages) && ctrl.hasError('required')) {
        errors.push({ key: 'required', message: 'Campo obbligatorio' });
      }
    } else {
      // Nessun NgControl (uso senza form): fallback su internalControl per required
      if (this.internalControl.hasError('required')) {
        errors.push({ key: 'required', message: 'Campo obbligatorio' });
      }
    }

    return errors;
  });

  constructor() {
    // Registrazione manuale del CVA: evita la dipendenza circolare con NG_VALUE_ACCESSOR
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    this.internalControl.valueChanges.subscribe((v) => {
      this.onChange(v);
    });
    effect(() => {
      this.setDisabledState(this.disabled());
    });
  }

  ngOnInit(): void {
    const ctrl = this.ngControl?.control;
    if (ctrl) {
      // Ascolta i cambiamenti di validità e valore per aggiornare activeErrors in modo reattivo
      merge(ctrl.statusChanges, ctrl.valueChanges)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => {
          // Sincronizza isTouched con il controllo padre (es. dopo form.reset())
          if (!ctrl.touched) this.isTouched.set(false);
          this.controlRevision.update(v => v + 1);
        });
    }
  }

  writeValue(value: string | number | null): void {
    this.internalControl.setValue(value, { emitEvent: false });
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) {
      this.internalControl.disable({ emitEvent: false });
    } else {
      this.internalControl.enable({ emitEvent: false });
    }
  }

  protected onBlur(): void {
    this.isTouched.set(true);
    this.onTouched();
  }
}
