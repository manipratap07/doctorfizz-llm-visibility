# Shared rank-checker audit

Inspected on 11 October 2026: https://doctorfizz-rank-checker-working-php.vercel.app/.

The page uses DoctorFizz's r12 assets: Manrope/Fira Code, a 1280px shell, 72px fixed navbar, near-black ruled background, rust/orange/gold gradient, 14px controls and 22px panels. The navbar has section links, a pill CTA, active section underline and scroll-triggered glass background. The footer includes the DoctorFizz logo, Itzfizz product/contact/legal links and the same four social icons.

Its motion layer uses GSAP, ScrollTrigger and Lenis. It animates word masks, the opening tool-card wipe, count-up facts, perspective cards, horizontal row reveals, panel wipes, pinned four-step cards, progress bar, button attraction, gradient sweeps and closing-card parallax. Its Three.js hero is a moving point field, paused outside the viewport; reduced motion skips the scene.

This revision reuses the actual PNG logos, locally hosted vendor assets and original r12 motion timings. The landing content uses the same structure and CSS with LLM-specific copy and controls. The CTA says “Check visibility” because it opens the LLM tool. The footer's data notice accurately describes this tool's cookie, hash and answer retention. These two pieces of copy intentionally reflect the different functionality.

Reference rank-checker task: keyword/domain + country/language + scan depth; organic Google position and competing pages. LLM task: website/brand + detected category/audience/location + neutral question/provider selection; AI mentions, recommendation order, citations, competing recommendations and raw-answer evidence. The LLM workflow and 30-day free-check window are retained rather than copying the rank checker's daily allowance.

No rank-checker query was submitted and its backend accuracy was not independently measured. Frontend/motion inspection used the public page and its delivered assets. The rank-checker source repository was not supplied and is not modified by this package.

## Shared assets and maintenance

- `src/components/SharedChrome.tsx`: navbar and footer, including the original social SVG paths.
- `src/components/SharedLanding.tsx`: reference-style educational sections and headings.
- `src/app/reference.css`: shared r12 styling plus LLM form overrides.
- `public/brand/`: original DoctorFizz and Itzfizz logos.
- `public/reference/`: local motion/WebGL modules and their vendor dependencies.
- `docs/reference/rank-checker.css`: original style snapshot for comparison.

Keep vendor copyright/license headers. If the rank checker is updated, update both tools' shared components from one reviewed source to prevent drift. The bundled `motion.r12.js` adds managed scene cleanup and applies the existing magnetic effect to the LLM primary buttons.
