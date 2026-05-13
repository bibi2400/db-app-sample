import { Injectable, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ShortcutService } from '../shortcut.service';

const STORAGE_KEY = 'eaf-zoom-level';
const ZOOM_STEP = 1;
const ZOOM_MIN = -3;
const ZOOM_MAX = 3;

@Injectable({ providedIn: 'root' })
export class ElectronZoomService {
  private readonly shortcutService = inject(ShortcutService);
  private readonly destroyRef = inject(DestroyRef);

  readonly zoomLevel = signal<number>(this.loadZoomLevel());
  readonly canZoomIn = computed(() => this.zoomLevel() < ZOOM_MAX);
  readonly canZoomOut = computed(() => this.zoomLevel() > ZOOM_MIN);
  readonly zoomPercent = computed(() => Math.round(Math.pow(1.2, this.zoomLevel()) * 100));

  constructor() {
    this.applyZoom(this.zoomLevel());

    this.shortcutService.on('zoom.in').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.zoomIn());
    this.shortcutService.on('zoom.out').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.zoomOut());
    this.shortcutService.on('zoom.reset').pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.zoomReset());
  }

  zoomIn(): void {
    if (!this.canZoomIn()) return;
    this.applyZoom(this.zoomLevel() + ZOOM_STEP);
  }

  zoomOut(): void {
    if (!this.canZoomOut()) return;
    this.applyZoom(this.zoomLevel() - ZOOM_STEP);
  }

  zoomReset(): void {
    this.applyZoom(0);
  }

  private applyZoom(level: number): void {
    this.zoomLevel.set(level);
    localStorage.setItem(STORAGE_KEY, String(level));
    // Applica lo zoom via CSS solo al contenuto della pagina (.main-container),
    // lasciando toolbar e sidebar alla dimensione naturale.
    // webFrame rimane sempre a 0 per evitare doppio zoom.
    const factor = Math.pow(1.2, level);
    document.documentElement.style.setProperty('--eaf-content-zoom', String(factor));
    window.electronAPI.setZoomLevel(0);
  }

  private loadZoomLevel(): number {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) return 0;
    const parsed = parseFloat(saved);
    return isNaN(parsed) ? 0 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, parsed));
  }
}
