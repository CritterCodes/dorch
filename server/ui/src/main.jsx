import { createRoot } from 'react-dom/client';
import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ExternalLink,
  FileText,
  GitBranch,
  GitMerge,
  HelpCircle,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  Play,
  Plus,
  Radio,
  RefreshCw,
  RotateCcw,
  Send,
  Settings,
  Square,
  Shuffle,
  Terminal,
  X,
  XCircle
} from 'lucide-react';
import './styles.css';

// ─── API helper ──────────────────────────────────────────────────────────────

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || response.statusText);
  return data;
}

// ─── Tutorial data ────────────────────────────────────────────────────────────

const TUTORIAL_STEPS = [
  {
    title: 'Welcome to Dorch',
    content: 'Dorch runs AI coding agents (Codex CLI + Claude CLI) on your projects. It manages the plan, handoffs, and agent switching so work continues uninterrupted — even when an agent hits a rate limit.',
    tip: 'Hit "Load Demo" on the projects screen to explore a live example without needing real agents.'
  },
  {
    title: '1 — Create a Project',
    content: 'A project is a persistent workspace. Give it a name and optionally a Git repo URL. Dorch creates the folder, git-inits (or clones) the workspace, and initialises all memory files.',
    tip: 'Leave the repo URL blank to start from a fresh git init. Add it later to push upstream.'
  },
  {
    title: '2 — Start a Sprint',
    content: 'A sprint is a focused block of work: a goal, a git branch, a Planner conversation, and a set of tasks. Open a project → Status tab → type a goal → "Start planning".',
    tip: 'The Planner asks up to 3 clarifying questions before writing the task plan. Answer them in the Chat tab.'
  },
  {
    title: '3 — Approve the Plan',
    content: 'After the Planner writes the plan you\'ll see it in the Plan tab. Once you\'re happy, hit "Approve" on the Status tab. This starts the first agent on task 1.',
    tip: 'You can always check the Plan tab to see which tasks are done (✓) and which is current.'
  },
  {
    title: '4 — Watch the Logs',
    content: 'The Logs tab streams live output from the running agent. You\'ll see file edits, test runs, and progress messages in real time. Agents output "STEP COMPLETE" when a task is done.',
    tip: 'If the agent goes quiet for 3+ minutes, Dorch auto-switches to the other agent using the last handoff as context.'
  },
  {
    title: '5 — Agent Switching',
    content: 'When an agent hits a rate limit or timeout, Dorch automatically writes a handoff file and starts the next agent from where the last one left off. You can also force a switch manually via the Status tab.',
    tip: 'Check the Handoff tab after a switch to see exactly what was in progress and what the next agent should do first.'
  },
  {
    title: '6 — Close the Sprint',
    content: 'When all tasks pass, the sprint moves to REVIEW. Chat with the Planner to review the work, then close and merge the sprint branch into main from the Status tab.',
    tip: 'The sprint summary is written to memory/sprints/sprint-NN.md and loaded as context for the next sprint automatically.'
  }
];

const TAB_HELP = {
  status: {
    title: 'Status tab',
    lines: [
      'Shows the active sprint, current agent state, and quick-action buttons.',
      '"Approve" starts the first agent after the Planner writes the plan.',
      '"Switch" manually hands off to the other agent mid-task.',
      '"Stop" kills the current agent without a handoff — use sparingly.'
    ]
  },
  chat: {
    title: 'Chat tab',
    lines: [
      'This is the Planner conversation — your primary way to communicate with Dorch about this sprint.',
      'During planning: answer the Planner\'s questions to define the task list.',
      'During execution: ask "how is it going?" or redirect ("skip task 3").',
      'At close: say "looks good, merge it" to kick off the sprint summary.'
    ]
  },
  logs: {
    title: 'Logs tab',
    lines: [
      'Live stream of agent stdout/stderr and Dorch system events.',
      'Watch for "STEP COMPLETE" — means an agent finished a task and tests passed.',
      'Watch for "BLOCKED: <reason>" — means the agent needs help or is switching.',
      'The stream reconnects automatically if the connection drops.'
    ]
  },
  plan: {
    title: 'Plan tab',
    lines: [
      'The current sprint plan written by the Planner.',
      '[ ] = pending task, [x] = completed task, ← CURRENT = active task.',
      'Each task has acceptance criteria — the test gate the agent must pass.',
      'The plan updates automatically as tasks are completed.'
    ]
  },
  handoff: {
    title: 'Handoff tab',
    lines: [
      'The most recent handoff written when an agent stopped.',
      'Contains: what was completed, what\'s in progress, files changed, blockers, and the next recommended step.',
      'Every new agent start reads this file — it\'s the primary continuity mechanism.',
      'If this says "No prior handoff" the next agent starts from scratch on task 1.'
    ]
  }
};

// ─── Tutorial modal ───────────────────────────────────────────────────────────

function TutorialModal({ open, onClose }) {
  const [step, setStep] = useState(0);
  const current = TUTORIAL_STEPS[step];

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card tutorial-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={16} /></button>
        <div className="tutorial-progress">
          {TUTORIAL_STEPS.map((_, i) => (
            <button
              key={i}
              className={`tutorial-dot${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <p className="tutorial-body">{current.content}</p>
        {current.tip && (
          <div className="tutorial-tip">
            <strong>Tip:</strong> {current.tip}
          </div>
        )}
        <div className="tutorial-nav">
          <button className="ghost-button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ChevronLeft size={16} /> Back
          </button>
          <span className="tutorial-count">{step + 1} / {TUTORIAL_STEPS.length}</span>
          {step < TUTORIAL_STEPS.length - 1 ? (
            <button className="primary-button small" onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button className="primary-button small" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab help panel ───────────────────────────────────────────────────────────

function HelpPanel({ tabKey, open, onClose }) {
  const help = TAB_HELP[tabKey];
  if (!open || !help) return null;
  return (
    <div className="help-panel">
      <div className="help-panel-header">
        <strong>{help.title}</strong>
        <button className="icon-only" onClick={onClose}><X size={14} /></button>
      </div>
      <ul className="help-panel-list">
        {help.lines.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  );
}

// ─── Settings modal ───────────────────────────────────────────────────────────

function SettingsModal({ open, onClose }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setError('');
    api('/settings').then((s) => setForm({
      agents: s.agents,
      primaryAgent: s.primaryAgent,
      noOutputTimeoutMin: Math.round(s.noOutputTimeoutMs / 60000),
      maxRuntimeMin: Math.round(s.maxRuntimeMs / 60000),
      maxSwitchesPerTask: s.maxSwitchesPerTask,
      testCommand: s.testCommand,
      availableAgents: s.availableAgents
    })).catch((e) => setError(e.message));
  }, [open]);

  if (!open) return null;

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api('/settings', {
        method: 'POST',
        body: {
          agents: form.agents,
          primaryAgent: form.primaryAgent,
          noOutputTimeoutMs: form.noOutputTimeoutMin * 60000,
          maxRuntimeMs: form.maxRuntimeMin * 60000,
          maxSwitchesPerTask: Number(form.maxSwitchesPerTask),
          testCommand: form.testCommand
        }
      });
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleAgent(name) {
    setForm((f) => {
      const next = f.agents.includes(name)
        ? f.agents.filter((a) => a !== name)
        : [...f.agents, name];
      const primary = next.includes(f.primaryAgent) ? f.primaryAgent : next[0] || '';
      return { ...f, agents: next, primaryAgent: primary };
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {!form ? (
          <div className="muted-row"><Loader2 className="spin" size={16} /> Loading…</div>
        ) : (
          <form className="settings-form" onSubmit={save}>

            <fieldset className="settings-group">
              <legend>Agents</legend>
              <div className="settings-row">
                <label className="settings-label">Active agents</label>
                <div className="agent-toggles">
                  {form.availableAgents.map((name) => (
                    <label key={name} className="agent-toggle">
                      <input
                        type="checkbox"
                        checked={form.agents.includes(name)}
                        onChange={() => toggleAgent(name)}
                      />
                      {name.replace('-cli', '')}
                    </label>
                  ))}
                </div>
              </div>
              <div className="settings-row">
                <label className="settings-label">Run first</label>
                <div className="agent-toggles">
                  {form.agents.map((name) => (
                    <label key={name} className="agent-toggle">
                      <input
                        type="radio"
                        name="primary"
                        checked={form.primaryAgent === name}
                        onChange={() => setForm((f) => ({ ...f, primaryAgent: name }))}
                      />
                      {name.replace('-cli', '')}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="settings-group">
              <legend>Timeouts</legend>
              <div className="settings-row">
                <label className="settings-label" htmlFor="noOutputTimeout">
                  No-output timeout
                  <span className="settings-hint">Switch agent if silent for this long</span>
                </label>
                <div className="settings-input-unit">
                  <input
                    id="noOutputTimeout"
                    type="number" min="1" max="60"
                    value={form.noOutputTimeoutMin}
                    onChange={(e) => setForm((f) => ({ ...f, noOutputTimeoutMin: Number(e.target.value) }))}
                  />
                  <span>min</span>
                </div>
              </div>
              <div className="settings-row">
                <label className="settings-label" htmlFor="maxRuntime">
                  Max runtime
                  <span className="settings-hint">Hard kill after this long regardless</span>
                </label>
                <div className="settings-input-unit">
                  <input
                    id="maxRuntime"
                    type="number" min="5" max="180"
                    value={form.maxRuntimeMin}
                    onChange={(e) => setForm((f) => ({ ...f, maxRuntimeMin: Number(e.target.value) }))}
                  />
                  <span>min</span>
                </div>
              </div>
            </fieldset>

            <fieldset className="settings-group">
              <legend>Limits</legend>
              <div className="settings-row">
                <label className="settings-label" htmlFor="maxSwitches">
                  Max switches per task
                  <span className="settings-hint">Pause for review after this many switches</span>
                </label>
                <input
                  id="maxSwitches"
                  type="number" min="1" max="20"
                  value={form.maxSwitchesPerTask}
                  onChange={(e) => setForm((f) => ({ ...f, maxSwitchesPerTask: Number(e.target.value) }))}
                  className="settings-number"
                />
              </div>
              <div className="settings-row">
                <label className="settings-label" htmlFor="testCmd">
                  Test command
                  <span className="settings-hint">Run after STEP COMPLETE. Leave empty to skip.</span>
                </label>
                <input
                  id="testCmd"
                  type="text"
                  value={form.testCommand}
                  onChange={(e) => setForm((f) => ({ ...f, testCommand: e.target.value }))}
                  placeholder="npm test"
                  className="settings-text"
                />
              </div>
            </fieldset>

            {error && <div className="error">{error}</div>}
            {saved && <div className="info-banner">Saved — takes effect on next agent start.</div>}

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>Cancel</button>
              <button type="submit" className="primary-button small" disabled={saving}>
                {saving ? <Loader2 className="spin" size={14} /> : null}
                Save
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Shared components ────────────────────────────────────────────────────────

function Pill({ children, tone = 'green' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

function IconButton({ children, label, onClick, danger = false, disabled = false }) {
  return (
    <button className={`icon-button ${danger ? 'danger' : ''}`} onClick={onClick} disabled={disabled} title={label}>
      {children}
      <span>{label}</span>
    </button>
  );
}

// ─── Login ────────────────────────────────────────────────────────────────────

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { method: 'POST', body: { password } });
      onLogin();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="brand-row">
          <Bot size={22} />
          <h1>dorch</h1>
        </div>
        <p>Agent orchestration console</p>
        <form onSubmit={submit} className="stack">
          <label>
            <span>Password</span>
            <div className="input-with-icon">
              <KeyRound size={16} />
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoFocus
                placeholder="DORCH_SESSION_PASSWORD"
              />
            </div>
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary-button" disabled={busy || !password}>
            {busy ? <Loader2 className="spin" size={16} /> : <Radio size={16} />}
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
}

// ─── Projects list ────────────────────────────────────────────────────────────

function Projects({ onSelect, onLogout }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [demoMsg, setDemoMsg] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setProjects(await api('/projects'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createProject(event) {
    event.preventDefault();
    setCreating(true);
    setError('');
    try {
      const project = await api('/projects/create', { method: 'POST', body: { name, repoUrl } });
      setName('');
      setRepoUrl('');
      onSelect(project.slug);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function loadDemo() {
    setSeeding(true);
    setDemoMsg('');
    setError('');
    try {
      const result = await api('/demo/seed', { method: 'POST' });
      setDemoMsg(result.message);
      await load();
      if (result.seeded) onSelect('demo-auth-service');
    } catch (err) {
      setError(err.message);
    } finally {
      setSeeding(false);
    }
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="app-frame">
      <TutorialModal open={showTutorial} onClose={() => setShowTutorial(false)} />
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <header className="topbar">
        <div className="brand-row tight">
          <Bot size={18} />
          <h1>Dorch</h1>
        </div>
        <div className="topbar-actions">
          <button className="ghost-button" onClick={() => setShowTutorial(true)}>
            <HelpCircle size={16} /> How it works
          </button>
          <button className="icon-only" onClick={() => setShowSettings(true)} title="Settings">
            <Settings size={16} />
          </button>
          <button className="ghost-button" onClick={logout}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      <section className="section-block">
        <div className="section-title">
          <span>Projects</span>
          <button className="icon-only" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
        </div>
        {loading ? <div className="muted-row"><Loader2 className="spin" size={16} /> Loading</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {!loading && projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet.</p>
            <p className="muted">Create one below or load the demo to explore.</p>
          </div>
        ) : null}
        <div className="list">
          {projects.map((p) => (
            <button className="list-item" key={p.slug} onClick={() => onSelect(p.slug)}>
              <div>
                <strong>{p.name}</strong>
                <span className="muted">{p.slug}</span>
              </div>
              <Pill tone={p.repoUrl ? 'green' : 'amber'}>{p.repoUrl ? 'cloned' : 'local'}</Pill>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block demo-section">
        <div className="section-title"><span>Try it out</span></div>
        <p className="body-copy muted">Load a demo project with a sprint already in progress — realistic memory files, handoffs, and planner history — so you can explore every screen without running real agents.</p>
        {demoMsg ? <div className="info-banner">{demoMsg}</div> : null}
        <button className="primary-button" onClick={loadDemo} disabled={seeding}>
          {seeding ? <Loader2 className="spin" size={16} /> : <Bot size={16} />}
          Load demo project
        </button>
      </section>

      <section className="section-block">
        <div className="section-title"><span>New project</span></div>
        <form className="stack" onSubmit={createProject}>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="auth-service" />
          </label>
          <label>
            <span>Repo URL <span className="muted">(optional)</span></span>
            <input value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} placeholder="https://github.com/you/repo" />
          </label>
          <button className="primary-button" disabled={creating || !name.trim()}>
            {creating ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
            Create
          </button>
        </form>
      </section>
    </div>
  );
}

// ─── Project detail ───────────────────────────────────────────────────────────

function ProjectDetail({ slug, onBack }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [active, setActive] = useState('status');
  const [helpOpen, setHelpOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [goal, setGoal] = useState('');
  const [chat, setChat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try {
      const [projectDetail, projectStatus, plannerMessages] = await Promise.all([
        api(`/projects/${slug}`),
        api(`/projects/${slug}/status`),
        api(`/projects/${slug}/planner/messages`)
      ]);
      setDetail(projectDetail);
      setStatus(projectStatus);
      setMessages(plannerMessages);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [slug]);

  // Auto-refresh status every 3s while a sprint is active
  useEffect(() => {
    const sprintStatus = detail?.sprints?.at(-1)?.status;
    if (sprintStatus !== 'ACTIVE') return;
    const id = setInterval(async () => {
      try {
        const s = await api(`/projects/${slug}/status`);
        setStatus(s);
      } catch {}
    }, 3000);
    return () => clearInterval(id);
  }, [slug, detail?.sprints?.at(-1)?.status]);

  // close help when switching tabs
  useEffect(() => { setHelpOpen(false); }, [active]);

  async function createSprint(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/sprints/create`, { method: 'POST', body: { goal } });
      setGoal('');
      setActive('chat');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!chat.trim()) return;
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/planner/message`, { method: 'POST', body: { text: chat } });
      setChat('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approvePlan() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/planner/approve`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function triggerSwitch() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/agent/switch`, { method: 'POST', body: { reason: 'manual' } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function stopAgent() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/agent/stop`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resumeAgent() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/agent/resume`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function closeSprint() {
    if (!latestSprint) return;
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/sprints/${latestSprint.n}/close`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function mergeSprint() {
    if (!latestSprint) return;
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/sprints/${latestSprint.n}/merge`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const project = detail?.project;
  const latestSprint = useMemo(() => detail?.sprints?.at(-1), [detail]);
  const isDemo = slug === 'demo-auth-service';

  return (
    <div className="phone-shell">
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
      <header className="topbar compact">
        <button className="icon-only" onClick={onBack} title="Back"><ChevronLeft size={18} /></button>
        <div>
          <h1>{project?.name || slug}{isDemo ? ' 🧪' : ''}</h1>
          <span className="muted">
            {latestSprint ? `sprint ${String(latestSprint.n).padStart(2, '0')} · ${latestSprint.status}` : 'no sprint'}
          </span>
        </div>
        <div className="topbar-actions">
          <button className="icon-only" onClick={() => setShowSettings(true)} title="Settings">
            <Settings size={16} />
          </button>
          <button className="icon-only" onClick={() => setHelpOpen((v) => !v)} title="Help">
            <HelpCircle size={16} />
          </button>
          <button className="icon-only" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
        </div>
      </header>

      {isDemo && (
        <div className="demo-banner">
          🧪 Demo project — explore every tab to see Dorch in action. No real agents needed.
        </div>
      )}

      {error ? <div className="error page-error">{error}</div> : null}

      <HelpPanel tabKey={active} open={helpOpen} onClose={() => setHelpOpen(false)} />

      <main className="tab-content">
        {active === 'status' && (
          <StatusTab
            slug={slug}
            latestSprint={latestSprint}
            status={status}
            goal={goal}
            setGoal={setGoal}
            createSprint={createSprint}
            approvePlan={approvePlan}
            triggerSwitch={triggerSwitch}
            stopAgent={stopAgent}
            resumeAgent={resumeAgent}
            closeSprint={closeSprint}
            mergeSprint={mergeSprint}
            busy={busy}
          />
        )}
        {active === 'chat' && (
          <ChatTab messages={messages} chat={chat} setChat={setChat} sendMessage={sendMessage} busy={busy} />
        )}
        {active === 'plan' && <MarkdownTab title="Sprint Plan" text={status?.currentSprint} />}
        {active === 'logs' && <LogsTab slug={slug} />}
        {active === 'handoff' && <MarkdownTab title="Latest Handoff" text={status?.latestHandoff} />}
        {active === 'run' && <RunTab slug={slug} />}
      </main>

      <nav className="bottom-nav">
        <TabButton active={active === 'status'} onClick={() => setActive('status')} icon={<Activity size={18} />} label="Status" />
        <TabButton active={active === 'chat'} onClick={() => setActive('chat')} icon={<MessageSquare size={18} />} label="Chat" />
        <TabButton active={active === 'logs'} onClick={() => setActive('logs')} icon={<Terminal size={18} />} label="Logs" />
        <TabButton active={active === 'plan'} onClick={() => setActive('plan')} icon={<ClipboardList size={18} />} label="Plan" />
        <TabButton active={active === 'handoff'} onClick={() => setActive('handoff')} icon={<FileText size={18} />} label="Handoff" />
        <TabButton active={active === 'run'} onClick={() => setActive('run')} icon={<Play size={18} />} label="Run" />
      </nav>
    </div>
  );
}

// ─── Status tab ───────────────────────────────────────────────────────────────

function UsageCard({ slug }) {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    api(`/projects/${slug}/usage`).then(setUsage).catch(() => {});
  }, [slug]);

  if (!usage || usage.totalRuns === 0) return null;

  function fmtDuration(ms) {
    if (!ms) return '0s';
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function fmtCost(usd) {
    if (!usd) return null;
    return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
  }

  function fmtTokens(n) {
    if (!n) return null;
    return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  }

  const cost = fmtCost(usage.totalCostUsd);
  const tokIn = fmtTokens(usage.totalTokensIn);
  const tokOut = fmtTokens(usage.totalTokensOut);

  return (
    <section className="section-block flush usage-card">
      <div className="section-title"><span>Usage</span></div>
      <div className="usage-summary">
        <div className="usage-stat">
          <span>{usage.totalRuns}</span>
          <label>runs</label>
        </div>
        <div className="usage-stat">
          <span>{fmtDuration(usage.totalDurationMs)}</span>
          <label>agent time</label>
        </div>
        {cost && <div className="usage-stat"><span>{cost}</span><label>cost</label></div>}
        {tokIn && <div className="usage-stat"><span>{tokIn}</span><label>in tokens</label></div>}
        {tokOut && <div className="usage-stat"><span>{tokOut}</span><label>out tokens</label></div>}
      </div>
      {Object.keys(usage.byAgent).length > 1 && (
        <div className="usage-agents">
          {Object.entries(usage.byAgent).map(([name, a]) => (
            <div className="usage-agent-row" key={name}>
              <span className="usage-agent-name">{name.replace('-cli', '')}</span>
              <span>{a.runs} runs</span>
              <span>{fmtDuration(a.durationMs)}</span>
              {a.costUsd > 0 && <span>{fmtCost(a.costUsd)}</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusTab({ latestSprint, status, goal, setGoal, createSprint, approvePlan, triggerSwitch, stopAgent, resumeAgent, closeSprint, mergeSprint, busy, slug }) {
  const agentState = status?.state || 'IDLE';
  const sprintStatus = latestSprint?.status;

  const agentStateTone = {
    IDLE: 'muted', RUNNING: 'green', SWITCHING: 'amber',
    AWAITING_USER_INPUT: 'red', AWAITING_COOLDOWN: 'amber', AWAITING_APPROVAL: 'blue'
  }[agentState] || 'muted';

  const sprintTone = { ACTIVE: 'green', REVIEW: 'amber', PLANNED: 'blue', CLOSED: 'muted' }[sprintStatus] || 'muted';

  return (
    <div className="stack roomy">
      <section className="status-card">
        <div>
          <span className="eyebrow">agent state</span>
          <h2>
            <Pill tone={agentStateTone}>
              {agentState === 'RUNNING' && <span className="pulse-dot" />}
              {agentState}
            </Pill>
          </h2>
        </div>
        <Pill tone={sprintTone}>{sprintStatus || 'no sprint'}</Pill>
      </section>

      {agentState === 'AWAITING_USER_INPUT' && (
        <div className="info-banner warn">
          Agent stopped unexpectedly. Review the Handoff tab, then resume when ready.
          <button className="primary-button small" onClick={resumeAgent} disabled={busy}>
            <RotateCcw size={14} /> Resume agent
          </button>
        </div>
      )}

      {latestSprint ? (
        <>
          <section className="section-block flush">
            <div className="section-title"><span>Sprint {latestSprint.n}</span><GitBranch size={16} /></div>
            <p className="body-copy">{latestSprint.goal}</p>
            <div className="meta-grid">
              <span>Branch</span><strong>{latestSprint.branch}</strong>
              <span>Status</span><strong>{latestSprint.status}</strong>
            </div>
          </section>

          <div className="button-grid">
            <IconButton label="Approve" onClick={approvePlan} disabled={busy || sprintStatus !== 'PLANNED'}>
              <Send size={16} />
            </IconButton>
            <IconButton label="Resume" onClick={resumeAgent} disabled={busy || sprintStatus !== 'ACTIVE' || agentState === 'RUNNING'}>
              <RotateCcw size={16} />
            </IconButton>
            <IconButton label="Switch" onClick={triggerSwitch} disabled={busy || agentState !== 'RUNNING'}>
              <Shuffle size={16} />
            </IconButton>
            <IconButton label="Stop" onClick={stopAgent} disabled={busy || agentState !== 'RUNNING'} danger>
              <Square size={16} />
            </IconButton>
            <IconButton label="Close" onClick={closeSprint} disabled={busy || sprintStatus !== 'ACTIVE'}>
              <XCircle size={16} />
            </IconButton>
            <IconButton label="Merge" onClick={mergeSprint} disabled={busy || sprintStatus !== 'REVIEW'}>
              <GitMerge size={16} />
            </IconButton>
          </div>
        </>
      ) : (
        <section className="section-block flush">
          <div className="section-title"><span>New sprint</span></div>
          <p className="body-copy muted">Describe the goal and the Planner will ask a few questions, then write the task plan.</p>
          <form className="stack" onSubmit={createSprint}>
            <label>
              <span>Goal</span>
              <textarea
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. Add rate limiting to the auth endpoints"
                rows={3}
              />
            </label>
            <button className="primary-button" disabled={busy || !goal.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Start planning
            </button>
          </form>
        </section>
      )}

      <section className="section-block flush">
        <div className="section-title"><span>Latest handoff</span></div>
        <pre className="mini-pre">{status?.latestHandoff || 'No handoff yet.'}</pre>
      </section>

      <UsageCard slug={slug} />
    </div>
  );
}

// ─── Logs tab ─────────────────────────────────────────────────────────────────

function parseRunLogLine(raw) {
  const m = raw.match(/^\[([^\]]+)\] \[([^\]]+)\] ?(.*)$/);
  if (!m) return { source: 'system', text: raw, ts: null };
  const event = m[2];
  const detail = m[3];
  const labels = {
    'agent:started': `▶ Agent started: ${detail}`,
    'agent:stopped': `■ Agent stopped: ${detail}`,
    'trigger:received': `⚡ Switch triggered: ${detail}`,
    'switch:complete': `↔ Switched to: ${detail}`,
    'switch:paused': `⏸ Paused — ${detail}`,
    'step:complete': '✓ Step complete — tests passed',
    'warn:tests_failed': '⚠ Step signal ignored — tests failed',
    'recovery:detected': `🔄 ${detail}`,
  };
  return { source: 'system', text: labels[event] || `${event}${detail ? ': ' + detail : ''}`, ts: m[1] };
}

function LogsTab({ slug }) {
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    let alive = true;
    fetch(`/projects/${slug}/run-log`, { credentials: 'include' })
      .then((r) => r.ok ? r.text() : Promise.reject(r.statusText))
      .then((text) => {
        if (!alive) return;
        const parsed = text.split(/\r?\n/).filter(Boolean).map(parseRunLogLine);
        setLines(parsed);
      })
      .catch((err) => { if (alive) setError(String(err)); });

    const stream = new EventSource(`/projects/${slug}/logs/stream`, { withCredentials: true });
    stream.onopen = () => { if (alive) setConnected(true); };
    stream.onerror = () => { if (alive) setConnected(false); };
    stream.onmessage = (e) => {
      if (!alive) return;
      const item = JSON.parse(e.data);
      setLines((cur) => [...cur.slice(-400), item]);
    };

    return () => { alive = false; stream.close(); };
  }, [slug]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  return (
    <section className="section-block flush full-height logs-panel">
      <div className="section-title">
        <span>Activity</span>
        <Pill tone={connected ? 'green' : 'muted'}>{connected ? 'live' : 'history'}</Pill>
      </div>
      <div className="logs-legend">
        <span className="legend-system">■ system events</span>
        <span className="legend-stdout">■ agent output</span>
        <span className="legend-stderr">■ errors</span>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="log-lines">
        {lines.length === 0 ? (
          <div className="empty-state">
            <p>No activity yet.</p>
            <p className="muted">Events appear here when an agent starts running.</p>
          </div>
        ) : null}
        {lines.map((line, i) => (
          <div className={`log-line ${line.source}`} key={`${i}-${line.ts || ''}`}>
            {line.ts && <span className="log-ts">{line.ts.replace('T', ' ').slice(0, 19)}</span>}
            <p>{line.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </section>
  );
}

// ─── Chat tab ─────────────────────────────────────────────────────────────────

function ChatTab({ messages, chat, setChat, sendMessage, busy }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  return (
    <div className="chat-tab">
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty-state">
            <p>No messages yet.</p>
            <p className="muted">Create a sprint on the Status tab to start planning.</p>
          </div>
        ) : null}
        {messages.map((m) => (
          <div className={`bubble ${m.from === 'user' ? 'user' : ''}`} key={m._id || `${m.ts}-${m.text}`}>
            <span className="bubble-from">{m.from === 'user' ? 'you' : 'dorch'}</span>
            <p>{m.text}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input
          value={chat}
          onChange={(e) => setChat(e.target.value)}
          placeholder="Message the Planner…"
          disabled={busy}
        />
        <button disabled={busy || !chat.trim()} title="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}

// ─── Run tab ──────────────────────────────────────────────────────────────────

function RunTab({ slug }) {
  const [runnerStatus, setRunnerStatus] = useState(null);
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [command, setCommand] = useState('');
  const [editingCommand, setEditingCommand] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  async function loadStatus() {
    try {
      const s = await api(`/projects/${slug}/runner/status`);
      setRunnerStatus(s);
      if (!command) setCommand(s.command || 'npm run dev');
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadStatus(); }, [slug]);

  useEffect(() => {
    let alive = true;
    const stream = new EventSource(`/projects/${slug}/runner/logs/stream`, { withCredentials: true });
    stream.onopen = () => setConnected(true);
    stream.onerror = () => setConnected(false);
    stream.onmessage = (e) => {
      if (!alive) return;
      const item = JSON.parse(e.data);
      setLines((cur) => [...cur.slice(-300), item]);
    };
    return () => { alive = false; stream.close(); };
  }, [slug]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lines]);

  async function start() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/runner/start`, { method: 'POST' });
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/runner/stop`, { method: 'POST' });
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCommand() {
    setBusy(true);
    setError('');
    try {
      await api(`/projects/${slug}/runner/command`, { method: 'POST', body: { command } });
      setEditingCommand(false);
      await loadStatus();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isRunning = runnerStatus?.state === 'RUNNING';
  const port = runnerStatus?.port;
  const publicHost = runnerStatus?.publicHost;
  const appUrl = publicHost && port ? `${publicHost}:${port}` : port ? `http://<your-server>:${port}` : null;

  return (
    <div className="stack roomy">
      <section className="status-card">
        <div>
          <span className="eyebrow">app state</span>
          <h2><Pill tone={isRunning ? 'green' : 'muted'}>{isRunning ? 'RUNNING' : 'IDLE'}</Pill></h2>
        </div>
        {port && <Pill tone="blue">:{port}</Pill>}
      </section>

      {appUrl && isRunning && (
        <a className="info-banner app-url-banner" href={appUrl} target="_blank" rel="noreferrer">
          <ExternalLink size={14} /> {appUrl}
        </a>
      )}

      {error && <div className="error">{error}</div>}

      <section className="section-block flush">
        <div className="section-title"><span>Run command</span></div>
        {editingCommand ? (
          <div className="command-editor">
            <input
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="npm run dev"
            />
            <button className="primary-button small" onClick={saveCommand} disabled={busy}>Save</button>
            <button className="ghost-button" onClick={() => setEditingCommand(false)}>Cancel</button>
          </div>
        ) : (
          <div className="command-display">
            <code>{runnerStatus?.command || 'npm run dev'}</code>
            <button className="ghost-button small" onClick={() => setEditingCommand(true)}>Edit</button>
          </div>
        )}
      </section>

      <div className="button-grid cols-2">
        <IconButton label="Start" onClick={start} disabled={busy || isRunning}>
          <Play size={16} />
        </IconButton>
        <IconButton label="Stop" onClick={stop} disabled={busy || !isRunning} danger>
          <Square size={16} />
        </IconButton>
      </div>

      <section className="section-block flush full-height logs-panel">
        <div className="section-title">
          <span>App logs</span>
          <Pill tone={connected ? 'green' : 'amber'}>{connected ? 'streaming' : 'idle'}</Pill>
        </div>
        <div className="log-lines">
          {lines.length === 0 ? <div className="empty">Start the app to see logs.</div> : null}
          {lines.map((line, i) => (
            <div className="log-line" key={`${i}-${line.ts || ''}`}>
              <span className={`log-source ${line.source}`}>[{line.source}]</span>
              <p>{line.text}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </section>
    </div>
  );
}

// ─── Markdown tab ─────────────────────────────────────────────────────────────

function MarkdownTab({ title, text }) {
  return (
    <section className="section-block flush full-height">
      <div className="section-title"><span>{title}</span></div>
      <pre className="markdown-pre">{text || 'Nothing to show yet.'}</pre>
    </section>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── App root ─────────────────────────────────────────────────────────────────

function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    api('/auth/session')
      .then((s) => setAuthenticated(s.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <main className="auth-screen">
        <div className="muted-row"><Loader2 className="spin" size={16} /> Checking session…</div>
      </main>
    );
  }
  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;
  if (!selectedProject) return <Projects onSelect={setSelectedProject} onLogout={() => setAuthenticated(false)} />;
  return <ProjectDetail slug={selectedProject} onBack={() => setSelectedProject(null)} />;
}

createRoot(document.getElementById('root')).render(<App />);
