/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {booleanAttribute, ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {DarkModePreference, DarkModeService} from './dark-mode.service';

/**
 * Icon only button switching the color scheme through the {@link DarkModeService}: a sun while the light
 * scheme is active, a moon while the dark one is:
 *
 * ```html
 * <lib-dark-mode-button/>
 * ```
 *
 * By default it simply toggles between light and dark, persisting the choice. When `withSystem` is set it
 * cycles through light, dark and system (a screen icon), the latter following the system preference again:
 *
 * ```html
 * <lib-dark-mode-button withSystem/>
 * ```
 */
@Component({
    selector: 'lib-dark-mode-button',
    templateUrl: './dark-mode-button.html',
    styleUrl: './dark-mode-button.css',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DarkModeButton {
    private readonly darkMode = inject(DarkModeService);

    /**
     * Whether the button also offers to follow the system preference, cycling through light, dark and
     * system instead of only toggling between light and dark (`false` by default).
     */
    public readonly withSystem = input(false, {transform: booleanAttribute});

    /**
     * Whether the dark scheme is currently active.
     */
    protected readonly dark = computed(() => this.darkMode.dark());

    /**
     * The icon to display: the scheme which is currently applied, or a screen while the system preference
     * is followed and the button offers it.
     */
    protected readonly icon = computed<'light' | 'dark' | 'system'>(() => {
        if (this.withSystem() && this.darkMode.preference() === 'system') {
            return 'system';
        }
        return this.dark() ? 'dark' : 'light';
    });

    /**
     * Tooltip of the button, describing what clicking it does.
     */
    protected readonly label = computed(() => LABELS[this.next()]);

    private readonly next = computed<DarkModePreference>(() => {
        if (!this.withSystem()) {
            return this.dark() ? 'light' : 'dark';
        }
        switch (this.darkMode.preference()) {
            case 'light':
                return 'dark';
            case 'dark':
                return 'system';
            default:
                return 'light';
        }
    });

    /**
     * Applies the next scheme, which is persisted unless it is the system one.
     */
    protected switch(): void {
        this.darkMode.set(this.next());
    }
}

const LABELS: Readonly<Record<DarkModePreference, string>> = {
    light: 'Switch to the light theme',
    dark: 'Switch to the dark theme',
    system: 'Follow the system theme'
};
