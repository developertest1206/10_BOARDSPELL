from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from src.models.db import connect_db, disconnect_db
from src.routes import oauth, webhooks, automations, monday
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import Response



load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    yield
    await disconnect_db()

app = FastAPI(
    title="Boardspell API",
    description="Cross-Board Automation Builder for monday.com",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(oauth.router,       prefix="/oauth",       tags=["OAuth"])
app.include_router(webhooks.router,    prefix="/webhooks",    tags=["Webhooks"])
app.include_router(automations.router, prefix="/automations", tags=["Automations"])
app.include_router(monday.router,      prefix="/monday",      tags=["Monday Data"])

@app.get("/")
async def root():
    return {"app": "Boardspell", "status": "✅ Running", "docs": "/docs"}

@app.get("/health")
async def health():
    return {"status": "✅ Running", "framework": "FastAPI", "version": "1.0.0"}

@app.middleware("http")
async def add_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["ngrok-skip-browser-warning"] = "true"
    response.headers["Access-Control-Allow-Origin"] = "*"
    return response
