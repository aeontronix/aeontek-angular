/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {signal, WritableSignal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {AuthenticatedResult, OidcSecurityService} from 'angular-auth-oidc-client';
import {AuthenticationService} from '@aeontronix/aeontek-angular';
import {OidcAuthenticationService, provideAuthOidcAuthentication} from './oidc-authentication.service';

describe('OidcAuthenticationService', () => {
    function fakeOidc(authenticated: WritableSignal<AuthenticatedResult>): OidcSecurityService {
        return {authenticated} as unknown as OidcSecurityService;
    }

    function result(isAuthenticated: boolean): AuthenticatedResult {
        return {isAuthenticated, allConfigsAuthenticated: []};
    }

    it('follows the authentication state of the oidc client', () => {
        const authenticated = signal(result(false));
        TestBed.configureTestingModule({
            providers: [
                {provide: OidcSecurityService, useValue: fakeOidc(authenticated)},
                provideAuthOidcAuthentication()
            ]
        });

        const authentication = TestBed.inject(AuthenticationService);

        expect(authentication).toBeInstanceOf(OidcAuthenticationService);
        expect(authentication.isAuthenticated()).toBe(false);

        authenticated.set(result(true));

        expect(authentication.isAuthenticated()).toBe(true);
    });

    it('is never authenticated while the oidc client is not configured', () => {
        TestBed.configureTestingModule({
            providers: [provideAuthOidcAuthentication()]
        });

        expect(TestBed.inject(AuthenticationService).isAuthenticated()).toBe(false);
    });
});
