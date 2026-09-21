/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {DestroyRef, inject, Injector, resource, ResourceOptions, ResourceRef} from '@angular/core';
import {ReloadRegistration, ReloadService, ReloadTarget} from './reload.service';

/**
 * Creates an angular signal `resource()` which is automatically registered against the {@link ReloadService}
 * using the given id, and automatically unregistered when the current injection context is destroyed.
 *
 * ```ts
 * readonly users = reloadableResource('users', {
 *     params: () => ({page: this.page()}),
 *     loader: ({params}) => fetchUsers(params.page)
 * });
 * ```
 */
export function reloadableResource<T, R>(id: string, options: ResourceOptions<T, R> & {
    defaultValue: NoInfer<T>
}): ResourceRef<T>;
export function reloadableResource<T, R>(id: string, options: ResourceOptions<T, R>): ResourceRef<T | undefined>;
export function reloadableResource<T, R>(id: string, options: ResourceOptions<T, R>): ResourceRef<T | undefined> {
    const injector = options.injector ?? inject(Injector);
    const resourceRef = resource<T, R>({...options, injector} as ResourceOptions<T, R>);
    registerReloadable(id, resourceRef, injector);
    return resourceRef;
}

/**
 * Registers an already existing reloadable target (ie a `resource()`) against the {@link ReloadService}.
 *
 * When called from an injection context (or when an injector is provided) the registration is automatically
 * removed once that context is destroyed.
 */
export function registerReloadable(id: string, target: ReloadTarget, injector?: Injector): ReloadRegistration {
    const inj = injector ?? inject(Injector);
    return inj.get(ReloadService).register(id, target, {destroyRef: inj.get(DestroyRef, null)});
}
