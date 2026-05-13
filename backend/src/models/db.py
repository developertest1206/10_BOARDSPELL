import databases
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
database     = databases.Database(DATABASE_URL)

async def connect_db():
    await database.connect()
    print("Connected to PostgreSQL - boardspell...")

async def disconnect_db():
    await database.disconnect()
    print("🔌 Disconnected from PostgreSQL")