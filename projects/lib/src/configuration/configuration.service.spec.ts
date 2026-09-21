/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {AEONTEK_CONFIG} from '../aeontek-config';
import {AeontekOptions, resolveAeontekConfig} from '../provide-aeontek';
import {AeontekConfiguration, ConfigurationService, injectConfiguration} from './configuration.service';

interface DemoConfiguration extends AeontekConfiguration {
    readonly appName: string;
}

function configure(options: AeontekOptions): ConfigurationService<DemoConfiguration> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
        providers: [{provide: AEONTEK_CONFIG, useValue: resolveAeontekConfig(options)}]
    });
    return TestBed.runInInjectionContext(() => injectConfiguration<DemoConfiguration>());
}

describe('ConfigurationService', () => {
    it('downloads the configuration and exposes it', async () => {
        const service = configure({
            configuration: {fetcher: async () => ({apiUrl: 'https://api.example.com', appName: 'demo'})}
        });

        expect(service.loaded()).toBe(false);
        expect(() => service.value).toThrow();

        const configuration = await service.load();

        expect(configuration?.appName).toBe('demo');
        expect(service.loaded()).toBe(true);
        expect(service.apiUrl).toBe('https://api.example.com');
        expect(service.configuration()?.appName).toBe('demo');
    });

    it('uses the default url unless overridden', () => {
        expect(configure({configuration: true}).url).toBe('/config.json');
        expect(configure({configuration: '/assets/config.json'}).url).toBe('/assets/config.json');
    });

    it('downloads only once unless a reload is requested', async () => {
        let loads = 0;
        const service = configure({
            configuration: {
                fetcher: async () => ({apiUrl: 'https://api.example.com', appName: `demo-${++loads}`})
            }
        });

        await service.load();
        await service.load();

        expect(loads).toBe(1);

        await service.load(true);

        expect(loads).toBe(2);
        expect(service.value.appName).toBe('demo-2');
    });

    it('rejects a configuration without a valid apiUrl', async () => {
        const service = configure({configuration: {fetcher: async () => ({appName: 'demo'})}});

        await expect(service.load()).rejects.toThrow();
        expect(service.loaded()).toBe(false);
    });

    it('only logs the failure when the configuration is not required', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const service = configure({
            configuration: {
                required: false,
                fetcher: () => Promise.reject(new Error('boom'))
            }
        });

        expect(await service.load()).toBeNull();
        expect(error).toHaveBeenCalled();

        error.mockRestore();
    });
});
