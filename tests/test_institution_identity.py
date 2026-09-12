import asyncio
import pytest
from institution.registry import CATALOG, select, run_specialist
from test_live_workspace import client
from fastapi.testclient import TestClient

def test_catalog_and_routing():
    assert len(CATALOG)==74
    assert len({a.college for a in CATALOG.values()})==14
    assert 'PhysicistAgent' in [a.id for a in select('physics')]
    assert len(select('physics chemistry biology'))<=3

@pytest.mark.parametrize('agent_id',list(CATALOG))
def test_every_specialist_uses_its_own_prompt(agent_id):
    async def provider(messages):
        assert messages[0]['content'].startswith(CATALOG[agent_id].system_prompt)
        yield 'Advisory result'
    assert asyncio.run(run_specialist(agent_id,[{'role':'user','content':'Review'}],provider))=='Advisory result'

def test_identity_not_configured(client):
    response=client.post('/api/auth/identity/exchange',json={'access_token':'invalid-token-value'})
    assert response.status_code==503

def test_identity_rejects_invalid_provider_session(client,monkeypatch):
    import httpx
    monkeypatch.setenv('AETHERION_SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('AETHERION_SUPABASE_PUBLISHABLE_KEY','public-test-key')
    async def invalid(*args,**kwargs):return httpx.Response(401)
    monkeypatch.setattr(httpx.AsyncClient,'get',invalid)
    assert client.post('/api/auth/identity/exchange',json={'access_token':'invalid-token-value'}).status_code==401

def test_identity_role_is_not_read_from_user_metadata(client,monkeypatch):
    import httpx
    from core.auth import AuthManager
    monkeypatch.setenv('AETHERION_SUPABASE_URL','https://example.supabase.co')
    monkeypatch.setenv('AETHERION_SUPABASE_PUBLISHABLE_KEY','public-test-key')
    async def verified(*args,**kwargs):return httpx.Response(200,json={'id':'user-1','email_confirmed_at':'2026-09-12','user_metadata':{'aetherion_role':'admin'}})
    monkeypatch.setattr(httpx.AsyncClient,'get',verified)
    result=client.post('/api/auth/identity/exchange',json={'access_token':'verified-test-token'}).json()
    claims=AuthManager().verify_jwt(result['access_token'])
    assert claims['role']=='operator'
    assert claims['sub']=='identity:user-1'
