# app/services/nomba.py
#
# This file handles ALL communication with Nomba's API.
# We keep all Nomba-related code here so:
#   1. It's easy to find and update
#   2. Routes don't need to know anything about Nomba's API structure
#   3. If Nomba changes their API, we only update this one file
#
# HOW NOMBA AUTH WORKS (from the docs):
# ──────────────────────────────────────
# Every API call needs a Bearer token in the Authorization header.
# To GET that token, we first call POST /v1/auth/token/issue
# with our client credentials. The token expires, so we re-fetch it per request.
#
# EVERY request to Nomba also needs:
#   - Authorization: Bearer <access_token>   (proves who we are)
#   - accountId: <parent_account_id>          (which Nomba account this is for)
#   - Content-Type: application/json
#
# SANDBOX vs PRODUCTION:
# ───────────────────────
# Sandbox base URL: https://sandbox.nomba.com/v1
# Production URL:   https://api.nomba.com/v1
# They MUST be paired with the matching credentials — never mix them.

import httpx
import logging
from typing import Optional
from app.core.config import settings

# Set up a logger for this module — logs appear in the terminal during development
logger = logging.getLogger(__name__)


class NombaService:
    """
    Service class that wraps all Nomba API calls.
    
    We create one instance of this at the bottom of the file
    and import it wherever we need Nomba functionality.
    """

    def __init__(self):
        # Pull all Nomba config from our settings (loaded from .env)
        self.base_url  = settings.NOMBA_BASE_URL           # https://sandbox.nomba.com/v1
        self.client_id = settings.NOMBA_CLIENT_ID          # TEST client ID
        self.client_secret = settings.NOMBA_CLIENT_SECRET  # TEST private key
        self.parent_account_id = settings.NOMBA_PARENT_ACCOUNT_ID  # goes in 'accountId' header
        self.sub_account_id    = settings.NOMBA_SUB_ACCOUNT_ID      # scopes virtual accounts

    async def _get_access_token(self) -> Optional[str]:
        """
        Authenticate with Nomba and get a Bearer access token.

        According to the Nomba docs, we POST to /v1/auth/token/issue with:
          - Header:  accountId = our parent account ID
          - Body:    grant_type, client_id, client_secret

        Returns the access token string, or None if authentication fails.

        Note: In production you'd cache this token until it expires.
        For the hackathon, we fetch a fresh one per request — simple and reliable.
        """
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/auth/token/issue",
                    # accountId goes in the HEADER, not the body
                    headers={
                        "Content-Type": "application/json",
                        "accountId": self.parent_account_id,
                    },
                    # grant_type, client_id, client_secret go in the BODY
                    json={
                        "grant_type"   : "client_credentials",
                        "client_id"    : self.client_id,
                        "client_secret": self.client_secret,
                    },
                    timeout=30.0,  # wait up to 30 seconds for a response
                )
                response.raise_for_status()  # raises an exception for 4xx/5xx status codes
                data = response.json()

                # Nomba wraps all responses in a "data" key
                # Successful response looks like: {"code": "00", "data": {"access_token": "..."}}
                access_token = data.get("data", {}).get("access_token")
                return access_token

        except httpx.HTTPStatusError as e:
            # This means Nomba returned a 4xx or 5xx response
            logger.error(f"Nomba auth failed — HTTP {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            logger.error(f"Nomba auth failed — unexpected error: {str(e)}")
            return None

    async def _get_headers(self) -> Optional[dict]:
        """
        Build the headers required for ALL Nomba API calls:
          - Authorization: Bearer <token>
          - accountId: <parent account ID>
          - Content-Type: application/json

        Returns None if we can't get an access token.
        """
        token = await self._get_access_token()
        if not token:
            return None

        return {
            "Authorization": f"Bearer {token}",
            "accountId"    : self.parent_account_id,  # ALWAYS the parent account ID
            "Content-Type" : "application/json",
        }

    async def create_virtual_account(
        self,
        customer_name: str,
        customer_id  : str,
        business_name: str,
    ) -> Optional[dict]:
        """
        Create a unique virtual account for one customer.

        Nomba endpoint: POST /v1/accounts/virtual
        
        The accountRef is OUR identifier for this account — we use the customer's
        Tara ID so we can always map back to the right customer.

        Successful response from Nomba looks like:
        {
          "code": "00",
          "data": {
            "accountRef": "...",
            "accountName": "Tara / John Doe",
            "bankName": "Nombank MFB",
            "bankAccountNumber": "9391076543",
            "bankAccountName": "Nomba/John Doe"
          }
        }

        Returns a dict with account details, or None if creation failed.
        """
        headers = await self._get_headers()
        if not headers:
            logger.error("Could not get Nomba headers — skipping virtual account creation")
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/accounts/virtual/{self.sub_account_id}",
                    headers=headers,
                    json={
                        "accountRef" : customer_id,
                        "accountName": f"{business_name} / {customer_name}",
                        "currency"   : "NGN",
                        "callbackUrl": "https://tara-nombahackathon.onrender.com/api/v1/webhooks/nomba",
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                # Check Nomba's response code (separate from HTTP status)
                # "00" means success in Nomba's system
                if data.get("code") != "00":
                    logger.error(f"Nomba returned non-success code: {data}")
                    return None

                account_data = data.get("data", {})

                # Return a clean dict with just what we need to store
                return {
                    "account_number": account_data.get("bankAccountNumber"),
                    "account_name"  : account_data.get("bankAccountName") or account_data.get("accountName"),
                    "bank_name"     : account_data.get("bankName", "Nomba"),
                    "account_ref"   : account_data.get("accountRef"),
                }

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Nomba virtual account creation failed — "
                f"HTTP {e.response.status_code}: {e.response.text}"
            )
            return None
        except Exception as e:
            logger.error(f"Nomba virtual account creation failed — {str(e)}")
            return None

    async def get_account_transactions(
        self,
        start_date: str,
        end_date  : str,
        limit     : int = 50,
    ) -> list[dict]:
        """
        Fetch recent transactions for our account from Nomba's Transactions API.

        Nomba endpoint: GET /v1/transactions/accounts
        
        Used by our nightly reconciliation job to cross-check:
        "Are there any payments in Nomba's records that we haven't reconciled yet?"

        Parameters:
          start_date: format "yyyy-MM-dd'T'HH:mm:ss" in UTC e.g. "2024-01-01T00:00:00"
          end_date:   same format
          limit:      how many transactions to fetch per page

        Returns a list of transaction dicts, or empty list on failure.
        """
        headers = await self._get_headers()
        if not headers:
            return []

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.base_url}/transactions/accounts/{self.sub_account_id}",
                    headers=headers,
                    params={
                        "startDate": start_date,
                        "endDate"  : end_date,
                        "limit"    : limit,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                data = response.json()

                # Transactions are nested inside data.results
                return data.get("data", {}).get("results", [])

        except httpx.HTTPStatusError as e:
            logger.error(
                f"Failed to fetch Nomba transactions — "
                f"HTTP {e.response.status_code}: {e.response.text}"
            )
            return []
        except Exception as e:
            logger.error(f"Failed to fetch Nomba transactions — {str(e)}")
            return []


# ── Singleton Instance ────────────────────────────────────────────────────────
# We create ONE instance of NombaService and import it everywhere.
# This is the "singleton pattern" — one shared instance instead of creating
# a new object every time we need to call Nomba.
nomba_service = NombaService()
