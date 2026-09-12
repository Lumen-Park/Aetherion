"""Coarse region suggestions using a local database; never an identity signal."""

import ipaddress
import os
import re

from fastapi import APIRouter, Request, Response

router = APIRouter()


def client_address(request):
    """Walk forwarding chains only when each hop is explicitly trusted."""
    try:
        peer = ipaddress.ip_address(request.client.host)
        networks = [
            ipaddress.ip_network(value.strip())
            for value in os.getenv("AETHERION_TRUSTED_PROXY_CIDRS", "").split(",")
            if value.strip()
        ]
        forwarded = request.headers.get("x-forwarded-for", "")
        if len(forwarded) > 1024:
            return None
        for item in reversed(forwarded.split(",")):
            if not item.strip() or not any(
                peer in network for network in networks
            ):
                break
            peer = ipaddress.ip_address(item.strip())
        return str(peer) if peer.is_global else None
    except (ValueError, AttributeError):
        return None


def lookup_country(address, path):
    import maxminddb

    with maxminddb.open_database(path) as database:
        record = database.get(address) or {}
        return record.get("country", {}).get("iso_code")


@router.get("/experience/context")
def experience_context(request: Request, response: Response):
    # Shared caches must never serve one visitor's region to another.
    response.headers["Cache-Control"] = "private, no-store"
    country = None
    path = os.getenv("AETHERION_GEOIP_DATABASE", "").strip()
    address = client_address(request)
    if path and address:
        try:
            country = lookup_country(address, path)
            if not isinstance(country, str) or not re.fullmatch(
                r"[A-Z]{2}", country
            ):
                country = None
        except (
            ImportError, OSError, ValueError, RuntimeError, TypeError,
            AttributeError,
        ):
            # Missing or invalid regional data must never block sign-in.
            country = None
    return {
        "country": country,
        "source": "network" if country else "unavailable",
    }
