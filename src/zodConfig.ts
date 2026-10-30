import { z } from 'zod'

// The safety rules shared with the server use zod. Its JIT probe (new Function) is reported by our strict CSP, so it is turned off in the browser.
// This module must be imported before anything that builds a schema.
z.config({ jitless: true })
