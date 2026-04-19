import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  input,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Subscription, from, isObservable } from 'rxjs';
import { EafFilterConfig, EafFilterType, EafSelectOption, EafSelectPredicateOption } from '../../types/eaf-table.types';
import { EafSelect } from '../form-elements/eaf-select/eaf-select';

@Component({
  selector: 'eaf-table-filter',
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    EafSelect,
  ],
  templateUrl: './eaf-table-filter.html',
  styleUrl: './eaf-table-filter.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafTableFilter implements OnInit, OnDestroy {
  /** Configurazione del filtro */
  readonly config = input<EafFilterConfig>({ type: 'text' });

  /** Valore iniziale del filtro (dal state persistito) */
  readonly initialValue = input<unknown>(null);

  /** Dati della colonna per estrarre opzioni uniche (filtro select senza options) */
  readonly columnData = input<unknown[]>([]);

  /** Emette il nuovo valore del filtro */
  readonly valueChange = output<unknown>();

  // State interno
  protected readonly currentValue = signal<unknown>(null);
  protected readonly rangeMin = signal<number | null>(null);
  protected readonly rangeMax = signal<number | null>(null);
  protected readonly dateFrom = signal<Date | null>(null);
  protected readonly dateTo = signal<Date | null>(null);
  protected readonly selectOptions = signal<EafSelectOption[]>([]);
  protected readonly numberMode = signal<'equal' | 'range'>('range');
  protected readonly numberEqual = signal<number | null>(null);
  protected readonly dateMode = signal<'equal' | 'range'>('range');
  protected readonly dateEqual = signal<Date | null>(null);

  private optionsSub?: Subscription;

  get filterType(): () => EafFilterType {
    return () => this.config().type;
  }

  /** Modalità abilitate per number/date. Default: entrambe */
  protected getAvailableModes(): ('equal' | 'range')[] {
    return this.config().modes ?? ['equal', 'range'];
  }

  protected hasMode(mode: 'equal' | 'range'): boolean {
    return this.getAvailableModes().includes(mode);
  }

  protected hasBothModes(): boolean {
    const m = this.getAvailableModes();
    return m.includes('equal') && m.includes('range');
  }

  ngOnInit(): void {
    // Imposta la modalità iniziale basata sui modes configurati
    const modes = this.getAvailableModes();
    const cfg = this.config();
    if (cfg.type === 'number') {
      this.numberMode.set(modes.includes('range') ? 'range' : 'equal');
    } else if (cfg.type === 'date') {
      this.dateMode.set(modes.includes('range') ? 'range' : 'equal');
    }

    this.restoreValue(this.initialValue());
    this.loadSelectOptions();
  }

  ngOnDestroy(): void {
    this.optionsSub?.unsubscribe();
  }

  protected isMultiple(): boolean {
    return this.config().multiple === true;
  }

  protected isAutocomplete(): boolean {
    return this.config().autocomplete === true;
  }

  onValueChange(value: unknown): void {
    this.currentValue.set(value);
    this.valueChange.emit(value);
  }

  onSelectValueChange(value: unknown): void {
    this.currentValue.set(value);
    this.valueChange.emit(value);
  }

  onRangeChange(min: number | null, max: number | null): void {
    this.rangeMin.set(min);
    this.rangeMax.set(max);
    const range = (min != null || max != null) ? { mode: 'range' as const, min, max } : null;
    this.currentValue.set(range);
    this.valueChange.emit(range);
  }

  onNumberEqualChange(value: number | null): void {
    this.numberEqual.set(value);
    const result = value != null ? { mode: 'equal' as const, equal: value } : null;
    this.currentValue.set(result);
    this.valueChange.emit(result);
  }

  onNumberModeChange(mode: 'equal' | 'range'): void {
    this.numberMode.set(mode);
    this.onClear();
  }

  onDateChange(from: Date | null, to: Date | null): void {
    this.dateFrom.set(from);
    this.dateTo.set(to);
    const range = (from || to) ? { mode: 'range' as const, from: from?.toISOString() ?? null, to: to?.toISOString() ?? null } : null;
    this.currentValue.set(range);
    this.valueChange.emit(range);
  }

  onDateEqualChange(value: Date | null): void {
    this.dateEqual.set(value);
    const result = value ? { mode: 'equal' as const, equal: value.toISOString() } : null;
    this.currentValue.set(result);
    this.valueChange.emit(result);
  }

  onDateModeChange(mode: 'equal' | 'range'): void {
    this.dateMode.set(mode);
    this.onClear();
  }

  onBooleanChange(checked: boolean): void {
    // Ciclo: null → true → false → null
    const current = this.currentValue();
    let next: boolean | null;
    if (current == null) next = true;
    else if (current === true) next = false;
    else next = null;
    this.currentValue.set(next);
    this.valueChange.emit(next);
  }

  onClear(): void {
    this.currentValue.set(null);
    this.rangeMin.set(null);
    this.rangeMax.set(null);
    this.numberEqual.set(null);
    this.dateFrom.set(null);
    this.dateTo.set(null);
    this.dateEqual.set(null);
    this.valueChange.emit(null);
  }

  private restoreValue(value: unknown): void {
    if (value == null) return;

    const cfg = this.config();
    if (cfg.type === 'number' && typeof value === 'object' && value !== null) {
      const v = value as { mode?: string; min?: number | null; max?: number | null; equal?: number | null };
      if (v.mode === 'equal') {
        this.numberMode.set('equal');
        this.numberEqual.set(v.equal ?? null);
      } else {
        this.numberMode.set('range');
        this.rangeMin.set(v.min ?? null);
        this.rangeMax.set(v.max ?? null);
      }
    } else if (cfg.type === 'date' && typeof value === 'object' && value !== null) {
      const v = value as { mode?: string; from?: string | null; to?: string | null; equal?: string | null };
      if (v.mode === 'equal') {
        this.dateMode.set('equal');
        this.dateEqual.set(v.equal ? new Date(v.equal) : null);
      } else {
        this.dateMode.set('range');
        this.dateFrom.set(v.from ? new Date(v.from) : null);
        this.dateTo.set(v.to ? new Date(v.to) : null);
      }
    }
    this.currentValue.set(value);
  }

  private loadSelectOptions(): void {
    const cfg = this.config();

    // Filtro 'select' con predicateOptions
    if (cfg.type === 'select') {
      if (cfg.predicateOptions?.length) {
        this.selectOptions.set(
          cfg.predicateOptions.map(o => ({ value: o.value, label: o.label }))
        );
      }
      return;
    }

    // Filtro 'select-distinct'
    if (cfg.type !== 'select-distinct') return;

    // 1. loadOptions da endpoint
    if (cfg.loadOptions) {
      const result = cfg.loadOptions();
      const obs = isObservable(result) ? result : from(result);
      this.optionsSub = obs.subscribe(options => this.selectOptions.set(options));
      return;
    }

    // 2. Opzioni statiche
    if (cfg.options?.length) {
      this.selectOptions.set(cfg.options);
      return;
    }

    // 3. Estrai valori unici dalla colonna
    this.extractUniqueOptions();
  }

  private extractUniqueOptions(): void {
    const data = this.columnData();
    const uniqueValues = [...new Set(data.filter(v => v != null))];
    uniqueValues.sort((a, b) => String(a).localeCompare(String(b)));
    this.selectOptions.set(
      uniqueValues.map(v => ({ value: v, label: String(v) }))
    );
  }
}
