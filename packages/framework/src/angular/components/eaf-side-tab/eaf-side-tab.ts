import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

/**
 * Linguetta laterale (lato destro dello schermo) che, quando premuta, apre
 * un pannello con azioni decise dall'app consumer (proiettate via `<ng-content>`).
 *
 * Esempio:
 *
 * ```html
 * <eaf-side-tab label="Azioni" icon="bolt"
 *   (opened)="onOpened()" (closed)="onClosed()">
 *   <button mat-button (click)="doSomething()">Azione 1</button>
 *   <button mat-button (click)="doSomethingElse()">Azione 2</button>
 * </eaf-side-tab>
 * ```
 */
@Component({
  selector: 'eaf-side-tab',
  imports: [MatIconModule, MatButtonModule],
  templateUrl: './eaf-side-tab.html',
  styleUrl: './eaf-side-tab.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EafSideTab implements OnInit, OnDestroy {
  /** Etichetta mostrata sulla linguetta (testo verticale). */
  readonly label = input<string>('Azioni');

  /** Icona Material mostrata sulla linguetta. */
  readonly icon = input<string>('bolt');

  /** Titolo del pannello aperto (default: stesso valore di `label`). */
  readonly panelTitle = input<string | null>(null);

  /** Larghezza del pannello in pixel. */
  readonly width = input<number>(320);

  /** Distanza dal bordo superiore (es. `'120px'`, `'30%'`). */
  readonly top = input<string>('30%');

  /** Se `true` il pannello si chiude cliccando fuori. */
  readonly closeOnOutsideClick = input<boolean>(true);

  /** Se `true` il pannello si chiude con tasto Esc. */
  readonly closeOnEscape = input<boolean>(true);

  /** Hook: emesso quando il pannello viene aperto. */
  readonly opened = output<void>();

  /** Hook: emesso quando il pannello viene chiuso. */
  readonly closed = output<void>();

  /** Hook: emesso ad ogni cambio di stato (true = aperto). */
  readonly toggled = output<boolean>();

  protected readonly isOpen = signal(false);

  private readonly host = inject(ElementRef<HTMLElement>);

  ngOnInit(): void {
    // Sposta l'elemento host in <body> in modo che `position: fixed` venga
    // posizionato rispetto al viewport e non rispetto al contenitore scrollabile
    // (es. mat-sidenav-content che applica una transform e crea un nuovo
    // containing block). Così la linguetta finisce sopra la scrollbar.
    if (typeof document !== 'undefined') {
      document.body.appendChild(this.host.nativeElement);
    }
  }

  ngOnDestroy(): void {
    const el = this.host.nativeElement;
    if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
  }

  open(): void {
    if (this.isOpen()) return;
    this.isOpen.set(true);
    this.opened.emit();
    this.toggled.emit(true);
  }

  close(): void {
    if (!this.isOpen()) return;
    this.isOpen.set(false);
    this.closed.emit();
    this.toggled.emit(false);
  }

  toggle(): void {
    this.isOpen() ? this.close() : this.open();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.closeOnEscape() && this.isOpen()) {
      this.close();
    }
  }

  @HostListener('document:mousedown', ['$event'])
  protected onDocumentClick(event: MouseEvent): void {
    if (!this.closeOnOutsideClick() || !this.isOpen()) return;
    const target = event.target as Node | null;
    if (target && !this.host.nativeElement.contains(target)) {
      this.close();
    }
  }
}
