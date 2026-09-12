# Live workspace implementation status

The README's three-tier model is a useful architectural direction: orchestration selects work, specialists perform it, and validation reviews the result. This implementation adds a separate, bounded conversation service. It does not establish that every legacy path follows that model or that the whole platform is production-certified.

## Implemented in this change

- Premium orbital design preview remains explicitly simulated.
- Authenticated users enter a separate live workspace. No demo answer is substituted for a failed model call.
- Quick mode streams from an administrator-configured Ollama model. Agent team mode calls selected versioned specialists, then the Chief of Staff. Council mode runs seven strict advisory judge passes, applies a Security absolute veto plus four-vote thresholds, persists the structured verdict, and still requires human approval. These are advisory model roles, not an execution engine.
- Conversation history, partial output, errors, and ordered events persist in a server-side SQLite database. Refresh/reconnection reads persisted state and replays a bounded agent/Council activity snapshot without replaying token deltas. Different API keys receive distinct identities; shared keys intentionally share an account.
- Unsent composer drafts sync to the authenticated conversation service after a short debounce and restore across sessions. Versioned saves detect concurrent edits and offer workspace, local, or combined recovery. A device-local cache remains available when the service is offline; draft content is never submitted until the operator sends it.
- Small text, Markdown, CSV, JSON, YAML, XML, and log attachments can be ingested into the bounded live model context. Images, PDFs, office files, and other binary formats remain metadata-only. Persisted message metadata records only the filename, type, size, and whether text was ingested.
- Deep research mode is available as a bounded evidence brief. It cites supported text attachments by filename and can optionally retrieve up to four HTTPS URLs from an explicit server-side allowlist, recording source metadata/status, replaying per-source retrieval events, and exposing `[Source: title]` citations in the answer.
- Branching a completed assistant response clones the conversation history through that response into an owner-isolated conversation, then restores the source prompt as an editable draft for the next turn.
- Council verdicts expose an authenticated human checkpoint in the live card. Operators can approve, request revision, or reject; Security vetoes cannot be approved, and the decision is persisted with a replayable event.
- Operator name, nickname, and all seven Council member names sync to the authenticated workspace profile, with device-local fallback when the service is unavailable.
- Standard and attachment-research answers create owner-scoped Markdown artifacts with revision numbers, optimistic conflict detection, download support, revision history, and a live side-panel editor that can restore an earlier version as a new save.
- Idempotent live submissions, one running response per conversation, cooperative cancellation, a 420-second total timeout, output limits, and interrupted-state recovery after service restart.
- Browser dictation inserts editable text without sending it. Read aloud is optional and stoppable. Browser support and microphone permission vary; speech services may process audio online.
- The sign-in surface now supports a configured identity provider for email OTP, phone OTP, Google OAuth, and GitHub OAuth, plus the existing administrator API-key route. Verified provider sessions are exchanged for short-lived Aetherion tokens; provider setup and email/SMS delivery remain deployment configuration.
- The new `institution` package contains versioned definitions for all 74 roster agents across all 14 colleges, deterministic bounded routing, and an authenticated college-service microservice boundary. The service is advisory-only and exposes no arbitrary tool execution.
- The Blender deliverable is an editable Glass Citadel scene with a glass core, three orbital rings, and seven Council nodes. The browser loads its portable GLB through `<model-viewer>`; the editable `.blend` is packaged separately.
- Model adapters follow the documented Ollama streaming chat protocol: https://docs.ollama.com/api/chat.

## Not complete

Production hosting has not been provisioned or deployed. No reachable model server or hosting credentials were supplied, so real-model answer quality and latency have not been tested. Tests use explicit protocol fixtures and verify failure when no model is configured.

Tool execution is not wired into this service. Deep research URL retrieval is limited to explicitly allowlisted HTTPS domains, caps each response at 500 KB and 30,000 characters, does not follow redirects, and fails closed when the allowlist is absent or a source cannot be read. There is no open-web search or unrestricted browsing. The live composer captures bounded file/image metadata and only sends explicitly supported text contents to the advisory model. Council verdicts and human checkpoint decisions are persisted and clearly marked as advisory; richer execution remains in the labeled design preview. Offline draft conflict resolution still depends on a later reconnect, while connected concurrent edits now surface an explicit recovery choice. The roster catalog and college microservice are new module boundaries, but they do not claim that every legacy pipeline has been migrated.

This service requires exactly one API worker per database volume. It does not use Redis for distributed execution. Refreshing the browser leaves server work running; restarting the server marks unfinished work interrupted and retains partial output. Model context uses the last 12 nonempty messages, each capped at 8,000 characters; earlier conversation content remains in storage but is not automatically remembered.

The orbital sculpture remains browser-rendered. The hosted Blender project request was blocked by an account usage-limit approval rejection; no .blend asset was produced.

## Deployment preparation

Use `deploy/workspace/compose.yaml` for the dedicated service, persistent storage, and a Caddy HTTPS frontend. Docker is not installed in the current environment, so the container build and deployment are not validated here.

1. On a Docker host, provide a domain pointing to that host and a reachable private Ollama service with the chosen model installed.
2. Copy `deploy/workspace/.env.example` to `deploy/workspace/.env`. Set a distinct random API key for every user (`key:operator`), a random JWT secret of at least 32 characters, domain, model name, and private Ollama URL. Set `AETHERION_RESEARCH_ALLOWLIST` to comma-separated HTTPS domains if live source retrieval is desired; leave it blank to disable it. Do not commit secrets.
3. Build the dashboard with `npm ci` then `npm run build` in `dashboard`. Do not use the demo build for production. Leave `VITE_API_ORIGIN` empty for the same-origin proxy; if using a separate API origin, set its HTTPS origin at build time and explicitly allow the frontend origin on the service.
4. Run `docker compose --env-file deploy/workspace/.env -f deploy/workspace/compose.yaml up -d --build` from the repository root.
5. Verify HTTPS sign-in, isolation with two independent accounts, readiness, model output, cancellation, restart recovery, and database backup/restore before inviting users. Readiness checks configuration and storage but does not prove that the remote model can answer a prompt.

Before public rollout, add gateway rate limiting, monitoring, a tested backup schedule, token revocation policy, and capacity limits across accounts. Do not expose Ollama publicly. `/health/live` reports process liveness; `/health/ready` confirms authentication, database access, and model configuration. The configuration is a deployment candidate, not evidence of a completed production rollout.

## Validation

Focused backend and authentication tests cover storage lifecycle, event replay, API-key/JWT isolation, authentication/role boundaries, idempotency, specialist sequencing, seven-judge Council voting with Security veto, partial cancellation, provider failure, restart interruption, and allowlisted research-source persistence/fail-closed behavior. The dashboard build passes. Source retrieval tests use a mocked fetch boundary; remote source latency and deployment networking still require verification on the target host. Browser inspection verified sign-in and live service error presentation. Microphone capture, real audio output, and live model latency require user/device and deployment verification.
