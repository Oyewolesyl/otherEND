import { useEffect, useMemo, useState } from "react";
import { ArtifactCard } from "./components/ArtifactCard";
import { DisciplineCard } from "./components/DisciplineCard";
import { ScoreRing } from "./components/ScoreRing";
import { artifacts, disciplines, risks, standards, workflow } from "./data/reviewModel";

const starterBrief =
  "build a subscription saas where teams can create projects, invite members, assign tasks, upload files, and receive weekly planning summaries.";

const guideSteps = [
  {
    title: "what otherend does",
    body: "describe the app you want to build or upload a zip of existing code. otai, the otherend ai reviewer, checks the parts most vibe-built products miss.",
  },
  {
    title: "start with the brief",
    body: "write in normal language. say who the app is for, what users can do, what data is stored, and what must be protected.",
  },
  {
    title: "run the review",
    body: "press save and check. otai turns your idea or code zip into clear fixes, risks, and a simple readiness score before you build or ship.",
  },
  {
    title: "use the output",
    body: "free explains what is wrong. paid drafts the corrected approach and stronger build prompt for cursor, claude, codex, or any coding tool.",
  },
];

type ApiReview = {
  readiness: number;
  controls: string[];
  blockers: string[];
  implementationPrompt: string;
  tier?: "free" | "paid";
  paidFixes?: string[];
  codeScan?: CodeScan | null;
};

type CodeScan = {
  fileName: string;
  size: number;
  fileCount: number;
  sampleFiles: string[];
  findings: string[];
  warnings: string[];
  reviewContext: string;
};

type ApiProject = {
  id: string;
  title: string;
  brief: string;
  review?: ApiReview | null;
};

function App() {
  const [brief, setBrief] = useState(starterBrief);
  const [activeDiscipline, setActiveDiscipline] = useState(disciplines[0].id);
  const [email, setEmail] = useState("founder@otherend.dev");
  const [token, setToken] = useState(() => localStorage.getItem("otherend_token") || "");
  const [projectId, setProjectId] = useState("");
  const [serverReview, setServerReview] = useState<ApiReview | null>(null);
  const [status, setStatus] = useState(token ? "you are signed in. describe an app and run a review." : "sign in to save your app idea and review.");
  const [storageMode, setStorageMode] = useState("checking");
  const [projectCount, setProjectCount] = useState(0);
  const [auditCount, setAuditCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(() => localStorage.getItem("otherend_guide_seen") !== "yes");
  const [guideStep, setGuideStep] = useState(0);
  const [tier, setTier] = useState<"free" | "paid">("free");
  const [codeScan, setCodeScan] = useState<CodeScan | null>(null);
  const [repoUrl, setRepoUrl] = useState("");

  const selected = disciplines.find((discipline) => discipline.id === activeDiscipline) ?? disciplines[0];

  const readinessScore = useMemo(() => {
    const average = disciplines.reduce((total, item) => total + item.score, 0) / disciplines.length;
    const briefLift = Math.min(4, Math.floor(brief.length / 160));
    return Math.min(94, Math.round(average + briefLift));
  }, [brief]);

  const briefSummary = useMemo(() => {
    const cleanBrief = brief.trim() || "a software project";
    return cleanBrief.length > 150 ? `${cleanBrief.slice(0, 150).trim()}...` : cleanBrief;
  }, [brief]);

  const nextStep = useMemo(() => {
    if (!token) return "enter an email and sign in. this lets otherend remember your projects and reviews.";
    if (!projectId) return "describe what you want to build, or upload a zip of existing code, then press save and check.";
    if (!serverReview) return "your project is saved. press save and review again if you changed the brief.";
    return tier === "paid"
      ? "read otai's corrected approach, then copy the build prompt or export the handoff."
      : "read the risks and fixes. switch to paid when you want otai to draft the corrected approach.";
  }, [projectId, serverReview, tier, token]);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => response.json())
      .then((body) => setStorageMode(body.storage || "unknown"))
      .catch(() => setStorageMode("offline"));
  }, []);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: "request failed" }));
      throw new Error(body.error || "request failed");
    }
    return response;
  }

  async function signIn() {
    setStatus("signing in...");
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, name: "otherend builder" }),
    });
    const body = await response.json();
    if (!response.ok) {
      setStatus(body.error || "sign in failed");
      return;
    }
    localStorage.setItem("otherend_token", body.token);
    setToken(body.token);
    setStorageMode(body.storage || storageMode);
    setStatus(`signed in as ${body.user.email}. workspace is ready for saved reviews.`);
    await refreshWorkspace(body.token);
  }

  async function refreshWorkspace(activeToken = token) {
    if (!activeToken) return;
    const request = (path: string) =>
      fetch(path, {
        headers: {
          authorization: `Bearer ${activeToken}`,
        },
      }).then((response) => {
        if (!response.ok) throw new Error("workspace refresh failed");
        return response.json();
      });
    const [projectsBody, auditBody] = await Promise.all([request("/api/projects"), request("/api/audit-logs")]);
    setProjectCount((projectsBody.projects || []).length);
    setAuditCount((auditBody.auditLogs || []).length);
    const latestReviewed = (projectsBody.projects || []).find((project: ApiProject) => project.review);
    if (latestReviewed?.review && !serverReview) setServerReview(latestReviewed.review);
  }

  async function runServerReview() {
    try {
      setStatus("saving your app idea...");
      let activeProjectId = projectId;
      if (!activeProjectId) {
        const created = await api("/api/projects", {
          method: "POST",
          body: JSON.stringify({ title: "production readiness review", brief }),
        }).then((response) => response.json());
        activeProjectId = created.project.id;
        setProjectId(activeProjectId);
      } else {
        await api(`/api/projects/${activeProjectId}`, {
          method: "PUT",
          body: JSON.stringify({ title: "production readiness review", brief }),
        });
      }

      setStatus("checking the build for backend, database, security, testing, and launch issues...");
      const reviewed = await api(`/api/projects/${activeProjectId}/review`, {
        method: "POST",
        body: JSON.stringify({ tier, codeScan }),
      }).then((response) => response.json());
      setServerReview(reviewed.review);
      setStatus("review complete. otherend found what is ready, what needs fixing, and what to do next.");
      await refreshWorkspace();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "review failed");
    }
  }

  async function exportReview() {
    try {
      if (!projectId) {
        setStatus("run a review first. then export will copy the full review document.");
        return;
      }
      const response = await api(`/api/projects/${projectId}/export`, {
        headers: { accept: "text/markdown" },
      });
      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);
      setStatus("review document copied. paste it into docs, github, notion, or send it to a developer.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "export failed");
    }
  }

  async function downloadCorrectedPackage() {
    try {
      if (!projectId) {
        setStatus("run a paid otai review first. then the corrected package can be downloaded.");
        return;
      }
      const response = await api(`/api/projects/${projectId}/package`, {
        headers: { accept: "application/zip" },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "otherend-corrected-package.zip";
      link.click();
      URL.revokeObjectURL(url);
      setStatus("corrected package downloaded. it contains otai's safer approach, checklist, and build prompt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "corrected package download failed");
    }
  }

  async function copyPrompt() {
    const prompt =
      serverReview?.implementationPrompt ||
      `build this project with production engineering standards:\n\n${brief}\n\ninclude architecture, backend contracts, security controls, testing, deployment, and release readiness.`;
    await navigator.clipboard.writeText(prompt);
    setStatus("build prompt copied. paste it into your coding tool so it builds from the reviewed plan.");
  }

  async function scanZip(file: File | null) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setStatus("upload a .zip file so otai can inspect the project structure.");
      return;
    }
    setStatus("reading your zip file...");
    const base64 = await new Promise<string>((resolveFile, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolveFile(String(reader.result || ""));
      reader.onerror = () => reject(new Error("could not read zip file"));
      reader.readAsDataURL(file);
    });
    try {
      setStatus("otai is scanning the uploaded code structure...");
      const response = await api("/api/code-scan", {
        method: "POST",
        body: JSON.stringify({ fileName: file.name, base64 }),
      }).then((bodyResponse) => bodyResponse.json());
      setCodeScan(response.scan);
      setStatus(`code scan ready. otai found ${response.scan.fileCount} files and ${response.scan.warnings.length} warning areas.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "zip scan failed");
    }
  }

  async function scanGithubRepo() {
    try {
      setStatus("otai is downloading the public github repo for review...");
      const response = await api("/api/github-scan", {
        method: "POST",
        body: JSON.stringify({ repoUrl }),
      }).then((bodyResponse) => bodyResponse.json());
      setCodeScan(response.scan);
      setStatus(`github scan ready. otai found ${response.scan.fileCount} files and ${response.scan.warnings.length} warning areas.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "github scan failed");
    }
  }

  async function startPaidCheckout() {
    try {
      setStatus("checking stripe checkout...");
      const body = await api("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ email }),
      }).then((response) => response.json());
      if (body.url) {
        setStatus("opening stripe checkout for paid otai review...");
        window.location.href = body.url;
        return;
      }
      setStatus(body.message || "stripe is not connected yet. add payment keys before taking paid users.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "stripe checkout failed");
    }
  }

  function closeGuide() {
    localStorage.setItem("otherend_guide_seen", "yes");
    setGuideOpen(false);
  }

  function nextGuideStep() {
    if (guideStep >= guideSteps.length - 1) {
      closeGuide();
      return;
    }
    setGuideStep((step) => step + 1);
  }

  return (
    <main>
      <section className="shell">
        <header className="topbar" aria-label="primary">
          <a className="brand" href="#console" aria-label="otherEND home">
            <img src="/brand/otherend-main.png" alt="otherEND" />
          </a>
          <button
            className="menu-button"
            type="button"
            aria-controls="app-nav"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span aria-hidden="true"></span>
            menu
          </button>
          <nav id="app-nav" className={menuOpen ? "is-open" : ""}>
            <a href="#review" onClick={() => setMenuOpen(false)}>start</a>
            <a href="#artifacts" onClick={() => setMenuOpen(false)}>outputs</a>
            <a href="#standards" onClick={() => setMenuOpen(false)}>checks</a>
            <a href="https://otherend.vercel.app/" onClick={() => setMenuOpen(false)}>landing</a>
          </nav>
          <button className="guide-button" type="button" onClick={() => { setGuideStep(0); setGuideOpen(true); }}>
            guide
          </button>
          <button className="export-button" aria-label="export markdown review" title="copy the saved review as markdown" onClick={exportReview}>
            export
          </button>
        </header>

        <section className="console-grid" id="console">
          <div className="intro-panel">
            <p className="eyebrow">review workspace</p>
            <h1>know what is wrong before you build.</h1>
            <p className="lede">
              describe your app in normal language or upload a zip of code. otai checks the backend, database, security,
              testing, and launch risks so you know what to fix before code becomes a problem.
            </p>
            <div className="purpose-list" aria-label="what this app does">
              <span>1. describe the app you want</span>
              <span>2. upload code if you already have it</span>
              <span>3. see what needs fixing</span>
              <span>4. copy the improved build prompt</span>
            </div>
            <div className="cta-row action-row">
              <div>
                <button className="primary-action" onClick={runServerReview} title="save this brief and check backend, database, security, testing, and launch risks">
                  check my app idea
                </button>
                <small>otai checks your idea or uploaded code and explains what is safe, risky, or missing.</small>
              </div>
              <div>
                <a className="secondary-action" href="#artifacts" title="jump to the documents and reports this review creates">
                  see outputs
                </a>
                <small>shows the documents and prompts this review creates for you.</small>
              </div>
            </div>
            <div className="proof-row" aria-label="review promises">
              <span>database plan</span>
              <span>security checks</span>
              <span>launch advice</span>
            </div>
          </div>

          <aside className="system-panel" aria-label="active review state">
            <div className="live-badge">
              <span>{readinessScore}% readiness</span>
            </div>
            <div className="system-head">
              <p className="eyebrow">active review</p>
              <h2>how ready each part looks</h2>
            </div>
            <div className="gate-stack">
              {disciplines.slice(0, 4).map((discipline) => {
                return (
                  <article key={discipline.id}>
                    <span>{discipline.title}</span>
                    <strong>{discipline.score}</strong>
                  </article>
                );
              })}
            </div>
            <div className="signal-grid">
              <div>
                <strong>{projectCount}</strong>
                <span>saved ideas</span>
              </div>
              <div>
                <strong>{auditCount}</strong>
                <span>actions logged</span>
              </div>
              <div>
                <strong>{storageMode}</strong>
                <span>save mode</span>
              </div>
            </div>
            <div className="decision-row">
              <span>can i keep building?</span>
              <strong>{serverReview && serverReview.blockers.length === 0 ? "yes" : "check first"}</strong>
            </div>
            <div className="review-note">
              <span>what this means</span>
              <p>
                {serverReview
                  ? `your review is saved. otherend listed ${serverReview.controls.length} fixes or safeguards to include before launch.`
                  : "run a review to turn your idea into risks, fixes, and a better prompt for your coding tool."}
              </p>
            </div>
          </aside>
        </section>

        <section className="auth-panel">
          <div>
            <p className="eyebrow">workspace</p>
            <h2>save the idea, review it, then hand off the result.</h2>
          </div>
            <div className="database-summary" aria-label="database implementation">
              <span>saving your work</span>
              <strong>{storageMode === "postgres" ? "database saving is active" : "temporary saving is active"}</strong>
              <p>otherend can remember users, workspaces, app ideas, reviews, and action history. connect postgres for permanent storage.</p>
            </div>
            <div className="auth-controls">
            <input
              aria-label="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
            <button className="secondary-action" onClick={signIn} title="create or resume a workspace so reviews can be saved">
              sign in
            </button>
            <span>{status}</span>
          </div>
        </section>

        <section className="activity-panel" aria-live="polite">
          <div>
            <span>current action</span>
            <strong>{status}</strong>
          </div>
          <div>
            <span>next step</span>
            <p>{nextStep}</p>
          </div>
        </section>

        <section className="workbench" id="review">
          <div className="brief-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">step 1</p>
                <h2>describe what you want to build</h2>
              </div>
            </div>
            <textarea
              aria-label="project brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={8}
            />
            <p className="field-help">
              write like you are explaining the app to a teammate. include users, data, payments, files, permissions, and anything sensitive.
            </p>
            <div className="upload-panel">
              <div>
                <span>optional code review</span>
                <strong>upload a zip or scan a public github repo</strong>
                <p>otai reads project structure, finds backend/database/security signals, and adds them to the review. your code is reviewed for guidance, not published.</p>
              </div>
              <label className="file-action">
                choose zip
                <input type="file" accept=".zip,application/zip" onChange={(event) => scanZip(event.target.files?.[0] || null)} />
              </label>
              <div className="repo-action">
                <input
                  aria-label="public github repo url"
                  value={repoUrl}
                  onChange={(event) => setRepoUrl(event.target.value)}
                  placeholder="https://github.com/owner/repo"
                />
                <button type="button" onClick={scanGithubRepo}>scan github</button>
              </div>
              {codeScan && (
                <div className="scan-result">
                  <strong>{codeScan.fileName}</strong>
                  <span>{codeScan.fileCount} files scanned</span>
                  <p>{codeScan.findings.length ? codeScan.findings.slice(0, 3).join("; ") : "otai scanned the file names and project structure."}</p>
                  {codeScan.warnings.length > 0 && <p>watchlist: {codeScan.warnings.slice(0, 2).join("; ")}</p>}
                </div>
              )}
            </div>
            <div className="tier-panel" aria-label="review tier">
              <button className={tier === "free" ? "is-selected" : ""} type="button" onClick={() => setTier("free")}>
                <strong>free review</strong>
                <span>3 reviews per month. idea, zip, or public github review with risks and fixes.</span>
              </button>
              <button className={tier === "paid" ? "is-selected" : ""} type="button" onClick={() => setTier("paid")}>
                <strong>pro otai draft</strong>
                <span>unlimited reviews, corrected approach, safer plan, tests, build prompt, and package download.</span>
              </button>
            </div>
            <button className="billing-action" type="button" onClick={startPaidCheckout}>
              set up paid access with stripe
            </button>
            <div className="prompt-footer">
              <span>{brief.length} characters ready to review</span>
              <button onClick={copyPrompt} title="copy a coding-agent prompt based on this brief and the review standards">
                copy build prompt
              </button>
              <button onClick={runServerReview} title="save this project and generate the engineering review">
                save and check
              </button>
              <button onClick={downloadCorrectedPackage} title="download the paid corrected package as a zip">
                download corrected package
              </button>
            </div>
          </div>

          <div className="review-panel">
            <div className="review-header">
              <div>
                <p className="eyebrow">step 2</p>
                <h2>{selected.title}</h2>
              </div>
              <ScoreRing score={selected.score} label="readiness" />
            </div>
            <p className="selected-verdict">{selected.verdict}</p>
            <div className="check-grid">
              {selected.checks.map((check) => (
                <span key={check}>
                  {check}
                </span>
              ))}
            </div>
            <div className="generated-brief">
              <strong>otai review output</strong>
              <p>
                for "{briefSummary}", otherend explains what should be fixed or planned before this
                becomes production software.
              </p>
              <p>
                click each review area below to see the checks behind the score in simpler terms.
              </p>
              {serverReview && (
                <ul>
                  {serverReview.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
              )}
              {serverReview?.paidFixes?.length ? (
                <div className="paid-fixes">
                  <strong>paid corrected approach</strong>
                  <ul>
                    {serverReview.paidFixes.map((fix) => (
                      <li key={fix}>{fix}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="paid-note">paid tier adds otai-drafted corrected approach, safer code plan, tests, and handoff notes.</p>
              )}
            </div>
          </div>
        </section>

        <section className="discipline-strip" aria-label="engineering specialists">
          {disciplines.map((discipline) => (
            <DisciplineCard
              key={discipline.id}
              discipline={discipline}
              active={discipline.id === activeDiscipline}
              onSelect={() => setActiveDiscipline(discipline.id)}
            />
          ))}
        </section>

        <section className="split-section">
          <div className="pipeline-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">how it works</p>
                <h2>one idea becomes a clearer build plan</h2>
              </div>
            </div>
            <ol className="timeline">
              {workflow.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                  {index < workflow.length - 1 && <i aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>

          <div className="risk-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">what can go wrong</p>
                <h2>the review shows risks before users find them</h2>
              </div>
            </div>
            <div className="risk-list">
              {risks.map((risk) => (
                <article key={risk.label} className={`risk-item risk-${risk.severity}`}>
                  <span>{risk.severity}</span>
                  <h3>{risk.label}</h3>
                  <p>{risk.control}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="artifact-section" id="artifacts">
          <div className="section-heading">
            <p className="eyebrow">what you get</p>
            <h2>use these outputs to build with more confidence.</h2>
          </div>
          <div className="artifact-grid">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.title} artifact={artifact} />
            ))}
          </div>
        </section>

        <section className="database-section">
          <div className="section-heading">
            <p className="eyebrow">what gets saved</p>
            <h2>your ideas and reviews are structured like a real product workspace.</h2>
          </div>
          <div className="database-grid">
            <article>
              <strong>workspace model</strong>
              <p>people can belong to a shared workspace, so a founder, teammate, or developer can review the same build.</p>
            </article>
            <article>
              <strong>saved app ideas</strong>
              <p>each brief becomes a saved project that can be changed, reviewed again, and exported.</p>
            </article>
            <article>
              <strong>review history</strong>
              <p>each review keeps the readiness score, risk notes, fixes, blockers, and build prompt.</p>
            </article>
            <article>
              <strong>activity history</strong>
              <p>important actions are logged so users can understand what changed and when.</p>
            </article>
          </div>
        </section>

        <section className="standards-section" id="standards">
          <div className="section-heading">
            <p className="eyebrow">what otherend checks</p>
            <h2>the same serious checklist, explained in plain language.</h2>
          </div>
          <div className="standards-grid">
            {standards.map((standard) => {
              return (
                <article key={standard.label}>
                  <strong>{standard.label}</strong>
                  <p>{standard.value}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ship-panel">
          <div>
            <p className="eyebrow">release path</p>
            <h2>move from vibe-built to ready-to-review.</h2>
            <p>
              start with one idea. get the risks, fixes, database notes, security notes, and a stronger
              prompt for your coding tool.
            </p>
          </div>
          <button className="primary-action" onClick={runServerReview}>
            check this idea
          </button>
        </section>
      </section>
      {guideOpen && (
        <div className="guide-overlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <section className="guide-card">
            <div className="guide-progress">
              <span>{guideStep + 1} of {guideSteps.length}</span>
              <button type="button" onClick={closeGuide}>skip</button>
            </div>
            <h2 id="guide-title">{guideSteps[guideStep].title}</h2>
            <p>{guideSteps[guideStep].body}</p>
            <div className="guide-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={() => setGuideStep((step) => Math.max(0, step - 1))}
                disabled={guideStep === 0}
              >
                back
              </button>
              <button type="button" className="primary-action" onClick={nextGuideStep}>
                {guideStep === guideSteps.length - 1 ? "start using otherend" : "next"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
