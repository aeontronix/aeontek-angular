/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { Injectable } from '@angular/core';

export interface DemoUser {
  id: number;
  name: string;
  role: string;
}

export interface DemoStats {
  users: number;
  sessions: number;
  errors: number;
}

/**
 * Fake backend used by the demo, every call is artificially delayed so that the reloading signals are
 * actually visible in the UI.
 */
@Injectable({
  providedIn: 'root',
})
export class DemoApi {
  private readonly roles = ['admin', 'editor', 'viewer', 'guest'];
  private fetchCount = 0;

  async fetchUsers(page: number): Promise<DemoUser[]> {
    await delay(900);
    this.fetchCount++;
    return Array.from({ length: 3 }, (_, i) => {
      const id = page * 3 + i + 1;
      return {
        id,
        name: `User ${id} (#${this.fetchCount})`,
        role: this.roles[id % this.roles.length],
      };
    });
  }

  async fetchStats(): Promise<DemoStats> {
    await delay(1400);
    return {
      users: random(100, 999),
      sessions: random(10, 99),
      errors: random(0, 9),
    };
  }

  async fetchActivity(): Promise<string[]> {
    await delay(2000);
    return Array.from({ length: 3 }, () => `Event at ${new Date().toLocaleTimeString()}`);
  }

  async refreshNotifications(): Promise<number> {
    await delay(1200);
    return random(0, 20);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function random(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}
