/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {InjectionToken} from '@angular/core';
import type {AeontekConfig, AeontekWebSocketLike} from './provide-aeontek';

/**
 * Default path used by the websocket event service.
 */
export const DEFAULT_AEONTEK_EVENTS_PATH = '/aeontek-events';

/**
 * Default url the configuration service downloads the configuration from.
 */
export const DEFAULT_AEONTEK_CONFIGURATION_URL = '/config.json';

/**
 * Settings of the websocket event service, part of the configuration downloaded from the server (the
 * `events` section of the {@link AeontekConfiguration}), every value being optional.
 */
export interface AeontekEventsConfiguration {
    /**
     * Whether the websocket event service is enabled, defaults to `true` when the `events` section is
     * present in the downloaded configuration.
     */
    readonly enabled?: boolean;
    /**
     * Path the websocket connects to, relative to the current origin. Ignored when {@link url} is set.
     */
    readonly path?: string;
    /**
     * Absolute websocket url (ie `wss://host/aeontek-events`), overriding {@link path} when specified.
     */
    readonly url?: string;
    /**
     * Whether the connection is established automatically once the configuration has been loaded.
     */
    readonly autoConnect?: boolean;
    /**
     * Delay in milliseconds before reconnecting after the connection was lost, `0` disables reconnection.
     */
    readonly reconnectDelay?: number;
}

/**
 * Resolved settings of the websocket event service, where every value is set.
 */
export interface ResolvedAeontekEventsConfiguration extends AeontekEventsConfiguration {
    readonly enabled: boolean;
    readonly path: string;
    readonly autoConnect: boolean;
    readonly reconnectDelay: number;
}

/**
 * Returns the default settings of the websocket event service, which is disabled unless the downloaded
 * configuration contains an `events` section.
 */
export function defaultAeontekEventsConfiguration(): ResolvedAeontekEventsConfiguration {
    return {
        enabled: false,
        path: DEFAULT_AEONTEK_EVENTS_PATH,
        autoConnect: true,
        reconnectDelay: 5000
    };
}

/**
 * Resolves the `events` section of the downloaded configuration into full settings, enabling the service
 * when the section is present unless it is explicitly disabled.
 */
export function resolveAeontekEventsConfiguration(
    events?: AeontekEventsConfiguration | null
): ResolvedAeontekEventsConfiguration {
    const defaults = defaultAeontekEventsConfiguration();
    if (!events) {
        return defaults;
    }
    return {
        ...defaults,
        ...events,
        enabled: events.enabled ?? true
    };
}

/**
 * Returns the default configuration, where all optional services are disabled.
 */
export function defaultAeontekConfig(): AeontekConfig {
    return {
        configuration: {
            enabled: false,
            url: DEFAULT_AEONTEK_CONFIGURATION_URL,
            required: true
        },
        restApi: {
            // left undefined on purpose, so that it falls back to whether the configuration is enabled
            enabled: undefined
        }
    };
}

/**
 * Token holding the library configuration, defaults to {@link defaultAeontekConfig} when
 * `provideAeontek()` was not called.
 */
export const AEONTEK_CONFIG = new InjectionToken<AeontekConfig>('AEONTEK_CONFIG', {
    providedIn: 'root',
    factory: defaultAeontekConfig
});

/**
 * Token holding the factory used by the event service to create the websocket, defaults to the browser
 * `WebSocket`. Mostly useful in tests, or to use an alternative transport:
 *
 * ```ts
 * providers: [{provide: AEONTEK_WEB_SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url)}]
 * ```
 */
export const AEONTEK_WEB_SOCKET_FACTORY = new InjectionToken<(url: string) => AeontekWebSocketLike>(
    'AEONTEK_WEB_SOCKET_FACTORY'
);
