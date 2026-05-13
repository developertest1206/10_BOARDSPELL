from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import uuid, json
from src.models.db import database
from src.services.monday_api import register_webhook, delete_webhook

router = APIRouter()

# Only status_change can be auto-registered via API
# item_moved requires manual monday.com automation setup
TRIGGER_EVENT_MAP = {
    "status_change": "change_column_value",
}


class AutomationCreate(BaseModel):
    workspace_id:     str
    name:             str
    trigger_type:     str
    trigger_board_id: str
    trigger_config:   dict
    condition_config: Optional[dict] = None
    action_type:      str
    action_board_id:  Optional[str] = None
    action_config:    dict


async def get_token(workspace_id: str) -> str:
    row = await database.fetch_one(
        "SELECT access_token FROM workspaces WHERE workspace_id = :id",
        values={"id": workspace_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return row["access_token"]


async def register_auto_webhook(automation_id: str, workspace_id: str, trigger_type: str, trigger_board_id: str):
    event_type = TRIGGER_EVENT_MAP.get(trigger_type)
    if not event_type:
        print(f"ℹ️ No auto-webhook for trigger type: {trigger_type}")
        return

    try:
        token   = await get_token(workspace_id)
        webhook = await register_webhook(trigger_board_id, event_type, token)
        await database.execute("""
            INSERT INTO webhook_subscriptions
            (id, automation_id, monday_webhook_id, board_id, event_type)
            VALUES (:id, :automation_id, :monday_webhook_id, :board_id, :event_type)
        """, values={
            "id":                str(uuid.uuid4()),
            "automation_id":     automation_id,
            "monday_webhook_id": str(webhook["id"]),
            "board_id":          trigger_board_id,
            "event_type":        event_type,
        })
        print(f"✅ Webhook registered & saved: {webhook['id']}")
    except Exception as e:
        print(f"⚠️ Webhook registration failed: {e}")


# GET all automations
@router.get("/{workspace_id}")
async def get_automations(workspace_id: str):
    rows = await database.fetch_all("""
        SELECT a.*,
               COUNT(e.id)         AS run_count,
               MAX(e.triggered_at) AS last_triggered
        FROM automations a
        LEFT JOIN execution_logs e ON e.automation_id = a.id
        WHERE a.workspace_id = :workspace_id
        GROUP BY a.id
        ORDER BY a.created_at DESC
    """, values={"workspace_id": workspace_id})
    return {"automations": [dict(r) for r in rows]}


# POST create automation
@router.post("/")
async def create_automation(data: AutomationCreate):
    automation_id = str(uuid.uuid4())
    await database.execute("""
        INSERT INTO automations
        (id, workspace_id, name, trigger_type, trigger_board_id,
         trigger_config, condition_config, action_type, action_board_id, action_config)
        VALUES
        (:id, :workspace_id, :name, :trigger_type, :trigger_board_id,
         :trigger_config, :condition_config, :action_type, :action_board_id, :action_config)
    """, values={
        "id":               automation_id,
        "workspace_id":     data.workspace_id,
        "name":             data.name,
        "trigger_type":     data.trigger_type,
        "trigger_board_id": data.trigger_board_id,
        "trigger_config":   json.dumps(data.trigger_config),
        "condition_config": json.dumps(data.condition_config) if data.condition_config else None,
        "action_type":      data.action_type,
        "action_board_id":  data.action_board_id,
        "action_config":    json.dumps(data.action_config),
    })

    await register_auto_webhook(automation_id, data.workspace_id, data.trigger_type, data.trigger_board_id)

    row = await database.fetch_one("SELECT * FROM automations WHERE id = :id", values={"id": automation_id})
    return {"automation": dict(row), "message": "Created successfully"}


# PUT update existing automation
@router.put("/{automation_id}")
async def update_automation(automation_id: str, data: AutomationCreate):
    existing = await database.fetch_one("SELECT * FROM automations WHERE id = :id", values={"id": automation_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Automation not found")

    await database.execute("""
        UPDATE automations SET
            name             = :name,
            trigger_type     = :trigger_type,
            trigger_board_id = :trigger_board_id,
            trigger_config   = :trigger_config,
            condition_config = :condition_config,
            action_type      = :action_type,
            action_board_id  = :action_board_id,
            action_config    = :action_config
        WHERE id = :id
    """, values={
        "id":               automation_id,
        "name":             data.name,
        "trigger_type":     data.trigger_type,
        "trigger_board_id": data.trigger_board_id,
        "trigger_config":   json.dumps(data.trigger_config),
        "condition_config": json.dumps(data.condition_config) if data.condition_config else None,
        "action_type":      data.action_type,
        "action_board_id":  data.action_board_id,
        "action_config":    json.dumps(data.action_config),
    })

    # Re-register webhook if trigger changed
    if str(existing["trigger_board_id"]) != str(data.trigger_board_id) or \
       str(existing["trigger_type"])     != str(data.trigger_type):
        old_whs = await database.fetch_all(
            "SELECT * FROM webhook_subscriptions WHERE automation_id = :id",
            values={"id": automation_id}
        )
        try:
            token = await get_token(data.workspace_id)
            for wh in old_whs:
                await delete_webhook(wh["monday_webhook_id"], token)
        except Exception as e:
            print(f"⚠️ Old webhook delete failed: {e}")

        await database.execute("DELETE FROM webhook_subscriptions WHERE automation_id = :id", values={"id": automation_id})
        await register_auto_webhook(automation_id, data.workspace_id, data.trigger_type, data.trigger_board_id)

    row = await database.fetch_one("SELECT * FROM automations WHERE id = :id", values={"id": automation_id})
    return {"automation": dict(row), "message": "Updated successfully"}


# PATCH toggle active/pause
@router.patch("/{automation_id}")
async def toggle_automation(automation_id: str, payload: dict):
    if "is_active" not in payload:
        raise HTTPException(status_code=400, detail="Nothing to update")
    row = await database.fetch_one(
        "UPDATE automations SET is_active = :is_active WHERE id = :id RETURNING *",
        values={"is_active": payload["is_active"], "id": automation_id}
    )
    if not row:
        raise HTTPException(status_code=404, detail="Automation not found")
    return {"automation": dict(row)}


# DELETE automation
@router.delete("/{automation_id}")
async def delete_automation(automation_id: str):
    auto = await database.fetch_one("SELECT * FROM automations WHERE id = :id", values={"id": automation_id})
    if not auto:
        raise HTTPException(status_code=404, detail="Not found")

    webhooks = await database.fetch_all("SELECT * FROM webhook_subscriptions WHERE automation_id = :id", values={"id": automation_id})
    if webhooks:
        try:
            token = await get_token(auto["workspace_id"])
            for wh in webhooks:
                await delete_webhook(wh["monday_webhook_id"], token)
        except Exception as e:
            print(f"⚠️ Webhook delete failed: {e}")

    await database.execute("DELETE FROM automations WHERE id = :id", values={"id": automation_id})
    return {"deleted": True, "id": automation_id}


# GET logs
@router.get("/{automation_id}/logs")
async def get_logs(automation_id: str):
    rows = await database.fetch_all("""
        SELECT * FROM execution_logs
        WHERE automation_id = :automation_id
        ORDER BY triggered_at DESC LIMIT 20
    """, values={"automation_id": automation_id})
    return {"logs": [dict(r) for r in rows]}