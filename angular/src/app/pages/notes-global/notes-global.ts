import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import type {
  EafColumnDef,
  EafPaginationConfig,
  EafTableServerEvent,
  EafCellContext,
} from '@bibi2400/electron-angular-framework/angular';
import {
  EafActionsDefDirective,
  EafCellDefDirective,
  EafTable,
  ElectronNoteService,
} from '@bibi2400/electron-angular-framework/angular';
import type { NoteInfo } from '@bibi2400/electron-angular-framework/shared';

/**
 * Pagina Note Globali — lista server-side di tutte le note nel sistema.
 * Consente di filtrare per owner, contenuto, data e stato di pin.
 *
 * Cliccando su una nota con ownerType='product' si naviga al prodotto associato.
 */
@Component({
  selector: 'app-notes-global',
  imports: [
    EafTable,
    EafActionsDefDirective,
    EafCellDefDirective,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
  ],
  templateUrl: './notes-global.html',
  styleUrl: './notes-global.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesGlobal implements OnInit {
  private readonly electronNote = inject(ElectronNoteService);
  private readonly router = inject(Router);

  protected readonly items = signal<NoteInfo[]>([]);
  protected readonly totalRows = signal<number>(0);
  protected readonly loading = signal<boolean>(false);

  protected readonly columns: EafColumnDef<NoteInfo>[] = [
    {
      key: 'id',
      header: 'ID',
      width: '65px',
      sortable: true,
      filter: { type: 'number', modes: ['equal'] },
    },
    {
      key: 'ownerType',
      header: 'Tipo owner',
      width: 1,
      sortable: true,
      filter: true,
    },
    {
      key: 'ownerId',
      header: 'Owner ID',
      width: '90px',
      sortable: true,
      filter: { type: 'number', modes: ['equal'] },
    },
    {
      key: 'content',
      header: 'Contenuto',
      width: 4,
      sortable: true,
      filter: true,
    },
    {
      key: 'noteDate',
      header: 'Data nota',
      width: 1,
      sortable: true,
      filter: { type: 'date' },
    },
    {
      key: 'pinned',
      header: 'Pinnata',
      width: '90px',
      sortable: true,
      filter: { type: 'boolean' },
    },
    {
      key: 'createdAt',
      header: 'Inserita il',
      width: 1,
      sortable: true,
      filter: { type: 'date' },
    },
  ];

  protected readonly pagination: EafPaginationConfig = {
    enabled: true,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50],
  };

  ngOnInit(): void {
    this.fetch({ filters: {}, pageIndex: 0, pageSize: this.pagination.pageSize ?? 20 });
  }

  protected onServerEvent(event: EafTableServerEvent): void {
    this.fetch(event);
  }

  protected openOwner(note: NoteInfo): void {
    if (note.ownerType === 'product' && note.ownerId != null) {
      this.router.navigate(['/product-detail', note.ownerId]);
    }
  }

  protected formatDate(isoString: string | null | undefined): string {
    if (!isoString) return '—';
    return new Intl.DateTimeFormat('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(isoString));
  }

  private async fetch(event: EafTableServerEvent): Promise<void> {
    this.loading.set(true);
    try {
      const result = await this.electronNote.listAll(event);
      this.items.set(result.items);
      this.totalRows.set(result.total);
    } catch (err) {
      console.error('[NotesGlobal] fetch failed:', err);
    } finally {
      this.loading.set(false);
    }
  }
}
