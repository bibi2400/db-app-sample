import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  model,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  ControlValueAccessor,
  FormControl,
  FormsModule,
  NgControl,
  ReactiveFormsModule,
} from '@angular/forms';
import { merge } from 'rxjs';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldAppearance, MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EafSelectOption } from '../../../types/eaf-table.types';

export interface EafSelectActionOption {
  label: string;
  icon?: string;
  action: () => void;
}

@Component({
  selector: 'eaf-select',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
  ],
  templateUrl: './eaf-select.html',
  styleUrl: './eaf-select.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafSelect implements ControlValueAccessor, OnInit {
  /** Appearance del mat-form-field interno */
  readonly appearance = input<MatFormFieldAppearance>('outline');

  /** Disabilita il componente (input diretto) */
  readonly disabledInput = input(false, { alias: 'disabled' });

  /** Stato disabled propagato da ControlValueAccessor (setDisabledState) */
  private readonly _disabledState = signal(false);

  /** Disabled effettivo: combina input diretto e CVA */
  protected readonly disabled = computed(
    () => this.disabledInput() || this._disabledState()
  );

  /** Opzioni disponibili */
  readonly options = input<EafSelectOption[]>([]);

  /** Valore selezionato (single: valore, multi: array) */
  readonly value = model<unknown>(null);

  /** Selezione multipla */
  readonly multiple = input(false);

  /** Abilita autocomplete con ricerca */
  readonly autocomplete = input(false);

  /** Numero massimo di opzioni mostrate nell'autocomplete (`null` = illimitato) */
  readonly maxVisibleOptions = input<number | null>(null);

  /**
   * Permette valori testuali liberi nell'autocomplete a selezione singola.
   * Non è supportato quando `multiple` è true.
   */
  readonly allowCustomValue = input(false);

  /** Label del form field */
  readonly label = input('Seleziona...');

  /** Placeholder del controllo */
  readonly placeholder = input('Cerca...');

  /** Campo obbligatorio */
  readonly required = input(false);

  /** Mappa di chiavi validator → messaggi mostrati dopo il blur. */
  readonly errorMessages = input<Record<string, string>>({});

  /** Testo hint sotto il campo */
  readonly hint = input('');

  /** Rimuove lo spazio riservato sotto il campo quando hint ed errori non sono presenti */
  readonly hideHint = input(false);

  /** Mostra opzione "— Tutti —" per single non-autocomplete */
  readonly showAllOption = input(true);

  /** @deprecated Usare actionOptions. Label dell'opzione speciale "Crea / Modifica" (null = nascosta) */
  readonly createOptionLabel = input<string | null>(null);

  /** @deprecated Usare actionOptions. Icona dell'opzione speciale (default: add) */
  readonly createOptionIcon = input('add');

  /** @deprecated Usare actionOptions. Emesso quando l'utente seleziona l'opzione speciale */
  readonly createOptionSelected = output<void>();

  /** Array di opzioni azione personalizzate */
  readonly actionOptions = input<EafSelectActionOption[]>([]);

  /** Lista unificata di action options (legacy + nuove) */
  protected readonly _allActionOptions = computed<EafSelectActionOption[]>(() => {
    const custom = this.actionOptions();
    const legacyLabel = this.createOptionLabel();
    if (!legacyLabel) return custom;
    return [
      { label: legacyLabel, icon: this.createOptionIcon(), action: () => this.createOptionSelected.emit() },
      ...custom,
    ];
  });

  // ViewChild refs per input autocomplete
  private readonly chipInputRef =
    viewChild<ElementRef<HTMLInputElement>>('chipInput');

  // Testo di ricerca per autocomplete
  protected readonly searchText = signal('');

  // FormControl interno per l'input autocomplete singolo
  protected readonly _autoDisplayControl = new FormControl('');

  // FormControl interno per mat-select (non-autocomplete)
  protected readonly _selectControl = new FormControl<unknown>(null);

  // Opzioni filtrate per autocomplete
  protected readonly filteredOptions = computed(() => {
    const text = this.searchText().toLowerCase().trim();
    const opts = this.options();
    const filtered = text
      ? opts.filter((option) => {
          const searchableText = [
            option.label,
            option.description ?? '',
            String(option.value ?? ''),
          ]
            .join(' ')
            .toLowerCase();
          return searchableText.includes(text);
        })
      : opts;
    const maxVisibleOptions = this.maxVisibleOptions();
    if (maxVisibleOptions == null) return filtered;
    return filtered.slice(0, Math.max(0, Math.trunc(maxVisibleOptions)));
  });

  // Per multi autocomplete: escludi opzioni già selezionate
  protected readonly availableOptions = computed(() => {
    const filtered = this.filteredOptions();
    const vals = this.selectedValues();
    return filtered.filter((o) => !vals.some((v) => v === o.value));
  });

  // Valori selezionati come array
  protected readonly selectedValues = computed((): unknown[] => {
    const val = this.value();
    if (val == null) return [];
    return Array.isArray(val) ? val : [val];
  });

  // Opzioni selezionate come oggetti (per chip display)
  protected readonly selectedOptions = computed(() => {
    const vals = this.selectedValues();
    const opts = this.options();
    return vals
      .map((v) => opts.find((o) => o.value === v))
      .filter((o): o is EafSelectOption => !!o);
  });

  // Ha un valore (per visibilità pulsante clear)
  protected readonly hasValue = computed(() => {
    const val = this.value();
    if (val == null) return false;
    if (Array.isArray(val)) return val.length > 0;
    return true;
  });

  // displayWith per mat-autocomplete (single)
  protected displayFn = (val: unknown): string => {
    if (val == null) return '';
    const opt = this.options().find((o) => o.value === val);
    return opt?.label ?? String(val);
  };

  private readonly ngControl = inject(NgControl, { self: true, optional: true });
  private readonly destroyRef = inject(DestroyRef);
  private readonly controlRevision = signal(0);
  private readonly isTouched = signal(false);

  protected readonly errorStateMatcher: ErrorStateMatcher = {
    isErrorState: () => this.activeErrors().length > 0,
  };

  protected readonly activeErrors = computed(() => {
    void this.controlRevision();
    if (!this.isTouched()) return [];

    const ctrl = this.ngControl?.control;
    if (!ctrl) return [];

    const messages = this.errorMessages();
    const errors: { key: string; message: string }[] = [];
    for (const [key, message] of Object.entries(messages)) {
      if (ctrl.hasError(key)) {
        errors.push({ key, message });
      }
    }
    if (!('required' in messages) && ctrl.hasError('required')) {
      errors.push({ key: 'required', message: 'Campo obbligatorio' });
    }
    return errors;
  });

  constructor() {
    if (this.ngControl) {
      this.ngControl.valueAccessor = this;
    }

    // Sincronizza il FormControl del display con valore + opzioni
    effect(() => {
      if (!this.autocomplete() || this.multiple()) return;
      const val = this.value();
      const opts = this.options();
      if (val == null) {
        this._autoDisplayControl.setValue('', { emitEvent: false });
      } else if (this.allowCustomValue()) {
        const opt = opts.find((o) => o.value === val);
        this._autoDisplayControl.setValue(
          opt?.label ?? String(val),
          { emitEvent: false },
        );
      } else if (opts.length > 0) {
        const opt = opts.find((o) => o.value === val);
        this._autoDisplayControl.setValue(opt?.label ?? '', { emitEvent: false });
      }
      // Se opts è vuoto e val è impostato, non fare nulla (aspetta il caricamento)
    });

    // Sincronizza lo stato disabled del FormControl autocomplete
    effect(() => {
      if (this.disabled()) {
        this._autoDisplayControl.disable({ emitEvent: false });
      } else {
        this._autoDisplayControl.enable({ emitEvent: false });
      }
    });

    // Sync _selectControl value with value() signal
    effect(() => {
      if (this.autocomplete()) return;
      const val = this.value();
      const current = this._selectControl.value;
      if (current !== val) {
        this._selectControl.setValue(val, { emitEvent: false });
      }
    });

    // Sync _selectControl disabled state
    effect(() => {
      if (this.autocomplete()) return;
      if (this.disabled()) {
        this._selectControl.disable({ emitEvent: false });
      } else {
        this._selectControl.enable({ emitEvent: false });
      }
    });
  }

  ngOnInit(): void {
    const ctrl = this.ngControl?.control;
    if (!ctrl) return;

    merge(ctrl.statusChanges, ctrl.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (!ctrl.touched) this.isTouched.set(false);
        this.controlRevision.update(value => value + 1);
      });
  }

  // ─── ControlValueAccessor ────────────────────────────────────────────────

  private _onChange: (value: unknown) => void = () => {};
  private _onTouched: () => void = () => {};

  writeValue(value: unknown): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: unknown) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabledState.set(isDisabled);
  }

  protected onTouched(): void {
    this.isTouched.set(true);
    this._onTouched();
    this.controlRevision.update(value => value + 1);
  }

  // ─── Search / Filter ──────────────────────────

  protected onSearchInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    this.searchText.set(text);
    if (this.allowCustomValue() && !this.multiple()) {
      this.value.set(text);
      this._onChange(text);
    }
  }

  /**
   * Flag set to true while processing an action-option click.
   *
   * When the user clicks an action option (rendered as a `mat-option` without a value),
   * Angular Material fires `(click)` on the element first, then emits `selectionChange` /
   * `optionSelected` with `undefined` as the selected value. Without this guard those
   * handlers would call `_onChange(undefined)`, wiping the FormControl value and
   * invalidating any required-field validation — which then blocks navigation guards.
   *
   * The flag is set synchronously in `onCreateOption` (before the action runs) and
   * cleared in a `Promise.resolve()` microtask so that all synchronous Angular Material
   * selection events that follow in the same tick are suppressed, while any subsequent
   * genuine user selection is processed normally.
   */
  private _suppressNextSelectChange = false;

  // ─── Single autocomplete ─────────────────────

  protected onAutocompleteSingleSelected(
    event: MatAutocompleteSelectedEvent
  ): void {
    if (this._suppressNextSelectChange) return;
    this.value.set(event.option.value);
    this._onChange(event.option.value);
    this.searchText.set('');
  }

  // ─── Multi autocomplete (chips) ──────────────

  protected onAutocompleteMultiSelected(
    event: MatAutocompleteSelectedEvent
  ): void {
    if (this._suppressNextSelectChange) return;
    const selectedValue = event.option.value;
    const current = this.selectedValues();
    const next = [...current, selectedValue];
    this.value.set(next);
    this._onChange(next);
    this.searchText.set('');
    const inputEl = this.chipInputRef();
    if (inputEl) inputEl.nativeElement.value = '';
  }

  protected removeChip(option: EafSelectOption): void {
    const current = this.selectedValues().filter((v) => v !== option.value);
    const next = current.length ? current : null;
    this.value.set(next);
    this._onChange(next);
  }

  // ─── Mat-select (non autocomplete) ───────────

  protected onSelectChange(val: unknown): void {
    if (this._suppressNextSelectChange) return;
    this.value.set(val);
    this._onChange(val);
  }

  protected onCreateOption(action: EafSelectActionOption): void {
    this._suppressNextSelectChange = true;
    Promise.resolve().then(() => {
      this._suppressNextSelectChange = false;
      // Re-sync internal display controls that Angular Material may have reset
      // to the action option's value (undefined) during the suppressed selection event.
      if (!this.autocomplete()) {
        this._selectControl.setValue(this.value(), { emitEvent: false });
      } else if (!this.multiple()) {
        const val = this.value();
        const opt = this.options().find((o) => o.value === val);
        const displayValue = this.allowCustomValue() && val != null
          ? opt?.label ?? String(val)
          : opt?.label ?? '';
        this._autoDisplayControl.setValue(displayValue, { emitEvent: false });
      }
    });
    action.action();
  }

  protected onMultiSelectChange(vals: unknown[]): void {
    if (this._suppressNextSelectChange) return;
    const next = vals?.length ? vals : null;
    this.value.set(next);
    this._onChange(next);
  }

  // ─── Clear ───────────────────────────────────

  protected onClear(event?: Event): void {
    event?.stopPropagation();
    this.value.set(null);
    this._onChange(null);
    this.searchText.set('');
    this._autoDisplayControl.setValue('', { emitEvent: false });
    this._selectControl.setValue(null, { emitEvent: false });
  }
}
