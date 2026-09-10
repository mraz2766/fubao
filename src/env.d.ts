/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    user: import('./types/domain').User | null;
    locale: import('./types/domain').Locale;
    preferences: import('./types/domain').Preferences;
  }
}
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    PHOTOS: R2Bucket;
    APP_ENV?: string;
  }
}
