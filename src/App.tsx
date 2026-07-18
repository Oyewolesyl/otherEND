import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clipboard,
  Download,
  Gauge,
  Layers3,
  Menu,
  MessageSquareText,
  Play,
  Shield,
} from "lucide-react";
import { ArtifactCard } from "./components/ArtifactCard";
import { DisciplineCard } from "./components/DisciplineCard";
import { ScoreRing } from "./components/ScoreRing";
import { artifacts, disciplines, risks, standards, workflow } from "./data/reviewModel";

const starterBrief =
  "build a subscription saas where teams can create projects, invite members, assign tasks, upload files, and receive weekly planning summaries.";

type ApiReview = {
  readiness: number;
  controls: string[];
  blockers: string[];
  implementationPrompt: string;
};

function App() {
  const [brief, setBrief] = useState(starterBrief);
  const [activeDiscipline, setActiveDiscipline] = useState(disciplines[0].id);
  const [email, setEmail] = useState("founder@otherend.dev");
  const [token, setToken] = useState(() => localStorage.getItem("otherend_token") || "");
  const [projectId, setProjectId] = useState("");
  const [serverReview, setServerReview] = useState<ApiReview | null>(null);
  const [status, setStatus] = useState(token ? "session ready" : "sign in to save reviews");
  const [menuOpen, setMenuOpen] = useState(false);

  const selected = disciplines.find((discipline) => discipline.id === activeDiscipline) ?? disciplines[0];

  const readinessScore = useMemo(() => {
    const average = disciplines.reduce((total, item) => total + item.score, 0) / disciplines.length;
    const briefLift = Math.min(4, Math.floor(brief.length / 160));
    return Math.min(94, Math.round(average + briefLift));
  }, [brief]);

  const briefSummary = useMemo(() => {
    const cleanBrief = brief.trim() || "a generated software project";
    return cleanBrief.length > 150 ? `${cleanBrief.slice(0, 150).trim()}...` : cleanBrief;
  }, [brief]);

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
    setStatus(`signed in as ${body.user.email}`);
  }

  async function runServerReview() {
    try {
      setStatus("creating project...");
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

      setStatus("running engineering review...");
      const reviewed = await api(`/api/projects/${activeProjectId}/review`, { method: "POST" }).then((response) =>
        response.json(),
      );
      setServerReview(reviewed.review);
      setStatus("review saved and ready to export");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "review failed");
    }
  }

  async function exportReview() {
    try {
      if (!projectId) {
        setStatus("run a review before export");
        return;
      }
      const response = await api(`/api/projects/${projectId}/export`, {
        headers: { accept: "text/markdown" },
      });
      const markdown = await response.text();
      await navigator.clipboard.writeText(markdown);
      setStatus("markdown export copied to clipboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "export failed");
    }
  }

  async function copyPrompt() {
    const prompt =
      serverReview?.implementationPrompt ||
      `build this project with production engineering standards:\n\n${brief}\n\ninclude architecture, backend contracts, security controls, testing, deployment, and release readiness.`;
    await navigator.clipboard.writeText(prompt);
    setStatus("implementation prompt copied");
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
            <Menu size={18} aria-hidden="true" />
            menu
          </button>
          <nav id="app-nav" className={menuOpen ? "is-open" : ""}>
            <a href="#review" onClick={() => setMenuOpen(false)}>review</a>
            <a href="#artifacts" onClick={() => setMenuOpen(false)}>artifacts</a>
            <a href="#standards" onClick={() => setMenuOpen(false)}>standards</a>
            <a href="https://otherend.vercel.app/" onClick={() => setMenuOpen(false)}>landing</a>
          </nav>
          <button className="icon-button" aria-label="export review" onClick={exportReview}>
            <Download size={18} aria-hidden="true" />
          </button>
        </header>

        <section className="console-grid" id="console">
          <div className="intro-panel">
            <p className="eyebrow">
              software engineering review
            </p>
            <h1>review software before it reaches production.</h1>
            <p className="lede">
              otherend sits above the build process and checks whether the system is secure,
              maintainable, scalable, testable, and ready to ship.
            </p>
            <div className="cta-row">
              <button className="primary-action" onClick={runServerReview}>
                run review
                <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a className="secondary-action" href="#artifacts">
                view artifacts
              </a>
            </div>
            <div className="proof-row" aria-label="review promises">
              <span>backend standards</span>
              <span>security controls</span>
              <span>release decision</span>
            </div>
          </div>

          <aside className="system-panel" aria-label="platform preview">
            <div className="live-badge">
              <Gauge size={17} aria-hidden="true" />
              <span>{readinessScore}% readiness</span>
            </div>
            <div className="system-head">
              <p className="eyebrow">active review</p>
              <h2>engineering gates</h2>
            </div>
            <div className="gate-stack">
              {disciplines.slice(0, 4).map((discipline) => {
                const Icon = discipline.icon;
                return (
                  <article key={discipline.id}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{discipline.title}</span>
                    <strong>{discipline.score}</strong>
                  </article>
                );
              })}
            </div>
            <div className="signal-grid">
              <div>
                <strong>12</strong>
                <span>controls mapped</span>
              </div>
              <div>
                <strong>8</strong>
                <span>release blockers</span>
              </div>
              <div>
                <strong>24</strong>
                <span>tests required</span>
              </div>
            </div>
            <div className="decision-row">
              <span>ship decision</span>
              <strong>{serverReview && serverReview.blockers.length === 0 ? "ready" : "needs review"}</strong>
            </div>
            <div className="review-note">
              <span>current review</span>
              <p>
                {serverReview
                  ? `project ${projectId.slice(0, 8)} is saved with ${serverReview.controls.length} required controls.`
                  : "run a review to turn the brief into controls, blockers, and a release package."}
              </p>
            </div>
          </aside>
        </section>

        <section className="auth-panel">
          <div>
            <p className="eyebrow">workspace</p>
            <h2>save projects, run reviews, export build prompts.</h2>
          </div>
          <div className="auth-controls">
            <input
              aria-label="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
            />
            <button className="secondary-action" onClick={signIn}>
              sign in
            </button>
            <span>{status}</span>
          </div>
        </section>

        <section className="workbench" id="review">
          <div className="brief-panel">
            <div className="section-title">
              <span className="icon-tile">
                <MessageSquareText size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">project intake</p>
                <h2>describe the product build</h2>
              </div>
            </div>
            <textarea
              aria-label="project brief"
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              rows={8}
            />
            <div className="prompt-footer">
              <span>{brief.length} characters reviewed</span>
              <button onClick={copyPrompt}>
                <Clipboard size={17} aria-hidden="true" />
                copy implementation prompt
              </button>
              <button onClick={runServerReview}>
                <Play size={17} aria-hidden="true" />
                save and review
              </button>
            </div>
          </div>

          <div className="review-panel">
            <div className="review-header">
              <div>
                <p className="eyebrow">specialist review</p>
                <h2>{selected.title}</h2>
              </div>
              <ScoreRing score={selected.score} label="discipline score" />
            </div>
            <p className="selected-verdict">{selected.verdict}</p>
            <div className="check-grid">
              {selected.checks.map((check) => (
                <span key={check}>
                  <Check size={15} aria-hidden="true" />
                  {check}
                </span>
              ))}
            </div>
            <div className="generated-brief">
              <strong>review output</strong>
              <p>
                for "{briefSummary}", otherend creates a gated engineering package before any code is
                accepted as production-ready.
              </p>
              {serverReview && (
                <ul>
                  {serverReview.blockers.map((blocker) => (
                    <li key={blocker}>{blocker}</li>
                  ))}
                </ul>
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
              <span className="icon-tile">
                <Layers3 size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">workflow</p>
                <h2>one request, six engineering gates</h2>
              </div>
            </div>
            <ol className="timeline">
              {workflow.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{step}</p>
                  {index < workflow.length - 1 && <ChevronRight size={17} aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>

          <div className="risk-panel">
            <div className="section-title">
              <span className="icon-tile danger">
                <Shield size={20} aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow">risk engine</p>
                <h2>hidden production risks become visible</h2>
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
            <p className="eyebrow">deliverables</p>
            <h2>code is only one artifact. the engineering package is the product.</h2>
          </div>
          <div className="artifact-grid">
            {artifacts.map((artifact) => (
              <ArtifactCard key={artifact.title} artifact={artifact} />
            ))}
          </div>
        </section>

        <section className="standards-section" id="standards">
          <div className="section-heading">
            <p className="eyebrow">standards library</p>
            <h2>the same professional checklist applied to every generated project.</h2>
          </div>
          <div className="standards-grid">
            {standards.map((standard) => {
              const Icon = standard.icon;
              return (
                <article key={standard.label}>
                  <Icon size={22} aria-hidden="true" />
                  <strong>{standard.label}</strong>
                  <p>{standard.value}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="ship-panel">
          <div>
            <p className="eyebrow">launch path</p>
            <h2>position it as the quality layer for generated software.</h2>
            <p>
              start with review packages, prompt optimization, security gates, and exportable implementation
              briefs. expand into repository scanning, github checks, team policies, and model orchestration.
            </p>
          </div>
          <button className="primary-action" onClick={runServerReview}>
            <Play size={18} aria-hidden="true" />
            start review
          </button>
        </section>
      </section>
    </main>
  );
}

export default App;
