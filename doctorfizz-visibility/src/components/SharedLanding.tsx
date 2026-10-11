import { ArrowRight } from "lucide-react";
export function Stack({
  first,
  last,
  level = 2,
}: {
  first: string;
  last: string;
  level?: 1 | 2;
}) {
  const Tag = level === 1 ? "h1" : "h2";
  return (
    <Tag className="stack" data-stack>
      <span className="stack-a">
        {first.split(" ").map((w, i) => (
          <span key={i}>
            <span className="wd">
              <span className="ink">{w}</span>
            </span>{" "}
          </span>
        ))}
      </span>{" "}
      <span className="stack-b">
        {last.split(" ").map((w, i) => (
          <span key={i}>
            <span className="wd">
              <span className="ink" data-grad="1">
                {w}
              </span>
            </span>{" "}
          </span>
        ))}
      </span>
    </Tag>
  );
}
const steps = [
  [
    "Enter your brand",
    "Add your website, brand name and market. We read the site to identify its category.",
  ],
  [
    "Confirm the context",
    "Review the category, audience and location. Edit the context and regenerate the questions when needed.",
  ],
  [
    "Ask like a customer",
    "Choose one brand-neutral question and the available AI providers. One question across those providers uses one check.",
  ],
  [
    "Read the evidence",
    "Compare mentions, recommendation positions and citations. Open the original answers or export your results.",
  ],
];
export default function SharedLanding({ faq }: { faq: string[][] }) {
  return (
    <>
      <section className="sec" id="does">
        <div className="shell">
          <div className="sec-head">
            <p className="rule">01 / What it does</p>
            <Stack first="WHAT IT" last="DOES" />
            <p className="lede" data-reveal>
              Three signals, with the answer behind each one.
            </p>
          </div>
          <div className="does-grid">
            {[
              [
                "FINDS",
                "Your brand mentions",
                "Checks whether each selected provider names your brand when a customer asks about your category.",
              ],
              [
                "SHOWS",
                "The competing answers",
                "Reports recommended competitors, their order and the sources cited in each response.",
              ],
              [
                "EXPLAINS",
                "The evidence",
                "Shows the original answer, the model reported, actual search activity and cache age behind your score.",
              ],
            ].map(([v, t, d]) => (
              <article className="does" data-card key={v}>
                <span className="does-v">{v}</span>
                <h3>{t}</h3>
                <p>{d}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="pin" id="how">
        <div className="shell pin-inner">
          <div className="pin-grid">
            <div>
              <p className="rule">02 / How it works</p>
              <Stack first="HOW IT" last="WORKS" />
              <p className="lede" data-reveal>
                Four steps, from your website to the actual answers.
              </p>
              <ol className="pin-nav" id="pin-nav">
                {steps.map(([t], i) => (
                  <li key={t} className={i === 0 ? "on" : ""}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {t}
                  </li>
                ))}
              </ol>
            </div>
            <div className="pin-stack" id="pin-stack">
              {steps.map(([t, d], i) => (
                <article className="pcard" data-pcard key={t}>
                  <span className="pcard-n">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3>{t}</h3>
                  <p>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="sec" id="readout">
        <div className="shell">
          <div className="sec-head">
            <p className="rule">03 / The readout</p>
            <Stack first="WHAT YOU" last="GET BACK" />
            <p className="lede" data-reveal>
              A diagnostic score and the facts needed to assess it.
            </p>
          </div>
          <ol className="gets">
            {[
              [
                "Mentions",
                "Which successful answers name your brand. Failed providers are excluded from the denominator.",
              ],
              [
                "Position",
                "Your order among explicit recommendations. An unordered mention has no numerical position.",
              ],
              [
                "Citations",
                "Direct links to your website, including its subdomains. A source link is shown separately from a textual mention.",
              ],
              [
                "The field",
                "Recommended competitors across successful providers, with the raw answers available to inspect.",
              ],
            ].map(([t, d], i) => (
              <li key={t} data-row>
                <span className="gets-n">{String(i + 1).padStart(2, "0")}</span>
                <b>{t}</b>
                <p>{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className="sec sec-alt" id="bands">
        <div className="shell">
          <div className="sec-head">
            <p className="rule">04 / Reading the position</p>
            <Stack first="WHAT THE" last="POSITION MEANS" />
            <p className="lede" data-reveal>
              These positions describe recommendations within an answer. Your
              overall visibility score also considers mentions and citations.
            </p>
          </div>
          <div className="bands">
            {[
              [
                "1 to 3",
                "Leading recommendation",
                "Your brand appears near the top of the recommendation list. Check the wording and sources that support it.",
              ],
              [
                "4 plus",
                "In the comparison",
                "Your brand appears later in the list. Compare the reasons given for the brands ahead of it.",
              ],
              [
                "Unordered",
                "Mentioned in context",
                "The answer names your brand without a ranked recommendation. Read the context before drawing a conclusion.",
              ],
              [
                "Absent",
                "No textual mention",
                "This answer does not name your brand. Inspect the competing recommendations and any website citation separately.",
              ],
            ].map(([n, t, d], i) => (
              <article className="band" data-card key={n}>
                <span className="band-r">{n}</span>
                <h3>{t}</h3>
                <p>{d}</p>
                <div className="band-bar">
                  <i data-fill={1 - i * 0.25} />
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="sec" id="ai">
        <div className="shell sec-split">
          <div className="sec-head">
            <p className="rule">05 / AI Overviews</p>
            <Stack first="CHECK BOTH" last="SIGNALS" />
          </div>
          <div className="copy" data-reveal>
            <p>
              Your organic Google position and your appearance in AI answers
              measure different things. Use both DoctorFizz tools to understand
              both signals.
            </p>
            <p>
              This checker tests provider APIs. It does not measure Google AI
              Overview citations, and its answers can differ from consumer apps
              because of models, search settings and personalisation.
            </p>
            <a
              className="btn btn-primary"
              href="https://doctorfizz-rank-checker-working-php.vercel.app/"
            >
              <span>Open the rank checker</span>
              <ArrowRight size={17} />
            </a>
          </div>
        </div>
      </section>
      <section className="sec" id="faq">
        <div className="shell sec-split">
          <div className="sec-head">
            <p className="rule">06 / FAQ</p>
            <Stack first="COMMON" last="QUESTIONS" />
            <p className="lede" data-reveal>
              Everything to know before trusting the result.
            </p>
          </div>
          <div>
            <div className="faq">
              {faq.map(([q, a], i) => (
                <details key={q} open={i === 0} data-row>
                  <summary>{q}</summary>
                  <div className="faq-a">
                    <p>{a}</p>
                  </div>
                </details>
              ))}
            </div>
            <p className="byline" data-reveal>
              Built and maintained by the search team at Itzfizz Digital,
              Bengaluru.
            </p>
          </div>
        </div>
      </section>
      <section className="close" id="close">
        <div className="shell close-in">
          <div className="close-copy">
            <Stack first="NOT THE" last="ANSWER YOU WANTED?" />
            <p data-reveal>
              Seeing the answer is the first step. Understanding why competitors
              appear and improving the information AI can find is the work.
              Share your results with Itzfizz Digital for a visibility review.
            </p>
            <div className="close-actions" data-reveal>
              <a className="btn btn-primary" href="https://itzfizz.com/contact">
                <span>Get a free gap review</span>
                <ArrowRight size={17} />
              </a>
              <a className="btn btn-quiet" href="#tool">
                Run another check
              </a>
            </div>
          </div>
          <aside className="close-card" data-reveal>
            <p className="close-k">Who built this</p>
            <img
              src="/brand/itzfizz-black.png"
              alt="Itzfizz Digital"
              width="196"
              height="64"
              loading="lazy"
            />
            <p>
              Itzfizz Digital is a digital marketing agency in Bengaluru working
              with clients across the United Kingdom and India, running SEO,
              generative engine optimisation, content and technical programmes.
              DoctorFizz is the tooling those programmes run on, and this
              checker is one piece of it, given away free.
            </p>
            <a className="close-link" href="https://itzfizz.com">
              See how Itzfizz works <ArrowRight size={15} />
            </a>
          </aside>
        </div>
      </section>
    </>
  );
}
