---
name: aeontek-angular
description: How to use the aeontek angular library (`@aeontronix/aeontek-angular`) in an angular application - setup with provideAeontek(), runtime configuration, rest api interceptor, authentication abstraction (with the optional angular-auth-oidc-client integration), error handling and ErrorView, dark mode, breadcrumbs, reload service and the websocket event service. TRIGGER when working in a project which depends on this library and the task involves any of those features, or when wiring the library into an application.
---

# Aeontek Angular

Angular library providing application wide building blocks: runtime configuration, rest api url
handling, an authentication abstraction, error handling, theming, breadcrumbs, coordinated reloading
and a websocket event service.

All services are `providedIn: 'root'` and expose signals, so they are injected with `inject()` and
used directly in templates.

Import everything from the package entry point (`@aeontronix/aeontek-angular`), except the oidc
integration which lives in the `@aeontronix/aeontek-angular/oidc` secondary entry point.

## Setup

`provideAeontek()` must be added to the application providers:

```ts
export const appConfig: ApplicationConfig = {
    providers: [
        provideAeontek({configuration: true}),
        provideHttpClient(withInterceptors([restApiInterceptor]))
    ]
};
```

`AeontekConfig` options:

| Option          | Values                                                                   | Default                        |
|-----------------|--------------------------------------------------------------------------|--------------------------------|
| `configuration` | `true`, url string, `{enabled, url, required, fetcher}`                   | disabled                       |
| `restApi`       | `true`, `false`, api url string, `{enabled, apiUrl}`                      | follows `configuration`        |

The event service is not configured here: the downloaded configuration decides whether it is used.

## Configuration Service

Downloads the application configuration (`/config.json` by default) before the application starts, so
that it is not baked into the build. Enabled with `provideAeontek({configuration: true})`.

Applications declare their own interface extending `AeontekConfiguration` (which requires a non empty
`apiUrl`) and inject the service typed with it:

```ts
export interface MyConfiguration extends AeontekConfiguration {
    readonly appName: string;
}

private readonly configuration = injectConfiguration<MyConfiguration>();

configuration.value;            // the configuration, throws if not loaded yet
configuration.apiUrl;           // shortcut for value.apiUrl
configuration.configuration();  // signal, null until loaded
configuration.loaded();         // signal
await configuration.load();     // load(true) to download it again
```

```json
{"apiUrl": "https://api.example.com", "events": {"path": "/my-events"}}
```

A failed load fails the application startup unless `{required: false}`. `{enabled: false}` loads it
manually, `{fetcher: url => ...}` replaces the download (useful in tests).

## Rest Api Interceptor

`restApiInterceptor` prefixes path only urls (`/users`) with the `apiUrl` of the configuration,
absolute urls are left untouched, so `httpClient.get('/users')` reaches the backend without the
application building urls. It must be registered with `provideHttpClient(withInterceptors([...]))`.

Enabled by default when the dynamic configuration is enabled. Requests pass through unchanged while no
api url is known yet.

## Authentication Service

`AuthenticationService` abstracts the authentication library, so components never depend on one:

```ts
private readonly authentication = inject(AuthenticationService);

authentication.isAuthenticated();   // signal
```

It can always be injected: without integration it falls back to `NoopAuthenticationService` (never
authenticated). An integration registers itself through the `AUTHENTICATION_BACKEND` token.

With [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client) (an *optional*
peer dependency, only referenced by the `@aeontronix/aeontek-angular/oidc` entry point):

```ts
import {provideAuthOidcAuthentication} from '@aeontronix/aeontek-angular/oidc';

providers: [
    provideAuth({config: {authority: 'https://sts.example.com'}}),
    provideAeontek(),
    provideAuthOidcAuthentication()
]
```

`provideAuth()` still owns the configuration and the login / logout flows, the service only exposes
the resulting state. Do not import `@aeontronix/aeontek-angular/oidc` in an application which does not
use that library.

## Error Handling Service

`ErrorHandlingService.handle(error)` turns anything into an `ErrorWithDetails`
(`{title, details?, status?, cause}`) which can be displayed as is:

```ts
this.http.get('/users').subscribe({
    error: err => this.error.set(this.errorHandling.handle(err))
});
```

`HttpErrorResponse` is handled out of the box, including [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
problem details (`title` / `detail`), falling back to `message` or `error`, then to the http status
(`Not found`, ...), status `0` giving `Unable to reach the server`. `Error`s and strings give their
message, anything else gives `An unexpected error occurred`. The original error is kept as `cause`.

Application specific errors are handled by a resolver, which wins over the built in handling and is
ignored when it returns `null`:

```ts
const unregister = errorHandling.register(error => error instanceof MyError ? {title: error.label} : null);
```

## Error View

`ErrorView` (`lib-error-view`) displays an error - typically the one of a `resource()` - as its title,
with an icon toggling the details and a refresh button triggering a reload through the reload service.
It carries its own styles (no css framework needed) and renders nothing when the error is nullish:

```html
<lib-error-view [error]="users.error()" [refreshable]="false" [detailsExpanded]="true"/>
```

The error goes through the error handling service, so anything can be bound to it.

## Dark Mode

`DarkModeService` toggles the `dark` class and `color-scheme` on `<html>`, following the system
preference until it is overridden, the choice then being persisted (`aeontek.dark-mode`):

```ts
darkMode.dark(); darkMode.scheme(); darkMode.preference(); darkMode.systemScheme(); darkMode.overridden();
darkMode.toggle(); darkMode.set('dark'); darkMode.useSystem();
```

Tailwind 4 must use the class instead of the media query:

```css
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
```

Prefer semantic colors mapped to css variables redefined under `.dark` over `dark:` variants in
templates. Library components can be re-colored from the global stylesheet with unlayered rules
beating the emulated encapsulation, ie `lib-error-view .error-view.error-view { ... }`.

`DarkModeButton` (`lib-dark-mode-button`) is an icon only button switching the scheme, cycling through
light / dark / system with the `withSystem` input.

## Breadcrumb Service

`BreadcrumbService` builds the trail from the `breadcrumb` entry of the route `data` on every
navigation, and exposes it as the `breadcrumbs()` signal of `BreadcrumbItem` (`{label, routerLink}`).
`addBreadcrumb(item)` appends one, `updateBreadcrumb(label)` relabels the last one (ie once the
loaded entity is known).

## Reload Service

Resources are registered with a dotted hierarchical id (alphanumeric, `_`, `-`, `.`), reloading an id
also reloads its children:

```ts
readonly users = reloadableResource('data.users', {params: () => ({page: this.page()}), loader: ...});
registerReloadable('data.users', this.users);
inject(ReloadService).register('stats', () => this.refreshStats());

reloadService.reload('data');   // 'data' and its children, reload() for everything
reloadService.reloading(); reloadService.reloadingIds(); reloadService.isReloading('data');
```

Registrations made in an injection context are removed when it is destroyed. An id is reloading while
a target reports `isLoading()` or a registered callback returned an unsettled promise.

## Event Service

`AeontekEventService` is an optional websocket client configured by the `events` section of the
downloaded configuration (so the server decides whether it is used), therefore it requires
`provideAeontek({configuration: true})`. It connects to `/aeontek-events` on the current origin,
reconnects automatically and exposes `connected()` and `lastEvent()`.

```jsonc
{"events": {"path": "/my-events", "reconnectDelay": 2000}}  // or url, autoConnect, enabled
```

Refresh events are forwarded to the reload service (`{"type": "refresh", "id": "data"}`, without `id`
everything is reloaded). `connect()` / `disconnect()` manage the connection manually, and
`AEONTEK_WEB_SOCKET_FACTORY` replaces the socket in tests.

## Conventions

- Inject services with `inject()`, read their signals directly in templates.
- Never depend on an authentication library directly, go through `AuthenticationService`.
- Never build backend urls by hand, use path only urls and let the interceptor prefix them.
- Display errors through `ErrorHandlingService` / `ErrorView` instead of raw error objects.
