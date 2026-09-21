/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {HttpClient, provideHttpClient, withInterceptors} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {TestBed} from '@angular/core/testing';
import {AEONTEK_CONFIG} from '../aeontek-config';
import {ConfigurationService} from '../configuration/configuration.service';
import {AeontekOptions, resolveAeontekConfig} from '../provide-aeontek';
import {restApiInterceptor} from './rest-api.interceptor';

function configure(options: AeontekOptions): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [
            {provide: AEONTEK_CONFIG, useValue: resolveAeontekConfig(options)},
            provideHttpClient(withInterceptors([restApiInterceptor])),
            provideHttpClientTesting()
        ]
    });
}

function request(url: string): string {
    TestBed.inject(HttpClient).get(url).subscribe({error: () => undefined});
    const controller = TestBed.inject(HttpTestingController);
    const [pending] = controller.match(() => true);
    pending.flush({});
    controller.verify();
    return pending.request.url;
}

describe('restApiInterceptor', () => {
    it('prefixes path only urls with the configured apiUrl', () => {
        configure({configuration: true, restApi: true});
        TestBed.inject(ConfigurationService).set({apiUrl: 'https://api.example.com'});

        expect(request('/users')).toBe('https://api.example.com/users');
        expect(request('users')).toBe('https://api.example.com/users');
    });

    it('leaves absolute urls untouched', () => {
        configure({restApi: 'https://api.example.com'});

        expect(request('https://other.example.com/users')).toBe('https://other.example.com/users');
        expect(request('//other.example.com/users')).toBe('//other.example.com/users');
    });

    it('uses the api url given in the options over the configuration', () => {
        configure({configuration: true, restApi: 'https://static.example.com/'});
        TestBed.inject(ConfigurationService).set({apiUrl: 'https://api.example.com'});

        expect(request('/users')).toBe('https://static.example.com/users');
    });

    it('is enabled by default when the configuration is enabled', () => {
        configure({configuration: true});
        TestBed.inject(ConfigurationService).set({apiUrl: 'https://api.example.com'});

        expect(request('/users')).toBe('https://api.example.com/users');
    });

    it('is disabled by default when the configuration is disabled', () => {
        configure({});
        TestBed.inject(ConfigurationService).set({apiUrl: 'https://api.example.com'});

        expect(request('/users')).toBe('/users');
    });

    it('still follows the configuration when only the api url is given', () => {
        configure({restApi: {apiUrl: 'https://static.example.com'}});

        expect(request('/users')).toBe('/users');

        configure({configuration: true, restApi: {apiUrl: 'https://static.example.com'}});

        expect(request('/users')).toBe('https://static.example.com/users');
    });

    it('can be disabled explicitly', () => {
        configure({configuration: true, restApi: false});
        TestBed.inject(ConfigurationService).set({apiUrl: 'https://api.example.com'});

        expect(request('/users')).toBe('/users');
    });

    it('leaves the url untouched while no api url is available', () => {
        configure({configuration: true});

        expect(request('/users')).toBe('/users');
    });
});
