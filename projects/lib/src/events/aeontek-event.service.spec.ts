/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {AeontekEventService} from './aeontek-event.service';
import {AEONTEK_WEB_SOCKET_FACTORY, AeontekEventsConfiguration, DEFAULT_AEONTEK_EVENTS_PATH} from '../aeontek-config';
import {AeontekConfiguration, ConfigurationService} from '../configuration/configuration.service';
import {AeontekWebSocketLike, provideAeontek} from '../provide-aeontek';
import {ReloadService} from '../reload/reload.service';

class FakeSocket implements AeontekWebSocketLike {
    public static last: FakeSocket | null = null;
    public closeCount = 0;
    public onopen: ((event: unknown) => unknown) | null = null;
    public onclose: ((event: unknown) => unknown) | null = null;
    public onerror: ((event: unknown) => unknown) | null = null;
    public onmessage: ((event: { data: unknown }) => unknown) | null = null;

    constructor(public readonly url: string) {
        FakeSocket.last = this;
    }

    public close(): void {
        this.closeCount++;
    }

    public open(): void {
        this.onopen?.({});
    }

    public receive(data: unknown): void {
        this.onmessage?.({data});
    }
}

/**
 * Configures the event service with the given `events` section of the downloaded configuration, which is
 * set manually instead of being downloaded.
 */
function configure(events?: AeontekEventsConfiguration): AeontekEventService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            provideAeontek(),
            {provide: AEONTEK_WEB_SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url)}
        ]
    });
    const configuration: AeontekConfiguration = {apiUrl: 'https://api.example.com', events};
    TestBed.inject(ConfigurationService).set(configuration);
    return TestBed.inject(AeontekEventService);
}

describe('AeontekEventService', () => {
    beforeEach(() => {
        FakeSocket.last = null;
    });

    it('is disabled unless the configuration contains an events section', () => {
        const service = configure();

        expect(service.enabled).toBe(false);

        service.connect();

        expect(FakeSocket.last).toBeNull();
        expect(service.connected()).toBe(false);
    });

    it('is disabled when the configuration disables it', () => {
        const service = configure({enabled: false});

        expect(service.enabled).toBe(false);
    });

    it('connects to the default path when the configuration enables it', () => {
        const service = configure({});

        expect(service.enabled).toBe(true);
        expect(service.url.endsWith(DEFAULT_AEONTEK_EVENTS_PATH)).toBe(true);

        service.connect();

        expect(FakeSocket.last?.url).toBe(service.url);
        FakeSocket.last!.open();
        expect(service.connected()).toBe(true);

        service.disconnect();

        expect(service.connected()).toBe(false);
        expect(FakeSocket.last!.closeCount).toBe(1);
    });

    it('uses the configured path', () => {
        const service = configure({path: '/custom-events'});

        expect(service.url.endsWith('/custom-events')).toBe(true);
    });

    it('uses the configured url', () => {
        const service = configure({url: 'wss://host/events'});

        expect(service.url).toBe('wss://host/events');
    });

    it('reloads everything on a refresh event without id', () => {
        const service = configure({});
        const reloadService = TestBed.inject(ReloadService);
        const calls: string[] = [];
        reloadService.register('foo', () => calls.push('foo'), {destroyRef: null});
        reloadService.register('bar.z', () => calls.push('bar.z'), {destroyRef: null});

        service.connect();
        FakeSocket.last!.receive(JSON.stringify({type: 'refresh'}));

        expect(calls.sort()).toEqual(['bar.z', 'foo']);
        expect(service.lastEvent()).toEqual({type: 'refresh'});
    });

    it('reloads the given id and its children on a refresh event with an id', () => {
        const service = configure({});
        const reloadService = TestBed.inject(ReloadService);
        const calls: string[] = [];
        for (const id of ['foo', 'bar', 'bar.z']) {
            reloadService.register(id, () => calls.push(id), {destroyRef: null});
        }

        service.connect();
        FakeSocket.last!.receive(JSON.stringify({type: 'refresh', id: 'bar'}));

        expect(calls.sort()).toEqual(['bar', 'bar.z']);
        expect(service.lastEvent()).toEqual({type: 'refresh', id: 'bar'});
    });

    it('ignores unsupported messages', () => {
        const service = configure({});
        const reloadService = TestBed.inject(ReloadService);
        let count = 0;
        reloadService.register('foo', () => count++, {destroyRef: null});

        service.connect();
        FakeSocket.last!.receive('not json');
        FakeSocket.last!.receive(JSON.stringify({type: 'something-else'}));
        FakeSocket.last!.receive(JSON.stringify({type: 'refresh', id: 'in valid'}));

        expect(count).toBe(0);
    });

    it('connects automatically once the configuration has been loaded', async () => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            providers: [
                provideAeontek({
                    configuration: {
                        fetcher: async () => ({apiUrl: 'https://api.example.com', events: {}})
                    }
                }),
                {provide: AEONTEK_WEB_SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url)}
            ]
        });

        await TestBed.inject(ConfigurationService).load();
        TestBed.inject(AeontekEventService).autoConnectIfEnabled();

        expect(FakeSocket.last).not.toBeNull();
    });

    it('does not connect automatically when autoConnect is disabled', () => {
        const service = configure({autoConnect: false});

        service.autoConnectIfEnabled();

        expect(FakeSocket.last).toBeNull();
        expect(service.enabled).toBe(true);
    });
});
