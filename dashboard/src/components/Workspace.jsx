import React, { useEffect, useMemo, useRef, useState } from 'react';

const STORE_KEY = 'aetherion_conversations_v1';
const PROFILE_KEY = 'aetherion_operator_profile';
const modes = [
  { id: 'quick', label: 'Quick', icon: '⚡', hint: 'Direct answer' },
  { id: 'standard', label: 'Standard', icon: '✦', hint: 'Balanced team' },
  { id: 'research', label: 'Deep research', icon: '⌁', hint: 'Sources + synthesis' },
  { id: 'council', label: 'Council', icon: '◇', hint: 'Governed review' },
];
const defaultCouncil = ['Critic', 'Security', 'Alignment', 'Constraint', 'Evaluator', 'Documentation', 'Aetherion Prime'];
const starters = [
  ['⌁', 'Research', 'Map the strongest signals shaping autonomous software this year'],
  ['◇', 'Council', 'Evaluate this product decision from every stakeholder perspective'],
  ['</>', 'Build', 'Design a secure API and show me the implementation plan'],
  ['✦', 'Create', 'Turn a rough idea into a polished launch narrative'],
];

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const makeConversation = () => ({ id: uid(), title: 'New conversation', updatedAt: Date.now(), messages: [] });
const loadJson = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } };

function AssistantMessage({ message, onRetry, onBranch }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard.writeText(message.content); setCopied(true); window.setTimeout(() => setCopied(false), 1200); };
  return <article className="chat-message assistant-message">
    <div className="assistant-avatar">A</div>
    <div className="message-body"><div className="message-author"><strong>Aetherion</strong><span>Chief of Staff</span></div>
      <div className="message-copy">{message.content}{message.streaming && <i className="stream-caret" />}</div>
      {message.card === 'council' && <div className="generative-card"><div className="generative-head"><span>◇ Council chamber</span><b>7 / 7 reporting</b></div><div className="vote-meter"><i style={{width:'86%'}} /></div><div className="vote-summary"><strong>6 approve</strong><span>1 requests revision</span><b>86% confidence</b></div></div>}
      {!message.streaming && <div className="message-actions"><button onClick={copy}>{copied ? '✓ Copied' : '□ Copy'}</button><button onClick={onRetry}>↻ Retry</button><button onClick={onBranch}>⑂ Branch</button><button aria-label="Helpful">♡</button><button aria-label="Not helpful">♢</button></div>}
    </div>
  </article>;
}

export default function Workspace() {
  const initial = useMemo(() => loadJson(STORE_KEY, [makeConversation()]), []);
  const [conversations, setConversations] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0].id);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState('standard');
  const [attachments, setAttachments] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(() => loadJson(PROFILE_KEY, { name: 'Operator', nickname: 'Operator', council: defaultCouncil }));
  const streamRef = useRef(null);
  const composerRef = useRef(null);
  const active = conversations.find(item => item.id === activeId) || conversations[0];

  useEffect(() => localStorage.setItem(STORE_KEY, JSON.stringify(conversations)), [conversations]);
  useEffect(() => localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)), [profile]);
  useEffect(() => () => window.clearInterval(streamRef.current), []);
  useEffect(() => { if (composerRef.current) { composerRef.current.style.height = '0'; composerRef.current.style.height = `${Math.min(composerRef.current.scrollHeight, 180)}px`; } }, [draft]);

  const updateActive = (updater) => setConversations(items => items.map(item => item.id === activeId ? updater(item) : item));
  const newChat = () => { const next = makeConversation(); setConversations(items => [next, ...items]); setActiveId(next.id); setDraft(''); setSidebarOpen(false); };
  const stop = () => { window.clearInterval(streamRef.current); setStreaming(false); updateActive(item => ({ ...item, messages: item.messages.map(message => message.streaming ? { ...message, streaming: false } : message) })); };

  const runResponse = (prompt, selectedMode = mode) => {
    const responses = {
      quick: `Here’s the clearest path, ${profile.nickname}: start with the smallest reversible action, validate the signal, then scale what works. I can turn that into an executable checklist next.`,
      standard: `I’ve translated your request into a focused mission. The Strategy and Delivery agents are aligned on three moves: clarify the outcome, build the smallest complete version, and validate it against real user behavior. I’ll keep the details visible while protecting you from the operational noise.`,
      research: `I’m opening a deep-research track. The Research team will map the landscape, compare independent sources, flag disagreements, and return a cited synthesis—not a pile of links. The first useful output will be a research plan with clear questions and evidence standards.`,
      council: `The Council has reviewed the request against your workspace constitution. Six judges support proceeding; the Constraint judge requests a narrower first release. Recommendation: approve a bounded pilot with an explicit rollback point and a human review before expansion.`,
    };
    const full = responses[selectedMode];
    const responseId = uid();
    updateActive(item => ({ ...item, title: item.messages.length ? item.title : prompt.slice(0, 42), updatedAt: Date.now(), messages: [...item.messages, { id: uid(), role: 'user', content: prompt, attachments }, { id: responseId, role: 'assistant', content: '', streaming: true, card: selectedMode === 'council' ? 'council' : null }] }));
    setDraft(''); setAttachments([]); setStreaming(true);
    let index = 0;
    streamRef.current = window.setInterval(() => {
      index += 2;
      setConversations(items => items.map(item => item.id !== activeId ? item : { ...item, messages: item.messages.map(message => message.id !== responseId ? message : { ...message, content: full.slice(0, index), streaming: index < full.length }) }));
      if (index >= full.length) { window.clearInterval(streamRef.current); setStreaming(false); }
    }, 18);
  };

  const send = () => { if (draft.trim() && !streaming) runResponse(draft.trim()); };
  const retry = () => { const prompt = [...active.messages].reverse().find(message => message.role === 'user')?.content; if (prompt) runResponse(prompt); };
  const branch = (message) => { const next = { ...makeConversation(), title: `${active.title} · branch`, messages: active.messages.slice(0, active.messages.findIndex(item => item.id === message.id) + 1).map(item => ({...item, id: uid()})) }; setConversations(items => [next, ...items]); setActiveId(next.id); };
  const exportChat = () => { const blob = new Blob([active.messages.map(message => `## ${message.role === 'user' ? profile.nickname : 'Aetherion'}\n\n${message.content}`).join('\n\n')], {type:'text/markdown'}); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${active.title.replace(/\W+/g, '-').toLowerCase()}.md`; link.click(); URL.revokeObjectURL(link.href); };
  const filtered = conversations.filter(item => item.title.toLowerCase().includes(query.toLowerCase()));

  return <div className="workspace-shell">
    <aside className={`conversation-sidebar ${sidebarOpen ? 'open' : ''}`}><div className="conversation-brand"><span>✦</span><div><b>Chief of Staff</b><small>Conversation workspace</small></div><button onClick={() => setSidebarOpen(false)}>×</button></div><button className="new-chat-button" onClick={newChat}>＋ New conversation <kbd>⌘ K</kbd></button><label className="conversation-search"><span>⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search conversations" /></label><div className="conversation-group"><p>RECENT</p>{filtered.map(item => <button className={item.id === activeId ? 'active' : ''} onClick={() => { setActiveId(item.id); setSidebarOpen(false); }} key={item.id}><span>◫</span><div><b>{item.title}</b><small>{item.messages.length ? `${item.messages.length} messages` : 'Just now'}</small></div><i>•••</i></button>)}</div><div className="workspace-profile"><button onClick={() => setProfileOpen(true)}><span>{profile.nickname.slice(0,2).toUpperCase()}</span><div><b>{profile.name}</b><small>Workspace owner</small></div><i>⚙</i></button></div></aside>

    <section className="conversation-main"><header className="conversation-header"><button className="mobile-conversation-toggle" onClick={() => setSidebarOpen(true)}>☰</button><div><h1>{active.title}</h1><p><i /> Aetherion Prime · Ready</p></div><div><button onClick={exportChat} title="Export conversation">⇩</button><button onClick={() => setDetailsOpen(value => !value)} className={detailsOpen ? 'active' : ''} title="Toggle mission details">◫</button></div></header>
      <div className="message-stream" aria-live="polite">{!active.messages.length ? <div className="workspace-empty"><div className="chief-orb"><span>A</span><i/><i/><i/></div><p className="workspace-eyebrow">AETHERION PRIME</p><h2>What are we building, <em>{profile.nickname}?</em></h2><p>Bring me an idea, a hard decision, or an ambitious mission. I’ll assemble the right team and keep you in control.</p><div className="starter-grid">{starters.map(([icon,label,text]) => <button key={label} onClick={() => { setDraft(text); composerRef.current?.focus(); }}><span>{icon}</span><b>{label}</b><p>{text}</p><i>→</i></button>)}</div></div> : <div className="messages-inner">{active.messages.map(message => message.role === 'user' ? <article className="chat-message user-message" key={message.id}><div className="message-body"><div className="message-author"><strong>{profile.nickname}</strong></div><div className="message-copy">{message.content}</div>{message.attachments?.length > 0 && <div className="message-files">{message.attachments.map(file => <span key={file.name}>▧ {file.name}</span>)}</div>}</div><div className="user-avatar">{profile.nickname.slice(0,2).toUpperCase()}</div></article> : <AssistantMessage message={message} key={message.id} onRetry={retry} onBranch={() => branch(message)} />)}</div>}</div>
      <div className="composer-zone"><div className={`composer ${streaming ? 'is-streaming' : ''}`} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); setAttachments(items => [...items, ...[...event.dataTransfer.files].map(({name,size,type}) => ({name,size,type}))]); }}>
        {attachments.length > 0 && <div className="attachment-row">{attachments.map((file,index) => <span key={`${file.name}-${index}`}>▧ {file.name}<button onClick={() => setAttachments(items => items.filter((_,i) => i !== index))}>×</button></span>)}</div>}
        <textarea ref={composerRef} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } if (event.key === 'Escape') stop(); }} placeholder={`Message Aetherion, ${profile.nickname}…`} rows="1" />
        <div className="composer-tools"><label title="Attach files">＋<input type="file" multiple accept="image/*,.pdf,.txt,.md,.csv,.json" onChange={event => setAttachments(items => [...items, ...[...event.target.files].map(({name,size,type}) => ({name,size,type}))])} /></label><div className="mode-picker">{modes.map(item => <button title={item.hint} className={mode === item.id ? 'active' : ''} onClick={() => setMode(item.id)} key={item.id}><span>{item.icon}</span>{item.label}</button>)}</div>{streaming ? <button className="stop-button" onClick={stop}>■ Stop</button> : <button className="send-button" onClick={send} disabled={!draft.trim()} aria-label="Send message">↑</button>}</div>
      </div><p className="composer-note">Aetherion can make mistakes. Critical actions always require your approval.</p></div>
    </section>

    {detailsOpen && <aside className="mission-drawer"><div className="drawer-head"><div><span>MISSION VIEW</span><h2>Institution activity</h2></div><button onClick={() => setDetailsOpen(false)}>×</button></div><div className="agent-pulse"><span className="chief-mini">A</span><div><b>Chief of Staff</b><small>Coordinating the mission</small></div><i>LIVE</i></div><p className="drawer-label">ACTIVE TEAM</p>{['Strategy Agent','Research Lead','Security Agent'].map((agent,index) => <div className="working-agent" key={agent}><span>{['⌁','◎','◇'][index]}</span><div><b>{agent}</b><small>{active.messages.length ? ['Structuring the response','Checking evidence','Auditing constraints'][index] : 'Standing by'}</small></div><i className={active.messages.length ? 'working' : ''}/></div>)}<p className="drawer-label">GOVERNANCE</p><div className="constitution-card"><span>⌾</span><div><b>Constitution active</b><small>7 principles · No breaches</small></div><strong>✓</strong></div></aside>}

    {profileOpen && <div className="profile-backdrop" onMouseDown={event => event.target === event.currentTarget && setProfileOpen(false)}><div className="profile-modal"><div className="profile-modal-head"><div><span>PERSONALIZE</span><h2>Your institution</h2><p>Choose how Aetherion and the Council address one another.</p></div><button onClick={() => setProfileOpen(false)}>×</button></div><label>Your name<input value={profile.name} onChange={event => setProfile(value => ({...value,name:event.target.value}))} /></label><label>What should agents call you?<input value={profile.nickname} onChange={event => setProfile(value => ({...value,nickname:event.target.value}))} /></label><p className="council-name-label">COUNCIL MEMBER NAMES</p><div className="council-name-grid">{profile.council.map((name,index) => <label key={index}><span>Judge {index + 1}</span><input value={name} onChange={event => setProfile(value => ({...value,council:value.council.map((item,i) => i === index ? event.target.value : item)}))} /></label>)}</div><button className="save-profile" onClick={() => setProfileOpen(false)}>Save preferences</button></div></div>}
  </div>;
}
