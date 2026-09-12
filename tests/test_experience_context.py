import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.requests import Request

from api.routers import experience


def request_from(peer, forwarded=""):
    return Request(
        {
            "type": "http",
            "client": (peer, 12345),
            "headers": [(b"x-forwarded-for", forwarded.encode())],
        }
    )


def test_untrusted_headers_do_not_select_the_region(monkeypatch):
    monkeypatch.delenv("AETHERION_TRUSTED_PROXY_CIDRS", raising=False)
    assert (
        experience.client_address(request_from("8.8.8.8", "1.1.1.1"))
        == "8.8.8.8"
    )
    assert (
        experience.client_address(request_from("127.0.0.1", "1.1.1.1")) is None
    )


def test_proxy_walk_stops_at_first_untrusted_hop(monkeypatch):
    monkeypatch.setenv("AETHERION_TRUSTED_PROXY_CIDRS", "10.1.0.0/24")
    assert (
        experience.client_address(
            request_from("10.1.0.2", "9.9.9.9, 8.8.8.8, 10.1.0.3")
        )
        == "8.8.8.8"
    )


@pytest.mark.parametrize(
    "address", ["127.0.0.1", "10.0.0.1", "::1", "not-an-ip"]
)
def test_local_addresses_are_not_geolocated(address, monkeypatch):
    monkeypatch.delenv("AETHERION_TRUSTED_PROXY_CIDRS", raising=False)
    assert experience.client_address(request_from(address)) is None


def test_country_response_is_coarse_not_cached_and_needs_no_login(monkeypatch):
    monkeypatch.setenv("AETHERION_GEOIP_DATABASE", "local-fixture.mmdb")
    monkeypatch.delenv("AETHERION_TRUSTED_PROXY_CIDRS", raising=False)
    calls = []

    def lookup(address, path):
        calls.append((address, path))
        return "IN"

    monkeypatch.setattr(experience, "lookup_country", lookup)
    app = FastAPI()
    app.include_router(experience.router, prefix="/api")
    with TestClient(app, client=("8.8.8.8", 12345)) as client:
        response = client.get("/api/experience/context")
    assert response.json() == {"country": "IN", "source": "network"}
    assert response.headers["cache-control"] == "private, no-store"
    assert calls == [("8.8.8.8", "local-fixture.mmdb")]


def test_unavailable_database_does_not_block_entry(monkeypatch):
    monkeypatch.setenv("AETHERION_GEOIP_DATABASE", "missing.mmdb")

    def lookup(*args):
        raise OSError("unavailable")

    monkeypatch.setattr(experience, "lookup_country", lookup)
    app = FastAPI()
    app.include_router(experience.router)
    with TestClient(app, client=("8.8.8.8", 12345)) as client:
        assert client.get("/experience/context").json() == {
            "country": None,
            "source": "unavailable",
        }
