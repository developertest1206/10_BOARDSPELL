import asyncio, json, uuid, os
import redis.asyncio as redis
from dotenv import load_dotenv
from src.models.db import database, connect_db
from src.services.monday_api import change_column_value, assign_person, send_notification

load_dotenv()
REDIS_URL = os.getenv("REDIS_URL")


def safe_json(value):
    if value is None:        return {}
    if isinstance(value, dict): return value
    if isinstance(value, str):
        try:    return json.loads(value)
        except: return {}
    return {}


async def retry_action(fn, *args, max_retries=3):
    for attempt in range(max_retries):
        try:
            return await fn(*args)
        except Exception as e:
            wait = 4 ** attempt
            print(f"⚠️  Attempt {attempt+1} failed: {e}. Retry in {wait}s...")
            await asyncio.sleep(wait)
    raise Exception(f"Action failed after {max_retries} attempts")


def map_event_to_trigger(event_type: str):
    mapping = {
        "update_column_value":        "status_change",
        "change_column_value":        "status_change",
        "change_status_column_value": "status_change",
        "move_pulse_into_group":      "item_moved",
        "move_item_to_group":         "item_moved",
    }
    result = mapping.get(event_type)
    print(f"🗺️  Event '{event_type}' → trigger '{result}'")
    return result


def trigger_matches(trigger_type: str, trigger_cfg: dict, event: dict) -> bool:
    print(f"\n🔍 TRIGGER CHECK: type={trigger_type}")
    print(f"   config = {trigger_cfg}")

    if trigger_type == "status_change":
        expected_col = str(trigger_cfg.get("column_id", "")).strip()
        expected_val = str(trigger_cfg.get("value",     "")).lower().strip()
        actual_col   = str(event.get("columnId",        "")).strip()

        raw = event.get("value", {})
        if isinstance(raw, str):
            try: raw = json.loads(raw)
            except: raw = {}

        label      = raw.get("label", {}) if isinstance(raw, dict) else {}
        actual_val = str(label.get("text", "")).lower().strip()

        print(f"   expected: col='{expected_col}' val='{expected_val}'")
        print(f"   actual:   col='{actual_col}'   val='{actual_val}'")

        if expected_col and actual_col != expected_col:
            print("   ❌ Column mismatch")
            return False
        if expected_val and actual_val != expected_val:
            print("   ❌ Value mismatch")
            return False
        print("   ✅ MATCHED!")
        return True

    elif trigger_type == "item_moved":
        expected_group = str(trigger_cfg.get("group_id", "")).strip()
        actual_group   = str(event.get("destGroupId",    "")).strip()
        print(f"   expected_group='{expected_group}' actual_group='{actual_group}'")
        if expected_group and actual_group != expected_group:
            print("   ❌ Group mismatch")
            return False
        print("   ✅ MATCHED!")
        return True

    return True


async def condition_matches(condition_cfg: dict, item_id: str, access_token: str) -> bool:
    """Fetch item column values from API and check condition"""
    if not condition_cfg:
        return True

    expected_col = condition_cfg.get("column_id", "")
    expected_val = str(condition_cfg.get("value", "")).lower().strip()

    if not expected_col or not expected_val:
        return True

    try:
        from src.services.monday_api import monday_query
        query = """
            query($itemId: ID!) {
                items(ids: [$itemId]) {
                    column_values {
                        id
                        text
                        value
                    }
                }
            }
        """
        data   = await monday_query(query, {"itemId": item_id}, access_token)
        items  = data.get("items", [])
        if not items:
            print(f"⚠️ Item {item_id} not found for condition check")
            return False

        col_values = items[0].get("column_values", [])
        actual_val = ""

        for cv in col_values:
            if cv["id"] == expected_col:
                actual_val = str(cv.get("text", "")).lower().strip()
                break

        matched = actual_val == expected_val
        print(f"🔍 CONDITION: col={expected_col} expected='{expected_val}' actual='{actual_val}' → {matched}")
        return matched

    except Exception as e:
        print(f"❌ Condition check failed: {e}")
        return False


async def log_execution(automation_id, event, action_taken, status, error_message=None):
    try:
        await database.execute("""
            INSERT INTO execution_logs
            (id, automation_id, trigger_payload, action_taken, status, error_message)
            VALUES (:id, :automation_id, :trigger_payload, :action_taken, :status, :error_message)
        """, values={
            "id":              str(uuid.uuid4()),
            "automation_id":   str(automation_id),
            "trigger_payload": json.dumps(event),
            "action_taken":    json.dumps(action_taken) if action_taken else None,
            "status":          status,
            "error_message":   error_message,
        })
        print(f"📝 Logged: {status}")
    except Exception as e:
        print(f"❌ Log failed: {e}")


async def execute_action(automation: dict, action_cfg: dict, event: dict, access_token: str):
    action_type = automation["action_type"]
    item_id     = str(event.get("pulseId", ""))
    print(f"\n⚡ ACTION: {action_type}")
    print(f"   config = {action_cfg}")

    if action_type == "change_column":
        target_item = action_cfg.get("target_item_id", "")
        column_id   = action_cfg.get("column_id", "")
        raw_val     = action_cfg.get("value", "")
        if not target_item: raise Exception("target_item_id missing")
        if not column_id:   raise Exception("column_id missing")
        formatted = json.dumps({"label": raw_val})
        print(f"   → change_column: board={automation['action_board_id']} item={target_item} col={column_id} val={formatted}")
        await retry_action(change_column_value, automation["action_board_id"], target_item, column_id, formatted, access_token)

    elif action_type == "assign_person":
        target_item = action_cfg.get("target_item_id", "")
        column_id   = action_cfg.get("column_id", "")
        user_id     = action_cfg.get("user_id", "")
        if not user_id: raise Exception("user_id missing")
        print(f"   → assign_person: item={target_item} col={column_id} user={user_id}")
        await retry_action(assign_person, automation["action_board_id"], target_item, column_id, user_id, access_token)

    elif action_type == "send_notification":
        user_ids = action_cfg.get("user_ids", [])
        message  = action_cfg.get("message", "Boardspell automation triggered")
        print(f"   → notify: users={user_ids}")
        for uid in user_ids:
            await retry_action(send_notification, uid, item_id, message, access_token)

    else:
        raise Exception(f"Unknown action_type: {action_type}")


async def process_automation(automation: dict, event: dict):
    automation_id = automation["id"]
    print(f"\n{'='*50}")
    print(f"🤖 Automation: {automation['name']}")

    try:
        access_token  = automation["access_token"]
        trigger_cfg   = safe_json(automation["trigger_config"])
        condition_cfg = safe_json(automation["condition_config"]) if automation.get("condition_config") else None
        action_cfg    = safe_json(automation["action_config"])
        item_id       = str(event.get("pulseId", ""))

        print(f"   trigger_cfg  = {trigger_cfg}")
        print(f"   condition_cfg= {condition_cfg}")
        print(f"   action_cfg   = {action_cfg}")
        print(f"   item_id      = {item_id}")

        # Step 1 — Check trigger
        if not trigger_matches(automation["trigger_type"], trigger_cfg, event):
            await log_execution(automation_id, event, None, "skipped", "trigger config not matched")
            return

        # Step 2 — Check condition (fetch from API)
        if condition_cfg:
            matched = await condition_matches(condition_cfg, item_id, access_token)
            if not matched:
                print(f"⏭️  Condition not met — skipping")
                await log_execution(automation_id, event, None, "skipped", "condition not met")
                return

        # Step 3 — Execute action
        await execute_action(automation, action_cfg, event, access_token)
        print(f"✅ Success: {automation['name']}")
        await log_execution(automation_id, event, action_cfg, "success")

    except Exception as e:
        import traceback
        print(f"❌ FAILED:\n{traceback.format_exc()}")
        await log_execution(automation_id, event, None, "failed", str(e))


async def process_event(event: dict, event_id: str):
    board_id     = str(event.get("boardId", ""))
    event_type   = str(event.get("type",    ""))
    trigger_type = map_event_to_trigger(event_type)

    print(f"\n{'='*50}")
    print(f"📨 EVENT: type={event_type} board={board_id}")

    if not trigger_type:
        print(f"⏭️  Unknown event type")
        return

    automations = await database.fetch_all("""
        SELECT a.*, w.access_token
        FROM automations a
        JOIN workspaces w ON w.workspace_id = a.workspace_id
        WHERE a.trigger_board_id = :board_id
          AND a.trigger_type     = :trigger_type
          AND a.is_active        = TRUE
    """, values={"board_id": board_id, "trigger_type": trigger_type})

    print(f"🔎 Found {len(automations)} automation(s)")
    if not automations:
        return

    for auto in automations:
        await process_automation(dict(auto), event)


async def run_worker():
    await connect_db()
    r = redis.from_url(REDIS_URL)
    print("🔄 Automation worker started — listening for events...")
    while True:
        try:
            result = await r.brpop("automation_events", timeout=1)
            if result:
                _, raw   = result
                payload  = json.loads(raw)
                event_id = payload.get("event_id", "")
                event    = payload.get("event", {})

                seen = await r.sismember("processed_events", event_id)
                if seen:
                    print(f"⏭️  Duplicate skipped: {event_id}")
                    continue

                await r.sadd("processed_events", event_id)
                await r.expire("processed_events", 86400)
                await process_event(event, event_id)

        except Exception as e:
            import traceback
            print(f"❌ Worker error:\n{traceback.format_exc()}")
            await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(run_worker())