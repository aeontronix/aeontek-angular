/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {DARK_MODE_CLASS, DARK_MODE_STORAGE_KEY, DarkModeService} from './dark-mode.service';
import {DarkModeButton} from './dark-mode-button';

describe('DarkModeButton', () => {
    let originalMatchMedia: typeof window.matchMedia;

    function render(withSystem = false) {
        const fixture = TestBed.createComponent(DarkModeButton);
        fixture.componentRef.setInput('withSystem', withSystem);
        fixture.detectChanges();
        return fixture;
    }

    function button(fixture: {nativeElement: HTMLElement}): HTMLButtonElement {
        return fixture.nativeElement.querySelector<HTMLButtonElement>('.dark-mode-button')!;
    }

    function label(fixture: {nativeElement: HTMLElement}): string | null {
        return button(fixture).getAttribute('aria-label');
    }

    beforeEach(() => {
        originalMatchMedia = window.matchMedia;
        window.matchMedia = ((query: string) => ({
            media: query,
            matches: false,
            addEventListener: () => undefined,
            removeEventListener: () => undefined
        })) as unknown as typeof window.matchMedia;
        localStorage.removeItem(DARK_MODE_STORAGE_KEY);
        TestBed.configureTestingModule({});
    });

    afterEach(() => {
        window.matchMedia = originalMatchMedia;
        localStorage.removeItem(DARK_MODE_STORAGE_KEY);
        document.documentElement.classList.remove(DARK_MODE_CLASS);
        document.documentElement.style.colorScheme = '';
    });

    it('switches to the dark scheme and back', () => {
        const fixture = render();
        const service = TestBed.inject(DarkModeService);

        expect(label(fixture)).toBe('Switch to the dark theme');
        expect(button(fixture).getAttribute('aria-pressed')).toBe('false');

        button(fixture).click();
        fixture.detectChanges();

        expect(service.dark()).toBe(true);
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBe('dark');
        expect(label(fixture)).toBe('Switch to the light theme');
        expect(button(fixture).getAttribute('aria-pressed')).toBe('true');

        button(fixture).click();
        fixture.detectChanges();

        expect(service.dark()).toBe(false);
        expect(label(fixture)).toBe('Switch to the dark theme');
    });

    it('follows the service when the scheme is changed elsewhere', () => {
        const fixture = render();

        TestBed.inject(DarkModeService).set('dark');
        fixture.detectChanges();

        expect(label(fixture)).toBe('Switch to the light theme');
    });

    it('cycles through light, dark and system when asked to', () => {
        const fixture = render(true);
        const service = TestBed.inject(DarkModeService);

        expect(service.preference()).toBe('system');
        expect(label(fixture)).toBe('Switch to the light theme');
        expect(button(fixture).getAttribute('aria-pressed')).toBeNull();

        button(fixture).click();
        fixture.detectChanges();
        expect(service.preference()).toBe('light');

        button(fixture).click();
        fixture.detectChanges();
        expect(service.preference()).toBe('dark');

        button(fixture).click();
        fixture.detectChanges();
        expect(service.preference()).toBe('system');
        expect(localStorage.getItem(DARK_MODE_STORAGE_KEY)).toBeNull();
    });
});
