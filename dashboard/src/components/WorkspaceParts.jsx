import React, { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import {
  X,
  Check,
  Copy,
  Pencil,
  RotateCcw,
  GitBranch,
  ThumbsUp,
  ThumbsDown,
  ShieldCheck,
  ArrowUpRight,
  FileText,
  Sparkles,
} from "lucide-react";
export const defaults = [
  "Critic",
  "Security",
  "Alignment",
  "Constraint",
  "Evaluator",
  "Documentation",
  "Aetherion Prime",
];
export const uid = () => crypto.randomUUID();
export const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
};
export const save = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};
export const createChat = () => ({
  id: uid(),
  title: "New conversation",
  messages: [],
  draft: "",
  mode: "standard",
  updatedAt: Date.now(),
});
export const download = (text, name) => {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
export function IconButton({ label, children, ...props }) {
  return (
    <button className="aw-icon" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Modal({ title, subtitle, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement,
      node = ref.current;
    node.focus();
    const key = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
      if (e.key === "Tab") {
        const nodes = [
            ...node.querySelectorAll('button,input,textarea,[tabindex="0"]'),
          ].filter((el) => !el.disabled),
          first = nodes[0],
          last = nodes[nodes.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="aw-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="aw-modal"
      >
        <header>
          <div>
            <span className="aw-kicker">YOUR WORKSPACE</span>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </header>
        {children}
      </section>
    </div>
  );
}
export function CouncilCard({ names, onOpen }) {
  return (
    <button className="aw-council-card" onClick={onOpen}>
      <div className="aw-card-heading">
        <span>
          <ShieldCheck size={16} />
          Council deliberation
        </span>
        <small>DEMO VERDICT</small>
      </div>
      <div className="aw-vote-avatars">
        {names.map((name, i) => (
          <span className={i === 3 ? "revision" : ""} key={i} title={name}>
            {name.slice(0, 1)}
            <i>{i === 3 ? "!" : "✓"}</i>
          </span>
        ))}
      </div>
      <div className="aw-vote-bar">
        {names.map((_, i) => (
          <i className={i === 3 ? "revision" : ""} key={i} />
        ))}
      </div>
      <footer>
        <span>
          <b>6 approve</b> · 1 revision
        </span>
        <span>
          View chamber <ArrowUpRight size={14} />
        </span>
      </footer>
    </button>
  );
}
export function Answer({
  message,
  profile,
  onRetry,
  onBranch,
  onFeedback,
  onEdit,
  onPanel,
  notify,
  disabled,
}) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      notify("Answer copied");
    } catch {
      notify("Clipboard unavailable. Export to save this answer.");
    }
  };
  return (
    <article className="aw-answer">
      <div className="aw-answer-avatar">
        <Sparkles size={16} />
      </div>
      <div className="aw-answer-body">
        <div className="aw-author">
          <strong>Aetherion</strong>
          <span>CHIEF OF STAFF</span>
          <small>
            {message.streaming
              ? "Composing…"
              : message.stopped
                ? "Stopped"
                : "Demo response"}
          </small>
        </div>
        <div className="aw-markdown">
          <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
            {message.content}
          </ReactMarkdown>
          {message.streaming && <span className="aw-stream-caret" />}
        </div>
        {message.card === "council" &&
          !message.streaming &&
          !message.stopped && (
            <CouncilCard
              names={profile.council}
              onOpen={() => onPanel("council")}
            />
          )}
        {message.artifact && !message.streaming && !message.stopped && (
          <button
            className="aw-artifact-link"
            onClick={() => onPanel("artifact", message)}
          >
            <span>
              <FileText size={20} />
            </span>
            <div>
              <b>{message.artifact.title}</b>
              <small>Markdown document · Open in studio</small>
            </div>
            <ArrowUpRight size={18} />
          </button>
        )}
        {!message.streaming && (
          <div className="aw-answer-actions">
            <IconButton label="Copy answer" onClick={copy}>
              <Copy size={14} />
            </IconButton>
            <IconButton label="Edit answer" onClick={() => onEdit(message)}>
              <Pencil size={14} />
            </IconButton>
            <IconButton
              label="Retry response"
              onClick={() => onRetry(message)}
              disabled={disabled}
            >
              <RotateCcw size={14} />
            </IconButton>
            <IconButton
              label="Branch from response"
              onClick={() => onBranch(message)}
              disabled={disabled}
            >
              <GitBranch size={14} />
            </IconButton>
            <span />
            <IconButton
              label="Helpful"
              aria-pressed={message.feedback === "up"}
              onClick={() => onFeedback(message, "up")}
            >
              <ThumbsUp size={14} />
            </IconButton>
            <IconButton
              label="Not helpful"
              aria-pressed={message.feedback === "down"}
              onClick={() => onFeedback(message, "down")}
            >
              <ThumbsDown size={14} />
            </IconButton>
          </div>
        )}
      </div>
    </article>
  );
}
export const makeDemo = (prompt, mode, nickname) => {
  const quoted = prompt.replace(/[\r\n*_`<>]+/g, " ").slice(0, 240),
    intro = `${nickname}, here’s a starting point for **${quoted}**.`;
  const content = {
    quick: `${intro}\n\nStart by defining one useful outcome and the smallest reversible step that gets you there. Validate that step before expanding the scope.\n\n**Next step:** write down what success looks like, who it serves, and how you will test it.\n\n*Illustrative response: connect the orchestration backend for a real answer.*`,
    standard: `${intro}\n\n## A clear path from idea to outcome\n\n1. **Frame the mission.** Define the user need, constraints, and a measurable outcome.\n2. **Assemble the team.** Assign strategy, implementation, and independent review.\n3. **Build a complete first slice.** Make it usable, testable, and easy to revise.\n4. **Review before release.** Check accessibility, security, and the original success criteria.\n\nI’ve prepared an editable mission brief in the artifact studio.\n\n*Preview only: no agents or external tools have been executed.*`,
    research: `${intro}\n\n## Research plan\n\n- **Define the question:** identify the decision this research should support.\n- **Gather evidence:** prioritize primary sources, record dates, and compare independent findings.\n- **Resolve disagreement:** document competing claims and the strength of each source.\n- **Synthesize:** attach citations to claims and make remaining uncertainty explicit.\n\n### Evidence status\n\nNo sources have been retrieved in this design preview. The research brief is ready to edit; verified citations require a connected research service.`,
    council: `${intro}\n\n## Recommendation: a bounded pilot\n\nThis sample Council review illustrates approval and dissent together. Six members support a pilot; the Constraint member requests a narrower scope.\n\n**Proposed condition:** agree on a rollback point and human review before expanding the mission.\n\nOpen the Council chamber to inspect each position and record a **local demo decision**.\n\n*These votes are illustrative. No live Council has reviewed this request.*`,
  }[mode];
  return {
    content,
    artifact:
      mode === "quick"
        ? null
        : {
            title: mode === "research" ? "Research brief" : "Mission brief",
            content: `# ${mode === "research" ? "Research" : "Mission"} brief\n\n## Request\n${prompt}\n\n## Outcome\nDefine the result and its intended audience.\n\n## Scope\n- First complete deliverable\n- Constraints and exclusions\n- Human review checkpoint\n\n## Validation\nRecord evidence, tests, and unresolved questions.\n\n## Next step\nChoose one reversible action.\n\n---\nDesign preview template. No external work has been performed.`,
          },
  };
};
