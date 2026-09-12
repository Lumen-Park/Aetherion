"""Versioned advisory institution catalog for the dashboard and operators."""

from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_user
from institution.registry import CATALOG

router = APIRouter(prefix="/institution", tags=["Institution"])


def _public_agent(agent):
    return {
        "id": agent.id,
        "name": agent.id,
        "college": agent.college,
        "expertise": agent.expertise,
        "version": agent.version,
        "capabilities": agent.capabilities,
        "tools": agent.tools,
        "advisory_only": True,
    }


@router.get("/catalog")
async def get_institution_catalog(user: dict = Depends(get_current_user)):
    agents = [_public_agent(agent) for agent in CATALOG.values()]
    agents.sort(key=lambda item: (item["college"], item["name"]))
    return {
        "version": "1.0.0",
        "colleges": sorted({agent["college"] for agent in agents}),
        "agents": agents,
        "advisory_only": True,
    }


@router.get("/catalog/{college}")
async def get_college_catalog(
    college: str, user: dict = Depends(get_current_user)
):
    agents = [
        _public_agent(agent)
        for agent in CATALOG.values()
        if agent.college.casefold() == college.casefold()
    ]
    if not agents:
        raise HTTPException(status_code=404, detail="College not found")
    agents.sort(key=lambda item: item["name"])
    return {"college": agents[0]["college"], "agents": agents, "advisory_only": True}
