import { Injectable } from '../helpers/mini-pie/decorators';
import { Logger } from '../helpers/logger';
import { DevModeService } from './dev-mode.service';
import { ControllerService } from './controller.service';
import { TestController } from '../controllers/test.controller';

/**
 * Service that manages the right-click context menu for all windows
 * using electron-context-menu (ESM-only, loaded via dynamic import).
 */
@Injectable()
export class ContextMenuService {
  constructor(
    private readonly devModeService: DevModeService,
    private readonly controllerService: ControllerService,
  ) {}

  /**
   * Initializes the context menu for all current and future windows.
   * Must be called after controllers are registered.
   */
  async init(): Promise<void> {
    const { default: contextMenu } = await import('electron-context-menu');

    contextMenu({
      showInspectElement: this.devModeService.isDev,
      append: (_defaultActions, _parameters, browserWindow) => [
        { type: 'separator' },
        {
          label: '🔔 Test Notifiche',
          click: () => this.triggerTestNotifications(),
        },
      ],
    });

    Logger.info('[ContextMenu] Context menu initialized');
  }

  private triggerTestNotifications(): void {
    const testController = this.controllerService.getController<TestController>('TestController');
    if (testController) {
      testController.testNotifications().catch((err: unknown) => {
        Logger.error('[ContextMenu] Test notifications failed:', err);
      });
    } else {
      Logger.warn('[ContextMenu] TestController not found');
    }
  }
}
