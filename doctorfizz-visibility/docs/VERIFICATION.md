# Verification record

Checked on 11 October 2026.

- TypeScript: passed.
- Unit and SQL integration tests: 44 passed across four suites.
- Browser tests: three passed. Test-only transport fixtures cover site analysis, prompt/provider selection, results, evidence drawer and allowance exhaustion. Additional checks cover a 390px mobile layout, original shared logo, glass navbar scroll state, pinned four-step timeline, FAQ interaction and reduced-motion readable cards.
- Next.js production build: passed with the Node.js API bridge and VPS authentication proxy.
- Production-mode HTTP smoke: `/api/config` rejected unauthenticated access with 401 and accepted the bridge secret with 200; response contained public configuration and no provider keys.
- Bridge tests: cookie propagation, streamed response body, CSV disposition, trusted IP replacement, oversized payload rejection, missing IP failure and standalone bypass.
- Result parsing: Markdown recommendation headings and actual answer order are covered; invented evidence is rejected and provider failures remain outside the score denominator.
- Visual QA: desktop/mobile views inspected. A mobile notice spacing issue was corrected; original logos and locally hosted r12 motion are present.
- Docker context: original PNG logo assets are included rather than excluded by the previous wildcard image rule.

Browser screenshots are internal verification files and are not included in the source archive. Browser flow tests use fixtures, not live model responses.

Live provider calls, a real PostgreSQL concurrency load test, Docker execution, a hosted VPS/Vercel deployment and the ten-brand manual matrix remain unverified because credentials and target-host access were not supplied. PGlite runs the real SQL schema while advisory locking is stubbed in its integration harness. Tier C public browser locators remain experimental and disabled.
