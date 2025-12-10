// Import with `const Sentry = require("@sentry/nestjs");` if you are using CJS
import * as Sentry from "@sentry/nestjs"

Sentry.init({
  dsn: "https://116a277a785118fa3250e06b3192c215@o4510504007630848.ingest.de.sentry.io/4510504017395792",
  
  sendDefaultPii: false,
  
  // Set the environment (development, production, etc.)
  environment: process.env.NODE_ENV || 'development',
  
  // Enable performance monitoring
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  
  // Enable debug mode in development to see what Sentry is doing
  debug: process.env.NODE_ENV === 'development',
  
  // Configure release tracking (useful for versioning)
  release: process.env.npm_package_version || undefined,
});