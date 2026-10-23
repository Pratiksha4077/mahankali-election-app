import logging
import json
import uuid
from datetime import datetime
from typing import Optional, Dict, Any, List
import psycopg2
from psycopg2.extras import Json, RealDictCursor

from app.config.config import settings

logger = logging.getLogger("election_app.supabase")

class SupabaseActivityService:
    @staticmethod
    def _get_connection():
        """Creates a PostgreSQL connection to Supabase with strict timeout."""
        db_url = settings.DATABASE_URL
        if not db_url or not db_url.startswith("postgres"):
            return None
        return psycopg2.connect(db_url, connect_timeout=5)

    @staticmethod
    def ensure_indexes():
        """Ensures high-performance indexes exist on public.activity_logs in Supabase."""
        try:
            conn = SupabaseActivityService._get_connection()
            if not conn:
                return
            conn.autocommit = True
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_activity_logs_username_ts
                    ON public.activity_logs (username, timestamp DESC);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_activity_logs_action_ts
                    ON public.activity_logs (action, timestamp DESC);
                """)
                cur.execute("""
                    CREATE INDEX IF NOT EXISTS idx_activity_logs_user_ts
                    ON public.activity_logs (user_id, timestamp DESC);
                """)
            conn.close()
            logger.info("Supabase activity_logs indexes confirmed.")
        except Exception as e:
            logger.warning(f"Note on Supabase index setup: {e}")

    @staticmethod
    def log_activity_sync(
        user_id: Optional[str],
        username: str,
        action: str,
        details: str = "",
        entity_type: Optional[str] = None,
        entity_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None
    ) -> bool:
        """
        Synchronizes an activity record into Supabase PostgreSQL public.activity_logs.
        Safely handles UUID foreign key validation so records are never lost.
        """
        try:
            conn = SupabaseActivityService._get_connection()
            if not conn:
                return False
            conn.autocommit = True

            ts = timestamp or datetime.utcnow()
            meta = metadata or {}
            target_user_uuid = None

            with conn.cursor() as cur:
                # 1. Resolve UUID for foreign key reference to public.users
                if user_id:
                    try:
                        valid_uuid = str(uuid.UUID(str(user_id)))
                        cur.execute("SELECT id FROM public.users WHERE id = %s", (valid_uuid,))
                        row = cur.fetchone()
                        if row:
                            target_user_uuid = row[0]
                    except ValueError:
                        pass

                if not target_user_uuid and username:
                    cur.execute("SELECT id FROM public.users WHERE LOWER(username) = LOWER(%s)", (username,))
                    row = cur.fetchone()
                    if row:
                        target_user_uuid = row[0]

                # Ensure original user_id is preserved in metadata
                meta["source_user_id"] = str(user_id or "")
                meta["source_username"] = str(username or "")

                cur.execute("""
                    INSERT INTO public.activity_logs (
                        user_id, username, action, entity_type, entity_id,
                        details, metadata, timestamp
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    target_user_uuid,
                    username,
                    action,
                    entity_type or "ACTIVITY",
                    entity_id,
                    details,
                    Json(meta),
                    ts
                ))

            conn.close()
            return True
        except Exception as e:
            logger.warning(f"[SupabaseActivityService] Failed to sync activity to Supabase: {e}")
            return False

    @staticmethod
    def get_activities(
        username: Optional[str] = None,
        user_id: Optional[str] = None,
        action_pattern: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> Dict[str, Any]:
        """
        Queries activities from Supabase PostgreSQL with pagination, limits and sorting.
        """
        try:
            conn = SupabaseActivityService._get_connection()
            if not conn:
                return {"items": [], "total": 0}

            offset = max(0, (page - 1) * limit)
            where_clauses = []
            params = []

            if username:
                where_clauses.append("(LOWER(username) = LOWER(%s) OR metadata->>'username' = %s)")
                params.extend([username, username])

            if user_id:
                try:
                    valid_uuid = str(uuid.UUID(str(user_id)))
                    where_clauses.append("(user_id = %s OR metadata->>'user_id' = %s OR metadata->>'source_user_id' = %s)")
                    params.extend([valid_uuid, user_id, user_id])
                except ValueError:
                    where_clauses.append("(metadata->>'user_id' = %s OR metadata->>'source_user_id' = %s)")
                    params.extend([user_id, user_id])

            if action_pattern:
                where_clauses.append("action ILIKE %s")
                params.append(f"%{action_pattern}%")

            where_str = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                count_sql = f"SELECT COUNT(*) FROM public.activity_logs {where_str}"
                cur.execute(count_sql, tuple(params))
                total = cur.fetchone()["count"]

                query_sql = f"""
                    SELECT id, user_id, username, action, entity_type, entity_id, details, metadata, timestamp
                    FROM public.activity_logs
                    {where_str}
                    ORDER BY timestamp DESC
                    LIMIT %s OFFSET %s
                """
                cur.execute(query_sql, tuple(params + [limit, offset]))
                rows = cur.fetchall()

            conn.close()
            return {"items": [dict(r) for r in rows], "total": total}
        except Exception as e:
            logger.error(f"[SupabaseActivityService] Failed to query activities from Supabase: {e}")
            return {"items": [], "total": 0}
