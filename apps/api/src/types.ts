/**
 * API Types
 *
 * Hono context types for dependency injection.
 */

import type { DatabaseClient } from '@agentiom/db';
import type { LifecycleService } from './services/lifecycle.service';
import type { ActivityService } from './services/activity.service';

export interface User {
  id: string;
  email: string;
}

export interface Env {
  Variables: {
    db: DatabaseClient;
    user: User;
    lifecycle: LifecycleService;
    activity: ActivityService;
  };
}
