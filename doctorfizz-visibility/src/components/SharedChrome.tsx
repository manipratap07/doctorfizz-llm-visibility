"use client";
import { useEffect } from "react";
export function SharedHeader() {
  useEffect(() => {
    // Glass chrome and progress still work when animation is reduced or unavailable.
    const update = () => {
      if (document.documentElement.dataset.motion === "ready") return;
      document
        .getElementById("nav")
        ?.classList.toggle("stuck", window.scrollY > 80);
      const bar = document.querySelector<HTMLElement>("#progress i");
      if (bar)
        bar.style.width =
          (100 * window.scrollY) /
            Math.max(
              1,
              document.documentElement.scrollHeight - window.innerHeight,
            ) +
          "%";
    };
    window.addEventListener("scroll", update, { passive: true });
    update();
    return () => window.removeEventListener("scroll", update);
  }, []);
  return (
    <>
      <div className="progress" id="progress" aria-hidden="true">
        <i />
      </div>
      <header className="nav" id="nav">
        <div className="shell nav-in">
          <a
            className="brand"
            href="/"
            aria-label="DoctorFizz LLM visibility checker, home"
          >
            <img
              src="/brand/doctorfizz-white.png"
              alt="DoctorFizz"
              width="180"
              height="31"
              fetchPriority="high"
            />
          </a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#does">What it does</a>
            <a href="#how">How it works</a>
            <a href="#bands">Position bands</a>
            <a href="#ai">AI Overviews</a>
            <a href="#faq">FAQ</a>
          </nav>
          <a className="pill-cta" href="#tool">
            <span>Check visibility</span>
          </a>
        </div>
      </header>
    </>
  );
}
export function SharedFooter() {
  return (
    <footer className="foot">
      <div className="shell foot-in">
        <div>
          <img
            className="foot-mark"
            src="/brand/doctorfizz-white.png"
            alt="DoctorFizz"
            width="164"
            height="28"
            loading="lazy"
          />
          <p className="foot-note">
            This tool uses an essential cookie and a one way IP hash to count
            your free checks. Answers are retained for seven days. It sets no
            advertising cookies. <a href="/privacy">Tool privacy</a> ·{" "}
            <a href="/terms">Tool terms</a>
          </p>
          <p className="foot-copy">
            © {new Date().getFullYear()} Itzfizz Digital. All rights reserved.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="foot-links">
            <li>
              <a href="https://itzfizz.com" rel="noopener">
                Itzfizz Digital
              </a>
            </li>
            <li>
              <a href="https://doctorfizz.com" rel="noopener">
                DoctorFizz
              </a>
            </li>
            <li>
              <a href="https://itzfizz.com/contact" rel="noopener">
                Contact
              </a>
            </li>
            <li>
              <a href="https://itzfizz.com/privacy-policy" rel="noopener">
                Privacy policy
              </a>
            </li>
            <li>
              <a href="https://itzfizz.com/terms-of-service" rel="noopener">
                Terms of service
              </a>
            </li>
          </ul>
          <ul className="social">
            <li>
              <a
                href="https://www.linkedin.com/company/itzfizzz/"
                rel="noopener"
                aria-label="Itzfizz Digital on LinkedIn"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M4.98 3.5A2.5 2.5 0 1 1 5 8.5a2.5 2.5 0 0 1 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.77-1.95C20.4 8.75 21 11 21 14.1V21h-4v-6.1c0-1.46-.03-3.35-2.05-3.35-2.05 0-2.37 1.6-2.37 3.25V21H9z"
                  />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.instagram.com/itzfizz_digital/"
                rel="noopener"
                aria-label="Itzfizz Digital on Instagram"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M12 2.2c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.8 3.8 0 0 1-1.38-.9 3.8 3.8 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.21 15.58 2.2 15.2 2.2 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.21 8.8 2.2 12 2.2zm0 3.05A6.75 6.75 0 1 0 18.75 12 6.76 6.76 0 0 0 12 5.25zm0 11.13A4.38 4.38 0 1 1 16.38 12 4.38 4.38 0 0 1 12 16.38zm6.94-11.4a1.58 1.58 0 1 1-1.58-1.57 1.58 1.58 0 0 1 1.58 1.57z"
                  />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.youtube.com/@itzfizz_digital"
                rel="noopener"
                aria-label="Itzfizz Digital on YouTube"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M23 12s0-3.2-.41-4.74a2.5 2.5 0 0 0-1.76-1.77C19.29 5.08 12 5.08 12 5.08s-7.29 0-8.83.41A2.5 2.5 0 0 0 1.41 7.26 26 26 0 0 0 1 12a26 26 0 0 0 .41 4.74 2.5 2.5 0 0 0 1.76 1.77c1.54.41 8.83.41 8.83.41s7.29 0 8.83-.41a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12zM9.75 15.02V8.98L15.5 12z"
                  />
                </svg>
              </a>
            </li>
            <li>
              <a
                href="https://www.facebook.com/itzfizz.digital"
                rel="noopener"
                aria-label="Itzfizz Digital on Facebook"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  aria-hidden="true"
                >
                  <path
                    fill="currentColor"
                    d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"
                  />
                </svg>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
