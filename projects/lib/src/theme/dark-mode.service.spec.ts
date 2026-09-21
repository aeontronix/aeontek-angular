/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {DARK_MODE_CLASS, DARK_MODE_STORAGE_KEY, DarkModeService} from './dark-mode.service';

describe('DarkModeService', () => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    let systemDark = false;
    let originalMatchMedia: typeof window.matchMedia;

    function systemSwitchesTo(dark: boolean): void {
        systemDark = dark;
        for (const listener of [...listeners]) {
            listener({matches: dark} as MediaQueryListEvent);
        }
    }

    function root(): HTMLElement {
        return document.documentElement;
    }

    beforeEach(() => {
        listeners.clear();
        systemDark = false;
        originalMatchMedia = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            media: query,
            get matches() {
                return systemDark;
            },
            addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener),
            removeEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) =>
                listeners.delete(listener)
        })) as unknown as typeof window.matchMedia;
        localStorage.removeItem(DARK_MODE_STORAGE_KEY);
        TestBed.configureTestingModule({});
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        localStorage.removeItem(DARK_MODE_STORAGE_KEY);
        root().classList.remove(DARK_MODE_CLASS);
        root().style.colorScheme = '';
    });

    it('follows the system preference by default', () => {
        systemDark = true;
        const service = TestBed.inject(DarkModeService);

        expect(service.preference()).toBe('system');
        expect(service.overridden()).toBe(false);
        expect(service.scheme()).toBe('dark');
        expect(service.dark()).toBe(true);
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(true);
        expect(root().style.colorScheme).toBe('dark');
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBeNull();
    });

    it('follows the system preference when it changes', () => {
        const service = TestBed.inject(DarkModeService);

        expect(service.dark()).toBe(false);
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(false);

        systemSwitchesTo(true);

        expect(service.systemScheme()).toBe('dark');
        expect(service.dark()).toBe(true);
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(true);
    });

    it('persists the scheme once overridden', () => {
        const service = TestBed.inject(DarkModeService);

        service.toggle();

        expect(service.preference()).toBe('dark');
        expect(service.overridden()).toBe(true);
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBe('dark');
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(true);

        service.toggle();

        expect(service.preference()).toBe('light');
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBe('light');
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(false);
    });

    it('ignores the system preference once overridden', () => {
        const service = TestBed.inject(DarkModeService);
        service.set('light');

        systemSwitchesTo(true);

        expect(service.systemScheme()).toBe('dark');
        expect(service.dark()).toBe(false);
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(false);
    });

    it('restores the stored scheme', () => {
        localStorage.setItem(DARK_MODE_STORAGE_KEY, 'dark');

        const service = TestBed.inject(DarkModeService);

        expect(service.preference()).toBe('dark');
        expect(service.dark()).toBe(true);
        expect(root().classList.contains(DARK_MODE_CLASS)).toBe(true);
    });

    it('ignores a garbage stored scheme', () => {
        localStorage.setItem(DARK_MODE_STORAGE_KEY, 'whatever');

        expect(TestBed.inject(DarkModeService).preference()).toBe('system');
    });

    it('follows the system preference again, forgetting the stored scheme', () => {
        systemDark = true;
        localStorage.setItem(DARK_MODE_STORAGE_KEY, 'light');
        const service = TestBed.inject(DarkModeService);

        service.useSystem();

        expect(service.preference()).toBe('system');
        expect(service.overridden()).toBe(false);
        expect(service.dark()).toBe(true);
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBeNull();
    });

    it('works without matchMedia', () => {
        (window as {matchMedia?: unknown}).matchMedia = undefined;

        const service = TestBed.inject(DarkModeService);

        expect(service.systemScheme()).toBe('light');
        expect(service.dark()).toBe(false);

        service.set('dark');

        expect(service.dark()).toBe(true);
    });
});
