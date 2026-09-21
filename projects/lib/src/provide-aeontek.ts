/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {EnvironmentProviders, inject, makeEnvironmentProviders, provideAppInitializer} from '@angular/core';
import {AEONTEK_CONFIG, defaultAeontekConfig} from './aeontek-config';
import {AeontekEventService} from './events/aeontek-event.service';
import {ConfigurationService} from './configuration/configuration.service';

/**
 * Minimal subset of the browser `WebSocket` api used by the event service, so that it can be replaced
 * (ie in tests, or to use an alternative transport).
 */
export interface AeontekWebSocketLike {
    close(): void;

    send?(data: string): void;

    onopen: ((event: unknown) => unknown) | null;
    onclose: ((event: unknown) => unknown) | null;
    onerror: ((event: unknown) => unknown) | null;
    onmessage: ((event: { data: unknown }) => unknown) | null;
}

/**
 * Options of the {@link ConfigurationService}, which downloads the application configuration from
 * the server. Disabled by default, it can be enabled through {@link provideAeontek}.
 */
export interface DynamicConfigOptions {
    /**
     * Whether the configuration is downloaded automatically when the application starts.
     */
    enabled: boolean;
    /**
     * Url the configuration is downloaded from, relative to the current origin by default.
     */
    url: string;
    /**
     * Whether a failure to download the configuration fails the application startup, when `false` the
     * error is only logged.
     */
    required: boolean;
    /**
     * Function used to download the configuration, defaults to the browser `fetch`.
     */
    fetcher?: (url: string) => Promise<unknown>;
}

/**
 * Options of the {@link restApiInterceptor}, which prefixes path only request urls with the base url of
 * the backend api. Enabled by default when the dynamic configuration is enabled.
 */
export interface RestApiOptions {
    /**
     * Whether path only request urls are prefixed with the api url, falling back to whether the dynamic
     * configuration is enabled when left `undefined` (or `null`).
     */
    enabled?: boolean;
    /**
     * Base url of the api, defaults to the `apiUrl` of the configuration downloaded by the
     * {@link ConfigurationService}.
     */
    apiUrl?: string;
}

/**
 * Configuration of the library, resolved from the {@link AeontekOptions} given to {@link provideAeontek}.
 */
export interface AeontekConfig {
    readonly configuration: DynamicConfigOptions;
    readonly restApi: RestApiOptions;
}

/**
 * Options accepted by {@link provideAeontek}, every value is optional.
 */
export interface AeontekOptions {
    /**
     * Configuration service options, `true` simply enables it with all defaults, a string is a shortcut
     * for the url the configuration is downloaded from.
     */
    configuration?: Partial<DynamicConfigOptions> | boolean | string;
    /**
     * Rest api interceptor options, `true` simply enables it with all defaults, a string is a shortcut for
     * the base url of the api. Defaults to whether the configuration service is enabled.
     */
    restApi?: Partial<RestApiOptions> | boolean | string;
}

/**
 * Initializes the library, to be added to the application providers:
 *
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *     providers: [provideAeontek()]
 * };
 * ```
 *
 * The configuration service is disabled by default, and can be enabled (downloading `/config.json`
 * before the application starts) with:
 *
 * ```ts
 * provideAeontek({configuration: true});
 * provideAeontek({configuration: '/assets/config.json'});
 * ```
 *
 * The {@link restApiInterceptor} (which must be registered with
 * `provideHttpClient(withInterceptors([restApiInterceptor]))`) follows the configuration service unless
 * it is configured explicitly:
 *
 * ```ts
 * provideAeontek({restApi: false});                       // never prefix request urls
 * provideAeontek({restApi: 'https://api.example.com'});   // static api url
 * ```
 *
 * The websocket event service is not configured here, its settings come from the `events` section of the
 * configuration downloaded by the {@link ConfigurationService}:
 *
 * ```json
 * {"apiUrl": "https://api.example.com", "events": {"path": "/my-events", "reconnectDelay": 2000}}
 * ```
 */
export function provideAeontek(options?: AeontekOptions): EnvironmentProviders {
    const config = resolveAeontekConfig(options);
    const providers: EnvironmentProviders[] = [];
    if (config.configuration.enabled) {
        providers.push(provideAppInitializer(() => {
            const configuration = inject(ConfigurationService);
            const events = inject(AeontekEventService);
            // the event service is configured by the downloaded configuration, so it can only connect after it
            return configuration.load().then(() => events.autoConnectIfEnabled());
        }));
    }
    return makeEnvironmentProviders([
        {provide: AEONTEK_CONFIG, useValue: config},
        ...providers
    ]);
}

/**
 * Resolves user provided options into a full configuration.
 */
export function resolveAeontekConfig(options?: AeontekOptions): AeontekConfig {
    const config = defaultAeontekConfig();
    const configuration = resolveConfigurationOptions(config.configuration, options?.configuration);
    return {
        ...config,
        configuration,
        restApi: resolveRestApiOptions(config.restApi, options?.restApi)
    };
}

function resolveConfigurationOptions(
    defaults: DynamicConfigOptions,
    configuration?: Partial<DynamicConfigOptions> | boolean | string
): DynamicConfigOptions {
    if (configuration === undefined) {
        return defaults;
    }
    if (typeof configuration === 'boolean') {
        return {...defaults, enabled: configuration};
    }
    if (typeof configuration === 'string') {
        return {...defaults, enabled: true, url: configuration};
    }
    return {
        ...defaults,
        ...configuration,
        // enabling the service is implied when options are given, unless explicitly disabled
        enabled: configuration.enabled ?? true
    };
}

function resolveRestApiOptions(
    defaults: RestApiOptions,
    restApi: Partial<RestApiOptions> | boolean | string | undefined
): RestApiOptions {
    if (restApi === undefined) {
        // 'enabled' is left undefined, so that it follows the configuration service (which provides the api url)
        return defaults;
    }
    if (typeof restApi === 'boolean') {
        return {...defaults, enabled: restApi};
    }
    if (typeof restApi === 'string') {
        return {...defaults, enabled: true, apiUrl: restApi};
    }
    return {
        ...defaults,
        ...restApi
    };
}
