/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { Component, signal } from '@angular/core';
import { injectConfiguration } from '@aeontronix/aeontek-angular';
import { AppConfiguration } from './app-configuration';

@Component({
  selector: 'app-configuration-demo',
  templateUrl: './configuration-demo.html',
})
export class ConfigurationDemo {
  /**
   * Configuration service typed with the application configuration, already loaded on startup by
   * `provideAeontek({configuration: true})`.
   */
  protected readonly configuration = injectConfiguration<AppConfiguration>();

  protected readonly reloading = signal(false);

  protected async reload(): Promise<void> {
    this.reloading.set(true);
    try {
      await this.configuration.load(true);
    } finally {
      this.reloading.set(false);
    }
  }
}
