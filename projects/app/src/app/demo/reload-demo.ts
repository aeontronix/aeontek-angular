/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { Component, inject, signal } from '@angular/core';
import { ReloadService, reloadableResource } from '@aeontronix/aeontek-angular';
import { DemoApi, DemoStats, DemoUser } from './demo-api';

@Component({
  selector: 'app-reload-demo',
  templateUrl: './reload-demo.html',
})
export class ReloadDemo {
  private readonly api = inject(DemoApi);
  protected readonly reloadService = inject(ReloadService);

  protected readonly page = signal(0);

  /**
   * Resources automatically registered against the reload service with hierarchical ids.
   */
  protected readonly users = reloadableResource<DemoUser[], { page: number }>('data.users', {
    defaultValue: [],
    params: () => ({ page: this.page() }),
    loader: ({ params }) => this.api.fetchUsers(params.page),
  });

  protected readonly stats = reloadableResource<DemoStats, unknown>('data.stats', {
    loader: () => this.api.fetchStats(),
  });

  protected readonly activity = reloadableResource<string[], unknown>('reports.activity', {
    defaultValue: [],
    loader: () => this.api.fetchActivity(),
  });

  /**
   * Any callback can be registered too, a returned promise drives the reloading state.
   */
  protected readonly notifications = signal<number | null>(null);

  constructor() {
    this.reloadService.register('notifications', () => this.loadNotifications());
    this.loadNotifications().then(() => console.debug('Notifications loaded'));
  }

  protected reload(id?: string): void {
    this.reloadService.reload(id);
  }

  protected nextPage(): void {
    this.page.update((p) => p + 1);
  }

  private async loadNotifications(): Promise<void> {
    this.notifications.set(await this.api.refreshNotifications());
  }
}
