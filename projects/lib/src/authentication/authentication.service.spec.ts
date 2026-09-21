/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {Injectable, Signal, signal, WritableSignal} from '@angular/core';
import {TestBed} from '@angular/core/testing';
import {AUTHENTICATION_BACKEND, AuthenticationService, NoopAuthenticationService} from './authentication.service';

@Injectable()
class FakeAuthenticationService extends AuthenticationService {
    public readonly authenticated: WritableSignal<boolean> = signal(false);
    public readonly isAuthenticated: Signal<boolean> = this.authenticated.asReadonly();
}

describe('AuthenticationService', () => {
    it('is never authenticated without a backend', () => {
        TestBed.configureTestingModule({});

        const authentication = TestBed.inject(AuthenticationService);

        expect(authentication).toBeInstanceOf(NoopAuthenticationService);
        expect(authentication.isAuthenticated()).toBe(false);
    });

    it('delegates to the registered backend', () => {
        TestBed.configureTestingModule({
            providers: [
                FakeAuthenticationService,
                {provide: AUTHENTICATION_BACKEND, useExisting: FakeAuthenticationService}
            ]
        });

        const backend = TestBed.inject(FakeAuthenticationService);
        const authentication = TestBed.inject(AuthenticationService);

        expect(authentication).toBe(backend);
        expect(authentication.isAuthenticated()).toBe(false);

        backend.authenticated.set(true);

        expect(authentication.isAuthenticated()).toBe(true);
    });
});
