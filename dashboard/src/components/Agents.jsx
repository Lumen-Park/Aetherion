import React, { useEffect, useState } from "react";
import { agentsAPI } from "../api/client";
import { ErrorState, LoadingState } from "./AsyncState";

function Agents() {
  const [agents, setAgents] = useState([]);
  const [filter, setFilter] = useState("");
  const [collegeFilter, setCollegeFilter] = useState("All");
  const [state, setState] = useState("loading");

  const loadAgents = () => {
    setState("loading");
    agentsAPI
      .institutionCatalog()
      .then((res) => {
        setAgents(res.data.agents || []);
        setState("ready");
      })
      .catch(() =>
        agentsAPI
          .list()
          .then((res) => {
            setAgents(
              (res.data.agents || []).map((agent) => ({
                ...agent,
                id: agent.name,
                version: "legacy",
                capabilities: [],
              })),
            );
            setState("ready");
          })
          .catch(() => setState("error")),
      );
  };
  useEffect(loadAgents, []);

  const colleges = ["All", ...new Set(agents.map((a) => a.college))];

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(filter.toLowerCase()) &&
      (collegeFilter === "All" || a.college === collegeFilter),
  );

  return (
    <div>
      <p className="eyebrow">Specialist network</p>
      <h1 className="page-title">
        Agent roster <span className="text-indigo-200">({agents.length})</span>
      </h1>
      <p className="page-subtitle mb-8">
        Find the right expertise across your active collaborators.
      </p>
      {state === "loading" ? (
        <LoadingState label="Syncing the agent roster…" />
      ) : state === "error" ? (
        <ErrorState
          message="The agent roster is temporarily unavailable."
          onRetry={loadAgents}
        />
      ) : (
        <>
          <div className="panel flex flex-col gap-3 p-4 mb-6 md:flex-row">
            <input
              type="text"
              placeholder="Search agents..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="field flex-1"
            />
            <select
              value={collegeFilter}
              onChange={(e) => setCollegeFilter(e.target.value)}
              className="field md:w-52"
            >
              {colleges.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
        </>
      )}
      {state === "ready" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <div
              key={agent.name}
              className="panel p-5 transition duration-200 hover:-translate-y-1 hover:border-indigo-300/30"
            >
              <span className="mb-4 grid h-9 w-9 place-items-center rounded-xl bg-indigo-400/15 text-indigo-200">
                ◌
              </span>
              <h3 className="font-bold text-lg text-white">{agent.name}</h3>
              <p className="mt-1 text-xs font-bold uppercase tracking-wider text-cyan-200/70">
                {agent.college}
              </p>
              <p className="text-sm mt-3 leading-6 text-slate-300">
                {agent.expertise}
              </p>
              <div className="mt-4 flex items-center justify-between text-[10px] uppercase tracking-wider text-slate-500">
                <span>Module {agent.version}</span>
                <span>
                  {agent.advisory_only === false ? "Tool enabled" : "Advisory"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Agents;
