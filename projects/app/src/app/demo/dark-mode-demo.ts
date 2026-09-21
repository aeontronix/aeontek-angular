/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DarkModeButton, DarkModeService } from '@aeontronix/aeontek-angular';

/**
 * Demo of the `DarkModeService` and the `DarkModeButton`: the tailwind `dark:` variants follow the
 * scheme, which defaults to the system one until it is switched, in which case it is persisted.
 */
@Component({
  selector: 'app-dark-mode-demo',
  imports: [DarkModeButton],
  templateUrl: './dark-mode-demo.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DarkModeDemo {
  protected readonly darkMode = inject(DarkModeService);
}
