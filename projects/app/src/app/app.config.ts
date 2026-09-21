import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideAeontek, restApiInterceptor } from 'lib';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // the configuration is downloaded from `/config.json` before the application starts
    // the websocket event service is enabled by an `events` section in that downloaded configuration
    provideAeontek({ configuration: true }),
    // path only request urls (ie `/users`) are prefixed with the `apiUrl` of the downloaded configuration,
    // the interceptor is enabled by default since the configuration is
    provideHttpClient(withInterceptors([restApiInterceptor])),
  ],
};
