import { Component, ChangeDetectionStrategy } from '@angular/core';
import { FrameworkShell } from '@bibi2400/electron-angular-framework/angular';

@Component({
  selector: 'app-root',
  imports: [FrameworkShell],
  template: '<eaf-shell author="bibi" />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App { }

