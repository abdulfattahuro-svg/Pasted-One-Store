---
name: Config auto-seed
description: Why the system_config table needs an ensureConfig() guard
---

## Rule
The `system_config` table starts empty (no migration seeds it). The GET /config route must call `ensureConfig()` which inserts a default row if none exists. Without this, GET /config returns 404 and the entire settings page fails to load.

**Why:** Drizzle push doesn't seed data, only creates tables. The config table was always empty on fresh environments.

**How to apply:** Any route that reads from `systemConfigTable` should call `ensureConfig()` first rather than handling the empty case with a 404.
