/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input, signal} from '@angular/core';
import {ErrorHandlingService} from './error-handling.service';
import {ErrorWithDetails} from './error-with-details';
import {ReloadService} from '../reload/reload.service';

/**
 * Component displaying an error, typically the one of a signal `resource()`, in as little space as
 * possible: only the title of the error is displayed, the details (when there are any) being shown on
 * demand, along with a refresh button triggering a full reload through the {@link ReloadService}.
 *
 * The error is converted by the {@link ErrorHandlingService}, so anything can be given to it (an
 * `HttpErrorResponse`, an `Error`, an already converted {@link ErrorWithDetails}, ...):
 *
 * ```html
 * @if (users.error(); as error) {
 *     <lib-error-view [error]="error"/>
 * }
 * ```
 *
 * Nothing is rendered while the error is `null` or `undefined`, so it can also be bound directly:
 *
 * ```html
 * <lib-error-view [error]="users.error()"/>
 * ```
 */
@Component({
    selector: 'lib-error-view',
    templateUrl: './error-view.html',
    styleUrl: './error-view.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErrorView {
    private readonly errorHandling = inject(ErrorHandlingService);
    private readonly reloadService = inject(ReloadService);

    /**
     * The error to display, converted by the {@link ErrorHandlingService}. Nothing is rendered while it
     * is `null` or `undefined`.
     */
    public readonly error = input<unknown>();

    /**
     * Whether the refresh button, triggering a full reload, is displayed (`true` by default).
     */
    public readonly refreshable = input(true, {transform: booleanAttribute});

    /**
     * Whether the details are expanded initially (`false` by default, they are shown on demand).
     */
    public readonly detailsExpanded = input(false, {transform: booleanAttribute});

    private readonly expanded = signal(false);

    /**
     * The human friendly version of the error, `null` while there is no error.
     */
    protected readonly resolved = computed<ErrorWithDetails | null>(() => {
        const error = this.error();
        return error === null || error === undefined ? null : this.errorHandling.handle(error);
    });

    /**
     * Everything we know about the error beyond its title, `null` when there is nothing more to show.
     */
    protected readonly details = computed<string | null>(() => {
        const error = this.resolved();
        if (!error) {
            return null;
        }
        const parts: string[] = [];
        if (error.status !== undefined) {
            parts.push(`Status: ${error.status}`);
        }
        if (error.details) {
            parts.push(error.details);
        }
        if (parts.length === 0) {
            const cause = describeCause(error.cause);
            if (cause && cause !== error.title) {
                parts.push(cause);
            }
        }
        return parts.length > 0 ? parts.join('\n\n') : null;
    });

    protected readonly detailsVisible = computed(() => this.expanded() || this.detailsExpanded());

    protected readonly reloading = computed(() => this.reloadService.reloading());

    protected toggleDetails(): void {
        this.expanded.update(visible => !visible);
    }

    /**
     * Reloads everything registered against the {@link ReloadService}.
     */
    protected refresh(): void {
        this.reloadService.reloadAll();
    }
}

/**
 * The original error as a displayable string, used as details when the error carried none.
 */
function describeCause(cause: unknown): string | null {
    if (cause === null || cause === undefined) {
        return null;
    }
    if (typeof cause === 'string') {
        return cause.trim() || null;
    }
    if (cause instanceof Error) {
        return cause.stack ?? `${cause.name}: ${cause.message}`;
    }
    try {
        const json = JSON.stringify(cause, null, 2);
        return json && json !== '{}' ? json : null;
    } catch {
        return null;
    }
}
