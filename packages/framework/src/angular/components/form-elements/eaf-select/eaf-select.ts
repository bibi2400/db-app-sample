import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { EafSelectOption } from '../../../types/eaf-table.types';

@Component({
  selector: 'eaf-select',
  imports: [
    FormsModule,
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
export class EafSelect {
  /** Opzioni disponibili */
  readonly options = input<EafSelectOption[]>([]);

  /** Valore selezionato (single: valore, multi: array) */
  readonly value = model<unknown>(null);

  /** Selezione multipla */
  readonly multiple = input(false);

  /** Abilita autocomplete con ricerca */
  readonly autocomplete = input(false);

  /** Label del form field */
  readonly label = input('Seleziona...');

  /** Mostra opzione "— Tutti —" per single non-autocomplete */
  readonly showAllOption = input(true);

  // ViewChild refs per input autocomplete
  private readonly autoInputRef =
    viewChild<ElementRef<HTMLInputElement>>('autoInput');
  private readonly chipInputRef =
    viewChild<ElementRef<HTMLInputElement>>('chipInput');

  // Testo di ricerca per autocomplete
  protected readonly searchText = signal('');

  // Opzioni filtrate per autocomplete
  protected readonly filteredOptions = computed(() => {
    const text = this.searchText().toLowerCase().trim();
    const opts = this.options();
    return text
      ? opts.filter((o) => o.label.toLowerCase().includes(text))
      : opts;
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

  constructor() {
    // Sincronizza l'input single autocomplete con il valore corrente
    effect(() => {
      if (!this.autocomplete() || this.multiple()) return;
      const val = this.value();
      const inputEl = this.autoInputRef();
      if (!inputEl) return;
      const opts = this.options();
      if (val != null) {
        const opt = opts.find((o) => o.value === val);
        inputEl.nativeElement.value = opt?.label ?? '';
      } else {
        inputEl.nativeElement.value = '';
      }
    });
  }

  // ─── Search / Filter ──────────────────────────

  protected onSearchInput(event: Event): void {
    this.searchText.set((event.target as HTMLInputElement).value);
  }

  // ─── Single autocomplete ─────────────────────

  protected onAutocompleteSingleSelected(
    event: MatAutocompleteSelectedEvent
  ): void {
    this.value.set(event.option.value);
    this.searchText.set('');
  }

  // ─── Multi autocomplete (chips) ──────────────

  protected onAutocompleteMultiSelected(
    event: MatAutocompleteSelectedEvent
  ): void {
    const selectedValue = event.option.value;
    const current = this.selectedValues();
    this.value.set([...current, selectedValue]);
    this.searchText.set('');
    const inputEl = this.chipInputRef();
    if (inputEl) inputEl.nativeElement.value = '';
  }

  protected removeChip(option: EafSelectOption): void {
    const current = this.selectedValues().filter((v) => v !== option.value);
    this.value.set(current.length ? current : null);
  }

  // ─── Mat-select (non autocomplete) ───────────

  protected onSelectChange(val: unknown): void {
    this.value.set(val);
  }

  protected onMultiSelectChange(vals: unknown[]): void {
    this.value.set(vals?.length ? vals : null);
  }

  // ─── Clear ───────────────────────────────────

  protected onClear(event?: Event): void {
    event?.stopPropagation();
    this.value.set(null);
    this.searchText.set('');
  }
}
