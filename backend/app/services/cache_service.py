import logging
import json
import time
import fnmatch
from typing import Optional, Any, Dict, Tuple
from app.config.config import settings

logger = logging.getLogger("election_app.cache")

class CacheService:
    _client = None
    _is_connected = False
    _connection_attempted = False
    _memory_cache: Dict[str, Tuple[float, Any]] = {}

    @classmethod
    def get_client(cls):
        """Returns Redis client instance with connection pooling and strict timeouts, or None."""
        if cls._connection_attempted and not cls._is_connected:
            return None

        if cls._client is not None:
            return cls._client

        cls._connection_attempted = True
        redis_url = settings.REDIS_URL
        if not redis_url:
            logger.info("Redis cache is not configured (REDIS_URL empty). Using high-speed in-memory cache fallback.")
            return None

        try:
            import redis
            cls._client = redis.Redis.from_url(
                redis_url,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2
            )
            cls._client.ping()
            cls._is_connected = True
            logger.info("Redis cache connected successfully (%s)", redis_url.split("@")[-1])
            return cls._client
        except Exception as e:
            logger.warning("Redis cache unavailable (%s). Falling back to high-speed in-memory cache.", e)
            cls._client = None
            cls._is_connected = False
            return None

    @classmethod
    def get(cls, key: str) -> Optional[Any]:
        """Fetch cached value by key (from Redis or In-Memory fallback)."""
        # 1. Try Redis
        try:
            client = cls.get_client()
            if client:
                val = client.get(key)
                if val is not None:
                    return json.loads(val)
        except Exception as e:
            logger.debug("Redis GET error for %s: %s", key, e)

        # 2. In-Memory fallback
        entry = cls._memory_cache.get(key)
        if entry:
            expiry, val = entry
            if expiry > time.time():
                return val
            else:
                del cls._memory_cache[key]
        return None

    @classmethod
    def set(cls, key: str, value: Any, ttl: int = 300) -> bool:
        """Store value with expiration in seconds (to Redis and In-Memory fallback)."""
        success = False
        # 1. Store in Redis
        try:
            client = cls.get_client()
            if client:
                payload = json.dumps(value, ensure_ascii=False, default=str)
                success = bool(client.setex(key, ttl, payload))
        except Exception as e:
            logger.debug("Redis SET error for %s: %s", key, e)

        # 2. Always store in In-Memory fallback for ultra-fast local response
        cls._memory_cache[key] = (time.time() + ttl, value)
        return True

    @classmethod
    def delete(cls, key: str) -> bool:
        """Delete a single key."""
        try:
            client = cls.get_client()
            if client:
                client.delete(key)
        except Exception:
            pass

        if key in cls._memory_cache:
            del cls._memory_cache[key]
        return True

    @classmethod
    def delete_pattern(cls, pattern: str) -> int:
        """Delete keys matching pattern (e.g. 'voters:*', 'user:*')."""
        deleted_count = 0
        try:
            client = cls.get_client()
            if client:
                keys = client.keys(pattern)
                if keys:
                    deleted_count = client.delete(*keys)
        except Exception:
            pass

        # Also purge from in-memory cache
        to_del = [k for k in cls._memory_cache.keys() if fnmatch.fnmatch(k, pattern)]
        for k in to_del:
            del cls._memory_cache[k]
        return deleted_count + len(to_del)

    @classmethod
    def invalidate_voter_cache(cls):
        """Invalidate all voter and report caches upon import or update."""
        cls.delete_pattern("voters:*")
        cls.delete_pattern("reports:*")
        cls.delete("dashboard:stats")

    @classmethod
    def invalidate_all_reports(cls):
        """Invalidate all report caches."""
        cls.delete_pattern("reports:*")

    @classmethod
    def invalidate_user_cache(cls, user_id: Optional[str] = None):
        """Invalidate user and user activity caches."""
        if user_id:
            cls.delete_pattern(f"user:{user_id}:*")
        cls.delete_pattern("users:list")
        cls.delete("dashboard:stats")
