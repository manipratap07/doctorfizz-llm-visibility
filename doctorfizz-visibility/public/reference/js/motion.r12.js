/* Motion layer, release r12.
   GSAP, ScrollTrigger and Lenis, vendored locally so no third party script runs on the page.

   Governing rule, unchanged from r11: this module owns its own start state. Nothing is hidden
   by CSS in the hope that JavaScript arrives to reveal it. Every element is visible in the
   stylesheet and gsap.set() hides it here, one frame before the animation that brings it back.
   If this file never loads the page is static and fully readable.

   What r12 adds over r11: masked word reveals instead of plain fades, drawn section rules,
   a scroll spy on the nav, magnetic and sweeping buttons, band meters, a deeper hero parallax,
   and a result reveal that deals the ladder rows in. */

const gsap = window.gsap;
const ScrollTrigger = window.ScrollTrigger;
const Lenis = window.Lenis;

if (!gsap || !ScrollTrigger) {
  throw new Error('GSAP did not load');
}

gsap.registerPlugin(ScrollTrigger);

const EASE = 'power3.out';
const q = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const desktop = () => window.matchMedia('(min-width: 1000px)').matches;
const fine = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

let lenis = null;
let smoothTicker = null;

/* ------------------------------------------------------------------ smooth scroll */

function smoothScroll() {
  if (!Lenis) { return; }

  lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false          // native scrolling on touch, which is what people expect
  });

  lenis.on('scroll', ScrollTrigger.update);
  smoothTicker = (time) => lenis?.raf(time * 1000);
  gsap.ticker.add(smoothTicker);
  gsap.ticker.lagSmoothing(0);

  q('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (ev) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') { return; }
      const target = document.querySelector(id);
      if (!target) { return; }
      ev.preventDefault();
      lenis.scrollTo(target, { offset: -88 });
    });
  });
}

/* ------------------------------------------------------------------ headings */

/* Headings resolve word by word behind a mask, so each word rises out of a hard edge rather
   than fading in mid air. Word level rather than letter level because a wrapping headline
   reflows mid animation at letter level. */
function stacks() {
  q('[data-stack]').forEach((h, index) => {
    const words = q('.wd', h);
    if (!words.length) { return; }

    // The mask is applied here, not in CSS, so the heading is plain text without this file.
    words.forEach((w) => {
      w.style.overflow = 'hidden';
      w.style.paddingBottom = '.08em';
      w.style.marginBottom = '-.08em';
    });

    gsap.set(words, { yPercent: 108, opacity: 0 });

    gsap.to(words, {
      yPercent: 0,
      opacity: 1,
      duration: .9,
      ease: 'power4.out',
      stagger: { each: .045, from: 'start' },
      scrollTrigger: index === 0 ? undefined : { trigger: h, start: 'top 86%', once: true },
      delay: index === 0 ? .12 : 0
    });
  });
}

/* The mono rule above a section heading draws itself across as the section arrives. */
function rules() {
  q('.rule').forEach((r) => {
    gsap.fromTo(r, { opacity: 0 }, {
      opacity: 1, duration: .5, ease: EASE,
      scrollTrigger: { trigger: r, start: 'top 92%', once: true }
    });
  });
}

/* ------------------------------------------------------------------ hero */

function hero() {
  const kicker = document.querySelector('[data-kicker]');
  const deck   = document.querySelector('[data-deck]');
  const facts  = document.querySelector('[data-facts]');
  const card   = document.getElementById('tool-card');
  const glow   = document.querySelector('.hero-glow');

  if (kicker) { gsap.set(kicker, { opacity: 0, y: 12 }); }
  if (deck)   { gsap.set(deck, { opacity: 0, y: 16 }); }
  if (facts)  { gsap.set(facts.querySelectorAll('div'), { opacity: 0, y: 20 }); }
  if (card)   { gsap.set(card, { opacity: 0, y: 40, clipPath: 'inset(0% 0% 100% 0%)' }); }

  const tl = gsap.timeline({ defaults: { ease: EASE } });

  if (kicker) { tl.to(kicker, { opacity: 1, y: 0, duration: .5 }, 0); }

  // The tool card wipes open from its top edge, which reads as the instrument switching on.
  if (card) {
    tl.to(card, {
      opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)',
      duration: 1.05, ease: 'power3.inOut'
    }, .28);
  }

  if (deck)  { tl.to(deck, { opacity: 1, y: 0, duration: .6 }, .5); }
  if (facts) { tl.to(facts.querySelectorAll('div'), { opacity: 1, y: 0, duration: .55, stagger: .07 }, .58); }

  // Slow ambient drift on the glow, so the hero is never completely still.
  if (glow) {
    gsap.to(glow, { xPercent: -46, yPercent: 4, scale: 1.08, duration: 14, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  }

  // The layers separate on exit instead of scrolling as one flat sheet.
  const canvas = document.getElementById('hero-canvas');
  if (canvas) {
    gsap.to(canvas, {
      yPercent: 16, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .5 }
    });
  }
  if (glow) {
    gsap.to(glow, {
      yPercent: 24, opacity: .35, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .8 }
    });
  }
  const copy = document.querySelector('.hero-copy');
  if (copy && desktop()) {
    gsap.to(copy, {
      y: -60, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: .6 }
    });
  }
}

/* ------------------------------------------------------------------ pinned stack */

/* The signature moment. The section pins and the cards deal themselves into place as you
   scroll, one replacing the last, with the index on the left keeping pace. On narrow screens
   the pin is skipped entirely and the cards are a plain stacked list. */
function pinnedStack() {
  const section = document.getElementById('how');
  const stack   = document.getElementById('pin-stack');
  if (!section || !stack) { return; }

  const cards = q('[data-pcard]', stack);
  const nav   = q('#pin-nav li');
  if (cards.length < 2) { return; }

  ScrollTrigger.matchMedia({
    '(min-width: 1000px)': function () {
      gsap.set(cards, { force3D: true, transformPerspective: 1200, transformOrigin: 'center top' });
      gsap.set(cards.slice(1), { yPercent: 110, opacity: 0, rotateX: -10, scale: .96 });
      gsap.set(cards[0], { yPercent: 0, opacity: 1, rotateX: 0, scale: 1 });

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top top',
          end: '+=' + (cards.length * 620),
          scrub: .6,
          pin: true,
          anticipatePin: 1,
          onUpdate(self) {
            const i = Math.min(cards.length - 1, Math.floor(self.progress * cards.length));
            nav.forEach((li, n) => li.classList.toggle('on', n === i));
          }
        }
      });

      cards.forEach((card, i) => {
        if (i === 0) { return; }
        const prev = cards[i - 1];
        tl.to(prev, { yPercent: -16, opacity: 0, scale: .93, rotateX: 8, duration: .5, ease: 'power2.in' }, i - 1)
          .to(card, { yPercent: 0, opacity: 1, scale: 1, rotateX: 0, duration: .5, ease: 'power2.out' }, i - 1 + .12);
      });
    },
    '(max-width: 999px)': function () {
      gsap.set(cards, { clearProps: 'all' });
      ScrollTrigger.batch(cards, {
        start: 'top 92%',
        onEnter: (batch) => gsap.from(batch, {
          opacity: 0, y: 30, duration: .6, stagger: .08, ease: EASE, overwrite: true
        })
      });
    }
  });
}

/* ------------------------------------------------------------------ generic reveals */

function reveals() {
  const nodes = q('[data-reveal]');
  if (nodes.length) {
    gsap.set(nodes, { opacity: 0, y: 24 });
    ScrollTrigger.batch(nodes, {
      start: 'top 90%',
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: .75, stagger: .09, ease: EASE, overwrite: true })
    });
  }

  // Cards tilt up on a perspective, so a row reads as one object turning toward you.
  const cards = q('[data-card]');
  if (cards.length) {
    gsap.set(cards, { opacity: 0, y: 46, rotateX: -12, transformPerspective: 900, transformOrigin: 'center top' });
    ScrollTrigger.batch(cards, {
      start: 'top 90%',
      onEnter: (b) => gsap.to(b, {
        opacity: 1, y: 0, rotateX: 0, duration: .85, stagger: .1, ease: EASE, overwrite: true
      })
    });
  }

  const rows = q('[data-row]');
  if (rows.length) {
    gsap.set(rows, { opacity: 0, x: -20 });
    ScrollTrigger.batch(rows, {
      start: 'top 93%',
      onEnter: (b) => gsap.to(b, { opacity: 1, x: 0, duration: .55, stagger: .07, ease: EASE, overwrite: true })
    });
  }

  // Panels that wipe open from their leading edge. Used on the grid style blocks.
  const wipes = q('[data-wipe]');
  if (wipes.length) {
    gsap.set(wipes, { clipPath: 'inset(0% 100% 0% 0%)' });
    ScrollTrigger.batch(wipes, {
      start: 'top 88%',
      onEnter: (b) => gsap.to(b, {
        clipPath: 'inset(0% 0% 0% 0%)', duration: 1.1, stagger: .12, ease: 'power3.inOut', overwrite: true
      })
    });
  }

  // The band meters fill to their share of the first 50 results.
  q('.band-bar i').forEach((bar) => {
    const to = parseFloat(bar.getAttribute('data-fill') || '1');
    gsap.fromTo(bar, { scaleX: 0 }, {
      scaleX: Math.max(.06, Math.min(1, to)),
      duration: 1.1,
      ease: 'power3.out',
      scrollTrigger: { trigger: bar, start: 'top 94%', once: true }
    });
  });
}

function counters() {
  q('[data-count]').forEach((node) => {
    const raw = node.getAttribute('data-count');
    const unit = node.getAttribute('data-unit') || '';
    const target = parseFloat(raw);
    if (!isFinite(target)) { return; }

    const decimals = (raw.split('.')[1] || '').length;
    const obj = { n: 0 };

    gsap.to(obj, {
      n: target, duration: 1.6, ease: 'power2.out',
      scrollTrigger: { trigger: node, start: 'top 92%', once: true },
      onUpdate() { node.textContent = obj.n.toFixed(decimals) + unit; },
      onComplete() { node.textContent = raw + unit; }
    });
  });
}

/* ------------------------------------------------------------------ chrome */

function chrome() {
  const bar = document.querySelector('#progress i');
  if (bar) {
    gsap.to(bar, {
      width: '100%', ease: 'none',
      scrollTrigger: { start: 0, end: () => document.body.scrollHeight - window.innerHeight, scrub: .3 }
    });
  }

  const nav = document.getElementById('nav');
  if (nav) {
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate: (self) => nav.classList.toggle('stuck', self.scroll() > 80)
    });
  }

  // Scroll spy. The nav link for the section you are reading carries its own underline.
  q('.nav-links a[href^="#"]').forEach((link) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) { return; }
    ScrollTrigger.create({
      trigger: target,
      start: 'top 45%',
      end: 'bottom 45%',
      onToggle: (self) => link.classList.toggle('on', self.isActive)
    });
  });

  const card = document.querySelector('.close-card');
  if (card && desktop()) {
    gsap.to(card, {
      y: -40, ease: 'none',
      scrollTrigger: { trigger: '.close', start: 'top bottom', end: 'bottom top', scrub: .6 }
    });
  }
}

/* Primary buttons lean toward the cursor. Small, and only on a real pointer. */
function magnets() {
  if (!fine()) { return; }
  q('[data-magnet], .primary, .btn-go, .btn-primary, .pill-cta').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: .45, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: .45, ease: 'power3' });

    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      xTo((ev.clientX - r.left - r.width / 2) * .14);
      yTo((ev.clientY - r.top - r.height / 2) * .22);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------------ result */

export function revealResult(resultEl, summaryEl, ladderEl) {
  const tl = gsap.timeline({ defaults: { ease: EASE } });

  if (resultEl) {
    tl.fromTo(resultEl,
      { opacity: 0, y: 24, clipPath: 'inset(0% 0% 100% 0%)' },
      { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: .7, ease: 'power3.inOut' }, 0);

    const num = resultEl.querySelector('.rd-num');
    if (num) { tl.from(num, { scale: .78, duration: .75, ease: 'back.out(1.9)' }, .08); }

    const chip = resultEl.querySelector('.chip');
    if (chip) { tl.from(chip, { opacity: 0, y: -8, duration: .4 }, .3); }

    const advice = resultEl.querySelector('.rd-advice');
    if (advice) { tl.from(advice, { opacity: 0, x: -10, duration: .45 }, .38); }
  }
  if (summaryEl) {
    tl.from(summaryEl.querySelectorAll('.sm'), { opacity: 0, y: 16, duration: .45, stagger: .07 }, .24);
  }
  if (ladderEl) {
    tl.from(ladderEl.querySelectorAll('.rung'), {
      opacity: 0, x: -16, duration: .4, stagger: .03, clearProps: 'all'
    }, .34);

    const hit = ladderEl.querySelector('.rung.hit');
    if (hit) {
      tl.fromTo(hit, { backgroundColor: 'rgba(255,166,21,.28)' }, { backgroundColor: 'rgba(255,166,21,.04)', duration: 1.1 }, .8);
    }
  }

  ScrollTrigger.refresh();
}

export function openModal(card) {
  gsap.from(card, { opacity: 0, y: 26, scale: .96, duration: .42, ease: 'power3.out' });
}

/* Used by the app layer to bring the tool back into view without fighting Lenis. */
export function scrollToTool(el) {
  if (!el) { return; }
  if (lenis) { lenis.scrollTo(el, { offset: -96 }); return; }
  const y = el.getBoundingClientRect().top + window.pageYOffset - 96;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

/* ------------------------------------------------------------------ init */

export function init() {
  const ctx = gsap.context(() => {
    smoothScroll(); stacks(); rules(); hero(); reveals(); pinnedStack(); counters(); chrome(); magnets();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  const refresh = () => ScrollTrigger.refresh();
  window.addEventListener('df:layout', refresh);
  return { revealResult, openModal, scrollToTool, destroy() { ctx.revert(); if (smoothTicker) gsap.ticker.remove(smoothTicker); lenis?.destroy(); lenis = null; window.removeEventListener('df:layout',refresh); } };
}
