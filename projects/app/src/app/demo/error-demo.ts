/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { Component, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ErrorView, reloadableResource } from 'lib';

type FailureKind = 'http' | 'plain' | 'none';

/**
 * Failures the demo can produce, all going through the `ErrorHandlingService` before being displayed by
 * the `ErrorView`.
 */
const FAILURES: Readonly<Record<Exclude<FailureKind, 'none'>, () => unknown>> = {
  http: () =>
    new HttpErrorResponse({
      status: 404,
      statusText: 'Not Found',
      url: '/users/42',
      error: { title: 'Unknown user', detail: 'No user exists with id 42' },
    }),
  plain: () => new Error('Something went terribly wrong while loading the users'),
};

@Component({
  selector: 'app-error-demo',
  imports: [ErrorView],
  templateUrl: './error-demo.html',
})
export class ErrorDemo {
  protected readonly failure = signal<FailureKind>('http');

  /**
   * A resource which fails on demand, its error being handed over to the `ErrorView`.
   */
  protected readonly users = reloadableResource<string[], { failure: FailureKind }>('demo.errors', {
    defaultValue: [],
    params: () => ({ failure: this.failure() }),
    loader: async ({ params }) => {
      await new Promise((resolve) => setTimeout(resolve, 600));
      if (params.failure !== 'none') {
        throw FAILURES[params.failure]();
      }
      return ['User 1', 'User 2', 'User 3'];
    },
  });

  /**
   * A short error, shown inline to illustrate that the `ErrorView` only takes the space it is given.
   */
  protected readonly shortError = new Error('Session expired');

  protected fail(kind: FailureKind): void {
    this.failure.set(kind);
  }
}
