/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {inject, Injectable, InjectionToken, Signal, signal} from '@angular/core';

/**
 * Token the actual authentication implementation is registered under, which the
 * {@link AuthenticationService} delegates to when present.
 *
 * It is not meant to be provided directly, the integration of a given authentication library provides it
 * (ie `provideAuthOidcAuthentication()` of the `@aeontronix/aeontek-angular/oidc` entry point).
 */
export const AUTHENTICATION_BACKEND = new InjectionToken<AuthenticationService>('aeontek.authentication-backend');

/**
 * Abstraction over the authentication library used by the application, so that components and services
 * only depend on this api:
 *
 * ```ts
 * private readonly authentication = inject(AuthenticationService);
 *
 * authentication.isAuthenticated();    // signal, whether the user is currently authenticated
 * ```
 *
 * ```html
 * @if (authentication.isAuthenticated()) {
 *     <app-profile/>
 * }
 * ```
 *
 * The implementation which is used is resolved from the {@link AUTHENTICATION_BACKEND} token, falling back
 * to the {@link NoopAuthenticationService} (never authenticated) when no authentication library is
 * integrated, so that this service can always be injected.
 *
 * Applications using [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client)
 * register the matching implementation with the `@aeontronix/aeontek-angular/oidc` entry point:
 *
 * ```ts
 * import {provideAuthOidcAuthentication} from '@aeontronix/aeontek-angular/oidc';
 *
 * export const appConfig: ApplicationConfig = {
 *     providers: [
 *         provideAuth({config: {...}}),
 *         provideAeontek(),
 *         provideAuthOidcAuthentication()
 *     ]
 * };
 * ```
 *
 * That entry point is the only place where `angular-auth-oidc-client` is referenced: applications which do
 * not use it never import it, and therefore do not need it installed at all.
 */
@Injectable({
    providedIn: 'root',
    useFactory: () => inject(AUTHENTICATION_BACKEND, {optional: true}) ?? inject(NoopAuthenticationService)
})
export abstract class AuthenticationService {
    /**
     * Whether the user is currently authenticated, usable directly within a template.
     */
    public abstract readonly isAuthenticated: Signal<boolean>;
}

/**
 * Implementation used when no authentication library is integrated: the user is never authenticated.
 */
@Injectable({
    providedIn: 'root'
})
export class NoopAuthenticationService extends AuthenticationService {
    public readonly isAuthenticated: Signal<boolean> = signal(false).asReadonly();
}
