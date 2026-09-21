/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {HttpErrorResponse} from '@angular/common/http';
import {TestBed} from '@angular/core/testing';
import {ErrorHandlingService} from './error-handling.service';
import {DEFAULT_ERROR_TITLE} from './error-with-details';

function service(): ErrorHandlingService {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
    return TestBed.inject(ErrorHandlingService);
}

function httpError(status: number, body: unknown, statusText = 'Not Found'): HttpErrorResponse {
    return new HttpErrorResponse({status, statusText, error: body, url: '/users'});
}

describe('ErrorHandlingService', () => {
    it('uses the RFC 9457 title and detail of the response', () => {
        const error = service().handle(
            httpError(404, {type: 'https://example.com/errors/unknown-user', title: 'Unknown user', detail: 'No user exists with id 42'})
        );

        expect(error.title).toBe('Unknown user');
        expect(error.details).toBe('No user exists with id 42');
        expect(error.status).toBe(404);
    });

    it('also accepts a details field', () => {
        const error = service().handle(httpError(409, {title: 'Conflict', details: 'The user already exists'}));

        expect(error.title).toBe('Conflict');
        expect(error.details).toBe('The user already exists');
    });

    it('falls back to the message field', () => {
        expect(service().handle(httpError(400, {message: 'Invalid email'}))).toMatchObject({
            title: 'Invalid email',
            details: undefined
        });
    });

    it('falls back to the error field', () => {
        expect(service().handle(httpError(400, {error: 'Invalid email'})).title).toBe('Invalid email');
    });

    it('uses the fallback as details when a title is present', () => {
        expect(service().handle(httpError(400, {title: 'Invalid request', message: 'Invalid email'}))).toMatchObject({
            title: 'Invalid request',
            details: 'Invalid email'
        });
    });

    it('keeps the status title when the payload only has details', () => {
        expect(service().handle(httpError(404, {detail: 'No user exists with id 42'}))).toMatchObject({
            title: 'Not found',
            details: 'No user exists with id 42'
        });
    });

    it('reads a nested error payload', () => {
        expect(service().handle(httpError(500, {error: {message: 'Database is down'}})).title).toBe('Database is down');
    });

    it('parses a payload which was not parsed by the http client', () => {
        expect(service().handle(httpError(404, '{"title": "Unknown user"}')).title).toBe('Unknown user');
    });

    it('uses a plain text payload as details', () => {
        expect(service().handle(httpError(500, 'boom', 'Internal Server Error'))).toMatchObject({
            title: 'Server error',
            details: 'boom'
        });
    });

    it('falls back to the http status when there is no payload', () => {
        expect(service().handle(httpError(403, null, 'Forbidden'))).toMatchObject({
            title: 'Access denied',
            details: '403 Forbidden',
            status: 403
        });
        expect(service().handle(httpError(418, {}, "I'm a teapot")).title).toBe('Request failed');
    });

    it('handles an unreachable server', () => {
        const error = service().handle(new HttpErrorResponse({status: 0, statusText: 'Unknown Error', error: new ProgressEvent('error')}));

        expect(error.title).toBe('Unable to reach the server');
        expect(error.status).toBeUndefined();
    });

    it('handles plain errors, strings and unknown values', () => {
        expect(service().handle(new Error('Something broke')).title).toBe('Something broke');
        expect(service().handle('Something broke').title).toBe('Something broke');
        expect(service().handle({message: 'Something broke'}).title).toBe('Something broke');
        expect(service().handle(undefined).title).toBe(DEFAULT_ERROR_TITLE);
        expect(service().handle(new Error()).title).toBe(DEFAULT_ERROR_TITLE);
    });

    it('returns an already human friendly error as is', () => {
        expect(service().handle({title: 'Unknown user', details: 'No user exists with id 42'})).toMatchObject({
            title: 'Unknown user',
            details: 'No user exists with id 42'
        });
    });

    it('keeps the original error as cause', () => {
        const cause = new Error('Something broke');

        expect(service().handle(cause).cause).toBe(cause);
    });

    it('uses the registered resolvers first, and ignores the ones which fail', () => {
        const errorHandling = service();
        errorHandling.register(() => {
            throw new Error('resolver failure');
        });
        const unregister = errorHandling.register(error => (error === 'boom' ? {title: 'Custom'} : null));

        expect(errorHandling.handle('boom').title).toBe('Custom');
        expect(errorHandling.handle('boom').cause).toBe('boom');
        expect(errorHandling.handle('other').title).toBe('other');

        unregister();

        expect(errorHandling.handle('boom').title).toBe('boom');
    });
});
