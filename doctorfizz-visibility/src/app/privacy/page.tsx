import Link from "next/link";
import DeleteData from "@/components/DeleteData";
export default function Privacy() {
  return (
    <main className="wrap legal">
      <Link href="/">← DoctorFizz</Link>
      <h1>Privacy policy</h1>
      <p>
        DoctorFizz uses your website, brand and chosen category to generate
        prompts and analyse provider answers. The prompt, rather than your
        supplied brand details, is sent to the selected visibility providers.
        Website metadata and brand exclusions may be sent to the OpenAI
        classifier.
      </p>
      <h2>Essential cookie and limits</h2>
      <p>
        A signed HTTP-only visitor cookie tracks your free checks for 30 days. A
        salted IP hash supports daily abuse controls. We do not store raw IP
        addresses. Your host must configure its trusted proxy correctly.
      </p>
      <h2>Retention and public result links</h2>
      <p>
        Result links contain unguessable IDs and remain accessible to anyone
        with the link for seven days. Avoid entering confidential information.
        Allowance records and profiles expire after 31 days. Raw response caches
        expire after six hours by default. Lead details expire after 90 days.
      </p>
      <h2>Provider processing</h2>
      <p>
        Selected API providers process your chosen prompt under their respective
        policies. Cloudflare Turnstile verifies the run action. There are no
        advertising trackers in this build.
      </p>
      <h2>Audit requests</h2>
      <p>
        Your contact details are saved only when you submit the audit form with
        consent. They are used to respond to that request.
      </p>
      <h2>Delete your data</h2>
      <p>
        You can remove the brand information, responses and lead details
        associated with this browser. Hashed allowance records remain until
        expiry to protect the free service.
      </p>
      <DeleteData />
      <p>
        The project owner must add the legal controller identity and privacy
        contact before public launch.
      </p>
    </main>
  );
}
