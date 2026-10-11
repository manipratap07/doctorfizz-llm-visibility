import Link from "next/link";
export default function Terms() {
  return (
    <main className="wrap legal">
      <Link href="/">← DoctorFizz</Link>
      <h1>Terms of use</h1>
      <p>
        This free tool reports snapshots from provider APIs. It does not
        guarantee visibility, traffic, sales or a permanent position. API
        answers can differ from consumer applications.
      </p>
      <h2>Use and limits</h2>
      <p>
        Use the generated prompts to check websites and brands you are
        authorised to analyse. Do not submit sensitive data or use the service
        to bypass provider safeguards. One prompt across selected providers is
        one check. Five checks are available per 30-day visitor window, subject
        to daily and budget limits.
      </p>
      <h2>Availability and evidence</h2>
      <p>
        Unavailable providers are excluded from the score. If every provider
        fails, the allowance is refunded. Responses may be cached with their age
        shown. Verify the raw answer before making a business decision.
      </p>
      <h2>Independent service</h2>
      <p>
        DoctorFizz is not affiliated with the listed AI providers. Their names
        identify the source of each API response. All trademarks belong to their
        respective owners.
      </p>
      <h2>Public launch</h2>
      <p>
        The project owner must add legal entity details, jurisdiction and a
        contact address before public launch.
      </p>
    </main>
  );
}
