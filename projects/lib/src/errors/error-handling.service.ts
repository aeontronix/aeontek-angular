/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import {HttpErrorResponse} from '@angular/common/http';
import {Injectable} from '@angular/core';
import {DEFAULT_ERROR_TITLE, ErrorWithDetails, isHumanFriendlyError} from './error-with-details';

/**
 * A resolver transforming an error into a {@link ErrorWithDetails}, returning `null` when it doesn't
 * know how to handle the given error (so that the next resolver, then the built in handling, gets a
 * chance to).
 */
export type ErrorResolver = (error: unknown) => ErrorWithDetails | null | undefined;

/**
 * Titles used for the http statuses the backend commonly returns, the status being meaningless to the
 * user when the response carries no payload.
 */
const HTTP_STATUS_TITLES: Readonly<Record<number, string>> = {
    400: 'Invalid request',
    401: 'Authentication required',
    403: 'Access denied',
    404: 'Not found',
    405: 'Invalid request',
    408: 'The request timed out',
    409: 'Conflict',
    410: 'Not found',
    422: 'Invalid request',
    429: 'Too many requests',
    500: 'Server error',
    501: 'Server error',
    502: 'The service is unavailable',
    503: 'The service is unavailable',
    504: 'The service is unavailable'
};

/**
 * Service transforming any error into a {@link ErrorWithDetails}, ie an object with a `title` and
 * optional `details` which can be displayed to the user.
 *
 * Errors of a rest api call (`HttpErrorResponse`) are handled out of the box: the json payload of the
 * response is inspected, following [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) (`title` and
 * `detail`), falling back to a `message` or `error` field, and finally to the http status itself.
 *
 * ```ts
 * private readonly errorHandling = inject(ErrorHandlingService);
 *
 * this.http.get('/users').subscribe({
 *     error: err => this.error.set(this.errorHandling.handle(err))
 * });
 * ```
 *
 * Application specific errors can be supported by registering a resolver, which takes precedence over
 * the built in handling:
 *
 * ```ts
 * errorHandling.register(error => error instanceof MyError ? {title: error.label} : null);
 * ```
 */
@Injectable({
    providedIn: 'root'
})
export class ErrorHandlingService {
    private readonly resolvers = new Set<ErrorResolver>();

    /**
     * Registers a resolver handling errors the service doesn't know about, or overriding the built in
     * handling. Resolvers are called in registration order, the first one returning a result wins.
     *
     * @returns a function unregistering the resolver
     */
    public register(resolver: ErrorResolver): () => void {
        this.resolvers.add(resolver);
        return () => {
            this.resolvers.delete(resolver);
        };
    }

    /**
     * Transforms the given error into a human friendly one, never throwing and always returning a
     * non empty title (`An unexpected error occurred` when nothing usable could be extracted).
     */
    public handle(error: unknown): ErrorWithDetails {
        for (const resolver of this.resolvers) {
            const resolved = this.safeResolve(resolver, error);
            if (resolved) {
                return {cause: error, ...resolved};
            }
        }
        return this.resolve(error);
    }

    private safeResolve(resolver: ErrorResolver, error: unknown): ErrorWithDetails | null {
        try {
            return resolver(error) ?? null;
        } catch {
            return null;
        }
    }

    private resolve(error: unknown): ErrorWithDetails {
        if (error instanceof HttpErrorResponse) {
            return this.resolveHttpError(error);
        }
        if (isHumanFriendlyError(error)) {
            return error;
        }
        const message = text(error) ?? (error instanceof Error ? text(error.message) : null);
        if (message) {
            return {title: message, cause: error};
        }
        const payload = extract(error);
        if (payload?.title) {
            return {...payload, title: payload.title, cause: error};
        }
        return {title: DEFAULT_ERROR_TITLE, cause: error};
    }

    /**
     * Handles the failure of a rest api call, the payload of the response taking precedence over the
     * http status.
     */
    private resolveHttpError(error: HttpErrorResponse): ErrorWithDetails {
        const payload = extract(parseBody(error.error));
        const status = error.status;
        return {
            title: payload?.title ?? httpStatusTitle(error),
            details: payload?.details ?? (payload?.title ? undefined : httpStatusDetails(error)),
            status: status > 0 ? status : undefined,
            cause: error
        };
    }
}

/**
 * Title of a response which carried no usable payload, the status being all we know about.
 */
function httpStatusTitle(error: HttpErrorResponse): string {
    if (error.status === 0) {
        return 'Unable to reach the server';
    }
    return HTTP_STATUS_TITLES[error.status] ?? (error.status < 500 ? 'Request failed' : 'Server error');
}

/**
 * Details of a response which carried no usable payload, ie `404 Not Found`.
 */
function httpStatusDetails(error: HttpErrorResponse): string | undefined {
    if (error.status === 0) {
        return 'The server could not be reached, please check your network connection.';
    }
    return text(`${error.status} ${error.statusText ?? ''}`) ?? undefined;
}

/**
 * Body of an error response, which is the parsed json when the server sent one, the raw text when it
 * couldn't be parsed (ie an html error page), or a `ProgressEvent` when the request itself failed.
 */
function parseBody(body: unknown): unknown {
    const raw = text(body);
    if (raw === null) {
        return body;
    }
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
        return {detail: raw};
    }
    try {
        return JSON.parse(raw);
    } catch {
        return {detail: raw};
    }
}

/**
 * Extracts the title and details out of a json payload, supporting RFC 9457 (`title` / `detail`), and
 * falling back to a `message` or `error` field when those are absent.
 */
function extract(payload: unknown, depth = 0): {title?: string; details?: string} | null {
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        return null;
    }
    const body = payload as Record<string, unknown>;
    const title = text(body['title']);
    const details = text(body['detail']) ?? text(body['details']);
    const fallback = text(body['message']) ?? text(body['error']);
    if (title || details || fallback) {
        return {
            title: title ?? fallback ?? undefined,
            details: (title ? details ?? fallback : details) ?? undefined
        };
    }
    // ie {error: {message: '...'}}, a shape several backends use
    if (depth === 0) {
        return extract(body['error'], depth + 1) ?? extract(body['message'], depth + 1);
    }
    return null;
}

/**
 * The given value as a non empty trimmed string, `null` when it isn't a usable string.
 */
function text(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}
