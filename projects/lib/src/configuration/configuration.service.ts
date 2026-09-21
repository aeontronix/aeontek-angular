/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {computed, inject, Injectable, Signal, signal} from '@angular/core';
import {AEONTEK_CONFIG, AeontekEventsConfiguration} from '../aeontek-config';

/**
 * Base configuration downloaded from the server, which every application configuration must extend:
 *
 * ```ts
 * export interface MyConfiguration extends AeontekConfiguration {
 *     readonly authUrl: string;
 * }
 * ```
 */
export interface AeontekConfiguration {
    /**
     * Base url of the backend api.
     */
    readonly apiUrl: string;
    /**
     * Settings of the websocket event service, which is enabled as soon as this section is present:
     *
     * ```json
     * {"apiUrl": "https://api.example.com", "events": {"path": "/my-events"}}
     * ```
     */
    readonly events?: AeontekEventsConfiguration;
}

/**
 * Service downloading the application configuration from the server (`/config.json` by default), so that
 * it doesn't have to be baked into the build.
 *
 * Disabled by default, it is enabled through `provideAeontek({configuration: true})`, which downloads the
 * configuration before the application starts.
 *
 * Applications needing more than the base {@link AeontekConfiguration} inject their own configuration type:
 *
 * ```ts
 * private readonly configuration = injectConfiguration<MyConfiguration>();
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class ConfigurationService<C extends AeontekConfiguration = AeontekConfiguration> {
    private readonly config = inject(AEONTEK_CONFIG).configuration;
    private readonly state = signal<C | null>(null);
    private loading: Promise<C | null> | null = null;

    /**
     * Configuration downloaded from the server, `null` until it has been loaded.
     */
    public readonly configuration: Signal<C | null> = this.state.asReadonly();

    /**
     * Whether the configuration has been loaded.
     */
    public readonly loaded: Signal<boolean> = computed(() => this.state() !== null);

    /**
     * Whether the configuration is downloaded when the application starts, see `provideAeontek()`.
     */
    public get enabled(): boolean {
        return this.config.enabled;
    }

    /**
     * Url the configuration is downloaded from.
     */
    public get url(): string {
        return this.config.url;
    }

    /**
     * Configuration downloaded from the server, throwing an error when it has not been loaded yet.
     */
    public get value(): C {
        const value = this.state();
        if (!value) {
            throw new Error(
                `The configuration ('${this.config.url}') has not been loaded, ` +
                `enable it with provideAeontek({configuration: true}) or call load() first`
            );
        }
        return value;
    }

    /**
     * Base url of the backend api, throwing an error when the configuration has not been loaded yet.
     */
    public get apiUrl(): string {
        return this.value.apiUrl;
    }

    /**
     * Downloads the configuration from the server, subsequent calls returning the already loaded
     * configuration unless `reload` is set.
     *
     * The returned promise is rejected when the download fails, unless the configuration was declared
     * optional (`provideAeontek({configuration: {required: false}})`) in which case the error is only
     * logged and `null` returned.
     */
    public load(reload = false): Promise<C | null> {
        const current = this.state();
        if (current && !reload) {
            return Promise.resolve(current);
        }
        if (this.loading && !reload) {
            return this.loading;
        }
        const loading = this.download()
            .then(configuration => {
                this.state.set(configuration);
                return configuration;
            })
            .catch(e => {
                if (this.config.required) {
                    throw e;
                }
                console.error(`Failed to load the configuration '${this.config.url}'`, e);
                return this.state();
            })
            .finally(() => {
                if (this.loading === loading) {
                    this.loading = null;
                }
            });
        this.loading = loading;
        return loading;
    }

    /**
     * Sets the configuration manually, typically used in tests.
     */
    public set(configuration: C): void {
        this.state.set(configuration);
    }

    private async download(): Promise<C> {
        const url = this.config.url;
        const fetcher = this.config.fetcher ?? defaultFetcher;
        return assertConfiguration<C>(await fetcher(url), url);
    }
}

/**
 * Injects the {@link ConfigurationService} typed with the application configuration:
 *
 * ```ts
 * private readonly configuration = injectConfiguration<MyConfiguration>();
 * ```
 */
export function injectConfiguration<C extends AeontekConfiguration = AeontekConfiguration>(): ConfigurationService<C> {
    return inject(ConfigurationService) as ConfigurationService<C>;
}

async function defaultFetcher(url: string): Promise<unknown> {
    if (typeof fetch === 'undefined') {
        throw new Error('fetch is not available in this environment');
    }
    const response = await fetch(url, {headers: {accept: 'application/json'}, cache: 'no-cache'});
    if (!response.ok) {
        throw new Error(`Unexpected response ${response.status} ${response.statusText}`);
    }
    return await response.json();
}

function assertConfiguration<C extends AeontekConfiguration>(value: unknown, url: string): C {
    if (!value || typeof value !== 'object') {
        throw new Error(`The configuration '${url}' is not a json object`);
    }
    const apiUrl = (value as { apiUrl?: unknown }).apiUrl;
    if (typeof apiUrl !== 'string' || apiUrl.length === 0) {
        throw new Error(`The configuration '${url}' does not contain a valid 'apiUrl'`);
    }
    return value as C;
}
