/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {computed, EnvironmentProviders, inject, Injectable, makeEnvironmentProviders, Signal} from '@angular/core';
import {OidcSecurityService} from 'angular-auth-oidc-client';
import {AUTHENTICATION_BACKEND, AuthenticationService} from 'lib';

/**
 * {@link AuthenticationService} implementation backed by
 * [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client), registered with
 * {@link provideAuthOidcAuthentication}.
 *
 * When several openid configurations are used, the user is considered authenticated once all of them are,
 * which is what `OidcSecurityService` itself reports.
 */
@Injectable()
export class OidcAuthenticationService extends AuthenticationService {
    private readonly oidc = inject(OidcSecurityService, {optional: true});

    /**
     * Whether the user is currently authenticated, `false` while `provideAuth()` is missing (ie the library
     * is installed but not configured).
     */
    public readonly isAuthenticated: Signal<boolean> = computed(
        () => this.oidc?.authenticated().isAuthenticated ?? false
    );
}

/**
 * Integrates [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client) with the
 * {@link AuthenticationService} abstraction, to be added to the application providers next to
 * `provideAuth()`:
 *
 * ```ts
 * export const appConfig: ApplicationConfig = {
 *     providers: [
 *         provideAuth({config: {authority: 'https://sts.example.com', ...}}),
 *         provideAeontek(),
 *         provideAuthOidcAuthentication()
 *     ]
 * };
 * ```
 *
 * Without it the {@link AuthenticationService} falls back to its no-op implementation, and applications
 * which do not use `angular-auth-oidc-client` never import this entry point, so they do not need the
 * library installed.
 */
export function provideAuthOidcAuthentication(): EnvironmentProviders {
    return makeEnvironmentProviders([
        OidcAuthenticationService,
        {provide: AUTHENTICATION_BACKEND, useExisting: OidcAuthenticationService}
    ]);
}
