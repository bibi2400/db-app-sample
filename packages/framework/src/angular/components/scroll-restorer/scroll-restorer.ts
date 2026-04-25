import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  OnDestroy,
  AfterViewInit,
  inject,
  input,
  effect,
  NgZone,
} from '@angular/core';
import { Router, NavigationEnd, NavigationStart } from '@angular/router';
import { Subscription, fromEvent } from 'rxjs';
import { auditTime, filter } from 'rxjs/operators';

/**
 * Scroll position restorer.
 *
 * Saves the scroll offset of a scrollable container into `localStorage`
 * (keyed by route + optional `key` input) and restores it when the page
 * is re-entered.
 *
 * Usage:
 * ```html
 * <!-- Auto-detect: walks up the DOM looking for an overflow:auto/scroll
 *      ancestor; falls back to the document scrolling element / window. -->
 * <eaf-scroll-restorer />
 *
 * <!-- Or pass an explicit scrollable element / ElementRef -->
 * <eaf-scroll-restorer [scrollElement]="myContainerRef" />
 * ```
 */
@Component({
  selector: 'eaf-scroll-restorer',
  standalone: true,
  template: '',
  styles: [':host { display: none; }'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScrollRestorer implements AfterViewInit, OnDestroy {
  /** Optional explicit scroll container. */
  scrollElement = input<HTMLElement | ElementRef<HTMLElement> | null>(null);

  /** Optional extra key to disambiguate multiple instances on the same route. */
  key = input<string>('');

  /** Storage key prefix in `localStorage`. */
  storagePrefix = input<string>('eaf:scroll:');

  /** Debounce time for save events (ms). */
  saveDebounceMs = input<number>(150);

  /** Max attempts to restore scroll (waits for content to render). */
  restoreRetries = input<number>(20);

  /** Delay between restore attempts (ms). */
  restoreRetryDelayMs = input<number>(50);

  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly router = inject(Router, { optional: true });
  private readonly zone = inject(NgZone);

  private target: HTMLElement | Window | null = null;
  private scrollSub?: Subscription;
  private routerSub?: Subscription;
  private currentKey = '';

  private isNavigatingAway = false;

  constructor() {
    // React to changes of the explicit scrollElement input.
    effect(() => {
      // Touch the input so the effect re-runs when it changes.
      this.scrollElement();
      // Re-init only after view exists.
      if (this.target !== null) {
        this.teardown();
        this.setup();
      }
    });
  }

  ngAfterViewInit(): void {
    console.log('ScrollRestorer: initializing');
    this.setup();
    // Save before the route changes (so we can restore on return).
    if (this.router) {
      this.routerSub = this.router.events
        .pipe(filter((e) => e instanceof NavigationEnd))
        .subscribe(() => {
          // TODO: qui sembra non ci entri mai... indagare!
          // After navigation, the route changed → recompute key & restore.
          this.save();
          this.currentKey = this.computeKey();
          this.restoreWithRetry();
        });

        this.routerSub.add(
          this.router.events
            .pipe(filter((e) => e instanceof NavigationStart))
            .subscribe(() => {
              this.isNavigatingAway = true;
            })
        );
    }
  }

  ngOnDestroy(): void {
    this.save();
    this.teardown();
    this.routerSub?.unsubscribe();
  }

  private setup(): void {
    this.target = this.resolveTarget();
    this.currentKey = this.computeKey();

    if (!this.target) return;

    this.zone.runOutsideAngular(() => {
      this.scrollSub = fromEvent(this.target as EventTarget, 'scroll', { passive: true } as AddEventListenerOptions)
        .pipe(auditTime(this.saveDebounceMs()))
        .subscribe(() => {
          this.save();
        });
    });

    this.restoreWithRetry();
  }

  private teardown(): void {
    this.scrollSub?.unsubscribe();
    this.scrollSub = undefined;
    this.target = null;
    this.isNavigatingAway = false;
  }

  // ─── Target resolution ──────────────────────────────────────────────────

  private resolveTarget(): HTMLElement | Window | null {
    const explicit = this.scrollElement();
    if (explicit) {
      return explicit instanceof ElementRef ? explicit.nativeElement : explicit;
    }
    const auto = this.findScrollableAncestor(this.host.nativeElement);
    if (auto) return auto;
    // Fallback to window / document scrolling element.
    return typeof window !== 'undefined' ? window : null;
  }

  private findScrollableAncestor(start: HTMLElement | null): HTMLElement | null {
    let el: HTMLElement | null = start?.parentElement ?? null;
    while (el && el !== document.body && el !== document.documentElement) {
      if (this.isScrollable(el)) return el;
      el = el.parentElement;
    }
    // Body / documentElement scroll → return null and use window fallback.
    return null;
  }

  private isScrollable(el: HTMLElement): boolean {
    const style = getComputedStyle(el);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const canScrollY = (overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    const canScrollX = (overflowX === 'auto' || overflowX === 'scroll') && el.scrollWidth > el.clientWidth;
    return canScrollY || canScrollX;
  }

  // ─── Persistence ────────────────────────────────────────────────────────

  private computeKey(): string {
    const route =
      typeof window !== 'undefined'
        ? `${window.location.pathname}${window.location.hash || ''}`
        : '';
    const extra = this.key() ? `::${this.key()}` : '';
    return `${this.storagePrefix()}${route}${extra}`;
  }

  private getOffsets(): { top: number; left: number } {
    const t = this.target;
    console.log("getting scroll offsets for target", {
      t,
      scrollY: (t as Window)?.scrollY,
      scrollTop: (t as HTMLElement)?.scrollTop,
      scrollTopDocument: document.documentElement?.scrollTop,
    });
    if (!t) return { top: 0, left: 0 };
    if (t instanceof Window) {
      return {
        top: t.scrollY || document.documentElement.scrollTop || 0,
        left: t.scrollX || document.documentElement.scrollLeft || 0,
      };
    }
    return { top: t.scrollTop, left: t.scrollLeft };
  }

  private setOffsets(top: number, left: number): void {
    const t = this.target;
    if (!t) return;
    if (t instanceof Window) {
      t.scrollTo({ top, left, behavior: 'auto' });
    } else {
      t.scrollTop = top;
      t.scrollLeft = left;
    }
  }

  private save(): void {
    if (!this.target || !this.currentKey) return;
    if (this.isNavigatingAway) return; // Don't save if we're navigating away, to avoid body height collapsing.
    const { top, left } = this.getOffsets();
    try {
      localStorage.setItem(this.currentKey, JSON.stringify({ top, left }));
    } catch {
      /* storage may be full or unavailable */
    }
  }

  private restoreWithRetry(): void {
    if (!this.target || !this.currentKey) return;

    let raw: string | null = null;
    try {
      raw = localStorage.getItem(this.currentKey);
    } catch {
      return;
    }
    if (!raw) return;

    let saved: { top: number; left: number };
    try {
      saved = JSON.parse(raw);
    } catch {
      return;
    }

    const maxAttempts = Math.max(1, this.restoreRetries());
    const delay = Math.max(0, this.restoreRetryDelayMs());
    let attempt = 0;

    const tryRestore = (): void => {
      if (!this.target) return;
      this.setOffsets(saved.top, saved.left);
      const current = this.getOffsets();
      const reached =
        Math.abs(current.top - saved.top) <= 1 && Math.abs(current.left - saved.left) <= 1;
      attempt++;
      if (!reached && attempt < maxAttempts) {
        this.zone.runOutsideAngular(() => setTimeout(tryRestore, delay));
      }
    };

    // Defer first attempt so the host content has a chance to render.
    this.zone.runOutsideAngular(() => setTimeout(tryRestore, 0));
  }
}
