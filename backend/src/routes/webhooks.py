from fastapi import APIRouter, Request
import redis.asyncio as redis
import json, os, time
from dotenv import load_dotenv

load_dotenv()
router    = APIRouter()
REDIS_URL = os.getenv("REDIS_URL")


@router.post("/receive")
async def receive_webhook(request: Request):
    body = await request.json()

    if "challenge" in body:
        print("✅ Webhook challenge verified")
        return {"challenge": body["challenge"]}

    event = body.get("event", {})
    print(f"\n📩 WEBHOOK RECEIVED:")
    print(f"   Type   : {event.get('type')}")
    print(f"   Board  : {event.get('boardId')}")
    print(f"   Item   : {event.get('pulseId')}")
    print(f"   Column : {event.get('columnId')}")
    print(f"   Value  : {event.get('value')}")

    try:
        pulse_id   = str(event.get("pulseId",  "unknown"))
        column_id  = str(event.get("columnId", "move"))
        event_type = str(event.get("type",      ""))
        changed_at = event.get("changedAt", str(time.time()))
        event_id   = f"{pulse_id}-{column_id}-{event_type}-{changed_at}"

        r = redis.from_url(REDIS_URL)
        await r.lpush("automation_events", json.dumps({"event_id": event_id, "event": event}))
        await r.aclose()

        print(f"✅ Queued: {event_id}")
        return {"status": "queued", "event_id": event_id}
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return {"status": "error", "message": str(e)}