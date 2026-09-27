import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  CdkConnectedOverlay,
  CdkOverlayOrigin,
  OverlayContainer,
} from '@angular/cdk/overlay';
import { By } from '@angular/platform-browser';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EafTable } from
  '../../../packages/framework/src/angular/components/eaf-table/eaf-table';
import { EafTableStorageService } from
  '../../../packages/framework/src/angular/services/eaf-table-storage.service';
import type { EafTableState } from
  '../../../packages/framework/src/angular/types/eaf-table.types';

interface Row {
  id: number;
  name: string;
}

describe('EafTable layout preferences', () => {
  const tableId = 'layout-test';
  let storage: EafTableStorageService;
  let fixture: ComponentFixture<EafTable<Row>>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [EafTable] });
    storage = TestBed.inject(EafTableStorageService);
    storage.clear(tableId);
  });

  afterEach(() => {
    fixture?.destroy();
    TestBed.resetTestingModule();
    storage.clear(tableId);
  });

  async function create(
    inputs: Record<string, unknown> = {},
  ): Promise<EafTable<Row>> {
    fixture = TestBed.createComponent(EafTable<Row>);
    fixture.componentRef.setInput('tableId', tableId);
    fixture.componentRef.setInput('columns', [
      { key: 'id', header: 'ID', filter: { type: 'number' } },
      { key: 'name', header: 'Name', filter: true },
    ]);
    fixture.componentRef.setInput('data', [
      { id: 2, name: 'Beta' },
      { id: 1, name: 'Alpha' },
    ]);
    fixture.componentRef.setInput('tableStateStorageType', 'local');
    for (const [key, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(key, value);
    }
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture.componentInstance;
  }

  it('preserves defaults for old stored state and keeps columns and filters',
    async () => {
      storage.save(tableId, {
        filters: { name: 'Alpha' },
        pageSize: 25,
      }, 'local');
      const table = await create();
      expect(table.getState()).toMatchObject({
        horizontalDensity: 'standard',
        tableZoom: 1,
        filters: { name: 'Alpha' },
        pageSize: 25,
      });
      expect(table.getState().columns).toHaveLength(2);
      expect(table.tableDataSource.filteredData).toEqual([
        { id: 1, name: 'Alpha' },
      ]);
    });

  it('restores layout preferences when the same table is reopened', async () => {
    const table = await create({ horizontalDensity: 'compact', tableZoom: 0.8 });
    expect(table.getState()).toMatchObject({
      horizontalDensity: 'compact', tableZoom: 0.8,
    });
    expect(storage.load(tableId, 'local')).toMatchObject({
      horizontalDensity: 'compact', tableZoom: 0.8,
    });
    fixture.destroy();
    const reopened = await create();
    expect(reopened.getState()).toMatchObject({
      horizontalDensity: 'compact', tableZoom: 0.8,
    });
  });

  it('applies input > initialState > storage per property', async () => {
    storage.save(tableId, {
      horizontalDensity: 'compact', tableZoom: 0.8,
    }, 'local');
    const table = await create({ initialState: { tableZoom: 0.9 } });
    expect(table.getState()).toMatchObject({
      horizontalDensity: 'compact', tableZoom: 0.9,
    });
    fixture.componentRef.setInput('horizontalDensity', 'standard');
    fixture.componentRef.setInput('tableZoom', 1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(table.getState()).toMatchObject({
      horizontalDensity: 'standard', tableZoom: 1,
    });
  });

  it.each([0.8, 0.85, 0.9, 1])('supports zoom %s', async (tableZoom) => {
    const table = await create({ tableZoom });
    expect(table.getState().tableZoom).toBe(tableZoom);
  });

  it.each([0, 0.79, 1.01, -1, NaN, Infinity, '0.9'])(
    'normalizes invalid input zoom %s to 1', async (tableZoom) => {
      const table = await create({ tableZoom });
      expect(table.getState().tableZoom).toBe(1);
      expect(storage.load(tableId, 'local')?.tableZoom).toBe(1);
    },
  );

  it('normalizes corrupt saved preferences without losing other state',
    async () => {
      localStorage.setItem('eaf-table:' + tableId, JSON.stringify({
        horizontalDensity: 'invalid', tableZoom: '0.8',
        filters: { name: 'Beta' },
      }));
      const table = await create();
      expect(table.getState()).toMatchObject({
        horizontalDensity: 'standard', tableZoom: 1,
        filters: { name: 'Beta' },
      });
    });

  it('resets stored preferences while retaining initialState', async () => {
    storage.save(tableId, {
      horizontalDensity: 'compact', tableZoom: 0.8,
    }, 'local');
    const table = await create({ initialState: { tableZoom: 0.9 } });
    table.resetState();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(table.getState()).toMatchObject({
      horizontalDensity: 'standard', tableZoom: 0.9,
    });
  });

  it('retains controlled inputs on reset', async () => {
    const table = await create({ horizontalDensity: 'compact', tableZoom: 0.8 });
    table.resetState();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(table.getState()).toMatchObject({
      horizontalDensity: 'compact', tableZoom: 0.8,
    });
  });

  it('uses session storage independently and honors storage none', async () => {
    await create({ tableStateStorageType: 'session', tableZoom: 0.9 });
    expect(storage.load(tableId, 'session')?.tableZoom).toBe(0.9);
    expect(storage.load(tableId, 'local')).toBeNull();
    fixture.destroy();
    await create({ tableStateStorageType: 'none', tableZoom: 0.8 });
    expect(storage.load(tableId, 'session')?.tableZoom).toBe(0.9);
    expect(storage.load(tableId, 'local')).toBeNull();
  });

  it('emits layout preferences without generating a server request', async () => {
    const table = await create({ serverSide: true });
    const serverEvent = vi.fn();
    const states: EafTableState[] = [];
    table.serverEvent.subscribe(serverEvent);
    table.stateChange.subscribe((state) => states.push(state));
    fixture.componentRef.setInput('tableZoom', 0.8);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(states.at(-1)?.tableZoom).toBe(0.8);
    expect(serverEvent).not.toHaveBeenCalled();
  });

  it('separates header and footer without layout inputs or an explicit height',
    async () => {
      await create({ pagination: true });
      const root: HTMLElement = fixture.nativeElement;
      const wrapper = root.querySelector<HTMLElement>('.eaf-table-wrapper')!;
      expect(wrapper.querySelector('th')).toBeNull();
      expect(root.querySelector('.eaf-table-header-viewport th')).not.toBeNull();
      expect(root.querySelector('mat-paginator')!.closest('.eaf-table-wrapper')).toBeNull();
      fixture.componentRef.setInput('tableZoom', 0.8);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(wrapper.querySelector('th')).toBeNull();
      expect(root.querySelector('mat-paginator')!.closest('.eaf-table-wrapper')).toBeNull();
    });

  it('retains the current page with header and footer separate at every zoom',
    async () => {
      const table = await create({ pagination: { enabled: true, pageSize: 1 } });
      const root: HTMLElement = fixture.nativeElement;
      const paginator = () => root.querySelector('mat-paginator')!;
      expect(paginator().closest('.eaf-table-wrapper')).toBeNull();
      root.querySelector<HTMLButtonElement>(
        '.mat-mdc-paginator-navigation-next',
      )!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(table.getState().pageIndex).toBe(1);

      fixture.componentRef.setInput('tableZoom', 0.8);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(paginator().closest('.eaf-table-wrapper')).toBeNull();
      expect(root.querySelector('.eaf-table-wrapper th')).toBeNull();
      expect(root.querySelectorAll('.eaf-filter-btn')).toHaveLength(2);
      expect(root.querySelector('.eaf-table-header-viewport th')).not.toBeNull();
      expect(table.getState().pageIndex).toBe(1);
      expect(root.querySelector('tr.mat-mdc-row')!.textContent).toContain('Alpha');
      root.querySelector<HTMLButtonElement>(
        '.mat-mdc-paginator-navigation-previous',
      )!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(table.getState().pageIndex).toBe(0);

      fixture.componentRef.setInput('tableZoom', 1);
      fixture.detectChanges();
      await fixture.whenStable();
      expect(paginator().closest('.eaf-table-wrapper')).toBeNull();
      expect(root.querySelector('.eaf-table-header-viewport')).not.toBeNull();
      expect(root.querySelector('tr.mat-mdc-row')!.textContent).toContain('Beta');
    });

  it('keeps a scrolling header when stickyHeader is disabled', async () => {
    await create({ stickyHeader: false, pagination: true });
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.eaf-table-header-viewport')).toBeNull();
    expect(root.querySelectorAll('.eaf-table-wrapper th')).toHaveLength(2);
    expect(root.querySelector('mat-paginator')!.closest('.eaf-table-wrapper')).toBeNull();
  });

  it('keeps filter portals outside the zoomed table and preserves sorting/clicks',
    async () => {
      const table = await create({ tableZoom: 0.8, horizontalDensity: 'compact' });
      const root: HTMLElement = fixture.nativeElement;
      const rowClick = vi.fn();
      table.rowClick.subscribe(rowClick);
      root.querySelector<HTMLElement>('.mat-sort-header-container')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(table.getState().sort).toEqual({ column: 'id', direction: 'asc' });
      root.querySelector<HTMLElement>('tr.mat-mdc-row')!.click();
      expect(rowClick).toHaveBeenCalledWith({ id: 1, name: 'Alpha' });
      root.querySelector<HTMLButtonElement>('[aria-label="Filtra Name"]')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      const container = TestBed.inject(OverlayContainer).getContainerElement();
      const dropdown = container.querySelector<HTMLElement>('.eaf-filter-dropdown');
      expect(dropdown).not.toBeNull();
      expect(dropdown!.closest('table')).toBeNull();
      expect(root.querySelector('.eaf-filter-dropdown')).toBeNull();
      fixture.componentRef.setInput('horizontalDensity', 'standard');
      fixture.componentRef.setInput('tableZoom', 1);
      fixture.detectChanges();
      await fixture.whenStable();
      const newTrigger = root.querySelector<HTMLButtonElement>(
        '[aria-label="Filtra Name"]',
      )!;
      const overlay = fixture.debugElement.queryAllNodes(
        By.directive(CdkConnectedOverlay),
      )[0].injector.get(CdkConnectedOverlay);
      const origin = overlay.origin instanceof CdkOverlayOrigin
        ? overlay.origin.elementRef.nativeElement : overlay.origin;
      expect(origin).toBe(newTrigger);
      expect(newTrigger.isConnected).toBe(true);
      expect(root.querySelector('tr.mat-mdc-row')!.textContent).toContain('Alpha');
      fixture.componentRef.setInput('stickyHeader', false);
      fixture.detectChanges();
      await fixture.whenStable();
      const scrollingTrigger = root.querySelector<HTMLButtonElement>(
        '[aria-label="Filtra Name"]',
      )!;
      expect(overlay.origin).toBe(scrollingTrigger);
      expect(scrollingTrigger.isConnected).toBe(true);
      table.setFilter('name', 'Alpha');
      fixture.detectChanges();
      await fixture.whenStable();
      expect(table.tableDataSource.filteredData).toEqual([
        { id: 1, name: 'Alpha' },
      ]);
      rowClick.mockClear();
      root.querySelector<HTMLElement>('tr.mat-mdc-row')!.click();
      fixture.detectChanges();
      await fixture.whenStable();
      expect(rowClick).not.toHaveBeenCalled();
      expect(container.querySelector('.eaf-filter-dropdown')).toBeNull();
    });
});
