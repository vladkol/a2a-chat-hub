import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import {provideRouter} from '@angular/router';
import { DEFAULT_CATALOG, provideA2UI } from '@a2ui/angular';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { theme } from './theme';

import {routes} from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideA2UI({
      catalog: {
        ...DEFAULT_CATALOG,
        Modal: {
          type: () => import('./components/custom-modal.component').then(m => m.CustomModal),
          bindings: (_node) => []
        },
        DateTimeInput: {
          type: () => import('./components/custom-datetime.component').then(m => m.CustomDateTimeInput),
          bindings: (DEFAULT_CATALOG['DateTimeInput'] as any).bindings,
        },
      },
      theme: theme,
    }),
    provideHttpClient(withFetch()),
  ],
};
