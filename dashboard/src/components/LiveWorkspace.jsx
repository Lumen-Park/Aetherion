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
  ShieldCheck,
} from "lucide-react";
import OrbitalCore from "./OrbitalCore";
import VoiceControls from "./VoiceControls";
import { IconButton, download } from "./WorkspaceParts";
import "./workspace-premium.css";

const origin = (import.meta.env.VITE_API_ORIGIN || "").replace(/\/$/, "");
export default function LiveWorkspace() {
  const [chats, setChats] = useState([]),
    [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]),
    [draft, setDraft] = useState("");
  const [mode, setMode] = useState("quick"),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [activity, setActivity] = useState([]);
  const [council, setCouncil] = useState(null);
  const [drawer, setDrawer] = useState(false),
    [connected, setConnected] = useState(false);
  const selection = useRef(null),
    submitting = useRef(false);
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
    const data = await (await request("/conversations")).json();
    setChats(data.conversations);
    setConnected(true);
  };
  useEffect(() => {
    list().catch((e) => {
      setNotice(e.message);
      setConnected(false);
    });
  }, []);
  useEffect(() => {
    selection.current = active;
    if (!active) {
      setMessages([]);
      setActivity([]);
      setCouncil(null);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    let cursor = 0;
    setMessages([]);
    setActivity([]);
    setCouncil(null);
    setDraft("");
    const sync = async () => {
      const chat = await (
        await request(`/conversations/${active}`, { signal: controller.signal })
      ).json();
      if (selection.current !== active) return;
      setMessages(chat.messages);
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
  const send = async () => {
    if (!draft.trim() || submitting.current || busy) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    try {
      let id = active;
      if (!id) {
        const chat = await (
          await request("/conversations", {
            method: "POST",
            body: JSON.stringify({ title: draft.slice(0, 80) }),
          })
        ).json();
        id = chat.id;
        setActive(id);
      }
      await request(`/conversations/${id}/live`, {
        method: "POST",
        body: JSON.stringify({
          content: draft,
          mode,
          request_id: crypto.randomUUID(),
        }),
      });
      setDraft("");
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
  const stop = async () => {
    if (!active) return;
    try {
      await request(`/conversations/${active}/live/cancel`, { method: "POST" });
      setBusy(false);
    } catch (error) {
      setNotice(error.message);
    }
  };
  const latest = [...messages]
    .reverse()
    .find((m) => m.role === "assistant" && m.metadata?.status !== "running");
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
        <button
          className="aw-new"
          onClick={() => {
            setActive(null);
            setDraft("");
            setDrawer(false);
          }}
        >
          <Plus size={18} /> New conversation
        </button>
        <div className="aw-history">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className="aw-nav"
              onClick={() => {
                setActive(chat.id);
                setDrawer(false);
              }}
            >
              {chat.title}
            </button>
          ))}
        </div>
        <div className="aw-preview-note">
          <span>{connected ? "SERVER CONNECTED" : "CONNECTING"}</span>
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
          <span className="aw-preview-badge">Live model · advisory</span>
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
          {messages.map((message) => (
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
              {message.content && (
                <IconButton
                  label="Copy message"
                  onClick={() =>
                    navigator.clipboard
                      .writeText(message.content)
                      .catch(() =>
                        setNotice(
                          "Clipboard unavailable. Select the answer to copy it.",
                        ),
                      )
                  }
                >
                  <Copy size={15} />
                </IconButton>
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
          <details style={{ padding: "8px 24px" }}>
            <summary>Agent activity · {activity.at(-1)}</summary>
            {activity.map((item, i) => (
              <p key={i}>{item}</p>
            ))}
          </details>
        )}
        {notice && (
          <div className="aw-offline" role="status">
            {notice}
          </div>
        )}
        <div className="aw-composer" style={{ margin: "12px 24px 24px" }}>
          <textarea
            aria-label="Message Aetherion"
            placeholder="An idea, a question, a little ambition…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
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
          <div className="aw-composer-toolbar">
            <VoiceControls
              onTranscript={(text) =>
                setDraft((value) => `${value} ${text}`.trim())
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
              onClick={() =>
                download(
                  messages
                    .map((m) => `## ${m.role}\n\n${m.content}`)
                    .join("\n\n"),
                  "aetherion-conversation.md",
                )
              }
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
                disabled={!draft.trim()}
                onClick={send}
              >
                <ArrowUp size={18} />
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
