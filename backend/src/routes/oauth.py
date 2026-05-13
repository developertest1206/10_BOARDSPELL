from fastapi import APIRouter
from fastapi.responses import HTMLResponse, RedirectResponse
import httpx, base64, json, os
from dotenv import load_dotenv
from src.models.db import database

load_dotenv()
router               = APIRouter()
MONDAY_CLIENT_ID     = os.getenv("MONDAY_CLIENT_ID")
MONDAY_CLIENT_SECRET = os.getenv("MONDAY_CLIENT_SECRET")
APP_URL              = os.getenv("APP_URL")


def decode_monday_token(token: str) -> dict:
    try:
        payload = token.split('.')[1]
        padding = 4 - len(payload) % 4
        if padding != 4:
            payload += '=' * padding
        return json.loads(base64.b64decode(payload))
    except Exception as e:
        print(f"❌ JWT decode error: {e}")
        return {}


@router.get("/start")
async def oauth_start():
    params   = f"client_id={MONDAY_CLIENT_ID}&redirect_uri={APP_URL}/oauth/callback"
    response = RedirectResponse(f"https://auth.monday.com/oauth2/authorize?{params}")
    response.headers["ngrok-skip-browser-warning"] = "true"
    return response


@router.get("/callback")
async def oauth_callback(code: str = None):
    if not code:
        return HTMLResponse("<h2>❌ No code received</h2>", status_code=400)
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://auth.monday.com/oauth2/token",
                json={
                    "client_id":     MONDAY_CLIENT_ID,
                    "client_secret": MONDAY_CLIENT_SECRET,
                    "code":          code,
                    "redirect_uri":  f"{APP_URL}/oauth/callback",
                },
                headers={"Content-Type": "application/json"},
            )
            token_data   = token_response.json()
            access_token = token_data.get("access_token")

            if not access_token:
                return HTMLResponse(f"<h2>❌ No access token</h2><pre>{token_data}</pre>", status_code=400)

            claims       = decode_monday_token(access_token)
            account_id   = claims.get("actid") or claims.get("account_id")
            user_id      = claims.get("uid")   or claims.get("user_id")

            if not account_id:
                return HTMLResponse(f"<h2>❌ Could not get account_id</h2><pre>{claims}</pre>", status_code=400)

            workspace_id = str(account_id)

            user_name = "Developer"
            try:
                users_resp = await client.post(
                    "https://api.monday.com/v2",
                    json={"query": f"query {{ users(ids:[{user_id}]){{ id name email }} }}"},
                    headers={"Authorization": access_token, "Content-Type": "application/json", "API-Version": "2024-01"},
                )
                users_list = users_resp.json().get("data", {}).get("users", [])
                if users_list:
                    user_name = users_list[0]["name"]
            except Exception:
                pass

            await database.execute("""
                INSERT INTO workspaces (workspace_id, monday_account_id, access_token)
                VALUES (:workspace_id, :account_id, :access_token)
                ON CONFLICT (workspace_id) DO UPDATE SET access_token = :access_token
            """, values={"workspace_id": workspace_id, "account_id": workspace_id, "access_token": access_token})

            print(f"✅ Workspace {workspace_id} authenticated!")

            return HTMLResponse(f"""
                <html><body style="font-family:sans-serif;text-align:center;padding:60px;background:#F4F5F7">
                <div style="background:#fff;border-radius:12px;padding:40px;max-width:500px;margin:0 auto;box-shadow:0 2px 8px rgba(0,0,0,0.1)">
                <div style="font-size:48px;margin-bottom:16px">✅</div>
                <h2 style="color:#172B4D">Boardspell Connected!</h2>
                <p style="color:#6B778C">Welcome, <strong>{user_name}</strong></p>
                <div style="background:#F4F5F7;border-radius:8px;padding:16px;margin-top:20px">
                <p style="margin:0 0 8px;font-size:13px;color:#42526E;font-weight:600">YOUR WORKSPACE ID</p>
                <strong style="font-size:36px;color:#6C47FF">{workspace_id}</strong>
                </div>
                <div style="background:#E6F9F0;border-radius:8px;padding:12px;margin-top:12px">
                <p style="margin:0;font-size:13px;color:#00875A;font-weight:600">✅ Copy this ID!</p>
                </div></div></body></html>
            """)
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return HTMLResponse(f"<h2>❌ {str(e)}</h2>", status_code=500)