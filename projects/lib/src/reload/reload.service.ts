/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {computed, DestroyRef, inject, Injectable, Signal, signal} from '@angular/core';

/**
 * Anything exposing a `reload()` method, such as an angular signal `resource()`.
 */
export interface Reloadable {
    reload(): unknown;
}

/**
 * A reloadable target: either an object with a `reload()` method (ie a `resource()`), or a plain function.
 */
export type ReloadTarget = Reloadable | (() => unknown);

/**
 * Handle returned when registering a target against the {@link ReloadService}.
 */
export interface ReloadRegistration {
    readonly id: string;

    unregister(): void;
}

export interface ReloadRegistrationOptions {
    /**
     * Destroy reference used to automatically unregister the target. When not specified, and the registration
     * happens within an injection context, the current `DestroyRef` will be used.
     */
    destroyRef?: DestroyRef | null;
}

/**
 * Pattern which reload ids must match: alphanumeric, underscore, dash or dot, where the dot is used as
 * hierarchy separator (ie `foo`, `bar.z`).
 */
export const RELOAD_ID_PATTERN = /^[A-Za-z0-9_-]+(\.[A-Za-z0-9_-]+)*$/;

/**
 * Validates a reload id, throwing an error if invalid.
 */
export function assertValidReloadId(id: string): void {
    if (!RELOAD_ID_PATTERN.test(id)) {
        throw new Error(
            `Invalid reload id '${id}': only alphanumeric, underscore, dash or dot characters are allowed, ` +
            `and dots must separate non empty segments`
        );
    }
}

interface ReloadEntry {
    readonly id: string;
    readonly reload: () => unknown;
    /**
     * Loading state exposed by the target itself (ie a `resource()` `isLoading` signal), when available.
     */
    readonly isLoading?: () => boolean;
}

/**
 * Service where reloadable resources can be registered, from where a full or partial reload can be triggered.
 *
 * Ids are hierarchical, using the dot as separator: reloading `bar` will also reload `bar.z` and `bar.y`.
 */
@Injectable({
    providedIn: 'root'
})
export class ReloadService {
    private readonly entries = new Map<string, Set<ReloadEntry>>();
    /**
     * Bumped whenever a target is registered or unregistered, so that the reloading signals recompute.
     */
    private readonly registrations = signal(0);
    /**
     * Number of in flight asynchronous reloads per id (targets which return a promise).
     */
    private readonly pending = signal<ReadonlyMap<string, number>>(new Map());

    /**
     * Ids which are currently reloading, sorted alphabetically.
     *
     * An id is considered reloading while one of its targets exposes a truthy `isLoading()` (ie a signal
     * `resource()`), or while a target which returned a promise has not settled yet.
     */
    public readonly reloadingIds: Signal<readonly string[]> = computed(() => {
        this.registrations();
        const ids = new Set<string>();
        for (const [id, entries] of this.entries) {
            for (const entry of entries) {
                if (entry.isLoading?.()) {
                    ids.add(id);
                    break;
                }
            }
        }
        for (const [id, count] of this.pending()) {
            if (count > 0) {
                ids.add(id);
            }
        }
        return [...ids].sort();
    });

    /**
     * Whether anything is currently reloading, typically used to display a global loading indicator.
     */
    public readonly reloading: Signal<boolean> = computed(() => this.reloadingIds().length > 0);

    /**
     * Registers a reloadable target (ie a signal `resource()`) against the given id.
     *
     * When called from an injection context, the registration is automatically removed when the current
     * context is destroyed.
     */
    public register(id: string, target: ReloadTarget, options?: ReloadRegistrationOptions): ReloadRegistration {
        assertValidReloadId(id);
        const entry: ReloadEntry = {
            id,
            reload: typeof target === 'function' ? () => target() : () => target.reload(),
            isLoading: typeof target === 'function' ? undefined : extractLoadingSignal(target)
        };
        let entries = this.entries.get(id);
        if (!entries) {
            entries = new Set<ReloadEntry>();
            this.entries.set(id, entries);
        }
        entries.add(entry);
        this.registrations.update(v => v + 1);
        let unregistered = false;
        const registration: ReloadRegistration = {
            id,
            unregister: () => {
                if (unregistered) {
                    return;
                }
                unregistered = true;
                const current = this.entries.get(id);
                if (current) {
                    current.delete(entry);
                    if (current.size === 0) {
                        this.entries.delete(id);
                    }
                }
                this.registrations.update(v => v + 1);
            }
        };
        const destroyRef = options && 'destroyRef' in options ? options.destroyRef : tryInjectDestroyRef();
        destroyRef?.onDestroy(() => registration.unregister());
        return registration;
    }

    /**
     * Reloads all targets registered with the given id, as well as all its children (ie reloading `bar` will
     * also reload `bar.z`). When no id is specified, all registered targets are reloaded.
     *
     * @returns the number of targets which were reloaded
     */
    public reload(id?: string): number {
        if (id === undefined) {
            return this.reloadAll();
        }
        assertValidReloadId(id);
        const prefix = id + '.';
        let count = 0;
        for (const [entryId, entries] of [...this.entries]) {
            if (entryId === id || entryId.startsWith(prefix)) {
                count += this.reloadEntries(entries);
            }
        }
        console.debug('Reloaded resources', id, count);
        return count;
    }

    /**
     * Reloads every registered target.
     *
     * @returns the number of targets which were reloaded
     */
    public reloadAll(): number {
        let count = 0;
        for (const entries of [...this.entries.values()]) {
            count += this.reloadEntries(entries);
        }
        console.debug('Reloaded all resources', count);
        return count;
    }

    /**
     * Returns all currently registered ids.
     */
    public registeredIds(): string[] {
        return [...this.entries.keys()];
    }

    /**
     * Whether the given id, or any of its children, is currently reloading. When no id is specified this is
     * equivalent to {@link reloading}.
     *
     * This reads signals, and can therefore be used directly within a template or a computed.
     */
    public isReloading(id?: string): boolean {
        const ids = this.reloadingIds();
        if (id === undefined) {
            return ids.length > 0;
        }
        assertValidReloadId(id);
        const prefix = id + '.';
        return ids.some(reloadingId => reloadingId === id || reloadingId.startsWith(prefix));
    }

    private reloadEntries(entries: Set<ReloadEntry>): number {
        let count = 0;
        for (const entry of [...entries]) {
            try {
                this.trackPending(entry.id, entry.reload());
            } catch (e) {
                console.error(`Failed to reload resource '${entry.id}'`, e);
            }
            count++;
        }
        return count;
    }

    /**
     * Tracks the reloading state of targets which returned a promise.
     */
    private trackPending(id: string, result: unknown): void {
        if (!isPromiseLike(result)) {
            return;
        }
        this.updatePending(id, 1);
        const done = () => this.updatePending(id, -1);
        Promise.resolve(result).then(done, done);
    }

    private updatePending(id: string, delta: number): void {
        this.pending.update(current => {
            const updated = new Map(current);
            const count = (updated.get(id) ?? 0) + delta;
            if (count > 0) {
                updated.set(id, count);
            } else {
                updated.delete(id);
            }
            return updated;
        });
    }
}

function extractLoadingSignal(target: Reloadable): (() => boolean) | undefined {
    const isLoading = (target as { isLoading?: unknown }).isLoading;
    return typeof isLoading === 'function' ? () => !!(isLoading as () => unknown).call(target) : undefined;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
    return !!value && typeof (value as PromiseLike<unknown>).then === 'function';
}

function tryInjectDestroyRef(): DestroyRef | null {
    try {
        return inject(DestroyRef, {optional: true});
    } catch {
        return null;
    }
}
