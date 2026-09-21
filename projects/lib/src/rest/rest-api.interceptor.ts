/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {HttpInterceptorFn} from '@angular/common/http';
import {inject} from '@angular/core';
import {AEONTEK_CONFIG} from '../aeontek-config';
import {ConfigurationService} from '../configuration/configuration.service';

/**
 * Matches an absolute url (`https://host/foo`, `//host/foo`, `data:...`), which the interceptor leaves
 * untouched.
 */
const ABSOLUTE_URL = /^([a-z][a-z\d+\-.]*:|\/\/)/i;

/**
 * Functional interceptor prefixing path only request urls (ie `/users`) with the base url of the backend
 * api, absolute urls (ie `https://host/users`) being left untouched.
 *
 * The api url is taken from the {@link ConfigurationService} (the `apiUrl` of the configuration downloaded
 * from the server), unless one was given through `provideAeontek({restApi: 'https://api.example.com'})`.
 * Requests are also left untouched when no api url is available (ie the configuration has not been loaded).
 *
 * It is enabled by default when the dynamic configuration is enabled, and can be forced either way with
 * `provideAeontek({restApi: true})` / `provideAeontek({restApi: false})`.
 *
 * ```ts
 * providers: [
 *     provideAeontek({configuration: true}),
 *     provideHttpClient(withInterceptors([restApiInterceptor]))
 * ]
 * ```
 */
export const restApiInterceptor: HttpInterceptorFn = (req, next) => {
    const config = inject(AEONTEK_CONFIG);
    const options = config.restApi;
    // unless it was set explicitly, the interceptor follows the configuration service (which provides the api url)
    const enabled = options.enabled ?? config.configuration.enabled;
    if (!enabled || isAbsoluteUrl(req.url)) {
        return next(req);
    }
    const apiUrl = options.apiUrl ?? inject(ConfigurationService, {optional: true})?.configuration()?.apiUrl;
    if (!apiUrl) {
        return next(req);
    }
    return next(req.clone({url: joinRestApiUrl(apiUrl, req.url)}));
};

/**
 * Whether the given url is absolute (ie `https://host/foo`), as opposed to a path only url (ie `/foo`).
 */
export function isAbsoluteUrl(url: string): boolean {
    return ABSOLUTE_URL.test(url);
}

/**
 * Appends a path only url to the base url of the api, ie `https://api.example.com` and `/users` give
 * `https://api.example.com/users`.
 */
export function joinRestApiUrl(apiUrl: string, url: string): string {
    const base = apiUrl.replace(/\/+$/, '');
    const path = url.startsWith('/') ? url : `/${url}`;
    return `${base}${path}`;
}
