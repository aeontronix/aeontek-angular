/*
 * Copyright (c) 2025. Aeontronix Inc
 */

/**
 * A human friendly representation of an error, meant to be displayed to the user (ie in a toast or a
 * dialog): a short {@link title}, and optional {@link details} giving more context.
 */
export interface ErrorWithDetails {
    /**
     * Short summary of the problem, ie `Not found`.
     */
    readonly title: string;
    /**
     * Longer explanation of the problem, ie `No user exists with id 42`, when one is available.
     */
    readonly details?: string;
    /**
     * Http status code, when the error comes from a rest api call.
     */
    readonly status?: number;
    /**
     * The error which was transformed, kept so that it can still be logged or inspected.
     */
    readonly cause?: unknown;
}

/**
 * Title used when nothing usable could be extracted from the error.
 */
export const DEFAULT_ERROR_TITLE = 'An unexpected error occurred';

/**
 * Whether the given value already is a {@link ErrorWithDetails}.
 */
export function isHumanFriendlyError(value: unknown): value is ErrorWithDetails {
    return (
        typeof value === 'object' &&
        value !== null &&
        typeof (value as ErrorWithDetails).title === 'string'
    );
}
