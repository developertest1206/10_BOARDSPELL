import asyncio, json, uuid, os
from datetime import date
from dotenv import load_dotenv
from src.models.db import database, connect_db
from src.services.monday_api import monday_query, change_column_value, send_notification, assign_person

load_dotenv()


async def run_date_triggers():
    print("⏰ Running date trigger check...")
    from datetime import date, datetime

    today            = date.today().isoformat()          # 2026-05-13
    today_formatted  = date.today().strftime("%Y-%m-%d") # 2026-05-13
    today_us         = date.today().strftime("%-m/%-d/%Y") if os.name != 'nt' else date.today().strftime("%#m/%#d/%Y")  # 5/13/2026

    print(f"📅 Checking for dates matching: {today}")

    automations = await database.fetch_all("""
        SELECT a.*, w.access_token FROM automations a
        JOIN workspaces w ON w.workspace_id = a.workspace_id
        WHERE a.trigger_type = 'date_reached' AND a.is_active = TRUE
    """)

    print(f"📅 Found {len(automations)} date automation(s)")

    for auto in automations:
        auto        = dict(auto)
        trigger_cfg = auto["trigger_config"] if isinstance(auto["trigger_config"], dict) else json.loads(auto["trigger_config"])
        action_cfg  = auto["action_config"]  if isinstance(auto["action_config"],  dict) else json.loads(auto["action_config"])
        column_id   = trigger_cfg.get("column_id")

        print(f"⚙️  Checking automation: {auto['name']} — column: {column_id}")

        try:
            query = """
                query($boardId: ID!) {
                    boards(ids: [$boardId]) {
                        items_page(limit: 200) {
                            items {
                                id
                                name
                                column_values { id text value }
                            }
                        }
                    }
                }
            """
            data  = await monday_query(query, {"boardId": auto["trigger_board_id"]}, auto["access_token"])
            items = data["boards"][0]["items_page"]["items"]

            for item in items:
                date_col = next((cv for cv in item["column_values"] if cv["id"] == column_id), None)
                if not date_col:
                    continue

                date_text  = date_col.get("text", "") or ""
                date_value = date_col.get("value", "") or ""

                print(f"   Item: {item['name']} → date text='{date_text}' value='{date_value}'")

                # Check multiple formats
                matched = (
                    date_text  == today         or
                    date_text  == today_us      or
                    today      in date_value    or
                    date_text  == date.today().strftime("%b %d, %Y")
                )

                if not matched:
                    continue

                # Check not already fired today
                already = await database.fetch_one("""
                    SELECT id FROM execution_logs
                    WHERE automation_id = :auto_id
                      AND status = 'success'
                      AND DATE(triggered_at) = CURRENT_DATE
                """, values={"auto_id": auto["id"]})

                if already:
                    print(f"   ⏭️ Already fired today for {item['name']}")
                    continue

                print(f"   ✅ Date MATCHED! Firing action for: {item['name']}")
                await fire_date_action(auto, action_cfg, item["id"])

        except Exception as e:
            import traceback
            print(f"❌ Error: {traceback.format_exc()}")

async def fire_date_action(auto: dict, action_cfg: dict, item_id: str):
    action_type  = auto["action_type"]
    access_token = auto["access_token"]
    log_status   = "success"
    log_error    = None

    try:
        if action_type == "change_column":
            await change_column_value(
                auto["action_board_id"], action_cfg["target_item_id"],
                action_cfg["column_id"], json.dumps({"label": action_cfg.get("value", "")}),
                access_token
            )
        elif action_type == "assign_person":
            await assign_person(
                auto["action_board_id"], action_cfg["target_item_id"],
                action_cfg["column_id"], action_cfg["user_id"], access_token
            )
        elif action_type == "send_notification":
            for uid in action_cfg.get("user_ids", []):
                await send_notification(uid, item_id, action_cfg.get("message", "Date trigger fired"), access_token)
    except Exception as e:
        log_status = "failed"
        log_error  = str(e)

    await database.execute("""
        INSERT INTO execution_logs
        (id, automation_id, trigger_payload, action_taken, status, error_message)
        VALUES (:id, :automation_id, :trigger_payload, :action_taken, :status, :error_message)
    """, values={
        "id":              str(uuid.uuid4()),
        "automation_id":   auto["id"],
        "trigger_payload": json.dumps({"type": "date_reached", "item_id": item_id}),
        "action_taken":    json.dumps(action_cfg),
        "status":          log_status,
        "error_message":   log_error,
    })


async def run_cron():
    await connect_db()
    print("⏰ CRON worker started")
    while True:
        await run_date_triggers()
        print("😴 Sleeping 24 hours...")
        await asyncio.sleep(86400)


if __name__ == "__main__":
    asyncio.run(run_cron())