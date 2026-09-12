# Global glass experience

The entry experience combines a midnight glass interface, a pearl-finish interactive 3D orbital sculpture, scroll-revealed institutional chapters, responsive account access, and local-time greetings. The conversation workspace uses the same glass surfaces and a personalized empty-state greeting.

## What works

- Country/region search across 245 supported dialing regions, including shared codes such as United States and Canada (+1).
- National numbers, formatting spaces, and pasted international numbers normalize to E.164 before OTP requests. Region selection is remembered on this browser; the phone number is not stored by this feature.
- Separate email/phone sign-in and signup, Google/GitHub provider entry, fixed OTP destination, resend cooldown, and inline recovery messages. Existing backend identity exchange still verifies the provider session.
- Local time and morning/afternoon/evening greetings update from the device clock and time zone. They are independent of the phone region, so travelers and VPN users can keep the correct number and local greeting.
- Motion can be paused. Reduced-motion preferences and hidden tabs stop automatic rotation; the sculpture loads near the viewport and has a CSS fallback. Mobile scrolling remains native.

The sculpture reuses the existing Blender-exported `glass-citadel.glb` geometry with a new pearl material finish. Regenerate `dashboard/public/glass-citadel-pearl.glb` with `python scripts/refine_glass_citadel.py`. This is a material refinement, not a newly modeled Blender scene.

## Enable account access

Use the identity configuration documented in [LIVE_WORKSPACE.md](LIVE_WORKSPACE.md). Configure Supabase email, SMS, Google and GitHub providers and the deployed `/workspace` redirect URL. Configure the email template with `{{ .Token }}` for the code-entry interface. Sign-in sends `shouldCreateUser: false`; the separate Create account action enables signup. See [Supabase OTP reference](https://supabase.com/docs/reference/javascript/auth-signinwithotp) and [phone login setup](https://supabase.com/docs/guides/auth/phone-login).

Provider credentials and SMS delivery are deployment requirements. An unconfigured installation says so inline; it does not fabricate successful authentication. Public previews remain labeled demonstrations and do not establish real sessions.

## Optional network country suggestion

`GET /api/experience/context` returns only a country code and source, with `Cache-Control: private, no-store`. The lookup uses the request IP against a local MaxMind-compatible country MMDB. It makes no third-party geolocation request, does not return the address, and does not persist it in this feature. Hosting access logs remain governed by the operator's logging policy. A missing database or unavailable region never blocks sign-in.

1. Obtain and maintain a licensed country MMDB; place it in `deploy/workspace/geoip/`. Database files are ignored by Git.
2. Set `AETHERION_GEOIP_DATABASE=/geoip/GeoLite2-Country.mmdb` (or the actual filename). The Compose service mounts this directory read-only. Ensure the service user can read the file.
3. Set `AETHERION_TRUSTED_PROXY_CIDRS` to only the actual reverse proxy IPs/subnets on your deployment. Leave it blank for direct connections. Never use a catch-all range. The Docker command disables Uvicorn's implicit proxy-header rewriting so the application can check the raw peer; use `--no-proxy-headers` for other launch commands too.
4. Verify through the deployed proxy that a genuine visitor gets the expected coarse country and spoofed forwarding headers cannot override it. The right-to-left forwarding-chain walk stops at the first untrusted hop. VPN/proxy regions may differ from a user's home country; the user can always change the selection.

Country lookup is a suggestion, never authentication, authorization, precise location, or proof of residence. The browser first uses a saved selection or explicit language region, and will not replace a region once the user starts entering their number. If the backend cannot suggest a country, selection remains available manually. The clock never depends on geolocation. See [MaxMind DB reader](https://maxminddb.readthedocs.io/en/latest/).

## Verification

Run `node --test tests/experience.test.mjs` from `dashboard`, build with `npm run build`, and run `tests/test_experience_context.py` alongside the conversation, live workspace, and institution identity tests. These cover dialing normalization, shared codes, time zones/DST, proxy trust, coarse uncached responses, and unavailable databases. Review desktop/mobile entry, country search, Escape focus return, validation, and demo entry in the browser.

This change improves the experience over the existing institution architecture. It does not claim all catalog agents are independent live services or that production authentication, SMS delivery, or hosting has been provisioned.
