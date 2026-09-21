import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfigurationDemo } from './demo/configuration-demo';
import { ReloadDemo } from './demo/reload-demo';
import { ErrorDemo } from './demo/error-demo';
import { DarkModeDemo } from './demo/dark-mode-demo';

@Component({
  imports: [RouterOutlet, ConfigurationDemo, ReloadDemo, ErrorDemo, DarkModeDemo],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('app');
}
