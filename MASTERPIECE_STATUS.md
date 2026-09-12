# Aetherion masterpiece implementation

This iteration adds a glassmorphism identity surface, an editable Blender Glass Citadel, and a versioned institution catalog.

## Delivered

- The login page uses a dark glass surface with responsive layout, pointer-reactive lighting, motion pause, reduced-motion support, OTP states, and provider setup messaging.
- Email OTP, phone OTP, Google OAuth, and GitHub OAuth are implemented through the configured identity provider adapter. API-key login remains available for administrators.
- The browser renders `dashboard/public/glass-citadel.glb`. The editable source is `outputs/glass-citadel.blend` and revision 1 is available in the 3D Jutsu project.
- `institution/catalog.json` contains all 74 roster agents in all 14 colleges. `institution/registry.py` provides versioned definitions and bounded deterministic routing. `institution/service.py` exposes authenticated advisory analysis.
- `deploy/workspace/colleges.yaml` provides one constrained microservice profile per college.

## Configuration required

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` for the browser. Configure email/SMS delivery and Google/GitHub OAuth redirect URLs in the identity provider. Set the matching server variables in `deploy/workspace/.env`.

The default verified-identity role is `operator` so a new verified account can start a workspace. Set `AETHERION_IDENTITY_DEFAULT_ROLE=viewer` for invite-only deployments and grant operator access through administrator-controlled app metadata.

The identity provider, model server, email/SMS gateway, and hosting account were not available in this environment, so external sign-in delivery and production deployment remain unverified. No model is trained from scratch; “new models” here means new agent and service modules around an administrator-configured provider.

## Verification

The focused backend and identity suite passes: 106 tests. The production and demo dashboard builds pass. Browser inspection confirmed the GLB renders and the sign-in surface exposes the requested methods. Build output includes a warning that the model-viewer chunk is large; it is dynamically loaded only on the login surface.
