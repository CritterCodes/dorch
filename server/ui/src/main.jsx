import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Bot,
  ChevronLeft,
  ClipboardList,
  FileText,
  GitBranch,
  KeyRound,
  Loader2,
  LogOut,
  MessageSquare,
  Plus,
  Radio,
  RefreshCw,
  Send,
  Square,
  Shuffle,
  Terminal
} from 'lucide-react';
import './styles.css';

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.error || response.statusText);
  }
  return data;
}

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
                onChange={(event) => setPassword(event.target.value)}
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

function Projects({ onSelect, onLogout }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [creating, setCreating] = useState(false);

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

  useEffect(() => {
    load();
  }, []);

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

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    onLogout();
  }

  return (
    <div className="app-frame">
      <header className="topbar">
        <div>
          <h1>Dorch</h1>
          <span>Projects</span>
        </div>
        <button className="ghost-button" onClick={logout}><LogOut size={16} /> Logout</button>
      </header>

      <section className="section-block">
        <div className="section-title">
          <span>Active workspaces</span>
          <button className="icon-only" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
        </div>
        {loading ? <div className="muted-row"><Loader2 className="spin" size={16} /> Loading projects</div> : null}
        {error ? <div className="error">{error}</div> : null}
        {!loading && projects.length === 0 ? <div className="empty">No projects yet.</div> : null}
        <div className="list">
          {projects.map((project) => (
            <button className="list-item" key={project.slug} onClick={() => onSelect(project.slug)}>
              <div>
                <strong>{project.name}</strong>
                <span>{project.slug}</span>
              </div>
              <Pill>{project.repoUrl ? 'cloned' : 'local'}</Pill>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title"><span>New project</span></div>
        <form className="stack" onSubmit={createProject}>
          <label>
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="auth-service" />
          </label>
          <label>
            <span>Repo URL</span>
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="optional Git URL" />
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

function ProjectDetail({ slug, onBack }) {
  const [detail, setDetail] = useState(null);
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [active, setActive] = useState('status');
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

  useEffect(() => {
    load();
  }, [slug]);

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
      await api(`/projects/${slug}/agent/switch`, { method: 'POST', body: { reason: 'manual UI switch' } });
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

  const project = detail?.project;
  const latestSprint = useMemo(() => detail?.sprints?.at(-1), [detail]);

  return (
    <div className="phone-shell">
      <header className="topbar compact">
        <button className="icon-only" onClick={onBack} title="Back"><ChevronLeft size={18} /></button>
        <div>
          <h1>{project?.name || slug}</h1>
          <span>{latestSprint ? `sprint ${String(latestSprint.n).padStart(2, '0')} · ${latestSprint.status}` : 'no sprint'}</span>
        </div>
        <button className="icon-only" onClick={load} title="Refresh"><RefreshCw size={16} /></button>
      </header>

      {error ? <div className="error page-error">{error}</div> : null}

      <main className="tab-content">
        {active === 'status' && (
          <StatusTab
            latestSprint={latestSprint}
            status={status}
            goal={goal}
            setGoal={setGoal}
            createSprint={createSprint}
            approvePlan={approvePlan}
            triggerSwitch={triggerSwitch}
            stopAgent={stopAgent}
            busy={busy}
          />
        )}
        {active === 'chat' && (
          <ChatTab messages={messages} chat={chat} setChat={setChat} sendMessage={sendMessage} busy={busy} />
        )}
        {active === 'plan' && <MarkdownTab title="Sprint Plan" text={status?.currentSprint} />}
        {active === 'logs' && <LogsTab slug={slug} />}
        {active === 'handoff' && <MarkdownTab title="Latest Handoff" text={status?.latestHandoff} />}
      </main>

      <nav className="bottom-nav">
        <TabButton active={active === 'status'} onClick={() => setActive('status')} icon={<Activity size={18} />} label="Status" />
        <TabButton active={active === 'chat'} onClick={() => setActive('chat')} icon={<MessageSquare size={18} />} label="Chat" />
        <TabButton active={active === 'logs'} onClick={() => setActive('logs')} icon={<Terminal size={18} />} label="Logs" />
        <TabButton active={active === 'plan'} onClick={() => setActive('plan')} icon={<ClipboardList size={18} />} label="Plan" />
        <TabButton active={active === 'handoff'} onClick={() => setActive('handoff')} icon={<FileText size={18} />} label="Handoff" />
      </nav>
    </div>
  );
}

function StatusTab({ latestSprint, status, goal, setGoal, createSprint, approvePlan, triggerSwitch, stopAgent, busy }) {
  return (
    <div className="stack roomy">
      <section className="status-card">
        <div>
          <span className="eyebrow">current state</span>
          <h2>{latestSprint?.status || 'IDLE'}</h2>
        </div>
        <Pill tone={latestSprint?.status === 'REVIEW' ? 'amber' : 'green'}>{latestSprint ? `task branch` : 'ready'}</Pill>
      </section>

      {latestSprint ? (
        <>
          <section className="section-block flush">
            <div className="section-title"><span>Sprint</span><GitBranch size={16} /></div>
            <p className="body-copy">{latestSprint.goal}</p>
            <div className="meta-grid">
              <span>Branch</span><strong>{latestSprint.branch}</strong>
              <span>Status</span><strong>{latestSprint.status}</strong>
            </div>
          </section>
          <div className="button-grid">
            <IconButton label="Approve" onClick={approvePlan} disabled={busy || latestSprint.status !== 'PLANNED'}><Send size={16} /></IconButton>
            <IconButton label="Switch" onClick={triggerSwitch} disabled={busy}><Shuffle size={16} /></IconButton>
            <IconButton label="Stop" onClick={stopAgent} disabled={busy} danger><Square size={16} /></IconButton>
          </div>
        </>
      ) : (
        <section className="section-block flush">
          <div className="section-title"><span>Create sprint</span></div>
          <form className="stack" onSubmit={createSprint}>
            <label>
              <span>Goal</span>
              <textarea value={goal} onChange={(event) => setGoal(event.target.value)} placeholder="Describe the sprint goal..." />
            </label>
            <button className="primary-button" disabled={busy || !goal.trim()}>
              {busy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
              Start planning
            </button>
          </form>
        </section>
      )}

      <section className="section-block flush">
        <div className="section-title"><span>Latest context</span></div>
        <pre className="mini-pre">{status?.latestHandoff || 'No handoff yet.'}</pre>
      </section>
    </div>
  );
}

function LogsTab({ slug }) {
  const [lines, setLines] = useState([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    fetch(`/projects/${slug}/run-log`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error(response.statusText);
        return response.text();
      })
      .then((text) => {
        if (!alive) return;
        setLines(text.split(/\r?\n/).filter(Boolean).map((line) => ({ source: 'evt', text: line })));
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });

    const stream = new EventSource(`/projects/${slug}/logs/stream`, { withCredentials: true });
    stream.onopen = () => setConnected(true);
    stream.onerror = () => setConnected(false);
    stream.onmessage = (event) => {
      const item = JSON.parse(event.data);
      setLines((current) => [...current.slice(-250), item]);
    };

    return () => {
      alive = false;
      stream.close();
    };
  }, [slug]);

  return (
    <section className="section-block flush full-height logs-panel">
      <div className="section-title">
        <span>Live Logs</span>
        <Pill tone={connected ? 'green' : 'amber'}>{connected ? 'streaming' : 'idle'}</Pill>
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="log-lines">
        {lines.length === 0 ? <div className="empty">No log lines yet.</div> : null}
        {lines.map((line, index) => (
          <div className="log-line" key={`${index}-${line.ts || ''}`}>
            <span>[{line.source || 'evt'}]</span>
            <p>{line.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ChatTab({ messages, chat, setChat, sendMessage, busy }) {
  return (
    <div className="chat-tab">
      <div className="messages">
        {messages.length === 0 ? <div className="empty">No planner messages yet.</div> : null}
        {messages.map((message) => (
          <div className={`bubble ${message.from === 'user' ? 'user' : ''}`} key={message._id || `${message.ts}-${message.text}`}>
            <span>{message.from}</span>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      <form className="chat-form" onSubmit={sendMessage}>
        <input value={chat} onChange={(event) => setChat(event.target.value)} placeholder="Message planner..." />
        <button disabled={busy || !chat.trim()} title="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}

function MarkdownTab({ title, text }) {
  return (
    <section className="section-block flush full-height">
      <div className="section-title"><span>{title}</span></div>
      <pre className="markdown-pre">{text || 'Nothing to show yet.'}</pre>
    </section>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button className={active ? 'active' : ''} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function App() {
  const [authenticated, setAuthenticated] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    api('/auth/session')
      .then((session) => setAuthenticated(session.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  if (authenticated === null) {
    return (
      <main className="auth-screen">
        <div className="muted-row"><Loader2 className="spin" size={16} /> Checking session</div>
      </main>
    );
  }

  if (!authenticated) return <Login onLogin={() => setAuthenticated(true)} />;
  if (!selectedProject) {
    return <Projects onSelect={setSelectedProject} onLogout={() => setAuthenticated(false)} />;
  }
  return <ProjectDetail slug={selectedProject} onBack={() => setSelectedProject(null)} />;
}

createRoot(document.getElementById('root')).render(<App />);
