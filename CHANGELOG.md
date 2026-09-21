# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `AuthenticationService`: abstraction over the authentication library used by the application, exposing an
  `isAuthenticated` signal, resolved from the `AUTHENTICATION_BACKEND` token and falling back to
  `NoopAuthenticationService` (never authenticated) when no library is integrated.
- `lib/oidc` secondary entry point: `OidcAuthenticationService` and `provideAuthOidcAuthentication()`, backing
  the `AuthenticationService` with [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client),
  which is declared as an *optional* peer dependency so applications which do not use it never need it installed.
- `provideAeontek()` with `AeontekConfig` to set up the library in an application.
- `ConfigurationService`: loading and exposing the runtime configuration of the application.
- `RestApiInterceptor`: prefixing relative api requests with the configured api url.
- `AeontekEventService`: application wide event bus.
- Error handling: `ErrorHandlingService`, `ErrorWithDetails` and the `ErrorView` component.
- `BreadcrumbService` and `BreadcrumbItem`: breadcrumb trail management.
- `ReloadService` and `ReloadableResource`: coordinated reloading of resources.
- Theming: `DarkModeService` and the `DarkModeButton` component.
- Documentation of all services and components in the `README.md`.
