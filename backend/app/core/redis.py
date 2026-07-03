# app/core/redis.py
#
# This file sets up our connection to Upstash Redis and provides
# utilities for handling webhook idempotency.
#
# WHY DO WE NEED IDEMPOTENCY?
# ────────────────────────────
# When Nomba sends us a webhook (payment notification), they might send it
# MORE THAN ONCE if they don't get a quick response from us.
# Without idempotency, we'd reconcile the same payment twice — crediting
# a customer twice for one payment. That's a serious bug.
#
# THE SOLUTION:
# When we receive a webhook event, we store its unique event_id in Redis.
# Before processing, we check Redis: "have we seen this event_id before?"
#   - If NO  → process it and store the ID
#   - If YES → skip it (it's a duplicate)
#
# Redis is perfect for this because it's fast (in-memory) and supports
# atomic operations (SET only if key doesn't exist = no race conditions).

from upstash_redis import Redis
from app.core.config import settings

# Create the Redis client using our Upstash credentials
redis = Redis(
    url=settings.UPSTASH_REDIS_URL,
    token=settings.UPSTASH_REDIS_TOKEN,
)

# How long to remember a processed event ID — 24 hours in seconds
# After 24 hours, Nomba won't retry a webhook anyway, so we can forget it
IDEMPOTENCY_TTL_SECONDS = 86400  # 24 * 60 * 60


def is_duplicate_event(event_id: str) -> bool:
    """
    Check if we've already processed this webhook event.

    Returns:
        True  → we've seen this before, SKIP processing
        False → this is new, GO AHEAD and process it

    How it works:
        Redis SET with NX flag means "set this key ONLY IF it doesn't exist yet"
        - If the key was successfully set → this is the FIRST time we see it → not duplicate
        - If the key already existed → we've seen it before → it IS a duplicate

    This is atomic — even if two webhook requests arrive at the exact same
    millisecond, only one will successfully set the key.
    """
    redis_key = f"webhook:processed:{event_id}"

    # NX = "Not eXists" — only set if key doesn't already exist
    # ex = expiry in seconds
    result = redis.set(redis_key, "1", nx=True, ex=IDEMPOTENCY_TTL_SECONDS)

    # result is True if key was SET (first time) → NOT a duplicate
    # result is None if key ALREADY EXISTED → IS a duplicate
    return result is None
