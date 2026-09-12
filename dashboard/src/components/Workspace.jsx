import React, { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import {
  Plus,
  Search,
  ArrowUp,
  ArrowUpRight,
  PanelLeftClose,
  PanelLeft,
  PanelRight,
  Settings2,
  Paperclip,
  X,
  Check,
  Download,
  Square,
  Zap,
  Orbit,
  ShieldCheck,
  FileText,
  Code2,
  ChevronDown,
  ChevronRight,
  Command,
  MessageSquare,
  MoreHorizontal,
  Trash2,
  Pencil,
  Globe2,
  Activity,
  LockKeyhole,
} from "lucide-react";
import OrbitalCore from "./OrbitalCore";
import WorkspaceWelcome from "./WorkspaceWelcome";
import AgentConstellation from "./AgentConstellation";
import LiveWorkspace from "./LiveWorkspace";
import VoiceControls from "./VoiceControls";
import {
  defaults,
  uid,
  read,
  save,
  createChat,
  download,
  IconButton,
  Modal,
  Answer,
  makeDemo,
} from "./WorkspaceParts";
import "./workspace-premium.css";
const STORE = "aetherion_conversations_v1",
  PROFILE = "aetherion_operator_profile";
const modes = [
  {
    id: "quick",
    name: "Quick",
    icon: Zap,
    description: "A focused, direct answer",
  },
  {
    id: "standard",
    name: "Agent team",
    icon: Orbit,
    description: "A coordinated specialist team",
  },
  {
    id: "research",
    name: "Deep research",
    icon: Globe2,
    description: "Explore questions and evidence",
  },
  {
    id: "council",
    name: "Council",
    icon: ShieldCheck,
    description: "Review through seven perspectives",
  },
];
const principles = [
  "Protect user data and privacy.",
  "Ask before irreversible actions.",
  "Keep a traceable record of decisions.",
  "Distinguish evidence from assumptions.",
  "Use the least privilege necessary.",
  "Surface uncertainty and dissent.",
  "Keep the human in control.",
];
export default function Workspace() {
  const token =
    localStorage.getItem("aetherion_token") ||
    sessionStorage.getItem("aetherion_token");
  return token === "public-demo" ? <DemoWorkspace /> : <LiveWorkspace />;
}
function DemoWorkspace() {
  const [conversations, setConversations] = useState(() => {
    const stored = read(STORE, []);
    return Array.isArray(stored) &&
      stored.some((x) => x && Array.isArray(x.messages))
      ? stored
          .filter((x) => x && Array.isArray(x.messages))
          .map((c) => ({
            ...c,
            messages: c.messages.map((m) => ({
              ...m,
              streaming: false,
              stopped: m.streaming || m.stopped,
            })),
          }))
      : [createChat()];
  });
  const [activeId, setActiveId] = useState(() =>
    read("aetherion_active_chat", null),
  );
  const active =
    conversations.find((c) => c.id === activeId) || conversations[0];
  const [profile, setProfile] = useState(() => {
    const p = read(PROFILE, {});
    return {
      name: p.name || "Operator",
      nickname: p.nickname || "Operator",
      council: defaults.map((n, i) => p.council?.[i] || n),
    };
  });
  const [query, setQuery] = useState(""),
    [sidebar, setSidebar] = useState(true),
    [mobileSidebar, setMobileSidebar] = useState(false),
    [panel, setPanel] = useState(null),
    [modal, setModal] = useState(null),
    [toast, setToast] = useState(""),
    [modeOpen, setModeOpen] = useState(false),
    [attachments, setAttachments] = useState([]),
    [dragging, setDragging] = useState(false),
    [stream, setStream] = useState(null),
    [artifactId, setArtifactId] = useState(null),
    [artifactEditing, setArtifactEditing] = useState(false),
    [editText, setEditText] = useState(""),
    [profileDraft, setProfileDraft] = useState(profile),
    [online, setOnline] = useState(navigator.onLine);
  const composer = useRef(null),
    timer = useRef(null),
    streamInfo = useRef(null),
    scroll = useRef(null),
    fileInput = useRef(null),
    toastTimer = useRef(null);
  const mode = active.mode || "standard",
    selectedMode = modes.find((m) => m.id === mode) || modes[1],
    draft = active.draft || "",
    currentStream = stream?.chatId === active.id;
  const patchChat = (id, fn) =>
      setConversations((items) => items.map((c) => (c.id === id ? fn(c) : c))),
    patchActive = (fn) => patchChat(active.id, fn);
  const notify = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4500);
  };
  useEffect(() => {
    if (!save(STORE, conversations))
      setToast(
        "Storage is full. Export important conversations before refreshing.",
      );
  }, [conversations]);
  useEffect(() => {
    save("aetherion_active_chat", active.id);
    setAttachments([]);
    setArtifactId(null);
  }, [active.id]);
  useEffect(() => {
    save(PROFILE, profile);
  }, [profile]);
  useEffect(() => {
    if (composer.current) {
      composer.current.style.height = "auto";
      composer.current.style.height = `${Math.min(composer.current.scrollHeight, 160)}px`;
    }
  }, [draft]);
  useEffect(() => {
    const el = scroll.current;
    if (
      active.messages.length &&
      el &&
      el.scrollHeight - el.scrollTop - el.clientHeight < 180
    )
      el.scrollTop = el.scrollHeight;
  }, [active.messages]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      clearInterval(timer.current);
      clearTimeout(toastTimer.current);
    };
  }, []);
  const stop = () => {
    const info = streamInfo.current;
    if (!info) return;
    clearInterval(timer.current);
    patchChat(info.chatId, (c) => ({
      ...c,
      messages: c.messages.map((m) =>
        m.id === info.messageId ? { ...m, streaming: false, stopped: true } : m,
      ),
    }));
    streamInfo.current = null;
    setStream(null);
  };
  const newChat = () => {
    const c = createChat();
    setConversations((items) => [c, ...items]);
    setActiveId(c.id);
    setMobileSidebar(false);
    setPanel(null);
    setTimeout(() => composer.current?.focus(), 0);
  };
  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setModal({ type: "commands" });
      }
      if (e.key === "Escape" && !modal) {
        stop();
        setModeOpen(false);
        setMobileSidebar(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [modal]);
  const run = (prompt, retryMessage = null) => {
    if (streamInfo.current || !prompt.trim()) return;
    const chatId = active.id,
      messageId = uid(),
      chosenMode = retryMessage?.mode || mode,
      result = makeDemo(prompt, chosenMode, profile.nickname);
    const assistant = {
      id: messageId,
      role: "assistant",
      content: "",
      streaming: true,
      mode: chosenMode,
      prompt,
      card: chosenMode === "council" ? "council" : null,
      artifact: null,
    };
    patchChat(chatId, (c) => ({
      ...c,
      title: c.messages.length ? c.title : prompt.slice(0, 48),
      draft: "",
      updatedAt: Date.now(),
      messages: retryMessage
        ? c.messages.map((m) => (m.id === retryMessage.id ? assistant : m))
        : [
            ...c.messages,
            { id: uid(), role: "user", content: prompt, attachments },
            assistant,
          ],
    }));
    setAttachments([]);
    const info = { chatId, messageId, mode: chosenMode };
    streamInfo.current = info;
    setStream(info);
    let index = 0;
    timer.current = setInterval(() => {
      index += 7;
      const done = index >= result.content.length;
      patchChat(chatId, (c) => ({
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: result.content.slice(0, index),
                streaming: !done,
                artifact: done ? result.artifact : null,
              }
            : m,
        ),
      }));
      if (done) {
        clearInterval(timer.current);
        streamInfo.current = null;
        setStream(null);
      }
    }, 22);
    setTimeout(() => {
      if (scroll.current)
        scroll.current.scrollTop = scroll.current.scrollHeight;
    }, 50);
  };
  const branch = (message) => {
    const c = {
      ...createChat(),
      title: `${active.title} · branch`,
      mode,
      messages: active.messages
        .slice(0, active.messages.findIndex((m) => m.id === message.id) + 1)
        .map((m) => ({ ...m, id: uid(), streaming: false })),
    };
    setConversations((items) => [c, ...items]);
    setActiveId(c.id);
    notify("Conversation branched. Continue from here.");
  };
  const exportChat = () =>
    download(
      active.messages
        .map(
          (m) =>
            `## ${m.role === "user" ? profile.nickname : "Aetherion"}\n\n${m.content}`,
        )
        .join("\n\n"),
      `${active.title.replace(/[^a-z0-9]/gi, "-") || "conversation"}.md`,
    );
  const addFiles = (files) => {
    const added = [...files]
      .filter((f) => f.size <= 20 * 1024 * 1024)
      .map((f) => ({ name: f.name, size: f.size, type: f.type }));
    setAttachments((current) => [...current, ...added].slice(0, 8));
    notify(
      "Preview: file names attached locally; contents are not uploaded. Limit: 8 files, 20 MB each.",
    );
  };
  const openPanel = (name, message) => {
    setPanel(name);
    if (message) setArtifactId(message.id);
  };
  const artifactMessage =
    active.messages.find((m) => m.id === artifactId && m.artifact) ||
    [...active.messages].reverse().find((m) => m.artifact && !m.stopped);
  const filtered = conversations.filter((c) =>
    `${c.title} ${c.messages.map((m) => m.content).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const openProfile = () => {
    setProfileDraft({ ...profile, council: [...profile.council] });
    setModal({ type: "profile" });
  };
  const hasCouncil = active.messages.some(
    (m) => m.card === "council" && !m.streaming && !m.stopped,
  );
  const activity = currentStream
    ? [
        "Request received",
        "Chief of Staff preparing a response",
        "Composing the preview",
      ]
    : active.messages.length
      ? [
          "Request received",
          "Preview response prepared",
          "Ready for your next direction",
        ]
      : [];
  return (
    <div
      className={`aw ${sidebar ? "" : "aw-collapsed"} ${panel ? "aw-with-panel" : ""}`}
    >
      {mobileSidebar && (
        <button
          className="aw-mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileSidebar(false)}
        />
      )}
      <aside className={`aw-sidebar ${mobileSidebar ? "is-open" : ""}`}>
        <NavLink to="/" className="aw-brand">
          <span className="aw-brand-symbol">
            <Orbit size={24} />
          </span>
          <b>
            aetherion<span>INDEPENDENT INTELLIGENCE</span>
          </b>
        </NavLink>
        <button className="aw-new" onClick={newChat}>
          <Plus size={17} /> New conversation <kbd>↗</kbd>
        </button>
        <button
          className="aw-search-trigger"
          onClick={() => setModal({ type: "search" })}
        >
          <Search size={16} /> Search anything <kbd>⌘ K</kbd>
        </button>
        <div className="aw-nav-label">WORKSPACE</div>
        <button
          className={`aw-nav ${!panel ? "selected" : ""}`}
          onClick={() => {
            setPanel(null);
            setMobileSidebar(false);
          }}
        >
          <MessageSquare size={17} /> Conversations{" "}
          <span>{conversations.length.toString().padStart(2, "0")}</span>
        </button>
        <button
          className={`aw-nav ${panel === "artifact" ? "selected" : ""}`}
          onClick={() => {
            setPanel("artifact");
            setMobileSidebar(false);
          }}
        >
          <FileText size={17} /> Artifact studio <ArrowUpRight size={13} />
        </button>
        <button
          className={`aw-nav ${panel === "council" ? "selected" : ""}`}
          onClick={() => {
            setPanel("council");
            setMobileSidebar(false);
          }}
        >
          <ShieldCheck size={17} /> Council chamber
        </button>
        <button
          className={`aw-nav ${panel === "constitution" ? "selected" : ""}`}
          onClick={() => {
            setPanel("constitution");
            setMobileSidebar(false);
          }}
        >
          <LockKeyhole size={17} /> Constitution
        </button>
        <div className="aw-nav-label aw-history-label">
          RECENT CONVERSATIONS <MoreHorizontal size={15} />
        </div>
        <div className="aw-history">
          {filtered
            .slice()
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((c) => (
              <div
                className={`aw-history-row ${c.id === active.id ? "selected" : ""}`}
                key={c.id}
              >
                <button
                  onClick={() => {
                    setActiveId(c.id);
                    setMobileSidebar(false);
                  }}
                >
                  <span className="aw-history-dot" />
                  {c.title}
                </button>
                <IconButton
                  label={`Manage ${c.title}`}
                  onClick={() => {
                    setEditText(c.title);
                    setModal({ type: "manage", id: c.id });
                  }}
                >
                  <MoreHorizontal size={14} />
                </IconButton>
              </div>
            ))}
        </div>
        <div className="aw-preview-note">
          <span>
            <i /> DESIGN PREVIEW
          </span>
          <p>
            A space for ambitious ideas.
            <br />
            You direct. We bring it together.
          </p>
          <button onClick={() => setModal({ type: "about" })}>
            About this workspace <ArrowUpRight size={14} />
          </button>
        </div>
        <button className="aw-profile" onClick={openProfile}>
          <span className="aw-profile-avatar">
            {profile.nickname.slice(0, 2).toUpperCase()}
          </span>
          <span>
            <b>{profile.name}</b>
            <small>Personal workspace</small>
          </span>
          <Settings2 size={16} />
        </button>
      </aside>
      <main className="aw-main">
        <p className="aw-sr-only" role="status" aria-live="polite">
          {currentStream
            ? "Aetherion is composing a preview response."
            : active.messages.length
              ? "Response ready. You can edit, copy, retry, or branch."
              : "New conversation ready."}
        </p>
        <header className="aw-header">
          <div>
            <IconButton
              label="Toggle conversation sidebar"
              onClick={() =>
                window.innerWidth < 900
                  ? setMobileSidebar((v) => !v)
                  : setSidebar((v) => !v)
              }
            >
              {sidebar ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
            </IconButton>
            <span className="aw-breadcrumb">
              Workspace <ChevronRight size={12} />
            </span>
            <b>{active.messages.length ? active.title : "New conversation"}</b>
          </div>
          <div>
            <span className="aw-preview-badge">
              <i /> Preview
            </span>
            <IconButton
              label="Export conversation"
              onClick={exportChat}
              disabled={!active.messages.length}
            >
              <Download size={17} />
            </IconButton>
            <IconButton
              label="Toggle activity panel"
              aria-pressed={panel === "activity"}
              onClick={() => setPanel(panel === "activity" ? null : "activity")}
            >
              <PanelRight size={18} />
            </IconButton>
          </div>
        </header>
        {!online && (
          <div className="aw-offline" role="status">
            You’re offline. This local preview and saved conversations remain
            available.
          </div>
        )}
        <div className="aw-scroll" ref={scroll}>
          {!active.messages.length ? (
            <section className="aw-empty">
              <div className="aw-orbital-stage">
                <div className="aw-orbit-caption left">
                  <span>AE / 01</span>
                  <i /> INSTITUTIONAL CORE
                </div>
                <OrbitalCore />
                <div className="aw-orbit-caption right">
                  <span>SEVEN PERSPECTIVES</span>
                  <i /> ONE DIRECTION
                </div>
              </div>
              <WorkspaceWelcome nickname={profile.nickname} />
              <div className="aw-quick-links">
                <button onClick={() => openPanel("council")}>
                  <span className="aw-stacked-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                  Meet your Council <ArrowUpRight size={13} />
                </button>
                <span />
                <button onClick={() => openPanel("constitution")}>
                  <ShieldCheck size={14} /> Governed by design
                </button>
              </div>
            </section>
          ) : (
            <div className="aw-messages">
              {active.messages.map((m) =>
                m.role === "user" ? (
                  <article key={m.id} className="aw-user-message">
                    <span className="aw-kicker">{profile.nickname}</span>
                    <p>{m.content}</p>
                    {m.attachments?.length > 0 && (
                      <div className="aw-attached">
                        {m.attachments.map((f, i) => (
                          <span key={i}>
                            <Paperclip size={12} />
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ) : (
                  <Answer
                    key={m.id}
                    message={m}
                    profile={profile}
                    onRetry={(message) =>
                      run(
                        message.prompt ||
                          [
                            ...active.messages.slice(
                              0,
                              active.messages.findIndex(
                                (x) => x.id === message.id,
                              ),
                            ),
                          ]
                            .reverse()
                            .find((x) => x.role === "user")?.content ||
                          "",
                        message,
                      )
                    }
                    onBranch={branch}
                    onFeedback={(message, value) =>
                      patchActive((c) => ({
                        ...c,
                        messages: c.messages.map((m) =>
                          m.id === message.id
                            ? {
                                ...m,
                                feedback: m.feedback === value ? null : value,
                              }
                            : m,
                        ),
                      }))
                    }
                    onEdit={(message) => {
                      setEditText(message.content);
                      setModal({ type: "edit", id: message.id });
                    }}
                    onPanel={openPanel}
                    notify={notify}
                    disabled={!!stream}
                  />
                ),
              )}
              {currentStream && (
                <div className="aw-inline-activity">
                  <span className="aw-working-dot" />
                  <span>Chief of Staff is composing a preview</span>
                  <button onClick={() => setPanel("activity")}>
                    View activity <ArrowUpRight size={12} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="aw-composer-zone">
          <div
            className={`aw-composer ${dragging ? "dragging" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget))
                setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(e.dataTransfer.files);
            }}
          >
            {attachments.length > 0 && (
              <div className="aw-attached">
                {attachments.map((f, i) => (
                  <span key={i}>
                    <Paperclip size={12} />
                    {f.name}
                    <IconButton
                      label={`Remove ${f.name}`}
                      onClick={() =>
                        setAttachments((a) => a.filter((_, j) => j !== i))
                      }
                    >
                      <X size={12} />
                    </IconButton>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={composer}
              aria-label="Message Aetherion"
              placeholder="An idea, a question, a little ambition…"
              value={draft}
              onChange={(e) =>
                patchActive((c) => ({ ...c, draft: e.target.value }))
              }
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault();
                  run(draft);
                }
              }}
              rows={1}
            />
            <div className="aw-composer-toolbar">
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <IconButton
                label="Attach files"
                onClick={() => fileInput.current.click()}
              >
                <Plus size={20} />
              </IconButton>
              <VoiceControls
                onTranscript={(text) =>
                  patchActive((c) => ({
                    ...c,
                    draft: `${c.draft || ""} ${text}`.trim(),
                  }))
                }
                text={
                  [...active.messages]
                    .reverse()
                    .find((m) => m.role === "assistant" && !m.streaming)
                    ?.content
                }
                onNotice={notify}
              />
              <span className="aw-toolbar-divider" />
              <div className="aw-mode-wrap">
                <button
                  className="aw-mode-trigger"
                  aria-expanded={modeOpen}
                  onClick={() => setModeOpen((v) => !v)}
                >
                  <selectedMode.icon size={15} />
                  {selectedMode.name}
                  <ChevronDown size={12} />
                </button>
                {modeOpen && (
                  <>
                    <button
                      className="aw-mode-dismiss"
                      tabIndex={-1}
                      aria-label="Close mode menu"
                      onClick={() => setModeOpen(false)}
                    />
                    <div className="aw-mode-menu">
                      {modes.map((m) => (
                        <button
                          aria-pressed={mode === m.id}
                          onClick={() => {
                            patchActive((c) => ({ ...c, mode: m.id }));
                            setModeOpen(false);
                            composer.current?.focus();
                          }}
                          key={m.id}
                        >
                          <m.icon size={17} />
                          <span>
                            <b>{m.name}</b>
                            <small>{m.description}</small>
                          </span>
                          {mode === m.id && <Check size={15} />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <span className="aw-composer-spacer" />
              <span className="aw-enter-hint">↵ to send</span>
              {currentStream ? (
                <button
                  className="aw-send aw-stop"
                  aria-label="Stop generation"
                  onClick={stop}
                >
                  <Square size={15} />
                </button>
              ) : (
                <button
                  className="aw-send"
                  aria-label="Send message"
                  disabled={!draft.trim() || !!stream}
                  onClick={() => run(draft)}
                >
                  <ArrowUp size={20} />
                </button>
              )}
            </div>
          </div>
          {!active.messages.length && (
            <div className="aw-starters">
              {[
                {
                  icon: Globe2,
                  label: "Explore an idea",
                  mode: "research",
                  prompt:
                    "Help me research an idea and build a clear evidence-based plan.",
                },
                {
                  icon: Code2,
                  label: "Build something",
                  mode: "standard",
                  prompt:
                    "Help me design and build a secure, accessible product.",
                },
                {
                  icon: ShieldCheck,
                  label: "Ask the Council",
                  mode: "council",
                  prompt:
                    "Review my next product decision from seven different perspectives.",
                },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => {
                    patchActive((c) => ({
                      ...c,
                      draft: s.prompt,
                      mode: s.mode,
                    }));
                    composer.current?.focus();
                  }}
                >
                  <s.icon size={14} />
                  {s.label}
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          )}
          <footer className="aw-composer-foot">
            <span>
              <LockKeyhole size={11} /> Saved on this device
            </span>
            <span>Illustrative responses · No live agent execution</span>
            <button onClick={() => setModal({ type: "commands" })}>
              <Command size={11} /> K
            </button>
          </footer>
        </div>
      </main>
      {panel && (
        <aside className="aw-panel">
          <header>
            <div>
              <span className="aw-kicker">THE INNER WORKINGS</span>
              <h2>
                {
                  {
                    activity: "Mission activity",
                    council: "Council chamber",
                    artifact: "Artifact studio",
                    constitution: "Constitution",
                  }[panel]
                }
              </h2>
            </div>
            <IconButton label="Close side panel" onClick={() => setPanel(null)}>
              <X size={18} />
            </IconButton>
          </header>
          <div className="aw-panel-content">
            {panel === "activity" && (
              <>
                <div className="aw-panel-hero">
                  <Orbit size={28} />
                  <h3>
                    {currentStream
                      ? "Bringing it together."
                      : active.messages.length
                        ? "Ready for what’s next."
                        : "Every step, in view."}
                  </h3>
                  <p>
                    {currentStream
                      ? "A simulated response is being composed."
                      : "Your mission timeline appears here as the conversation develops."}
                  </p>
                </div>
                <AgentConstellation />
                <div className="aw-section-label">
                  ACTIVITY <span>LOCAL PREVIEW</span>
                </div>
                {activity.length ? (
                  activity.map((a, i) => (
                    <div className="aw-timeline" key={a}>
                      <span>
                        {currentStream && i === 2 ? (
                          <span className="aw-working-dot" />
                        ) : (
                          <Check size={12} />
                        )}
                      </span>
                      <div>
                        <b>{a}</b>
                        <p>
                          {i === 0
                            ? "Your direction sets the mission."
                            : i === 1
                              ? "Illustrative workflow · No tools executed."
                              : currentStream
                                ? "Streaming the sample answer."
                                : "Continue, revise, or branch the conversation."}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="aw-panel-empty">
                    <Activity size={24} />
                    <p>
                      No mission yet.
                      <br />
                      Start with a message.
                    </p>
                  </div>
                )}
                <button
                  className="aw-panel-link"
                  onClick={() => setPanel("council")}
                >
                  <ShieldCheck size={16} /> Open Council chamber{" "}
                  <ArrowUpRight size={14} />
                </button>
              </>
            )}
            {panel === "council" && (
              <>
                <div className="aw-chamber-visual">
                  <div className="aw-chamber-center">
                    <ShieldCheck size={27} />
                    <span>VII</span>
                  </div>
                  {profile.council.map((name, i) => (
                    <span
                      className={`aw-judge-node ${hasCouncil && i === 3 ? "revision" : ""}`}
                      key={i}
                      style={{ "--angle": `${(i * 360) / 7 - 90}deg` }}
                      title={name}
                    >
                      {name.slice(0, 1)}
                    </span>
                  ))}
                </div>
                <div className="aw-chamber-summary">
                  <h3>
                    Independent minds.
                    <br />A considered decision.
                  </h3>
                  <p>
                    {hasCouncil
                      ? "Sample verdict: six approve, one requests revision."
                      : "Seven perspectives, ready to examine your next decision."}
                  </p>
                </div>
                <div className="aw-section-label">
                  COUNCIL MEMBERS{" "}
                  <span>{hasCouncil ? "DEMO VOTES" : "STANDING BY"}</span>
                </div>
                {profile.council.map((name, i) => (
                  <div className="aw-judge-row" key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <b>{name}</b>
                      <small>{defaults[i]}</small>
                    </div>
                    <i
                      className={
                        hasCouncil ? (i === 3 ? "revision" : "approve") : ""
                      }
                    >
                      {hasCouncil
                        ? i === 3
                          ? "Revision"
                          : "Approve"
                        : "Ready"}
                    </i>
                  </div>
                ))}
                {hasCouncil && (
                  <div className="aw-decision">
                    <b>
                      {active.decision
                        ? `Demo decision: ${active.decision}`
                        : "Your direction matters."}
                    </b>
                    <p>
                      {active.decision
                        ? "Saved locally. No pipeline action was taken."
                        : "Record a local decision on the sample bounded pilot."}
                    </p>
                    <div>
                      <button
                        onClick={() =>
                          patchActive((c) => ({ ...c, decision: "Approved" }))
                        }
                      >
                        Approve pilot
                      </button>
                      <button
                        onClick={() =>
                          patchActive((c) => ({
                            ...c,
                            decision: "Revision requested",
                          }))
                        }
                      >
                        Request revision
                      </button>
                    </div>
                  </div>
                )}
                <button className="aw-panel-link" onClick={openProfile}>
                  <Settings2 size={15} /> Personalize your Council{" "}
                  <ArrowUpRight size={14} />
                </button>
              </>
            )}
            {panel === "constitution" && (
              <>
                <div className="aw-panel-hero">
                  <LockKeyhole size={28} />
                  <h3>Ambition, with principles.</h3>
                  <p>
                    A proposed constitution for a transparent, accountable
                    institution.
                  </p>
                </div>
                <div className="aw-constitution-status">
                  <ShieldCheck size={17} /> Design principles{" "}
                  <span>PREVIEW</span>
                </div>
                {principles.map((p, i) => (
                  <div className="aw-principle" key={p}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <p>{p}</p>
                  </div>
                ))}
                <p className="aw-panel-disclaimer">
                  These principles describe the intended governance model.
                  Enforcement and audit records require the orchestration
                  backend.
                </p>
              </>
            )}
            {panel === "artifact" &&
              (artifactMessage ? (
                <>
                  <div className="aw-artifact-toolbar">
                    <div>
                      <FileText size={17} />
                      <b>{artifactMessage.artifact.title}</b>
                    </div>
                    <div>
                      <IconButton
                        label={
                          artifactEditing ? "Preview artifact" : "Edit artifact"
                        }
                        onClick={() => setArtifactEditing((v) => !v)}
                      >
                        {artifactEditing ? (
                          <Check size={15} />
                        ) : (
                          <Pencil size={15} />
                        )}
                      </IconButton>
                      <IconButton
                        label="Download artifact"
                        onClick={() =>
                          download(
                            artifactMessage.artifact.content,
                            "aetherion-brief.md",
                          )
                        }
                      >
                        <Download size={15} />
                      </IconButton>
                    </div>
                  </div>
                  <span className="aw-artifact-status">
                    {artifactEditing
                      ? "Editing · Changes saved locally"
                      : "DOCUMENT · EDITABLE TEMPLATE"}
                  </span>
                  {artifactEditing ? (
                    <textarea
                      className="aw-artifact-editor"
                      aria-label="Artifact content"
                      value={artifactMessage.artifact.content}
                      onChange={(e) =>
                        patchActive((c) => ({
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === artifactMessage.id
                              ? {
                                  ...m,
                                  artifact: {
                                    ...m.artifact,
                                    content: e.target.value,
                                  },
                                }
                              : m,
                          ),
                        }))
                      }
                    />
                  ) : (
                    <div className="aw-markdown aw-artifact-preview">
                      <ReactMarkdown>
                        {artifactMessage.artifact.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </>
              ) : (
                <div className="aw-panel-empty">
                  <FileText size={32} />
                  <h3>Give your ideas a form.</h3>
                  <p>
                    Send a message in Agent team or Deep research mode to create
                    an editable brief.
                  </p>
                  <button
                    className="aw-primary"
                    onClick={() => {
                      patchActive((c) => ({
                        ...c,
                        mode: "standard",
                        draft: "Create a mission brief for my next project.",
                      }));
                      composer.current?.focus();
                    }}
                  >
                    Start a brief <ArrowUpRight size={15} />
                  </button>
                </div>
              ))}
          </div>
        </aside>
      )}
      {toast && (
        <div className="aw-toast" role="status">
          <Check size={16} />
          {toast}
          <IconButton label="Dismiss notification" onClick={() => setToast("")}>
            <X size={14} />
          </IconButton>
        </div>
      )}
      {modal && (
        <Modal
          title={
            {
              profile: "Make it yours.",
              commands: "Where would you like to go?",
              search: "Find a conversation.",
              manage: "Conversation settings",
              edit: "Refine the answer.",
              about: "Aetherion, reimagined.",
            }[modal.type]
          }
          subtitle={
            modal.type === "profile"
              ? "Your name. Your Council. Your institution."
              : modal.type === "about"
                ? "An interactive design preview of the conversation-first workspace."
                : ""
          }
          onClose={() => {
            setModal(null);
            setQuery("");
          }}
        >
          {(modal.type === "commands" || modal.type === "search") && (
            <>
              <label className="aw-search-field">
                <Search size={18} />
                <input
                  aria-label="Search conversations"
                  placeholder="Search conversations…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              {modal.type === "commands" && (
                <div className="aw-command-actions">
                  {[
                    ["New conversation", Plus, () => newChat()],
                    ["Council chamber", ShieldCheck, () => setPanel("council")],
                    ["Artifact studio", FileText, () => setPanel("artifact")],
                    ["Personalize workspace", Settings2, () => openProfile()],
                  ].map(([label, Icon, action]) => (
                    <button
                      key={label}
                      onClick={() => {
                        setModal(null);
                        action();
                      }}
                    >
                      <Icon size={17} />
                      {label}
                      <ArrowUpRight size={14} />
                    </button>
                  ))}
                </div>
              )}
              <div className="aw-search-results">
                {filtered.length ? (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveId(c.id);
                        setModal(null);
                        setQuery("");
                      }}
                    >
                      <MessageSquare size={16} />
                      {c.title}
                      <ChevronRight size={14} />
                    </button>
                  ))
                ) : (
                  <p>No conversations match your search.</p>
                )}
              </div>
            </>
          )}
          {modal.type === "profile" && (
            <>
              <div className="aw-profile-fields">
                <label>
                  Your name
                  <input
                    value={profileDraft.name}
                    onChange={(e) =>
                      setProfileDraft((p) => ({ ...p, name: e.target.value }))
                    }
                  />
                </label>
                <label>
                  Call me
                  <input
                    value={profileDraft.nickname}
                    onChange={(e) =>
                      setProfileDraft((p) => ({
                        ...p,
                        nickname: e.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <div className="aw-section-label">YOUR SEVEN COUNCIL MEMBERS</div>
              <div className="aw-profile-fields">
                {profileDraft.council.map((name, i) => (
                  <label key={i}>
                    {defaults[i]}
                    <input
                      value={name}
                      maxLength={40}
                      onChange={(e) =>
                        setProfileDraft((p) => ({
                          ...p,
                          council: p.council.map((n, j) =>
                            j === i ? e.target.value : n,
                          ),
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button
                className="aw-primary"
                onClick={() => {
                  setProfile({
                    name: profileDraft.name.trim() || "Operator",
                    nickname: profileDraft.nickname.trim() || "Operator",
                    council: profileDraft.council.map(
                      (n, i) => n.trim() || defaults[i],
                    ),
                  });
                  setModal(null);
                  notify("Your institution has been personalized.");
                }}
              >
                Save preferences <Check size={16} />
              </button>
            </>
          )}
          {modal.type === "manage" && (
            <>
              <label className="aw-field">
                Conversation title
                <input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                />
              </label>
              <div className="aw-modal-actions">
                <button
                  className="aw-danger"
                  disabled={stream?.chatId === modal.id}
                  onClick={() => {
                    setConversations((items) => {
                      const remaining = items.filter((c) => c.id !== modal.id);
                      return remaining.length ? remaining : [createChat()];
                    });
                    setModal(null);
                    notify("Conversation deleted from this device.");
                  }}
                >
                  <Trash2 size={16} /> Delete conversation
                </button>
                <button
                  className="aw-primary"
                  onClick={() => {
                    patchChat(modal.id, (c) => ({
                      ...c,
                      title: editText.trim() || "Untitled conversation",
                    }));
                    setModal(null);
                  }}
                >
                  Save title
                </button>
              </div>
            </>
          )}
          {modal.type === "edit" && (
            <>
              <textarea
                className="aw-edit-answer"
                aria-label="Edit answer"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
              />
              <button
                className="aw-primary"
                onClick={() => {
                  patchActive((c) => ({
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === modal.id ? { ...m, content: editText } : m,
                    ),
                  }));
                  setModal(null);
                  notify("Answer updated locally.");
                }}
              >
                Save answer <Check size={16} />
              </button>
            </>
          )}
          {modal.type === "about" && (
            <div className="aw-about">
              <p>
                This workspace combines a responsive orbital sculpture,
                persistent conversations, an editable artifact studio, and a
                seven-member Council view.
              </p>
              <p>
                <b>Working locally:</b> drafts, search, streaming
                demonstrations, stop, retry, branching, feedback, export, and
                personalization.
              </p>
              <p>
                <b>Integration still needed:</b> authenticated cloud
                persistence, real agent execution and votes, file ingestion,
                research sources, voice services, and production hosting.
                Preview responses and votes are illustrative.
              </p>
              <p>
                Conversations are stored in this browser. Export them to keep a
                separate copy.
              </p>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
