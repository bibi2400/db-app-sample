import {
  Component,
  afterNextRender,
  ChangeDetectionStrategy,
  Injector,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { timer } from 'rxjs';
import { AppNotification, NotificationLevel } from '../../types/notification';
import { NotificationService } from '../../services/notification.service';
import { NavigationService } from '../../services/navigation.service';
import { NOTIFICATION_LEVELS, NOTIFICATION_PRESENTATION } from '../../../shared/notifications';

type LevelFilter = NotificationLevel | 'all' | 'standard';

interface NotificationGroup {
  key: number;
  label: string;
  notifications: AppNotification[];
}

@Component({
  selector: 'app-notifications',
  imports: [
    DatePipe,
    ClipboardModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatMenuModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Notifications implements OnInit {
  readonly notificationService = inject(NotificationService);
  private readonly navigationService = inject(NavigationService);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly injector = inject(Injector);
  private readonly now = signal(Date.now());

  readonly notifications = this.notificationService.notifications;
  readonly unreadCount = this.notificationService.unreadCount;
  readonly readCount = this.notificationService.readCount;
  readonly presentation = NOTIFICATION_PRESENTATION;
  readonly levels = NOTIFICATION_LEVELS;
  readonly expandedId = signal<string | null>(null);
  readonly unreadOnly = signal(false);
  readonly search = signal('');
  readonly level = signal<LevelFilter>('standard');
  readonly hasFilters = computed(() =>
    this.unreadOnly() || this.search().trim().length > 0 || this.level() !== 'standard'
  );
  readonly filteredNotifications = computed(() => {
    const query = this.search().trim().toLocaleLowerCase('it');
    const level = this.level();
    return this.notifications().filter(n => {
      const matchesRead = !this.unreadOnly() || !n.read || n.id === this.expandedId();
      const matchesLevel = level === 'all' ||
        (level === 'standard' ? n.level !== 'debug' : n.level === level);
      const text = `${n.title} ${n.message}`.toLocaleLowerCase('it');
      return matchesRead && matchesLevel && (!query || text.includes(query));
    });
  });
  readonly groups = computed(() => {
    const today = this.dayStart(this.now());
    const yesterdayDate = new Date(today);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = yesterdayDate.getTime();
    const groups = new Map<number, NotificationGroup>();
    for (const notification of this.filteredNotifications()) {
      const key = this.dayStart(notification.timestamp);
      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          label: key === today ? 'Oggi' : key === yesterday ? 'Ieri' :
            new Date(key).toLocaleDateString('it', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            }),
          notifications: [],
        };
        groups.set(key, group);
      }
      group.notifications.push(notification);
    }
    return [...groups.values()];
  });

  constructor() {
    timer(0, 60000).pipe(takeUntilDestroyed()).subscribe(() => this.now.set(Date.now()));
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe(params => {
      const id = params.get('notification');
      const notification = this.notifications().find(n => n.id === id);
      if (!notification) return;
      this.resetFilters();
      if (notification.level === 'debug') this.level.set('debug');
      this.expandedId.set(notification.id);
      this.notificationService.markAsRead(notification.id);
      afterNextRender(() => {
        const detail = document.getElementById(`detail-${notification.id}`);
        detail?.focus({ preventScroll: true });
        detail?.scrollIntoView?.({ block: 'nearest' });
      }, { injector: this.injector });
    });
  }

  ngOnInit(): void {
    this.navigationService.clearToolbarActions();
  }

  activate(notification: AppNotification): void {
    if (notification.route) {
      void this.notificationService.open(notification).catch(() => {
        this.snackBar.open('Non ? stato possibile aprire la pagina.', 'Chiudi', { duration: 4000 });
      });
      return;
    }
    this.toggleExpand(notification);
  }

  toggleExpand(notification: AppNotification): void {
    if (this.expandedId() === notification.id) {
      this.expandedId.set(null);
    } else {
      this.expandedId.set(notification.id);
      this.notificationService.markAsRead(notification.id);
    }
  }

  toggleReadStatus(notification: AppNotification): void {
    if (notification.read) {
      this.notificationService.markAsUnread(notification.id);
    } else {
      this.notificationService.markAsRead(notification.id);
    }
  }

  removeNotification(id: string): void {
    if (this.expandedId() === id) this.expandedId.set(null);
    this.notificationService.remove(id);
  }

  clearRead(): void {
    this.expandedId.set(null);
    this.notificationService.clearRead();
  }

  clearAll(): void {
    this.expandedId.set(null);
    this.notificationService.clearAll();
  }

  setUnreadOnly(value: boolean): void {
    this.expandedId.set(null);
    this.unreadOnly.set(value);
  }

  setLevel(value: LevelFilter): void {
    this.expandedId.set(null);
    this.level.set(value);
  }

  setSearch(value: string): void {
    this.expandedId.set(null);
    this.search.set(value);
  }

  resetFilters(): void {
    this.expandedId.set(null);
    this.unreadOnly.set(false);
    this.search.set('');
    this.level.set('standard');
  }

  copied(success: boolean): void {
    this.snackBar.open(
      success ? 'Dettagli copiati' : 'Non ? stato possibile copiare i dettagli',
      'Chiudi',
      { duration: 3000 },
    );
  }

  private dayStart(timestamp: number): number {
    const date = new Date(timestamp);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
}
