import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
import pymongo
from pymongo import MongoClient

from app.config.config import settings

logger = logging.getLogger("election_app.mongodb")

class MongoDBManager:
    client: Optional[AsyncIOMotorClient] = None
    db: Optional[AsyncIOMotorDatabase] = None
    sync_client: Optional[MongoClient] = None

mongo_manager = MongoDBManager()

async def connect_to_mongo():
    """Initializes async and sync MongoDB connections on application startup."""
    try:
        mongo_manager.client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000
        )
        mongo_manager.db = mongo_manager.client[settings.MONGODB_DB_NAME]
        
        # Ping server to confirm connection
        await mongo_manager.client.admin.command('ping')
        logger.info(f"Connected to MongoDB database: {settings.MONGODB_DB_NAME} at {settings.MONGODB_URL}")

        # Sync client for worker/bulk jobs
        mongo_manager.sync_client = MongoClient(
            settings.MONGODB_URL,
            serverSelectionTimeoutMS=5000
        )

        # Setup indexes
        await init_mongo_indexes()
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise e

async def close_mongo_connection():
    """Closes MongoDB connections on application shutdown."""
    if mongo_manager.client:
        mongo_manager.client.close()
        logger.info("Closed MongoDB async connection")
    if mongo_manager.sync_client:
        mongo_manager.sync_client.close()
        logger.info("Closed MongoDB sync connection")

def get_mongo_db() -> AsyncIOMotorDatabase:
    """FastAPI dependency for accessing async MongoDB database."""
    if mongo_manager.db is None:
        # Fallback lazy init if lifespan wasn't called (e.g. scripts or test setup)
        client = AsyncIOMotorClient(settings.MONGODB_URL)
        return client[settings.MONGODB_DB_NAME]
    return mongo_manager.db

def get_sync_mongo_db():
    """Synchronous MongoDB database for background jobs and tasks."""
    if mongo_manager.sync_client is None:
        client = MongoClient(settings.MONGODB_URL)
        return client[settings.MONGODB_DB_NAME]
    return mongo_manager.sync_client[settings.MONGODB_DB_NAME]

async def init_mongo_indexes():
    """Creates essential indexes on MongoDB collections for high query performance."""
    db = get_mongo_db()

    # 1. Members Indexes
    try:
        # Text Search Index for English & Marathi queries
        await db.members.create_index(
            [
                ("nameMarathi.full", "text"),
                ("name.full", "text"),
                ("nameMarathi.surname", "text"),
                ("membershipNumber", "text"),
                ("epicNumber", "text"),
                ("mobileNumber", "text")
            ],
            name="idx_members_text_search",
            weights={
                "nameMarathi.full": 10,
                "membershipNumber": 8,
                "nameMarathi.surname": 6,
                "name.full": 5,
                "mobileNumber": 5
            },
            default_language="none"
        )
    except Exception as ex:
        logger.warning(f"Note on text index: {ex}")

    # Single and compound indexes for members
    await db.members.create_index([("village.id", 1), ("status", 1), ("serialNumber", 1)])
    await db.members.create_index([("village.id", 1), ("membershipNumber", 1)])
    await db.members.create_index([("epicNumber", 1)], sparse=True)
    await db.members.create_index([("village.id", 1), ("category.id", 1)])
    await db.members.create_index([("familyId", 1)])
    await db.members.create_index([("assignedUserId", 1), ("village.id", 1)])
    await db.members.create_index([("updatedAt", -1)])

    # 2. Users Indexes
    await db.users.create_index([("username", 1)], unique=True)
    await db.users.create_index([("mobileNumber", 1)])
    await db.users.create_index([("role", 1), ("accountStatus", 1)])

    # 3. Villages Indexes
    await db.villages.create_index([("name", 1)])
    await db.villages.create_index([("nameMarathi", 1)])

    # 4. Import Jobs Indexes
    await db.import_jobs.create_index([("villageId", 1), ("createdAt", -1)])
    await db.import_jobs.create_index([("status", 1)])

    # 5. App Activities Indexes
    await db.app_activities.create_index([("userId", 1), ("timestamp", -1)])
    await db.app_activities.create_index([("action", 1), ("timestamp", -1)])

    # 6. Categories Indexes
    await db.categories.create_index([("code", 1)], unique=True)

    logger.info("Initialized MongoDB indexes successfully.")
