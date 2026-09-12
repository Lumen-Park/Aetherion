import React from "react";
import { Moon, Sun } from "lucide-react";
import useLocalMoment from "../hooks/useLocalMoment";
import "./workspace-experience.css";

export default function WorkspaceWelcome({ nickname = "Operator" }) {
  const moment = useLocalMoment(),
    Icon = moment.period === "evening" ? Moon : Sun;
  return (
    <div className="aw-personal-welcome">
      <div className="aw-local-moment">
        <Icon size={14} />
        <span>{moment.date}</span>
        <i />
        <time>{moment.time}</time>
        <span className="aw-local-zone">
          {moment.zone.replaceAll("_", " ")}
        </span>
      </div>
      <h1>
        {moment.greeting}, {nickname}.<br />
        <em>What shall we make possible?</em>
      </h1>
      <p>
        {moment.prompt}
        <br />
        Your Chief of Staff is ready for your first thought.
      </p>
    </div>
  );
}
