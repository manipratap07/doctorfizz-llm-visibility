export default function StructuredData() {
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "DoctorFizz LLM Visibility Checker",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description:
          "Check brand mentions, recommendations and citations in AI provider API answers.",
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      },
      {
        "@type": "FAQPage",
        mainEntity: [
          {
            q: "What does this check measure?",
            a: "It checks a neutral customer question against selected AI provider APIs for brand mentions, recommendations and citations.",
          },
          {
            q: "Are these permanent rankings?",
            a: "No. Every result is a dated API snapshot. Consumer apps may produce different answers.",
          },
          {
            q: "What happens if a provider fails?",
            a: "Unavailable providers are excluded from scoring. An all-provider failure refunds the check.",
          },
        ].map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
    ],
  };
  return <script type="application/ld+json">{JSON.stringify(data)}</script>;
}
