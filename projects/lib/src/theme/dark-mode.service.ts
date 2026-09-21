/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {computed, DestroyRef, DOCUMENT, inject, Injectable, Signal, signal} from '@angular/core';

/**
 * A resolved color scheme, ie what is actually displayed.
 */
export type ColorScheme = 'light' | 'dark';

/**
 * The color scheme wanted by the user: `system` (the default) follows the operating system / browser
 * preference, `light` and `dark` are explicit overrides which are persisted in the local storage.
 */
export type DarkModePreference = ColorScheme | 'system';

/**
 * Key the preference is stored under in the local storage.
 */
export const DARK_MODE_STORAGE_KEY = 'aeontek.dark-mode';

/**
 * Class added to the `<html>` element while the dark scheme is active, which is what tailwind expects:
 *
 * ```css
 * @import 'tailwindcss';
 * @custom-variant dark (&:where(.dark, .dark *));
 * ```
 */
export const DARK_MODE_CLASS = 'dark';

/**
 * Media query used to read the color scheme of the system.
 */
export const DARK_MODE_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Service controlling the dark mode of the application, in a tailwind compatible way: the
 * {@link DARK_MODE_CLASS `dark`} class is added to (or removed from) the `<html>` element, along with the
 * `color-scheme` style so that the browser widgets follow.
 *
 * The scheme defaults to the one of the system (`prefers-color-scheme`, which it keeps following as long
 * as it isn't overridden), and once the user overrides it the choice is persisted in the local storage:
 *
 * ```ts
 * private readonly darkMode = inject(DarkModeService);
 *
 * darkMode.dark();          // signal, whether the dark scheme is currently active
 * darkMode.scheme();        // signal, 'light' or 'dark'
 * darkMode.preference();    // signal, 'light', 'dark' or 'system'
 * darkMode.toggle();        // switches to the other scheme, persisting the choice
 * darkMode.set('dark');     // forces a scheme
 * darkMode.useSystem();     // back to the system preference, forgetting the stored choice
 * ```
 *
 * The {@link DarkModeButton} component provides a ready to use switch.
 */
@Injectable({
    providedIn: 'root'
})
export class DarkModeService {
    private readonly document = inject(DOCUMENT);
    private readonly stored = signal<DarkModePreference>(readStoredPreference());
    private readonly system = signal<ColorScheme>('light');

    /**
     * The scheme wanted by the user: `system` until it has been overridden.
     */
    public readonly preference: Signal<DarkModePreference> = this.stored.asReadonly();

    /**
     * The scheme of the system (`prefers-color-scheme`), whether it is followed or not.
     */
    public readonly systemScheme: Signal<ColorScheme> = this.system.asReadonly();

    /**
     * The scheme which is currently applied, ie the {@link preference} resolved against the system one.
     */
    public readonly scheme: Signal<ColorScheme> = computed(() => {
        const preference = this.stored();
        return preference === 'system' ? this.system() : preference;
    });

    /**
     * Whether the dark scheme is currently active, usable directly within a template.
     */
    public readonly dark: Signal<boolean> = computed(() => this.scheme() === 'dark');

    /**
     * Whether the system preference has been overridden by the user, in which case the choice is stored
     * in the local storage.
     */
    public readonly overridden: Signal<boolean> = computed(() => this.stored() !== 'system');

    public constructor() {
        const query = matchDarkModeQuery();
        this.system.set(query?.matches ? 'dark' : 'light');
        if (query) {
            const listener = (event: MediaQueryListEvent) => {
                this.system.set(event.matches ? 'dark' : 'light');
                this.apply();
            };
            query.addEventListener('change', listener);
            inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
        }
        this.apply();
    }

    /**
     * Sets the wanted scheme, persisting it in the local storage, `system` going back to the system
     * preference (see {@link useSystem}).
     */
    public set(preference: DarkModePreference): void {
        this.stored.set(preference);
        storePreference(preference);
        this.apply();
    }

    /**
     * Switches to the other scheme, persisting the choice: while the system preference is followed this
     * overrides it with the opposite of what is currently displayed.
     */
    public toggle(): void {
        this.set(this.dark() ? 'light' : 'dark');
    }

    /**
     * Follows the system preference again, forgetting the stored choice.
     */
    public useSystem(): void {
        this.set('system');
    }

    /**
     * Applies the current scheme to the `<html>` element, which is done automatically and is therefore
     * only needed when the element was replaced.
     */
    public apply(): void {
        const root = this.document.documentElement;
        if (!root) {
            return;
        }
        const dark = this.dark();
        root.classList.toggle(DARK_MODE_CLASS, dark);
        root.style.colorScheme = dark ? 'dark' : 'light';
    }
}

function matchDarkModeQuery(): MediaQueryList | null {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return null;
    }
    try {
        return window.matchMedia(DARK_MODE_MEDIA_QUERY);
    } catch {
        return null;
    }
}

function localStorageOrNull(): Storage | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage;
    } catch {
        // ie storage disabled by the browser
        return null;
    }
}

function readStoredPreference(): DarkModePreference {
    try {
        const stored = localStorageOrNull()?.getItem(DARK_MODE_STORAGE_KEY);
        return stored === 'dark' || stored === 'light' ? stored : 'system';
    } catch {
        return 'system';
    }
}

function storePreference(preference: DarkModePreference): void {
    const storage = localStorageOrNull();
    if (!storage) {
        return;
    }
    try {
        if (preference === 'system') {
            storage.removeItem(DARK_MODE_STORAGE_KEY);
        } else {
            storage.setItem(DARK_MODE_STORAGE_KEY, preference);
        }
    } catch (e) {
        console.warn(`Failed to store the dark mode preference '${preference}'`, e);
    }
}
