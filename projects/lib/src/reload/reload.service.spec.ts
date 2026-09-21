/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {ApplicationRef, createEnvironmentInjector, EnvironmentInjector} from '@angular/core';
import {ReloadService} from './reload.service';
import {reloadableResource, registerReloadable} from './reloadable-resource';

describe('ReloadService', () => {
    let service: ReloadService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(ReloadService);
    });

    it('reloads only the matching id and its children', () => {
        const calls: string[] = [];
        for (const id of ['foo', 'bar', 'bar.z', 'bar.y', 'barbecue']) {
            service.register(id, () => calls.push(id), {destroyRef: null});
        }

        expect(service.reload('bar')).toBe(3);
        expect(calls.sort()).toEqual(['bar', 'bar.y', 'bar.z']);
    });

    it('reloads everything when no id is given', () => {
        const calls: string[] = [];
        service.register('foo', () => calls.push('foo'), {destroyRef: null});
        service.register('bar.z', () => calls.push('bar.z'), {destroyRef: null});

        expect(service.reload()).toBe(2);
        expect(calls.sort()).toEqual(['bar.z', 'foo']);
    });

    it('supports targets exposing a reload method', () => {
        let reloaded = 0;
        service.register('foo', {reload: () => reloaded++}, {destroyRef: null});

        service.reload('foo');

        expect(reloaded).toBe(1);
    });

    it('supports multiple targets registered with the same id', () => {
        let count = 0;
        service.register('foo', () => count++, {destroyRef: null});
        service.register('foo', () => count++, {destroyRef: null});

        expect(service.reload('foo')).toBe(2);
        expect(count).toBe(2);
    });

    it('stops reloading once unregistered', () => {
        let count = 0;
        const registration = service.register('foo', () => count++, {destroyRef: null});

        registration.unregister();

        expect(service.reload('foo')).toBe(0);
        expect(count).toBe(0);
        expect(service.registeredIds()).toEqual([]);
    });

    it('keeps reloading other targets when one fails', () => {
        let count = 0;
        service.register('foo', () => {
            throw new Error('boom');
        }, {destroyRef: null});
        service.register('foo.child', () => count++, {destroyRef: null});

        expect(service.reload('foo')).toBe(2);
        expect(count).toBe(1);
    });

    it('rejects invalid ids', () => {
        expect(() => service.register('inv alid', () => undefined, {destroyRef: null})).toThrow();
        expect(() => service.register('foo/bar', () => undefined, {destroyRef: null})).toThrow();
        expect(() => service.register('.foo', () => undefined, {destroyRef: null})).toThrow();
        expect(() => service.register('foo..bar', () => undefined, {destroyRef: null})).toThrow();
        expect(() => service.register('', () => undefined, {destroyRef: null})).toThrow();
        expect(() => service.reload('foo bar')).toThrow();
    });

    it('accepts alphanumeric, underscore, dash and dot ids', () => {
        expect(() => service.register('a-B_1.c-2', () => undefined, {destroyRef: null})).not.toThrow();
    });

    it('registers a resource and reloads it', async () => {
        let loads = 0;
        const res = TestBed.runInInjectionContext(() =>
            reloadableResource<number, unknown>('data.users', {
                defaultValue: 0,
                loader: async () => ++loads
            })
        );

        await TestBed.inject(ApplicationRef).whenStable();
        expect(loads).toBe(1);
        expect(res.value()).toBe(1);

        service.reload('data');

        await TestBed.inject(ApplicationRef).whenStable();
        expect(loads).toBe(2);
        expect(res.value()).toBe(2);
    });

    it('exposes the reloading state of asynchronous targets', async () => {
        let resolve: () => void = () => undefined;
        service.register('foo', () => new Promise<void>(r => (resolve = r)), {destroyRef: null});

        expect(service.reloading()).toBe(false);
        expect(service.reloadingIds()).toEqual([]);

        service.reload('foo');

        expect(service.reloading()).toBe(true);
        expect(service.reloadingIds()).toEqual(['foo']);
        expect(service.isReloading('foo')).toBe(true);
        expect(service.isReloading('bar')).toBe(false);

        resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.reloading()).toBe(false);
        expect(service.reloadingIds()).toEqual([]);
    });

    it('reports a parent id as reloading when a child is reloading', async () => {
        let resolve: () => void = () => undefined;
        service.register('bar.z', () => new Promise<void>(r => (resolve = r)), {destroyRef: null});

        service.reload('bar');

        expect(service.reloadingIds()).toEqual(['bar.z']);
        expect(service.isReloading('bar')).toBe(true);
        expect(service.isReloading()).toBe(true);

        resolve();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.isReloading('bar')).toBe(false);
    });

    it('exposes the reloading state of registered resources', async () => {
        const res = TestBed.runInInjectionContext(() =>
            reloadableResource<number, unknown>('data.users', {
                defaultValue: 0,
                loader: async () => 1
            })
        );

        await TestBed.inject(ApplicationRef).whenStable();
        expect(service.reloading()).toBe(false);

        res.reload();

        expect(service.reloadingIds()).toEqual(['data.users']);
        expect(service.isReloading('data')).toBe(true);

        await TestBed.inject(ApplicationRef).whenStable();

        expect(service.reloading()).toBe(false);
    });

    it('unregisters resources when their injection context is destroyed', () => {
        const injector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
        let count = 0;
        registerReloadable('scoped', () => count++, injector);

        expect(service.reload('scoped')).toBe(1);

        injector.destroy();

        expect(service.reload('scoped')).toBe(0);
        expect(count).toBe(1);
    });
});
