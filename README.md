# Overview

This library provides various functionalities to help with angular projects

# Setup

Add `provideAeontek()` to the application providers to initialize the library:

```ts
export const appConfig: ApplicationConfig = {
  providers: [provideAeontek()],
};
```

Options:

```ts
provideAeontek({ configuration: true }); // download /config.json on startup
provideAeontek({ configuration: '/assets/config.json' }); // from another url
provideAeontek({ restApi: false }); // disable the rest api interceptor
provideAeontek({ restApi: 'https://api.example.com' }); // static api url
```

The websocket event service is not configured here, it is configured by the downloaded configuration (see
[Event Service](#event-service)).

# Components

## Configuration Service

A service downloading the application configuration from the server (`/config.json` by default), so that
it doesn't have to be baked into the build. Disabled by default, it is enabled with
`provideAeontek({configuration: true})` which downloads the configuration before the application starts.

The configuration must extend the base `AeontekConfiguration` interface, which only requires an `apiUrl`:

```ts
export interface MyConfiguration extends AeontekConfiguration {
  readonly appName: string;
}
```

Applications inject the service typed with their own configuration:

```ts
private readonly configuration = injectConfiguration<MyConfiguration>();

configuration.value;              // the configuration, throws if not loaded yet
configuration.apiUrl;             // shortcut for value.apiUrl
configuration.configuration();    // signal, null until loaded
configuration.loaded();           // signal, true once loaded
await configuration.load();       // loads it (or returns the already loaded one)
await configuration.load(true);   // downloads it again
```

Options:

```ts
provideAeontek({configuration: '/assets/config.json'});      // custom url
provideAeontek({configuration: {required: false}});          // a failure is only logged
provideAeontek({configuration: {enabled: false}});           // load it manually with load()
provideAeontek({configuration: {fetcher: url => ...}});      // custom download (ie in tests)
```

The downloaded json must be an object containing a non empty `apiUrl`, otherwise the load fails (which by
default fails the application startup). It may also contain an `events` section configuring the event
service:

```json
{
  "apiUrl": "https://api.example.com",
  "events": { "path": "/my-events", "reconnectDelay": 2000 }
}
```

### Demo

The `app` project shows it in action (`projects/app/src/app/demo`): `/config.json`
(`projects/app/public/config.json`) is downloaded on startup and typed with `AppConfiguration`, an
interface extending `AeontekConfiguration` with `appName`, `environment` and `features`. The page displays
the loaded values and can download the configuration again.

## Rest Api Interceptor

A functional http interceptor (`restApiInterceptor`) prefixing path only request urls (ie `/users`) with
the base url of the backend api, absolute urls (ie `https://host/users`, `//host/users`) being left
untouched. The api url is the `apiUrl` of the configuration downloaded by the configuration service, so
`httpClient.get('/users')` hits `https://api.example.com/users` without the application having to build
the url itself.

It is registered with the http client:

```ts
providers: [
  provideAeontek({ configuration: true }),
  provideHttpClient(withInterceptors([restApiInterceptor])),
];
```

It is enabled by default when the dynamic configuration is enabled (which is where the api url comes
from), and disabled otherwise, unless it is configured explicitly:

```ts
provideAeontek({ restApi: true }); // always prefix, even without dynamic configuration
provideAeontek({ restApi: false }); // never prefix
provideAeontek({ restApi: 'https://api.example.com' }); // static api url, instead of the downloaded one
provideAeontek({ restApi: { apiUrl: 'https://api.example.com' } }); // api url only, still follows the configuration
```

Only an explicit `enabled` (`true` / `false`) overrides that default, leaving it unset (or `undefined`)
keeps following the dynamic configuration.

Requests are left untouched while no api url is available (ie the configuration has not been loaded yet).

## Authentication Service

An abstraction (`AuthenticationService`) over the authentication library used by the application, so that
components and services never depend on a specific one:

```ts
private readonly authentication = inject(AuthenticationService);

authentication.isAuthenticated();    // signal, whether the user is currently authenticated
```

```html
@if (authentication.isAuthenticated()) {
<app-profile />
}
```

The service can always be injected: without any integration it falls back to a no-op implementation
(`NoopAuthenticationService`) where the user is never authenticated.

### angular-auth-oidc-client

Applications using [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client) add
`provideAuthOidcAuthentication()`, which backs the service with the `OidcSecurityService` of that library:

```ts
import { provideAuthOidcAuthentication } from 'lib/oidc';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAuth({ config: { authority: 'https://sts.example.com' /* ... */ } }),
    provideAeontek(),
    provideAuthOidcAuthentication(),
  ],
};
```

That integration lives in its own `lib/oidc` entry point, which is the only place where
`angular-auth-oidc-client` is referenced (it is an optional peer dependency): applications which do not
use it never import that entry point, and therefore do not need the library installed at all.

With several openid configurations the user is considered authenticated once all of them are, which is
what `OidcSecurityService` itself reports. `provideAuth()` remains responsible for the configuration and
the login / logout flows, this service only exposes the resulting state.

## Error Handling Service

A service (`ErrorHandlingService`) transforming any error into a human friendly one (`ErrorWithDetails`),
ie an object with a short `title` and optional `details`, which can be displayed to the user as is:

```ts
private readonly errorHandling = inject(ErrorHandlingService);

this.http.get('/users').subscribe({
    error: err => this.error.set(this.errorHandling.handle(err))
});
```

```ts
{title: 'Unknown user', details: 'No user exists with id 42', status: 404, cause: err}
```

Errors of a rest api call (`HttpErrorResponse`) are handled out of the box, the json payload of the
response taking precedence over the http status. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457)
problem details are supported (`title` and `detail`, `details` being accepted as well), falling back to a
`message` or `error` field when those are absent:

```jsonc
{"title": "Unknown user", "detail": "No user exists with id 42"} // title + details
{"title": "Invalid request", "message": "Invalid email"}         // title + details (the fallback)
{"message": "Invalid email"}                                     // title only
{"error": "Invalid email"}                                       // title only
{"error": {"message": "Database is down"}}                       // title only, nested payload
```

A body which the http client could not parse is parsed by the service, and a plain text body (ie an html
error page) is used as details. When the response carries nothing usable, the http status is used
(`Not found`, `Access denied`, `Too many requests`, ...) with `404 Not Found` as details, and a request
which never reached the server (status `0`) gives `Unable to reach the server`.

Anything else is handled too: an `Error` or a string gives its message as title, an object with a `title`
(or a `message` / `error`) is read the same way as a payload, and anything else gives
`An unexpected error occurred`. The original error is always kept as `cause`.

Application specific errors are supported by registering a resolver, which takes precedence over the
built in handling and is ignored when it returns `null` (or throws):

```ts
const unregister = errorHandling.register((error) =>
  error instanceof MyError ? { title: error.label } : null,
);
```

## Error View

A component (`ErrorView`, `lib-error-view`) displaying an error, typically the one of a signal
`resource()`. It is meant to be usable in small parts of the ui, so it only displays the title of the
error, the details being shown on demand, along with a refresh button triggering a full reload through
the [Reload Service](#reload-service). Both actions are icon only buttons (an eye toggling the details, a
circular arrow refreshing, spinning while a reload is in progress), each carrying a tooltip and an
`aria-label`:

```html
@if (users.error(); as error) {
<lib-error-view [error]="error" />
}
```

Nothing is rendered while the error is `null` or `undefined`, so it can also be bound directly:

```html
<lib-error-view [error]="users.error()" />
```

The error is converted by the [Error Handling Service](#error-handling-service), so anything can be given
to it (an `HttpErrorResponse`, an `Error`, an already converted `ErrorWithDetails`, ...), including
application specific errors handled by a registered resolver.

The details button is only displayed when there is something more to show than the title: the `details`
and `status` of the converted error, falling back to the original error (ie the stack of an `Error`) when
it carried none.

Inputs:

```html
<lib-error-view [error]="error" [refreshable]="false" />
<!-- no refresh button -->
<lib-error-view [error]="error" [detailsExpanded]="true" />
<!-- details shown right away -->
```

The component carries its own styles, it therefore doesn't require any css framework.

### Demo

The `app` project contains a live demo (`projects/app/src/app/demo/error-demo.ts`): a resource failing on
demand with an http error (a RFC 9457 payload), a plain `Error`, or succeeding, its error being displayed
by the `ErrorView`.

## Dark Mode

A service (`DarkModeService`) controlling the color scheme of the application in a tailwind compatible
way: it adds (or removes) the `dark` class on the `<html>` element, along with the `color-scheme` style so
that the browser widgets (scrollbars, form controls, ...) follow.

The scheme defaults to the one of the system (`prefers-color-scheme`, which it keeps following while it
changes), and once it is overridden the choice is persisted in the local storage (`aeontek.dark-mode`):

```ts
private readonly darkMode = inject(DarkModeService);

darkMode.dark();            // signal, true while the dark scheme is active
darkMode.scheme();          // signal, the applied scheme: 'light' or 'dark'
darkMode.preference();      // signal, what the user wants: 'light', 'dark' or 'system'
darkMode.systemScheme();    // signal, the scheme of the system
darkMode.overridden();      // signal, true once the system preference was overridden

darkMode.toggle();          // switches to the other scheme, persisting the choice
darkMode.set('dark');       // forces a scheme
darkMode.useSystem();       // follows the system again, forgetting the stored choice
```

Tailwind must be told to use the class instead of the media query, which in tailwind 4 is done in the
global stylesheet:

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));
```

`dark:` variants then follow the service:

```html
<div class="bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100">...</div>
```

### Theming the application

Sprinkling `dark:` variants everywhere quickly becomes unmanageable: the recommended (and application
specific, the library doesn't impose any theme) approach is to declare semantic colors, mapped to css
variables which are redefined for the dark scheme. Tailwind then generates the usual utilities
(`bg-surface`, `text-fg`, `border-border`, ...) and they simply switch with the `dark` class, without any
`dark:` variant in the templates:

```css
@import 'tailwindcss';
@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-canvas: var(--app-canvas);
  --color-fg: var(--app-fg);
  --color-border: var(--app-border);
}

@layer base {
  :root {
    --app-canvas: var(--color-white);
    --app-fg: var(--color-gray-900);
    --app-border: var(--color-gray-200);
  }

  .dark {
    --app-canvas: var(--color-gray-950);
    --app-fg: var(--color-gray-100);
    --app-border: var(--color-gray-700);
  }

  body {
    @apply bg-canvas text-fg;
  }
}
```

```html
<article class="border border-border p-4 text-fg">...</article>
```

The components of the library carry their own (light) styles so that they work without any css framework;
they can be re-colored by the application from its global stylesheet. Such rules must stay outside of any
`@layer` (unlayered styles win over layered ones) and must beat the emulated encapsulation of the
component, which is easily done by repeating the class:

```css
lib-error-view .error-view.error-view {
  border-color: var(--color-danger-border);
  background: var(--color-danger-surface);
  color: var(--color-danger-fg);
}
```

`projects/app/src/styles.css` contains the full set of tokens used by the demo.

### Dark Mode Button

An icon only button (`DarkModeButton`, `lib-dark-mode-button`) switching the scheme, displaying a sun in
light mode and a moon in dark mode, with a tooltip and an `aria-label` describing what it does:

```html
<lib-dark-mode-button />
```

By default it toggles between light and dark. With `withSystem` it cycles through light, dark and system
(a screen icon), the latter following the system preference again:

```html
<lib-dark-mode-button withSystem />
```

The button is nothing but the icon: no border, no background, it simply inherits the current color (and
therefore doesn't require any css framework), which keeps it usable anywhere, ie in a toolbar.

### Demo

The `app` project contains a live demo (`projects/app/src/app/demo/dark-mode-demo.ts`): a page displaying
the state of the service and offering the button as well as explicit light / dark / system switches. All
the demo pages use the semantic tokens of `projects/app/src/styles.css`, they therefore follow the scheme,
including the `ErrorView` which is re-colored from there.

## Breadcrumb

A service to manage breadcrumbs in an Angular application.

## Reload Service

A service where various resources can be registered against, from where a full reload can be triggered.

Resources are registered with an id (alphanumeric, underscore, dash or dot), where the dot acts as hierarchy
separator. Reloading an id also reloads all its children: with `foo`, `bar`, `bar.z` and `bar.y` registered,
reloading `bar` will reload `bar`, `bar.z` and `bar.y`.

Creating an already registered resource (unregistered automatically when the injection context is destroyed):

```ts
readonly users = reloadableResource('data.users', {
    params: () => ({page: this.page()}),
    loader: ({params}) => fetchUsers(params.page)
});
```

Registering an existing resource or any callback:

```ts
registerReloadable('data.users', this.users);
inject(ReloadService).register('stats', () => this.refreshStats());
```

Triggering reloads:

```ts
reloadService.reload('bar'); // 'bar' and all its children
reloadService.reload(); // everything
```

Reloading state (signals, usable directly in templates):

```ts
reloadService.reloading(); // true while anything is reloading
reloadService.reloadingIds(); // ids currently reloading, ie ['bar.z']
reloadService.isReloading('bar'); // true if 'bar' or any of its children is reloading
```

An id is reloading while one of its targets reports `isLoading()` (ie a signal `resource()`), or while a
registered callback returned a promise which has not settled yet.

### Demo

The `app` project contains a live demo (`projects/app/src/app/demo`): three `reloadableResource()` registered
as `data.users`, `data.stats` and `reports.activity`, plus a plain callback registered as `notifications`,
all backed by an artificially delayed fake api (`demo-api.ts`). The page shows the global reloading
indicator, `reloadingIds()`, per card `isReloading()` state, and buttons triggering reloads by id (including
parents such as `data` or `reports`) or everything at once.

```bash
ng build lib && ng serve app
```

## Event Service

An optional websocket service (`AeontekEventService`), configured by the `events` section of the
configuration downloaded by the configuration service (so the server decides whether it is used), and
disabled while that section is absent. It connects to `/aeontek-events` on the current origin (`ws`/`wss`
depending on the page protocol), reconnects automatically when the connection is lost, and exposes the
`connected()` and `lastEvent()` signals.

```jsonc
{"events": {}}                                             // enabled with all defaults
{"events": {"path": "/my-events", "reconnectDelay": 2000}} // custom path and reconnect delay
{"events": {"url": "wss://host/events"}}                   // absolute url instead of a path
{"events": {"autoConnect": false}}                         // connect manually
{"events": {"enabled": false}}                             // disabled
```

The connection is established once the configuration has been loaded (`autoConnect`, on by default), so
the configuration service must be enabled with `provideAeontek({configuration: true})`. The websocket
itself can be replaced (ie in tests) through the `AEONTEK_WEB_SOCKET_FACTORY` token:

```ts
providers: [
  { provide: AEONTEK_WEB_SOCKET_FACTORY, useValue: (url: string) => new FakeSocket(url) },
];
```

Currently only refresh events are supported, they are forwarded to the `ReloadService`:

```json
{"type": "refresh"}
{"type": "refresh", "id": "bar"}
```

A refresh without id reloads everything, otherwise the given id and all its children are reloaded. The
connection can also be managed manually with `connect()` / `disconnect()`.
