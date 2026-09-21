/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {computed, DestroyRef, DOCUMENT, inject, Injectable, PLATFORM_ID, Signal, signal} from '@angular/core';
import {isPlatformBrowser} from '@angular/common';
import {
    AEONTEK_WEB_SOCKET_FACTORY,
    ResolvedAeontekEventsConfiguration,
    resolveAeontekEventsConfiguration
} from '../aeontek-config';
import type {AeontekWebSocketLike} from '../provide-aeontek';
import {ConfigurationService} from '../configuration/configuration.service';
import {assertValidReloadId, ReloadService} from '../reload/reload.service';

/**
 * Event asking for a refresh, with an optional reload id (and its children) to limit the refresh to.
 */
export interface AeontekRefreshEvent {
    type: 'refresh';
    id?: string;
}

/**
 * Events supported by the websocket event service.
 */
export type AeontekEvent = AeontekRefreshEvent;

/**
 * Optional websocket service receiving events from the server, currently refresh events which are forwarded
 * to the {@link ReloadService}.
 *
 * It is configured by the `events` section of the configuration downloaded by the
 * {@link ConfigurationService}, and disabled while that section is absent:
 *
 * ```json
 * {"apiUrl": "https://api.example.com", "events": {"path": "/my-events", "reconnectDelay": 2000}}
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class AeontekEventService {
    private readonly configuration = inject(ConfigurationService);
    private readonly webSocketFactory = inject(AEONTEK_WEB_SOCKET_FACTORY, {optional: true});
    private readonly events: Signal<ResolvedAeontekEventsConfiguration> = computed(
        () => resolveAeontekEventsConfiguration(this.configuration.configuration()?.events)
    );
    private readonly reloadService = inject(ReloadService);
    private readonly document = inject(DOCUMENT, {optional: true});
    private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
    private socket: AeontekWebSocketLike | null = null;
    private reconnectHandle: ReturnType<typeof setTimeout> | null = null;
    private closed = false;
    private readonly connectedState = signal(false);
    private readonly lastEventState = signal<AeontekEvent | null>(null);

    /**
     * Whether the websocket is currently connected.
     */
    public readonly connected: Signal<boolean> = this.connectedState.asReadonly();

    /**
     * Last event received from the server, if any.
     */
    public readonly lastEvent: Signal<AeontekEvent | null> = this.lastEventState.asReadonly();

    constructor() {
        inject(DestroyRef).onDestroy(() => this.disconnect());
    }

    /**
     * Whether the service is enabled, which it is as soon as the downloaded configuration contains an
     * `events` section (unless it sets `enabled` to `false`).
     */
    public get enabled(): boolean {
        return this.events().enabled;
    }

    /**
     * Whether the connection is established automatically once the configuration has been loaded.
     */
    public get autoConnect(): boolean {
        return this.events().autoConnect;
    }

    /**
     * Url the websocket connects to.
     */
    public get url(): string {
        const config = this.events();
        if (config.url) {
            return config.url;
        }
        const path = config.path.startsWith('/') ? config.path : '/' + config.path;
        const location = this.document?.defaultView?.location;
        if (!location) {
            return path;
        }
        const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        return `${protocol}//${location.host}${path}`;
    }

    /**
     * Connects to the server, doing nothing if the service is disabled or already connected.
     */
    public connect(): void {
        if (!this.enabled || this.socket || !this.isBrowser) {
            return;
        }
        this.closed = false;
        const url = this.url;
        let socket: AeontekWebSocketLike;
        try {
            socket = this.createSocket(url);
        } catch (e) {
            console.error(`Failed to connect to the aeontek event websocket '${url}'`, e);
            this.scheduleReconnect();
            return;
        }
        this.socket = socket;
        socket.onopen = () => this.connectedState.set(true);
        socket.onmessage = event => this.handleMessage(event.data);
        socket.onerror = e => console.error(`Aeontek event websocket error '${url}'`, e);
        socket.onclose = () => {
            if (this.socket === socket) {
                this.socket = null;
            }
            this.connectedState.set(false);
            this.scheduleReconnect();
        };
    }

    /**
     * Connects to the server when the downloaded configuration enables the service and asks for an
     * automatic connection, called once the configuration has been loaded.
     */
    public autoConnectIfEnabled(): void {
        if (this.enabled && this.autoConnect) {
            this.connect();
        }
    }

    /**
     * Disconnects from the server, and cancels any pending reconnection.
     */
    public disconnect(): void {
        this.closed = true;
        this.cancelReconnect();
        const socket = this.socket;
        this.socket = null;
        this.connectedState.set(false);
        if (socket) {
            socket.onopen = socket.onclose = socket.onerror = null;
            socket.onmessage = null;
            try {
                socket.close();
            } catch (e) {
                console.error('Failed to close the aeontek event websocket', e);
            }
        }
    }

    /**
     * Handles a raw message received from the server, exposed for testing purposes.
     */
    public handleMessage(data: unknown): void {
        const event = parseEvent(data);
        if (!event) {
            console.warn('Ignoring unsupported aeontek event', data);
            return;
        }
        this.lastEventState.set(event);
        this.handleEvent(event);
    }

    private handleEvent(event: AeontekEvent): void {
        switch (event.type) {
            case 'refresh':
                if (event.id !== undefined) {
                    try {
                        assertValidReloadId(event.id);
                    } catch (e) {
                        console.error('Ignoring refresh event with an invalid id', event.id, e);
                        return;
                    }
                }
                this.reloadService.reload(event.id);
                break;
        }
    }

    private createSocket(url: string): AeontekWebSocketLike {
        const factory = this.webSocketFactory;
        if (factory) {
            return factory(url);
        }
        if (typeof WebSocket === 'undefined') {
            throw new Error('WebSocket is not available in this environment');
        }
        return new WebSocket(url) as unknown as AeontekWebSocketLike;
    }

    private scheduleReconnect(): void {
        const delay = this.events().reconnectDelay;
        if (this.closed || !delay || delay <= 0 || this.reconnectHandle !== null) {
            return;
        }
        this.reconnectHandle = setTimeout(() => {
            this.reconnectHandle = null;
            this.connect();
        }, delay);
    }

    private cancelReconnect(): void {
        if (this.reconnectHandle !== null) {
            clearTimeout(this.reconnectHandle);
            this.reconnectHandle = null;
        }
    }
}

function parseEvent(data: unknown): AeontekEvent | null {
    let value: unknown = data;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === 'refresh') {
            return {type: 'refresh'};
        }
        try {
            value = JSON.parse(trimmed);
        } catch {
            return null;
        }
    }
    if (!value || typeof value !== 'object') {
        return null;
    }
    const type = (value as { type?: unknown }).type;
    if (type !== 'refresh') {
        return null;
    }
    const id = (value as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0 ? {type: 'refresh', id} : {type: 'refresh'};
}
