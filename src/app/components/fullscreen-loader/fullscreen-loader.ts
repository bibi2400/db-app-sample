import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-fullscreen-loader',
  imports: [MatProgressSpinnerModule],
  templateUrl: './fullscreen-loader.html',
  styleUrl: './fullscreen-loader.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FullscreenLoaderComponent {
  message = input<string>('Operazione in corso...');
}
