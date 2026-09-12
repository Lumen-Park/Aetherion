"""Versioned specialist definitions and bounded, provider-independent execution."""
from dataclasses import dataclass
from pathlib import Path
import json
import re
from typing import Callable

@dataclass(frozen=True)
class AgentDefinition:
    id: str
    college: str
    expertise: str
    system_prompt: str
    version: str
    capabilities: list[str]
    tools: list[str]

CATALOG = {item['id']: AgentDefinition(**item) for item in json.loads(Path(__file__).with_name('catalog.json').read_text(encoding='utf-8'))}

def select(goal: str, limit: int = 3):
    """Deterministic, inspectable routing; no fabricated availability claims."""
    words=set(re.findall(r'[a-z]{3,}', goal.lower()))
    ranked=sorted(CATALOG.values(),key=lambda a:(-len(words & set(re.findall(r'[a-z]{3,}',a.expertise.lower()+' '+a.college.lower()))),a.id))
    matched=[a for a in ranked if words & set(re.findall(r'[a-z]{3,}',a.expertise.lower()+' '+a.college.lower()))]
    return matched[:max(1,min(limit,3))] or [CATALOG['SystemsThinkerAgent']]

async def run_specialist(agent_id: str, messages: list, provider: Callable):
    agent=CATALOG[agent_id]
    prompt=agent.system_prompt+' You provide advisory analysis only. No tools are available. State uncertainty. Never claim execution or access to live evidence. Return conclusions, not private chain-of-thought.'
    result=''
    async for delta in provider([{'role':'system','content':prompt},*messages]):
        result+=delta
        if len(result)>20000:raise RuntimeError('Specialist output exceeded the allowed size.')
    if not result.strip():raise RuntimeError('Specialist returned no output.')
    return result
