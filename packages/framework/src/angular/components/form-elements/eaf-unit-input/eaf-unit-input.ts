import {
  ChangeDetectionStrategy,
  Component,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import {
  ControlValueAccessor,
  FormControl,
  NG_VALUE_ACCESSOR,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatFormFieldAppearance, MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { NgClass, NgStyle } from '@angular/common';

@Component({
  selector: 'eaf-unit-input',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    NgClass,
    NgStyle,
  ],
  templateUrl: './eaf-unit-input.html',
  styleUrl: './eaf-unit-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EafUnitInput),
      multi: true,
    },
  ],
})
export class EafUnitInput implements ControlValueAccessor {
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

  /** Campo obbligatorio */
  readonly required = input(false);

  /** Testo hint sotto il campo */
  readonly hint = input<string>('');

  /** Appearance del mat-form-field */
  readonly appearance = input<MatFormFieldAppearance>('outline');

  // ─── ControlValueAccessor ────────────────────────────────────────────────

  /** FormControl interno usato dal template */
  protected readonly internalControl = new FormControl<string | number | null>(null);

  private onChange: (value: string | number | null) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly isDisabled = signal(false);

  constructor() {
    this.internalControl.valueChanges.subscribe((v) => {
      this.onChange(v);
    });
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
    this.onTouched();
  }
}
