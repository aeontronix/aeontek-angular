# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `AuthenticationService`: abstraction over the authentication library used by the application, exposing an
  `isAuthenticated` signal, resolved from the `AUTHENTICATION_BACKEND` token and falling back to
  `NoopAuthenticationService` (never authenticated) when no library is integrated.
- `@aeontronix/aeontek-angular/oidc` secondary entry point: `OidcAuthenticationService` and
  `provideAuthOidcAuthentication()`, backing the `AuthenticationService` with [angular-auth-oidc-client](https://github.com/damienbod/angular-auth-oidc-client),
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

### Changed

- CI: the pipeline now uses the `npm-publish` [component](https://gitlab.com/aeontronix/oss/aeon-gitlab-pipeline-components)
  instead of the `node-lib` template. Branches are built and tested, a manual job on the default branch
  tags the commit with the version of `projects/lib/package.json`, and the pipeline of that tag publishes
  `dist/lib` to the npm registry of the project.
- The `build`, `test`, `start` and `watch` scripts name the project they apply to, as `ng build` / `ng test`
  cannot pick one in this multi project workspace.
