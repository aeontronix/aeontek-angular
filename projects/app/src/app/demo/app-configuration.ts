/*
 * Copyright (c) 2025. Aeontronix Inc
 */

import { AeontekConfiguration } from '@aeontronix/aeontek-angular';

/**
 * Application configuration downloaded from `/config.json`, extending the base configuration (`apiUrl`)
 * with application specific properties.
 */
export interface AppConfiguration extends AeontekConfiguration {
  readonly appName: string;
  readonly environment: string;
  readonly features: readonly string[];
}
