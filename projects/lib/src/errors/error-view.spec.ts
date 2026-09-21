/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {TestBed} from '@angular/core/testing';
import {HttpErrorResponse} from '@angular/common/http';
import {ErrorView} from './error-view';
import {ReloadService} from '../reload/reload.service';

describe('ErrorView', () => {
    function render(error: unknown) {
        const fixture = TestBed.createComponent(ErrorView);
        fixture.componentRef.setInput('error', error);
        fixture.detectChanges();
        return fixture;
    }

    function text(fixture: {nativeElement: HTMLElement}, selector: string): string | null {
        return fixture.nativeElement.querySelector(selector)?.textContent?.trim() ?? null;
    }

    function button(fixture: {nativeElement: HTMLElement}, selector: string): HTMLButtonElement | null {
        return fixture.nativeElement.querySelector<HTMLButtonElement>(selector);
    }

    function detailsToggle(fixture: {nativeElement: HTMLElement}): HTMLButtonElement | null {
        return button(fixture, '.error-view-details-toggle');
    }

    function refresh(fixture: {nativeElement: HTMLElement}): HTMLButtonElement | null {
        return button(fixture, '.error-view-refresh');
    }

    beforeEach(() => {
        TestBed.configureTestingModule({});
    });

    it('renders nothing while there is no error', () => {
        const fixture = render(null);

        expect(fixture.nativeElement.textContent.trim()).toBe('');
    });

    it('displays only the title of the error', () => {
        const fixture = render(new HttpErrorResponse({
            status: 404,
            error: {title: 'Unknown user', detail: 'No user exists with id 42'}
        }));

        expect(text(fixture, '.error-view-title')).toBe('Unknown user');
        expect(text(fixture, '.error-view-details')).toBeNull();
    });

    it('displays the details on demand', () => {
        const fixture = render(new HttpErrorResponse({
            status: 404,
            error: {title: 'Unknown user', detail: 'No user exists with id 42'}
        }));

        expect(detailsToggle(fixture)!.getAttribute('aria-label')).toBe('Show details');

        detailsToggle(fixture)!.click();
        fixture.detectChanges();

        const details = text(fixture, '.error-view-details');
        expect(details).toContain('No user exists with id 42');
        expect(details).toContain('404');
        expect(detailsToggle(fixture)!.getAttribute('aria-label')).toBe('Hide details');
    });

    it('falls back to the cause when the error carries no details', () => {
        const fixture = render(new Error('boom'));

        detailsToggle(fixture)!.click();
        fixture.detectChanges();

        expect(text(fixture, '.error-view-title')).toBe('boom');
        expect(text(fixture, '.error-view-details')).toContain('boom');
    });

    it('offers no details when there is nothing more to show', () => {
        const fixture = render({title: 'Nope'});

        expect(text(fixture, '.error-view-title')).toBe('Nope');
        expect(detailsToggle(fixture)).toBeNull();
    });

    it('expands the details initially when asked to', () => {
        const fixture = render({title: 'Nope', details: 'Really nope'});
        fixture.componentRef.setInput('detailsExpanded', true);
        fixture.detectChanges();

        expect(text(fixture, '.error-view-details')).toBe('Really nope');
    });

    it('triggers a full reload', () => {
        const reloadService = TestBed.inject(ReloadService);
        let reloaded = 0;
        reloadService.register('foo', () => reloaded++, {destroyRef: null});
        reloadService.register('bar.z', () => reloaded++, {destroyRef: null});
        const fixture = render('boom');

        refresh(fixture)!.click();

        expect(reloaded).toBe(2);
    });

    it('hides the refresh button when it is disabled', () => {
        const fixture = render('boom');
        fixture.componentRef.setInput('refreshable', false);
        fixture.detectChanges();

        expect(refresh(fixture)).toBeNull();
    });
});
