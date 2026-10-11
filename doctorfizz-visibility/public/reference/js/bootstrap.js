/* Same locally hosted r12 motion assets as the rank checker, with route cleanup. */
(function () {
  let libraries, generation = 0;
  function load(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src; script.onload = resolve; script.onerror = reject;
      document.head.appendChild(script);
    });
  }
  function dispose() {
    generation++;
    window.DFMotion?.destroy(); window.DFMotion = undefined;
    window.DFHero?.destroy(); window.DFHero = undefined;
    delete document.documentElement.dataset.motion;
  }
  async function mount() {
    dispose(); const current = generation;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !document.getElementById('tool-card')) return;
    try {
      libraries ||= (async () => {
        await load('/reference/vendor/gsap.min.js');
        await load('/reference/vendor/ScrollTrigger.min.js');
        await load('/reference/vendor/lenis.min.js');
      })();
      await libraries;
      const motion = await import('/reference/js/motion.r12.js');
      if (current !== generation) return;
      document.documentElement.dataset.motion = 'ready';
      window.DFMotion = motion.init();
    } catch { document.documentElement.dataset.motion = 'static'; }
    try {
      if (current !== generation || navigator.connection?.saveData || (navigator.deviceMemory && navigator.deviceMemory < 4)) return;
      const probe = document.createElement('canvas');
      if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return;
      const hero = await import('/reference/js/hero.r12.js');
      if (current === generation) hero.init(document.getElementById('hero-canvas'));
    } catch { /* The shared gradient remains readable without WebGL. */ }
  }
  window.addEventListener('df:mount', mount);
  window.addEventListener('df:unmount', dispose);
  mount();
})();
