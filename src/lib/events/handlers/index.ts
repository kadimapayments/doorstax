/**
 * Built-in Event Handler Registration
 *
 * Registers all internal event handlers at import time.
 * This module is imported by the emitter to ensure handlers
 * are registered before the first event is emitted.
 */

import { onAll } from "../registry";
import { handleIntegrationWebhooks } from "./integration-webhook";

// ─── Wildcard Handlers (run on every event) ─────────────────

// Deliver events to external webhook subscribers
onAll(handleIntegrationWebhooks);
