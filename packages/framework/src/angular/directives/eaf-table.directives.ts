import { Directive, input, TemplateRef, inject } from '@angular/core';
import { EafCellContext, EafFilterContext, EafActionsContext } from '../types/eaf-table.types';

/**
 * Direttiva per definire un template custom per il contenuto di una cella.
 *
 * ```html
 * <eaf-table [data]="items" [columns]="columns" tableId="my-table">
 *   <ng-template eafCellDef="name" let-row let-value="value">
 *     <span class="bold">{{ value }}</span>
 *   </ng-template>
 * </eaf-table>
 * ```
 */
@Directive({
  selector: '[eafCellDef]',
})
export class EafCellDefDirective {
  readonly columnKey = input.required<string>({ alias: 'eafCellDef' });
  readonly templateRef = inject(TemplateRef<EafCellContext>);
}

/**
 * Direttiva per definire un template custom per il filtro di una colonna.
 *
 * ```html
 * <eaf-table [data]="items" [columns]="columns" tableId="my-table">
 *   <ng-template eafFilterDef="status" let-column let-value="value" let-filterChange="filterChange">
 *     <mat-select [value]="value" (selectionChange)="filterChange.next($event.value)">
 *       <mat-option [value]="null">Tutti</mat-option>
 *       <mat-option value="active">Attivo</mat-option>
 *     </mat-select>
 *   </ng-template>
 * </eaf-table>
 * ```
 */
@Directive({
  selector: '[eafFilterDef]',
})
export class EafFilterDefDirective {
  readonly columnKey = input.required<string>({ alias: 'eafFilterDef' });
  readonly templateRef = inject(TemplateRef<EafFilterContext>);
}

/**
 * Direttiva per definire la colonna azioni.
 *
 * ```html
 * <eaf-table [data]="items" [columns]="columns" tableId="my-table">
 *   <ng-template eafActionsDef let-row>
 *     <button mat-icon-button (click)="edit(row)">
 *       <mat-icon>edit</mat-icon>
 *     </button>
 *   </ng-template>
 * </eaf-table>
 * ```
 */
@Directive({
  selector: '[eafActionsDef]',
})
export class EafActionsDefDirective {
  readonly templateRef = inject(TemplateRef<EafActionsContext>);
}
