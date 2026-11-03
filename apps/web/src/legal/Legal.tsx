import { LEGAL_VERSION, legalDateLabel, missingLegalDetails, privacyPolicy, termsOfUse, type LegalSection } from "@apex/core";
import { Icons, ThemeButton } from "@apex/ui";
import { useEffect, useState } from "react";

type Page = "privacy" | "terms";
const pageFromHash = (): Page => (location.hash === "#terms" ? "terms" : "privacy");

/** The privacy policy and terms of use, one page with a switch between them (/legal/#privacy, /legal/#terms). */
export function Legal() {
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    document.title = `APEX · ${page === "terms" ? "Terms of use" : "Privacy policy"}`;
  }, [page]);
  const sections: LegalSection[] = page === "terms" ? termsOfUse() : privacyPolicy();
  const draft = missingLegalDetails().length > 0;
  return (
    <main className="legal">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <a className="wordmark" href="/" style={{ gap: 8, textDecoration: "none", color: "inherit" }}><Icons.logo width={22} height={22} /><b style={{ fontSize: 18 }}>APEX</b></a>
        <ThemeButton />
      </div>
      <div className="chips" role="tablist" style={{ marginTop: 24 }}>
        <a role="tab" aria-selected={page === "privacy"} className={`chip ${page === "privacy" ? "on" : ""}`} style={{ textDecoration: "none" }} href="#privacy">Privacy policy</a>
        <a role="tab" aria-selected={page === "terms"} className={`chip ${page === "terms" ? "on" : ""}`} style={{ textDecoration: "none" }} href="#terms">Terms of use</a>
      </div>
      <h1 className="h1" style={{ marginTop: 20 }}>{page === "terms" ? "Terms of use" : "Privacy policy"}</h1>
      <p className="tiny">Version {legalDateLabel(LEGAL_VERSION)}</p>
      {draft && <div className="legal-draft small">Draft. The business name, contact email and address in square brackets still need filling in before launch.</div>}
      {sections.map((s) => (
        <section key={s.heading}>
          <h2 className="h3">{s.heading}</h2>
          {s.paragraphs.map((p) => <p key={p} className="small">{p}</p>)}
        </section>
      ))}
    </main>
  );
}
