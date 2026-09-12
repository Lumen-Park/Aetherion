import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import {
  Plus,
  ArrowUp,
  Square,
  Download,
  PanelLeft,
  Copy,
  RotateCcw,
  GitBranch,
  ThumbsUp,
  ThumbsDown,
  Check,
  ShieldCheck,
  Command,
  Search,
  X,
  ChevronRight,
  Paperclip,
  Pencil,
  Trash2,
} from "lucide-react";
import OrbitalCore from "./OrbitalCore";
import AgentConstellation from "./AgentConstellation";
import VoiceControls from "./VoiceControls";
import { IconButton, download } from "./WorkspaceParts";
import "./workspace-premium.css";

const origin = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
const ACTIVE_CONVERSATION_KEY = "aetherion_live_active_conversation";
const DRAFT_CACHE_KEY = "aetherion_live_drafts";
const NEW_DRAFT_KEY = "__new__";
const MAX_TEXT_ATTACHMENT_BYTES = 200_000;
const MAX_TEXT_CONTEXT_CHARS = 100_000;
const TEXT_FILE_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".json",
  ".log",
  ".xml",
  ".yaml",
  ".yml",
]);
const isTextAttachment = (file) => {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return (
    (file.type || "").startsWith("text/") || TEXT_FILE_EXTENSIONS.has(extension)
  );
};
const readTextAttachment = async (file) => {
  if (!isTextAttachment(file) || file.size > MAX_TEXT_ATTACHMENT_BYTES)
    return null;
  try {
    return (await file.text()).slice(0, 50_000);
  } catch {
    return null;
  }
};
const readDraftCache = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(DRAFT_CACHE_KEY) || "{}");
    return stored && typeof stored === "object" ? stored : {};
  } catch {
    return {};
  }
};
const writeDraftCache = (cache) => {
  try {
    localStorage.setItem(DRAFT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Draft persistence is best effort when browser storage is unavailable.
  }
};
export default function LiveWorkspace() {
  const [chats, setChats] = useState([]),
    [active, setActive] = useState(
      () => localStorage.getItem(ACTIVE_CONVERSATION_KEY) || null,
    );
  const [chatQuery, setChatQuery] = useState("");
  const [historyCursor, setHistoryCursor] = useState(-1);
  const [editingChat, setEditingChat] = useState(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmingChat, setConfirmingChat] = useState(null);
  const [messages, setMessages] = useState([]),
    [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]),
    [dragging, setDragging] = useState(false);
  const [readingAttachments, setReadingAttachments] = useState(false);
  const [mode, setMode] = useState("quick"),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [activity, setActivity] = useState([]);
  const [feedback, setFeedback] = useState({});
  const [agents, setAgents] = useState([]);
  const [council, setCouncil] = useState(null);
  const [drawer, setDrawer] = useState(false),
    [connected, setConnected] = useState(false);
  const [syncState, setSyncState] = useState("syncing");
  const [draftSyncState, setDraftSyncState] = useState("local");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const selection = useRef(null),
    submitting = useRef(false),
    composer = useRef(null),
    palette = useRef(null),
    fileInput = useRef(null),
    historySearch = useRef(null),
    draftCache = useRef(null),
    draftValue = useRef(""),
    draftSaveTimer = useRef(null),
    draftRevision = useRef(0);
  const token =
    localStorage.getItem("aetherion_token") ||
    sessionStorage.getItem("aetherion_token");
  const request = async (path, options = {}) => {
    const response = await fetch(origin + "/api" + path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(
        typeof data.detail === "string"
          ? data.detail
          : `Request failed (${response.status}). Please retry.`,
      );
    }
    return response;
  };
  const list = async () => {
    setSyncState("syncing");
    const data = await (await request("/conversations")).json();
    setChats(data.conversations);
    setConnected(true);
    setSyncState("connected");
    setActive((current) => {
      const preferred =
        current || localStorage.getItem(ACTIVE_CONVERSATION_KEY);
      if (preferred && data.conversations.some((chat) => chat.id === preferred))
        return preferred;
      return data.conversations[0]?.id || null;
    });
  };
  useEffect(() => {
    if (active) localStorage.setItem(ACTIVE_CONVERSATION_KEY, active);
    else localStorage.removeItem(ACTIVE_CONVERSATION_KEY);
  }, [active]);
  const getDraftCache = () => {
    if (!draftCache.current) draftCache.current = readDraftCache();
    return draftCache.current;
  };
  const saveDraftCacheFor = (key, content) => {
    const cache = getDraftCache();
    if (content.trim()) cache[key] = content;
    else delete cache[key];
    writeDraftCache(cache);
  };
  const scheduleCloudDraftSave = (conversationId, content) => {
    clearTimeout(draftSaveTimer.current);
    if (!conversationId) {
      setDraftSyncState("local");
      return;
    }
    const revision = draftRevision.current;
    setDraftSyncState("saving");
    draftSaveTimer.current = setTimeout(() => {
      request(`/conversations/${conversationId}/draft`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      })
        .then(() => {
          if (revision === draftRevision.current) setDraftSyncState("cloud");
        })
        .catch((error) => {
          if (revision !== draftRevision.current) return;
          setDraftSyncState("local");
          setNotice(`Draft sync paused: ${error.message}`);
        });
    }, 450);
  };
  const updateDraft = (value) => {
    const next =
      typeof value === "function" ? value(draftValue.current) : value;
    draftValue.current = next;
    draftRevision.current += 1;
    saveDraftCacheFor(active || NEW_DRAFT_KEY, next);
    setDraft(next);
    scheduleCloudDraftSave(active, next);
  };
  const setDraftForConversation = (conversationId, content) => {
    draftValue.current = content;
    draftRevision.current += 1;
    saveDraftCacheFor(conversationId || NEW_DRAFT_KEY, content);
    setDraft(content);
    scheduleCloudDraftSave(conversationId, content);
  };
  useEffect(() => {
    clearTimeout(draftSaveTimer.current);
    draftRevision.current += 1;
    const revision = draftRevision.current;
    const cache = getDraftCache();
    const localDraft = cache[active || NEW_DRAFT_KEY] || "";
    draftValue.current = localDraft;
    setDraft(localDraft);
    setDraftSyncState(active ? "syncing" : "local");
    if (!active) return undefined;
    const controller = new AbortController();
    request(`/conversations/${active}/draft`, { signal: controller.signal })
      .then((response) => response.json())
      .then((data) => {
        if (controller.signal.aborted || revision !== draftRevision.current)
          return;
        const content = data.content || localDraft;
        draftValue.current = content;
        saveDraftCacheFor(active, content);
        setDraft(content);
        if (data.content) setDraftSyncState("cloud");
        else if (localDraft) scheduleCloudDraftSave(active, localDraft);
        else setDraftSyncState("cloud");
      })
      .catch((error) => {
        if (controller.signal.aborted || revision !== draftRevision.current)
          return;
        setDraftSyncState("local");
        if (localDraft) setNotice(`Using local draft: ${error.message}`);
      });
    return () => {
      controller.abort();
      clearTimeout(draftSaveTimer.current);
    };
  }, [active]);
  useEffect(() => {
    list().catch((e) => {
      setNotice(e.message);
      setConnected(false);
      setSyncState("offline");
    });
  }, []);
  useEffect(() => {
    selection.current = active;
    if (!active) {
      setMessages([]);
      setFeedback({});
      setActivity([]);
      setAgents([]);
      setCouncil(null);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    let cursor = 0;
    setMessages([]);
    setFeedback({});
    setActivity([]);
    setAgents([]);
    setCouncil(null);
    const sync = async () => {
      const chat = await (
        await request(`/conversations/${active}`, { signal: controller.signal })
      ).json();
      if (selection.current !== active) return;
      setMessages(chat.messages);
      setFeedback(
        Object.fromEntries(
          chat.messages
            .filter((message) => message.metadata?.feedback)
            .map((message) => [message.id, message.metadata.feedback]),
        ),
      );
      setConnected(true);
      setSyncState("connected");
      const latestCouncil = [...chat.messages]
        .reverse()
        .find((message) => message.metadata?.council)?.metadata?.council;
      setCouncil(latestCouncil || null);
      cursor = Math.max(cursor, chat.last_event_sequence || 0);
      setBusy(chat.messages.some((m) => m.metadata?.status === "running"));
    };
    const watch = async () => {
      while (!controller.signal.aborted) {
        try {
          await sync();
          const response = await request(
            `/conversations/${active}/events?after=${cursor}`,
            { signal: controller.signal },
          );
          setConnected(true);
          const reader = response.body.getReader(),
            decoder = new TextDecoder();
          let buffer = "";
          while (!controller.signal.aborted) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            let boundary,
              refresh = false;
            while ((boundary = buffer.indexOf("\n\n")) !== -1) {
              const frame = buffer.slice(0, boundary);
              buffer = buffer.slice(boundary + 2);
              const id = frame.match(/^id: (\d+)/m),
                event = frame.match(/^event: (.+)/m),
                payload = frame.match(/^data: (.+)/m);
              if (!payload || !event) continue;
              const data = JSON.parse(payload[1]);
              if (
                event[1] === "message.delta" ||
                event[1] === "message.finished"
              )
                refresh = true;
              if (event[1].startsWith("agent."))
                setActivity((items) => [
                  ...items.slice(-19),
                  `${data.name}: ${event[1].endsWith("started") ? "working" : "finished"}`,
                ]);
              if (
                event[1] === "agent.started" ||
                event[1] === "agent.completed"
              )
                setAgents((items) =>
                  [
                    ...items.filter((item) => item.name !== data.name),
                    {
                      name: data.name,
                      status:
                        event[1] === "agent.started" ? "working" : "completed",
                    },
                  ].slice(-14),
                );
              if (event[1] === "council.vote")
                setAgents((items) =>
                  [
                    ...items.filter((item) => item.name !== data.judge),
                    { name: data.judge, status: "voting" },
                  ].slice(-14),
                );
              if (event[1] === "message.finished")
                setActivity((items) => [
                  ...items.slice(-19),
                  `Run ${data.status}`,
                ]);
              if (event[1] === "council.verdict") setCouncil(data);
              if (event[1] === "mission.error") setNotice(data.detail);
              if (id) cursor = Math.max(cursor, Number(id[1]));
            }
            if (refresh) await sync();
          }
        } catch (error) {
          if (controller.signal.aborted) return;
          setConnected(false);
          setSyncState("reconnecting");
          setNotice(error.message + " Reconnecting…");
        }
        await new Promise((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", finish);
            resolve();
          };
          const timer = setTimeout(finish, 1500);
          controller.signal.addEventListener("abort", finish, { once: true });
        });
      }
    };
    watch();
    return () => controller.abort();
  }, [active]);
  const addFiles = async (files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;
    const available = Math.max(0, 8 - attachments.length);
    if (incoming.length > available)
      setNotice("You can attach up to eight files per message.");
    setReadingAttachments(true);
    try {
      let remainingTextBudget = MAX_TEXT_CONTEXT_CHARS;
      const prepared = await Promise.all(
        incoming.slice(0, available).map(async (file) => {
          const text = await readTextAttachment(file);
          const content = text?.slice(0, Math.max(0, remainingTextBudget));
          if (content) remainingTextBudget -= content.length;
          return {
            name: file.name,
            type: file.type || "application/octet-stream",
            size: file.size,
            ...(content ? { content } : {}),
          };
        }),
      );
      setAttachments((current) => [...current, ...prepared]);
    } finally {
      setReadingAttachments(false);
    }
  };
  const sendContent = async ({
    content,
    conversationId = active,
    requestMode = mode,
    requestAttachments = [],
    clearDraft = false,
  }) => {
    if (!content.trim() || submitting.current || busy || readingAttachments)
      return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    try {
      let id = conversationId;
      if (!id) {
        const chat = await (
          await request("/conversations", {
            method: "POST",
            body: JSON.stringify({ title: content.slice(0, 80) }),
          })
        ).json();
        id = chat.id;
        setActive(id);
      }
      await request(`/conversations/${id}/live`, {
        method: "POST",
        body: JSON.stringify({
          content,
          mode: requestMode,
          attachments: requestAttachments,
          request_id: crypto.randomUUID(),
        }),
      });
      if (clearDraft) {
        updateDraft("");
        setAttachments([]);
      }
      await list();
      const chat = await (await request(`/conversations/${id}`)).json();
      if (selection.current === id) setMessages(chat.messages);
    } catch (error) {
      setNotice(error.message);
      setBusy(false);
    } finally {
      submitting.current = false;
    }
  };
  const send = () =>
    sendContent({
      content: draft,
      conversationId: active,
      requestMode: mode,
      requestAttachments: attachments,
      clearDraft: true,
    });
  const retryMessage = (message, index) => {
    const source = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user");
    if (!source) {
      setNotice("The original prompt for this answer is unavailable.");
      return;
    }
    sendContent({
      content: source.content,
      conversationId: active,
      requestMode: message.metadata?.mode || mode,
    });
  };
  const branchFrom = async (message, index) => {
    const source = messages
      .slice(0, index)
      .reverse()
      .find((item) => item.role === "user");
    if (!source) {
      setNotice("The original prompt for this answer is unavailable.");
      return;
    }
    try {
      const chat = await (
        await request("/conversations", {
          method: "POST",
          body: JSON.stringify({
            title:
              `Branch · ${chats.find((item) => item.id === active)?.title || "Conversation"}`.slice(
                0,
                160,
              ),
          }),
        })
      ).json();
      setActive(chat.id);
      setDraftForConversation(chat.id, source.content);
      setAttachments([]);
      await list();
      setNotice(
        "Branch ready. Review the prompt, then send it when you are ready.",
      );
      setTimeout(() => composer.current?.focus(), 0);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const setMessageFeedback = (messageId, value) => {
    const previous = feedback[messageId] || null;
    const next = previous === value ? null : value;
    setFeedback((current) => {
      const updated = { ...current };
      if (next) updated[messageId] = next;
      else delete updated[messageId];
      return updated;
    });
    request(`/conversations/${active}/messages/${messageId}/feedback`, {
      method: "PATCH",
      body: JSON.stringify({ value: next }),
    }).catch((error) => {
      setFeedback((current) => {
        const restored = { ...current };
        if (previous) restored[messageId] = previous;
        else delete restored[messageId];
        return restored;
      });
      setNotice(error.message);
    });
  };
  const stop = async () => {
    if (!active) return;
    try {
      await request(`/conversations/${active}/live/cancel`, { method: "POST" });
      setBusy(false);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const newConversation = () => {
    if (!active) updateDraft("");
    setEditingChat(null);
    setConfirmingChat(null);
    setActive(null);
    setAttachments([]);
    setAgents([]);
    setCouncil(null);
    setPaletteOpen(false);
    setDrawer(false);
  };
  const exportConversation = () => {
    download(
      messages
        .map((message) => `## ${message.role}\n\n${message.content}`)
        .join("\n\n"),
      "aetherion-conversation.md",
    );
    setPaletteOpen(false);
  };
  useEffect(() => {
    const key = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (
        event.key === "/" &&
        !["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        event.preventDefault();
        historySearch.current?.focus();
      }
      if (event.key === "Escape") {
        if (paletteOpen) setPaletteOpen(false);
        else if (busy) stop();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [paletteOpen, busy]);
  useEffect(() => {
    if (paletteOpen) palette.current?.focus();
  }, [paletteOpen]);
  const latest = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.metadata?.status !== "running");
  const visibleChats = chats.filter((chat) =>
    chat.title.toLowerCase().includes(chatQuery.trim().toLowerCase()),
  );
  const draftStatus =
    {
      syncing: "Loading workspace draft…",
      saving: "Saving draft to workspace…",
      cloud: "Draft synced to workspace",
      local: "Draft saved on this device",
    }[draftSyncState] || "Draft saved on this device";
  useEffect(() => {
    setHistoryCursor((current) =>
      visibleChats.length
        ? Math.min(Math.max(current, -1), visibleChats.length - 1)
        : -1,
    );
  }, [visibleChats.length]);
  const selectConversation = (id) => {
    setEditingChat(null);
    setConfirmingChat(null);
    setActive(id);
    setDrawer(false);
  };
  const startRename = (chat) => {
    setConfirmingChat(null);
    setEditingChat(chat.id);
    setEditingTitle(chat.title);
  };
  const saveRename = async (chat) => {
    const title = editingTitle.trim();
    if (!title) return;
    try {
      await request(`/conversations/${chat.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title }),
      });
      setChats((items) =>
        items.map((item) => (item.id === chat.id ? { ...item, title } : item)),
      );
      setEditingChat(null);
      setNotice("Conversation title updated.");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const deleteConversation = async (chat) => {
    if (chat.id === active && busy) {
      setNotice("Stop the active response before deleting this conversation.");
      return;
    }
    try {
      await request(`/conversations/${chat.id}`, { method: "DELETE" });
      const remaining = chats.filter((item) => item.id !== chat.id);
      setChats(remaining);
      if (active === chat.id) setActive(remaining[0]?.id || null);
      setConfirmingChat(null);
      setNotice("Conversation deleted.");
    } catch (error) {
      setNotice(error.message);
    }
  };
  const handleHistoryKeyDown = (event) => {
    if (!visibleChats.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setHistoryCursor((current) => {
        if (current < 0)
          return event.key === "ArrowDown" ? 0 : visibleChats.length - 1;
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        return (next + visibleChats.length) % visibleChats.length;
      });
      return;
    }
    if (event.key === "Enter" && historyCursor >= 0) {
      event.preventDefault();
      selectConversation(visibleChats[historyCursor].id);
      historySearch.current?.blur();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setChatQuery("");
      setHistoryCursor(-1);
      historySearch.current?.blur();
    }
  };
  return (
    <div className="aw">
      <aside
        className="aw-sidebar"
        style={
          drawer
            ? { transform: "translateX(0)", visibility: "visible" }
            : undefined
        }
      >
        <div className="aw-brand">
          AETHERION <small>LIVE WORKSPACE</small>
        </div>
        <button className="aw-new" onClick={newConversation}>
          <Plus size={18} /> New conversation
        </button>
        <label className="aw-live-search">
          <Search size={14} />
          <input
            ref={historySearch}
            aria-label="Search conversations"
            aria-autocomplete="list"
            aria-controls="live-conversation-history"
            aria-activedescendant={
              historyCursor >= 0
                ? `live-conversation-${visibleChats[historyCursor]?.id}`
                : undefined
            }
            placeholder="Search conversations"
            role="combobox"
            value={chatQuery}
            onChange={(event) => {
              setChatQuery(event.target.value);
              setHistoryCursor(event.target.value ? 0 : -1);
            }}
            onKeyDown={handleHistoryKeyDown}
          />
          {chatQuery ? (
            <button
              type="button"
              className="aw-live-search-clear"
              aria-label="Clear conversation search"
              onClick={() => setChatQuery("")}
            >
              <X size={12} />
            </button>
          ) : (
            <kbd>/</kbd>
          )}
        </label>
        <div id="live-conversation-history" className="aw-history">
          {visibleChats.length ? (
            visibleChats.map((chat, index) => (
              <div
                key={chat.id}
                className={`aw-history-row ${chat.id === active ? "selected" : ""}`}
              >
                {editingChat === chat.id ? (
                  <form
                    className="aw-history-edit"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveRename(chat);
                    }}
                  >
                    <input
                      aria-label={`Rename ${chat.title}`}
                      autoFocus
                      maxLength={160}
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          event.preventDefault();
                          event.stopPropagation();
                          setEditingChat(null);
                        }
                      }}
                    />
                    <IconButton label="Save title" type="submit">
                      <Check size={13} />
                    </IconButton>
                    <IconButton
                      label="Cancel rename"
                      type="button"
                      onClick={() => setEditingChat(null)}
                    >
                      <X size={13} />
                    </IconButton>
                  </form>
                ) : confirmingChat === chat.id ? (
                  <div className="aw-history-confirm">
                    <span>Delete conversation?</span>
                    <button
                      type="button"
                      className="aw-history-confirm-delete"
                      onClick={() => deleteConversation(chat)}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingChat(null)}
                    >
                      Keep
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      id={`live-conversation-${chat.id}`}
                      className={`aw-nav ${chat.id === active ? "selected" : ""} ${
                        index === historyCursor ? "history-cursor" : ""
                      }`}
                      aria-current={chat.id === active ? "page" : undefined}
                      onClick={() => selectConversation(chat.id)}
                    >
                      <span className="aw-history-dot" />
                      <span>{chat.title}</span>
                    </button>
                    <IconButton
                      label={`Rename ${chat.title}`}
                      onClick={() => startRename(chat)}
                    >
                      <Pencil size={13} />
                    </IconButton>
                    <IconButton
                      label={`Delete ${chat.title}`}
                      disabled={chat.id === active && busy}
                      onClick={() => {
                        setEditingChat(null);
                        setConfirmingChat(chat.id);
                      }}
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </>
                )}
              </div>
            ))
          ) : (
            <p className="aw-live-history-empty">No conversations found.</p>
          )}
        </div>
        <div className="aw-preview-note">
          <span>
            {connected && syncState === "connected"
              ? "SERVER SYNCED"
              : syncState === "offline"
                ? "OFFLINE"
                : "SYNCING"}
          </span>
          <p>
            Conversations are stored on your Aetherion server. Voice transcripts
            wait for your review.
          </p>
        </div>
      </aside>
      <main className="aw-main">
        <header className="aw-header">
          <div>
            <IconButton
              label="Toggle conversations"
              onClick={() => setDrawer(!drawer)}
            >
              <PanelLeft size={18} />
            </IconButton>
            <b>
              {chats.find((c) => c.id === active)?.title || "New conversation"}
            </b>
          </div>
          <span
            className={`aw-preview-badge aw-sync-badge ${syncState}`}
            aria-live="polite"
          >
            <i />
            {syncState === "connected"
              ? "Cloud synced · advisory"
              : syncState === "reconnecting"
                ? "Reconnecting…"
                : syncState === "offline"
                  ? "Offline · retrying"
                  : "Syncing workspace…"}
          </span>
        </header>
        <div
          className="aw-message-scroll"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px clamp(20px, 5vw, 90px)",
          }}
        >
          {!messages.length && (
            <div className="aw-empty">
              <OrbitalCore />
              <h1>Bring your next idea to life.</h1>
              <p>
                Ask the Chief of Staff, bring in a Planner and Reviewer, or ask
                the Council.
              </p>
            </div>
          )}
          {messages.map((message, index) => (
            <article
              key={message.id}
              className="aw-message"
              style={{ margin: "24px auto", maxWidth: 850 }}
            >
              <small>
                {message.role === "user" ? "YOU" : "AETHERION"}{" "}
                {message.metadata?.status && `· ${message.metadata.status}`}
              </small>
              <div className="aw-markdown">
                <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
                  {message.content || "Working…"}
                </ReactMarkdown>
              </div>
              {message.metadata?.attachments?.length > 0 && (
                <div className="aw-attached aw-message-attachments">
                  {message.metadata.attachments.map((file, index) => (
                    <span key={`${file.name}-${index}`}>
                      <Paperclip size={12} />
                      {file.name}
                    </span>
                  ))}
                </div>
              )}
              {message.metadata?.council && (
                <section className="aw-council-card aw-live-council-card">
                  <div className="aw-card-heading">
                    <span>
                      <ShieldCheck size={16} />
                      Live Council verdict
                    </span>
                    <small>SEVEN JUDGES · HUMAN REVIEW</small>
                  </div>
                  <div className="aw-vote-bar">
                    {message.metadata.council.votes?.map((vote) => (
                      <i
                        key={vote.judge}
                        className={vote.verdict === "revise" ? "revision" : ""}
                        title={`${vote.judge}: ${vote.reason}`}
                      />
                    ))}
                  </div>
                  <footer>
                    <span>
                      <b>{message.metadata.council.decision?.toUpperCase()}</b>{" "}
                      · {message.metadata.council.approvals} approve ·{" "}
                      {message.metadata.council.rejections} reject ·{" "}
                      {message.metadata.council.revisions} revise
                    </span>
                    <span>
                      {message.metadata.council.security_veto
                        ? "Security veto"
                        : "Approval required"}
                    </span>
                  </footer>
                  <div className="aw-live-vote-list">
                    {message.metadata.council.votes?.map((vote) => (
                      <div key={vote.judge}>
                        <strong>{vote.judge}</strong>
                        <span className={`aw-vote-${vote.verdict}`}>
                          {vote.verdict}
                        </span>
                        <small>{vote.reason}</small>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {message.content && (
                <div
                  className="aw-answer-actions"
                  role="toolbar"
                  aria-label={`${message.role === "assistant" ? "Answer" : "Message"} actions`}
                >
                  <IconButton
                    label="Copy message"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(message.content)
                        .then(() => setNotice("Copied to clipboard."))
                        .catch(() =>
                          setNotice(
                            "Clipboard unavailable. Select the message to copy it.",
                          ),
                        )
                    }
                  >
                    <Copy size={14} />
                  </IconButton>
                  {message.role === "assistant" &&
                    message.metadata?.status !== "running" && (
                      <>
                        <IconButton
                          label="Retry response"
                          onClick={() => retryMessage(message, index)}
                          disabled={busy}
                        >
                          <RotateCcw size={14} />
                        </IconButton>
                        <IconButton
                          label="Branch from response"
                          onClick={() => branchFrom(message, index)}
                          disabled={busy}
                        >
                          <GitBranch size={14} />
                        </IconButton>
                        <span />
                        <IconButton
                          label="Helpful"
                          aria-pressed={feedback[message.id] === "up"}
                          onClick={() => setMessageFeedback(message.id, "up")}
                        >
                          <ThumbsUp size={14} />
                        </IconButton>
                        <IconButton
                          label="Not helpful"
                          aria-pressed={feedback[message.id] === "down"}
                          onClick={() => setMessageFeedback(message.id, "down")}
                        >
                          <ThumbsDown size={14} />
                        </IconButton>
                      </>
                    )}
                </div>
              )}
            </article>
          ))}
        </div>
        {council && (
          <div className="aw-council-live-status" role="status">
            <ShieldCheck size={15} />
            <span>
              Council {council.decision || "review"} · {council.approvals || 0}
               approve / {council.rejections || 0} reject
            </span>
          </div>
        )}
        {activity.length > 0 && (
          <div className="aw-live-activity">
            <AgentConstellation activeAgents={agents} live />
            <details>
              <summary>Agent activity · {activity.at(-1)}</summary>
              {activity.map((item, i) => (
                <p key={i}>{item}</p>
              ))}
            </details>
          </div>
        )}
        {notice && (
          <div className="aw-offline" role="status">
            {notice}
          </div>
        )}
        <div
          className={`aw-composer ${dragging ? "dragging" : ""}`}
          style={{ margin: "12px 24px 24px" }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          {attachments.length > 0 && (
            <div className="aw-attached" aria-label="Attached files">
              {attachments.map((file, index) => (
                <span key={`${file.name}-${index}`}>
                  <Paperclip size={12} />
                  <span>{file.name}</span>
                  {file.content && (
                    <small className="aw-attachment-ingested">TEXT READY</small>
                  )}
                  <IconButton
                    label={`Remove ${file.name}`}
                    onClick={() =>
                      setAttachments((items) =>
                        items.filter((_, itemIndex) => itemIndex !== index),
                      )
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
            onChange={(e) => updateDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                send();
              }
              if (e.key === "Escape") stop();
            }}
          />
          {draft.trim() && (
            <div className="aw-draft-status" role="status">
              <Check size={12} /> {draftStatus}
            </div>
          )}
          {readingAttachments && (
            <div className="aw-draft-status" role="status">
              <Paperclip size={12} /> Preparing text attachments…
            </div>
          )}
          <div className="aw-composer-toolbar">
            <input
              ref={fileInput}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx"
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
            <IconButton
              label="Attach files or images"
              onClick={() => fileInput.current?.click()}
            >
              <Paperclip size={17} />
            </IconButton>
            <VoiceControls
              onTranscript={(text) =>
                updateDraft((value) => `${value} ${text}`.trim())
              }
              text={latest?.content}
              onNotice={setNotice}
            />
            <select
              aria-label="Response mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="quick">Quick</option>
              <option value="standard">Agent team</option>
              <option value="council">Council review</option>
            </select>
            <IconButton
              label="Export conversation"
              onClick={exportConversation}
              disabled={!messages.length}
            >
              <Download size={17} />
            </IconButton>
            <span className="aw-composer-spacer" />
            {busy ? (
              <button
                className="aw-send"
                aria-label="Stop generation"
                onClick={stop}
              >
                <Square size={17} />
              </button>
            ) : (
              <button
                className="aw-send"
                aria-label="Send message"
                disabled={!draft.trim() || readingAttachments}
                onClick={send}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </main>
      {paletteOpen && (
        <div
          className="aw-command-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPaletteOpen(false);
          }}
        >
          <section
            ref={palette}
            className="aw-command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Workspace command palette"
            tabIndex={-1}
          >
            <header>
              <div>
                <span className="aw-kicker">
                  <Command size={12} /> COMMAND CENTER
                </span>
                <h2>What would you like to do?</h2>
              </div>
              <IconButton
                label="Close command palette"
                onClick={() => setPaletteOpen(false)}
              >
                <X size={17} />
              </IconButton>
            </header>
            <div className="aw-command-search">
              <Search size={16} />
              <span>Search an action</span>
              <kbd>ESC</kbd>
            </div>
            <div className="aw-command-list">
              <button onClick={newConversation}>
                <span className="aw-command-icon">
                  <Plus size={16} />
                </span>
                <span>
                  <b>New conversation</b>
                  <small>Start with a clean workspace</small>
                </span>
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => {
                  setPaletteOpen(false);
                  setTimeout(() => composer.current?.focus(), 0);
                }}
              >
                <span className="aw-command-icon">
                  <Command size={16} />
                </span>
                <span>
                  <b>Focus composer</b>
                  <small>Return to your next instruction</small>
                </span>
                <kbd>↵</kbd>
              </button>
              <button onClick={busy ? stop : undefined} disabled={!busy}>
                <span className="aw-command-icon">
                  <Square size={15} />
                </span>
                <span>
                  <b>Stop generation</b>
                  <small>
                    {busy
                      ? "Interrupt the current response"
                      : "No response is running"}
                  </small>
                </span>
                <kbd>ESC</kbd>
              </button>
              <button onClick={exportConversation} disabled={!messages.length}>
                <span className="aw-command-icon">
                  <Download size={15} />
                </span>
                <span>
                  <b>Export conversation</b>
                  <small>Save the current thread as Markdown</small>
                </span>
                <ChevronRight size={15} />
              </button>
            </div>
            <div className="aw-command-section-label">RESPONSE MODE</div>
            <div className="aw-command-modes">
              {[
                ["quick", "Quick", "Direct answer"],
                ["standard", "Agent team", "Coordinate specialists"],
                ["council", "Council review", "Seven governed perspectives"],
              ].map(([value, label, description]) => (
                <button
                  key={value}
                  aria-pressed={mode === value}
                  onClick={() => {
                    setMode(value);
                    setPaletteOpen(false);
                    setTimeout(() => composer.current?.focus(), 0);
                  }}
                >
                  <span>{label.slice(0, 1)}</span>
                  <b>{label}</b>
                  <small>{description}</small>
                </button>
              ))}
            </div>
            <footer>
              <span>⌘K / Ctrl K to open</span>
              <span>ESC to close</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
