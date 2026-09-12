"""Authenticated microservice boundary for the complete advisory college catalog."""
import asyncio
import os
import httpx
from fastapi import FastAPI, Depends, HTTPException
from pydantic import BaseModel, Field
from api.dependencies import get_current_user, require_role
from api.workspace.runtime import tokens
from institution.registry import CATALOG, run_specialist

app=FastAPI(title='Aetherion College Service')
COLLEGE=os.getenv('AETHERION_COLLEGE')
ACTIVE={key:a for key,a in CATALOG.items() if not COLLEGE or a.college==COLLEGE}
capacity=asyncio.Semaphore(4)

@app.on_event('startup')
def secure_startup():
    from core.auth import AuthManager
    if not AuthManager().auth_enabled:raise RuntimeError('College service requires authentication')
    if not ACTIVE:raise RuntimeError('Unknown college')

@app.get('/agents')
def agents(user=Depends(get_current_user)):
    return {'agents':[{'id':a.id,'college':a.college,'expertise':a.expertise,'version':a.version,'capabilities':a.capabilities} for a in ACTIVE.values()]}

class Mission(BaseModel):
    goal:str=Field(min_length=1,max_length=16000)

@app.post('/agents/{agent_id}/analyze')
async def analyze(agent_id:str, body:Mission,user=Depends(require_role('operator'))):
    if agent_id not in ACTIVE:raise HTTPException(404,'Unknown agent')
    try:
        async with asyncio.timeout(120), capacity:
            result=await run_specialist(agent_id,[{'role':'user','content':body.goal}],tokens)
    except (RuntimeError,TimeoutError,httpx.HTTPError):raise HTTPException(503,'Specialist could not complete. Check the model service.')
    return {'agent_id':agent_id,'content':result,'advisory':True}
