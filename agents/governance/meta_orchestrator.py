"""
Meta-Orchestrator – Supreme Controller of Aetherion v3.4
Includes Human Override API, Budget Enforcement, Weighted Council, Reputation Feedback,
Tamper‑Proof Audit Logging, and lazy metrics imports for test compatibility.
"""

import os
import time
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

import psutil

from core.auth import AuthManager
from core.memory import KnowledgeGraph
from core.protocol import LLMWrapper
from core.task_state import TaskContext, TaskState, TaskStateManager
from utils.logger import AetherionLogger
from utils.sandbox import SandboxExecutor
from utils.tamper_log import TamperProofLogger


class BudgetExceededError(RuntimeError):
    """Raised when agent call budget is exceeded."""

    pass


@dataclass
class OrchestratorConfig:
    max_agent_calls: int = 50
    max_time_seconds: int = 420
    cpu_threshold: float = 80.0
    memory_threshold: float = 80.0
    loop_detection_threshold: int = 3
    confidence_gate: float = 0.45
    council_score_threshold: float = 0.50


class PipelineMode(Enum):
    STANDARD = "standard"
    RESEARCH_ONLY = "research"
    CODE_ONLY = "code"
    INVENTION = "invention"
    MISSION = "mission"


class MetaOrchestrator:
    """Supreme Controller with human override, weighted Council, reputation, and tamper‑proof audit."""

    def __init__(self, config: Optional[OrchestratorConfig] = None):
        self.config = config or OrchestratorConfig()
        self.llm = LLMWrapper()
        self.state_manager = TaskStateManager(
            confidence_threshold=self.config.confidence_gate
        )
        self.knowledge_graph = KnowledgeGraph()
        self.logger = AetherionLogger()

        network_mode = os.getenv("SANDBOX_NETWORK_MODE", "none")
        allowed_domains = [
            d.strip()
            for d in os.getenv("SANDBOX_ALLOWED_DOMAINS", "").split(",")
            if d.strip()
        ]
        allowed_cidrs = [
            c.strip()
            for c in os.getenv("SANDBOX_ALLOWED_CIDRS", "").split(",")
            if c.strip()
        ]

        self.sandbox = SandboxExecutor(
            network_mode=network_mode,
            allowed_domains=allowed_domains,
            allowed_cidrs=allowed_cidrs,
            runtime=os.getenv("SANDBOX_RUNTIME", "runsc"),
        )

        self.auth_manager = AuthManager()

        audit_log_path = os.getenv(
            "AETHERION_AUDIT_LOG_PATH", "./audit/audit.log"
        )
        private_key_path = os.getenv("AETHERION_AUDIT_PRIVATE_KEY")
        self.audit_log = TamperProofLogger(
            log_path=audit_log_path, private_key_path=private_key_path
        )

        self.call_count = 0
        self.start_time: Optional[float] = None
        self.current_context: Optional[TaskContext] = None

        self._pipeline_agents = None
        self._council = None
        self._curator = None

        self.workspace_constitution = None
        self.workspace_enabled_agents = None

    # ------------------------------------------------------------------
    # Lazy property accessors
    # ------------------------------------------------------------------
    def _get_pipeline_agents(self):
        if self._pipeline_agents is None:
            from agents.pipeline.pipeline_agents import (
                Developer,
                DocumentationAgent,
                GoalRefiner,
                Partner,
                Presenter,
                Reporter,
                Researcher,
                Scout,
                Synthesizer,
                Tester,
            )

            self._pipeline_agents = {
                "researcher": Researcher(),
                "developer": Developer(),
                "partner": Partner(),
                "tester": Tester(),
                "reporter": Reporter(),
                "scout": Scout(),
                "synthesizer": Synthesizer(),
                "presenter": Presenter(),
                "goal_refiner": GoalRefiner(),
                "documentation": DocumentationAgent(),
            }
        return self._pipeline_agents

    def _get_council(self):
        if self._council is None:
            from agents.council.council import AetherionCouncil

            self._council = AetherionCouncil(llm=self.llm)
        return self._council

    def _get_curator(self):
        if self._curator is None:
            from agents.governance.curator import Curator

            self._curator = Curator()
            if self.workspace_enabled_agents:
                self._curator.set_enabled_agents(self.workspace_enabled_agents)
        return self._curator

    # ------------------------------------------------------------------
    # Budget and cognitive load
    # ------------------------------------------------------------------
    def _check_budget(self) -> None:
        self.call_count += 1
        if self.call_count > self.config.max_agent_calls:
            self.logger.error(
                f"Agent call budget exceeded: "
                f"{self.call_count}/{self.config.max_agent_calls}"
            )
            raise BudgetExceededError(
                f"Agent call budget exceeded: {self.config.max_agent_calls}"
            )

        elapsed = time.time() - self.start_time if self.start_time else 0
        if elapsed > self.config.max_time_seconds:
            raise TimeoutError(
                f"Task timeout: {elapsed:.1f}s > {self.config.max_time_seconds}s"
            )

    def _check_cognitive_load(self) -> bool:
        cpu = psutil.cpu_percent(interval=0.1)
        mem = psutil.virtual_memory().percent
        return (
            cpu > self.config.cpu_threshold
            or mem > self.config.memory_threshold
        )

    def _wait_for_resources(self) -> None:
        while self._check_cognitive_load():
            self.logger.info(
                "Cognitive load high, pausing...",
                cpu=psutil.cpu_percent(),
                mem=psutil.virtual_memory().percent,
            )
            time.sleep(2)

    # ------------------------------------------------------------------
    # Intent classification
    # ------------------------------------------------------------------
    def _classify_intent(self, goal: str) -> PipelineMode:
        goal_lower = goal.lower()
        invention_kw = [
            "invent",
            "create a new",
            "design a novel",
            "blueprint",
            "patent",
        ]
        if any(kw in goal_lower for kw in invention_kw):
            return PipelineMode.INVENTION
        research_kw = [
            "research",
            "analyze",
            "summarize",
            "explain",
            "what is",
            "how does",
        ]
        if (
            any(kw in goal_lower for kw in research_kw)
            and "code" not in goal_lower
        ):
            return PipelineMode.RESEARCH_ONLY
        mission_kw = [
            "fix issue",
            "solve issue",
            "github",
            "open source",
            "bug",
        ]
        if any(kw in goal_lower for kw in mission_kw):
            return PipelineMode.MISSION
        code_kw = [
            "write",
            "code",
            "function",
            "class",
            "script",
            "program",
            "implement",
        ]
        if any(kw in goal_lower for kw in code_kw):
            return PipelineMode.CODE_ONLY
        return PipelineMode.STANDARD

    # ------------------------------------------------------------------
    # Main execution entry point
    # ------------------------------------------------------------------
    def execute(  # noqa: C901 - pipeline branching is intentionally centralized
        self,
        goal: str,
        mode: Optional[str] = None,
        auth_token: Optional[str] = None,
    ) -> TaskContext:
        # Lazy import to avoid module load failure when fastapi is not installed
        from api.metrics import (
            cpu_usage_percent,
            memory_usage_bytes,
            task_duration_seconds,
            task_success_counter,
        )

        auth_info = self.auth_manager.authenticate(auth_token)
        if self.auth_manager.auth_enabled and not auth_info:
            raise PermissionError(
                "Authentication required. Provide a valid API key or JWT."
            )
        if not self.auth_manager.authorize(auth_info, "operator"):
            raise PermissionError("Insufficient permissions to execute tasks.")

        start_time = time.time()
        self.start_time = start_time
        self.call_count = 0

        task_id = f"task_{int(start_time)}"
        self.current_context = self.state_manager.start_task(task_id, goal)

        self.logger.info("Task started", task_id=task_id, goal=goal, mode=mode)

        try:
            pipeline_mode = (
                PipelineMode(mode) if mode else self._classify_intent(goal)
            )
            self.logger.info(
                "Pipeline mode selected", mode=pipeline_mode.value
            )

            if pipeline_mode == PipelineMode.INVENTION:
                ctx = self._execute_invention_pipeline()
            elif pipeline_mode == PipelineMode.MISSION:
                ctx = self._execute_mission_pipeline()
            else:
                ctx = self._execute_standard_pipeline(pipeline_mode)

            if ctx.council_verdict:
                verdict = ctx.council_verdict.get("verdict", "UNKNOWN")
                task_success_counter.labels(verdict=verdict).inc()

            return ctx

        except BudgetExceededError as e:
            self.logger.error("Budget exceeded", error=str(e))
            ctx = self.state_manager.transition(
                TaskState.FAILED,
                {"error": str(e), "error_type": "BudgetExceeded"},
            )
            task_success_counter.labels(verdict="BUDGET_EXCEEDED").inc()
            return ctx
        except Exception as e:
            self.logger.error(
                "Pipeline execution failed", error=str(e), task_id=task_id
            )
            task_success_counter.labels(verdict="EXCEPTION").inc()
            try:
                ctx = self.state_manager.transition(
                    TaskState.FAILED,
                    {"error": str(e), "error_type": type(e).__name__},
                )
                return ctx
            except ValueError:
                return TaskContext(
                    task_id=self.current_context.task_id,
                    state=TaskState.FAILED,
                    goal=self.current_context.goal,
                    error=str(e),
                )
        finally:
            task_duration_seconds.observe(time.time() - start_time)
            cpu_usage_percent.set(psutil.cpu_percent(interval=0.1))
            mem = psutil.virtual_memory()
            memory_usage_bytes.set(mem.used)

    # ------------------------------------------------------------------
    # Standard pipeline
    # ------------------------------------------------------------------
    def _execute_standard_pipeline(self, mode: PipelineMode) -> TaskContext:
        self._wait_for_resources()

        ctx = self._refine_goal()
        ctx = self._curate_panel()

        if mode != PipelineMode.CODE_ONLY:
            ctx = self._research()
        else:
            ctx = self.state_manager.transition(
                TaskState.RESEARCHING,
                {
                    "research_findings": "[SKIPPED - CODE_ONLY mode]",
                    "confidence": 0.5,
                },
            )

        if mode != PipelineMode.RESEARCH_ONLY:
            ctx = self._develop_and_test()

        ctx = self._council_review()
        ctx = self.state_manager.transition(TaskState.HUMAN_REVIEW, {})

        return ctx

    def _refine_goal(self) -> TaskContext:
        self._check_budget()
        agents = self._get_pipeline_agents()
        refined = agents["goal_refiner"].refine(self.current_context.goal)
        return self.state_manager.transition(
            TaskState.REFINING,
            {
                "refined_goal": refined["content"],
                "confidence": refined["confidence"],
            },
        )

    def _curate_panel(self) -> TaskContext:
        self._check_budget()
        curator = self._get_curator()
        goal = self.current_context.refined_goal or self.current_context.goal
        past_context = self.knowledge_graph.get_relevant_context(goal)
        experts = curator.select_experts(goal, max_experts=5)
        return self.state_manager.transition(
            TaskState.CURATING, {"expert_panel": experts}
        )

    def _research(self) -> TaskContext:
        self._check_budget()
        agents = self._get_pipeline_agents()
        researcher = agents["researcher"]
        synthesizer = agents["synthesizer"]
        goal = self.current_context.refined_goal or self.current_context.goal

        from agents.colleges.all_colleges import get_agent

        expert_findings = {}
        for expert_name in self.current_context.expert_panel:
            agent = get_agent(expert_name)
            if agent:
                expert_findings[expert_name] = agent.analyze(goal)

        primary = researcher.execute(goal)
        synthesis = synthesizer.synthesize(
            primary["content"], expert_findings, goal
        )

        return self.state_manager.transition(
            TaskState.RESEARCHING,
            {
                "research_findings": synthesis["content"],
                "confidence": synthesis["confidence"],
            },
        )

    def _develop_and_test(self) -> TaskContext:
        agents = self._get_pipeline_agents()
        developer = agents["developer"]
        partner = agents["partner"]
        tester = agents["tester"]

        max_retries = 3
        retry_count = 0
        research = self.current_context.research_findings or ""
        goal = self.current_context.refined_goal or self.current_context.goal

        while retry_count < max_retries:
            self._check_budget()
            self._wait_for_resources()

            code_result = developer.write_code(
                research, goal, strategy_hint=f"attempt_{retry_count + 1}"
            )
            ctx = self.state_manager.transition(
                TaskState.DEVELOPING, {"code_output": code_result["content"]}
            )

            review = partner.review(code_result["content"], goal)
            if review["requires_changes"]:
                research = (
                    f"{research}\n\nPartner feedback: {review['feedback']}"
                )
                retry_count += 1
                continue

            ctx = self.state_manager.transition(
                TaskState.REVIEWING, {"review_feedback": review["feedback"]}
            )

            test_result = self._run_tests(code_result["content"])
            ctx = self.state_manager.transition(
                TaskState.TESTING, {"test_results": test_result}
            )

            if test_result["passed"]:
                return ctx

            if retry_count < max_retries - 1:
                from agents.pipeline.pipeline_agents import Debugger

                debugger = Debugger()
                fix = debugger.fix(
                    code_result["content"], test_result["errors"], research
                )
                code_result["content"] = fix["content"]
                research = (
                    f"{research}\n\nDebugger analysis: {fix['analysis']}"
                )

            retry_count += 1

        raise RuntimeError("Development failed after max retries")

    def _run_tests(self, code: str) -> Dict[str, Any]:
        agents = self._get_pipeline_agents()
        tester = agents["tester"]
        analysis = tester.analyze(code)

        if self._is_safe_for_sandbox(code):
            sandbox_result = self.sandbox.run(code)
            return {
                "passed": sandbox_result["passed"],
                "errors": sandbox_result["stderr"],
                "issues": analysis.get("issues", ""),
                "edge_cases": analysis.get("edge_cases", []),
                "sandbox_output": sandbox_result["stdout"],
            }
        return {
            "passed": analysis["passed"],
            "errors": analysis.get("issues", ""),
            "edge_cases": analysis.get("edge_cases", []),
        }

    def _is_safe_for_sandbox(self, code: str) -> bool:
        dangerous = [
            "os.system",
            "subprocess",
            "eval",
            "exec",
            "__import__",
            "open(",
            "file(",
            "input(",
            "requests.",
            "socket.",
        ]
        return not any(d in code.lower() for d in dangerous)

    # ------------------------------------------------------------------
    # Council integration (with lazy metrics)
    # ------------------------------------------------------------------
    def _council_review(self) -> TaskContext:
        from api.metrics import (
            council_approval_rate,
            council_deliberation_seconds,
        )

        start_time = time.time()
        self._check_budget()
        council = self._get_council()
        output = (
            self.current_context.code_output
            or self.current_context.research_findings
        )
        goal = self.current_context.refined_goal or self.current_context.goal

        ctx = self._run_pre_council_pipeline(output)
        sanitized = ctx.__dict__.get("sanitized_output", output)
        ctx = self.state_manager.transition(TaskState.EVALUATING, {})

        weights = {
            judge: self.knowledge_graph.reputation.get_weight(judge)
            for judge in council.judges
        }
        verdict = council.deliberate(
            sanitized,
            goal,
            weights=weights,
            constitution=self.workspace_constitution,
        )
        ctx = self.state_manager.transition(
            TaskState.COUNCIL,
            {
                "council_verdict": verdict,
                "confidence": verdict.get("score", 0.5),
            },
        )
        self._update_reputation_from_verdict(ctx)

        council_deliberation_seconds.observe(time.time() - start_time)
        stats = council.telemetry.get_stats()
        council_approval_rate.set(stats["approval_rate"])

        return ctx

    def _run_pre_council_pipeline(self, output: str) -> TaskContext:
        from agents.council.council import (
            EdgeCaseGenerator,
            ForensicAnalyst,
            SanitizerAgent,
        )

        ctx = self.current_context

        sanitizer = SanitizerAgent(self.llm)
        sanitized = sanitizer.clean(output)
        ctx = self.state_manager.transition(
            TaskState.SANITIZING, {"sanitized_output": sanitized}
        )

        forensic = ForensicAnalyst(self.llm)
        forensic_report = forensic.analyze(sanitized)
        ctx = self.state_manager.transition(
            TaskState.FORENSICS, {"forensic_report": forensic_report}
        )

        edge_gen = EdgeCaseGenerator(self.llm)
        edge_cases = edge_gen.generate(sanitized)
        return self.state_manager.transition(
            TaskState.EDGE_CASES, {"edge_cases": edge_cases}
        )

    def _update_reputation_from_verdict(self, ctx: TaskContext) -> None:
        if not ctx.council_verdict:
            return
        score = ctx.council_verdict.get("score", 5.0)
        for vote in ctx.council_verdict.get("votes", []):
            agent_name = vote["agent"]
            if score >= 7.0:
                self.knowledge_graph.reputation.update(
                    agent_name, was_correct=True
                )
            elif score <= 4.0:
                self.knowledge_graph.reputation.update(
                    agent_name, was_correct=False
                )

    def _store_successful_output(self, ctx: TaskContext) -> None:
        if self.state_manager.should_store_to_memory():
            key = f"task:{ctx.task_id}:{ctx.refined_goal[:50]}"
            value = {
                "goal": ctx.goal,
                "refined_goal": ctx.refined_goal,
                "output": ctx.code_output or ctx.research_findings,
                "council_score": (
                    ctx.council_verdict.get("score")
                    if ctx.council_verdict
                    else None
                ),
            }
            self.knowledge_graph.store(
                key=key,
                value=value,
                confidence=ctx.confidence,
                source="MetaOrchestrator",
            )

    # ------------------------------------------------------------------
    # Invention & mission pipelines
    # ------------------------------------------------------------------
    def _execute_invention_pipeline(self) -> TaskContext:
        from mission.invention_pipeline import InventionPipeline

        pipeline = InventionPipeline()
        latex_path = pipeline.run(self.current_context.goal)
        # Store invention blueprint in code_output field for consistency
        ctx = self.state_manager.transition(
            TaskState.DEVELOPING,
            {"code_output": f"Invention Blueprint: {latex_path}"},
        )
        # Run through council review
        ctx = self._council_review()
        # Transition to human review
        ctx = self.state_manager.transition(TaskState.HUMAN_REVIEW, {})
        return ctx

    def _execute_mission_pipeline(self) -> TaskContext:
        from mission.mission_agent import (
            FilterAgent,
            GitPayloadBuilder,
            ScoutAgent,
            SelectorAgent,
        )

        scout = ScoutAgent()
        issues = scout.search_github_issues(self.current_context.goal, limit=5)
        filter_agent = FilterAgent()
        filtered = filter_agent.filter_issues(issues)
        selector = SelectorAgent()
        selected = selector.select_best(filtered)
        if not selected:
            raise RuntimeError("No suitable issues found")
        self.current_context.goal = f"Fix GitHub issue: {selected['title']}\n\n{selected.get('body', '')}"
        ctx = self._execute_standard_pipeline(PipelineMode.STANDARD)
        # Standard pipeline returns HUMAN_REVIEW; attach git payload if code was generated
        if ctx.code_output and ctx.state == TaskState.HUMAN_REVIEW:
            builder = GitPayloadBuilder()
            payload = builder.build_payload(
                selected, ctx.code_output, ctx.research_findings or ""
            )
            # Append git payload to code output for reference
            ctx.code_output = f"{ctx.code_output}\n\n[GIT_PAYLOAD]\n{payload}"
        return ctx

    # ------------------------------------------------------------------
    # Human override (with auth and tamper‑proof audit)
    # ------------------------------------------------------------------
    def accept_override(
        self,
        task_id: str,
        operator: str,
        reason: str,
        auth_token: Optional[str] = None,
    ) -> bool:
        auth_info = self.auth_manager.authenticate(auth_token)
        if self.auth_manager.auth_enabled and not auth_info:
            self.logger.error(
                "Override authentication failed: invalid credentials"
            )
            return False
        if not self.auth_manager.authorize(auth_info, "admin"):
            self.logger.error(
                f"Operator {operator} lacks admin privileges for override"
            )
            return False

        ctx = self.current_context
        if ctx is None or ctx.task_id != task_id:
            self.logger.error(f"Task {task_id} not found or not current")
            return False

        if ctx.state != TaskState.HUMAN_REVIEW:
            self.logger.error(
                f"Task {task_id} not in HUMAN_REVIEW (current: {ctx.state.name})"
            )
            return False

        self.logger.info(
            "Human override accepted",
            task_id=task_id,
            operator=operator,
            reason=reason,
        )

        # Tamper‑proof audit log entry
        self.audit_log.write(
            "human_override",
            {
                "task_id": task_id,
                "operator": operator,
                "reason": reason,
                "previous_state": ctx.state.name,
                "auth_info": (
                    auth_info.get("sub", "unknown") if auth_info else "unknown"
                ),
            },
        )

        ctx = self.state_manager.transition(
            TaskState.APPROVED,
            {
                "override": True,
                "override_operator": operator,
                "override_reason": reason,
                "override_timestamp": time.time(),
            },
        )
        self.current_context = ctx
        self._store_successful_output(ctx)
        ctx = self.state_manager.transition(TaskState.DONE, {})
        self.current_context = ctx
        return True
