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


class SupabaseMemberService:
    @staticmethod
    def _get_connection():
        db_url = settings.DATABASE_URL
        if not db_url or not db_url.startswith("postgres"):
            return None
        return psycopg2.connect(db_url, connect_timeout=5)

    @staticmethod
    def update_member_sync(member_id: str, update_fields: Dict[str, Any], updated_by: str = "system") -> bool:
        """
        Updates a member/voter record directly in Supabase PostgreSQL public.members.
        Finds the record by UUID, mongo_id, membership_number, or serial_number.
        """
        try:
            conn = SupabaseMemberService._get_connection()
            if not conn:
                return False
            conn.autocommit = True

            set_clauses = ["updated_at = NOW()", "updated_by = %s"]
            params = [updated_by]

            # 1. Mobile & Address
            mob = update_fields.get("mobileNumber") or update_fields.get("mobile_number")
            if mob is not None:
                set_clauses.append("mobile_number = %s")
                params.append(str(mob).strip())

            addr = update_fields.get("address")
            if addr is not None:
                set_clauses.append("address = %s")
                params.append(str(addr).strip())

            pin = update_fields.get("pinCode") or update_fields.get("pin_code")
            if pin is not None:
                set_clauses.append("pin_code = %s")
                params.append(str(pin).strip())

            house = update_fields.get("houseNumber") or update_fields.get("house_number")
            if house is not None:
                set_clauses.append("house_number = %s")
                params.append(str(house).strip())

            # 2. Demographics
            raw_age = update_fields.get("age")
            if raw_age is not None and str(raw_age).strip() != "":
                try:
                    set_clauses.append("age = %s")
                    params.append(int(float(str(raw_age).strip())))
                except Exception:
                    pass

            raw_gender = update_fields.get("gender")
            if raw_gender is not None:
                g_str = str(raw_gender).strip()
                if g_str in ("पुरुष", "पु", "M", "m", "Male"):
                    resolved_gender = "Male"
                elif g_str in ("महिला", "स्त्री", "F", "f", "Female"):
                    resolved_gender = "Female"
                else:
                    resolved_gender = g_str
                set_clauses.append("gender = %s")
                params.append(resolved_gender)

            # 3. Voter Identifiers
            raw_serial = (
                update_fields.get("serialNumber") or
                update_fields.get("serial_number") or
                update_fields.get("voter_number")
            )
            if raw_serial is not None and str(raw_serial).strip() != "":
                try:
                    set_clauses.append("serial_number = %s")
                    params.append(int(str(raw_serial).strip()))
                except Exception:
                    pass

            epic = update_fields.get("epicNumber") or update_fields.get("epic_number")
            if epic is not None:
                set_clauses.append("epic_number = %s")
                params.append(str(epic).strip())

            booth = update_fields.get("boothPartNumber") or update_fields.get("booth_part_number")
            if booth is not None:
                set_clauses.append("booth_part_number = %s")
                params.append(str(booth).strip())

            # 4. Marathi Names
            name_mr = update_fields.get("full_name_mr") or update_fields.get("nameMarathi")
            if isinstance(name_mr, dict):
                if name_mr.get("full"):
                    set_clauses.append("full_name_marathi = %s")
                    params.append(str(name_mr["full"]).strip())
                if name_mr.get("first"):
                    set_clauses.append("first_name_marathi = %s")
                    params.append(str(name_mr["first"]).strip())
                if name_mr.get("surname"):
                    set_clauses.append("surname_marathi = %s")
                    params.append(str(name_mr["surname"]).strip())
                if name_mr.get("fatherName"):
                    set_clauses.append("father_name_marathi = %s")
                    params.append(str(name_mr["fatherName"]).strip())
            elif isinstance(name_mr, str) and name_mr.strip():
                nm_clean = name_mr.strip()
                set_clauses.append("full_name_marathi = %s")
                params.append(nm_clean)
                tokens = nm_clean.split()
                if len(tokens) >= 3:
                    set_clauses.append("surname_marathi = %s")
                    params.append(tokens[0])
                    set_clauses.append("first_name_marathi = %s")
                    params.append(tokens[1])
                    set_clauses.append("father_name_marathi = %s")
                    params.append(" ".join(tokens[2:]))
                elif len(tokens) == 2:
                    set_clauses.append("surname_marathi = %s")
                    params.append(tokens[0])
                    set_clauses.append("first_name_marathi = %s")
                    params.append(tokens[1])

            # 5. English Names
            name_en = update_fields.get("full_name_en") or update_fields.get("name")
            if isinstance(name_en, dict):
                if name_en.get("full"):
                    set_clauses.append("full_name = %s")
                    params.append(str(name_en["full"]).strip())
                if name_en.get("first"):
                    set_clauses.append("first_name = %s")
                    params.append(str(name_en["first"]).strip())
                if name_en.get("surname"):
                    set_clauses.append("surname = %s")
                    params.append(str(name_en["surname"]).strip())
            elif isinstance(name_en, str) and name_en.strip():
                set_clauses.append("full_name = %s")
                params.append(name_en.strip())

            # 6. Status & Deceased
            if update_fields.get("is_deceased") is True or update_fields.get("status") == "DECEASED":
                set_clauses.append("status = %s")
                params.append("DECEASED")
                set_clauses.append("deceased_date = NOW()")
                set_clauses.append("deceased_recorded_by = %s")
                params.append(updated_by)
            elif update_fields.get("is_deceased") is False or update_fields.get("status") == "ACTIVE":
                set_clauses.append("status = %s")
                params.append("ACTIVE")

            # 7. Caste, Religion, Profession, Designation, Organization
            for field, col in [
                ("caste", "caste"),
                ("religion", "religion"),
                ("profession", "profession"),
                ("designation", "designation"),
                ("organization", "organization"),
                ("org", "organization")
            ]:
                if field in update_fields and update_fields[field] is not None:
                    set_clauses.append(f"{col} = %s")
                    params.append(str(update_fields[field]).strip())

            # 8. Category update if requested
            cat_val = update_fields.get("category_id") or update_fields.get("categoryId") or update_fields.get("category")
            if cat_val:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT id, code, color FROM public.categories 
                        WHERE id::text = %s OR code ILIKE %s OR color = %s OR name ILIKE %s
                        LIMIT 1
                    """, (str(cat_val), str(cat_val), str(cat_val), f"%{cat_val}%"))
                    c_row = cur.fetchone()
                    if c_row:
                        set_clauses.append("category_id = %s")
                        params.append(c_row[0])
                        set_clauses.append("category_code = %s")
                        params.append(c_row[1])
                        set_clauses.append("category_color = %s")
                        params.append(c_row[2])

            # Build WHERE condition matching id or mongo_id
            where_conditions = ["mongo_id = %s"]
            where_params = [str(member_id)]

            try:
                valid_u = str(uuid.UUID(str(member_id)))
                where_conditions.append("id = %s")
                where_params.append(valid_u)
            except ValueError:
                pass

            sql = f"""
                UPDATE public.members 
                SET {", ".join(set_clauses)}
                WHERE {" OR ".join(where_conditions)}
            """
            all_params = tuple(params + where_params)

            with conn.cursor() as cur:
                cur.execute(sql, all_params)
                affected = cur.rowcount

            conn.close()
            logger.info(f"[SupabaseMemberService] Updated member {member_id} in Supabase (rows: {affected})")
            return affected > 0
        except Exception as e:
            logger.error(f"[SupabaseMemberService] Failed to update member in Supabase: {e}")
            return False

    @staticmethod
    def update_category_sync(member_id: str, category_ident: str, updated_by: str = "system") -> bool:
        """
        Updates a member's category color directly in Supabase PostgreSQL public.members.
        """
        try:
            conn = SupabaseMemberService._get_connection()
            if not conn:
                return False
            conn.autocommit = True

            with conn.cursor() as cur:
                # Find matching category
                cur.execute("""
                    SELECT id, code, color FROM public.categories
                    WHERE id::text = %s OR code ILIKE %s OR color = %s OR name ILIKE %s
                    LIMIT 1
                """, (str(category_ident), str(category_ident), str(category_ident), f"%{category_ident}%"))
                c_row = cur.fetchone()
                if not c_row:
                    # fallback to green
                    cur.execute("SELECT id, code, color FROM public.categories WHERE code = 'GREEN' LIMIT 1")
                    c_row = cur.fetchone()

                if not c_row:
                    conn.close()
                    return False

                cat_id, cat_code, cat_color = c_row

                where_conditions = ["mongo_id = %s"]
                where_params = [str(member_id)]
                try:
                    valid_u = str(uuid.UUID(str(member_id)))
                    where_conditions.append("id = %s")
                    where_params.append(valid_u)
                except ValueError:
                    pass

                update_sql = f"""
                    UPDATE public.members
                    SET category_id = %s,
                        category_code = %s,
                        category_color = %s,
                        updated_at = NOW(),
                        updated_by = %s
                    WHERE {" OR ".join(where_conditions)}
                """
                cur.execute(update_sql, (cat_id, cat_code, cat_color, updated_by) + tuple(where_params))
                affected = cur.rowcount

            conn.close()
            logger.info(f"[SupabaseMemberService] Updated category for {member_id} to {cat_code} in Supabase (rows: {affected})")
            return affected > 0
        except Exception as e:
            logger.error(f"[SupabaseMemberService] Failed to update category in Supabase: {e}")
            return False

