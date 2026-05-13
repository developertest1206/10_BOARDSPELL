import httpx, os, json
from dotenv import load_dotenv

load_dotenv()
MONDAY_API_URL = "https://api.monday.com/v2"
APP_URL        = os.getenv("APP_URL")


async def monday_query(query: str, variables: dict, access_token: str):
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            MONDAY_API_URL,
            json={"query": query, "variables": variables},
            headers={
                "Authorization": access_token,
                "Content-Type":  "application/json",
                "API-Version":   "2024-01",
            },
        )
    data = response.json()
    if "errors" in data:
        raise Exception(f"Monday API error: {data['errors'][0]['message']}")
    if "data" not in data:
        raise Exception(f"Unexpected response: {data}")
    return data["data"]


async def get_boards(access_token: str):
    data = await monday_query("""
        query {
            boards(limit: 100, order_by: used_at) {
                id name description
                items_count
            }
        }
    """, {}, access_token)
    return data["boards"]


async def get_board_columns(board_id: str, access_token: str):
    data = await monday_query("""
        query($b: ID!) {
            boards(ids: [$b]) {
                columns { id title type settings_str }
            }
        }
    """, {"b": board_id}, access_token)
    return data["boards"][0]["columns"]


async def get_board_groups(board_id: str, access_token: str):
    data = await monday_query("""
        query($b: ID!) {
            boards(ids: [$b]) {
                groups { id title color position }
            }
        }
    """, {"b": board_id}, access_token)
    return data["boards"][0]["groups"]


async def get_board_items(board_id: str, access_token: str):
    data = await monday_query("""
        query($b: ID!) {
            boards(ids: [$b]) {
                items_page(limit: 200) {
                    items {
                        id name
                        group { id title }
                        column_values { id text value type }
                    }
                }
            }
        }
    """, {"b": board_id}, access_token)
    return data["boards"][0]["items_page"]["items"]


async def get_users(access_token: str):
    data = await monday_query("""
        query {
            users(kind: non_guests) {
                id name email photo_thumb
                is_admin
            }
        }
    """, {}, access_token)
    return data["users"]


async def get_item_column_values(item_id: str, access_token: str):
    """Get all column values for a specific item"""
    data = await monday_query("""
        query($itemId: ID!) {
            items(ids: [$itemId]) {
                id name
                column_values {
                    id text value type
                    ... on StatusValue { label }
                    ... on PeopleValue { persons_and_teams { id kind } }
                    ... on DateValue { date time }
                }
            }
        }
    """, {"itemId": item_id}, access_token)
    items = data.get("items", [])
    return items[0]["column_values"] if items else []


async def get_status_column_settings(board_id: str, column_id: str, access_token: str):
    """Get all possible status labels for a status column"""
    columns = await get_board_columns(board_id, access_token)
    for col in columns:
        if col["id"] == column_id and col["type"] == "status":
            try:
                settings = json.loads(col.get("settings_str", "{}"))
                labels   = settings.get("labels", {})
                return [{"index": k, "label": v} for k, v in labels.items()]
            except Exception:
                pass
    return []


async def change_column_value(board_id: str, item_id: str, column_id: str, value: str, access_token: str):
    data = await monday_query("""
        mutation($boardId: ID!, $itemId: ID!, $columnId: String!, $value: JSON!) {
            change_column_value(
                board_id:  $boardId,
                item_id:   $itemId,
                column_id: $columnId,
                value:     $value
            ) { id name }
        }
    """, {
        "boardId":  board_id,
        "itemId":   item_id,
        "columnId": column_id,
        "value":    value,
    }, access_token)
    return data["change_column_value"]


async def assign_person(board_id: str, item_id: str, column_id: str, user_id: str, access_token: str):
    value = json.dumps({"personsAndTeams": [{"id": int(user_id), "kind": "person"}]})
    return await change_column_value(board_id, item_id, column_id, value, access_token)


async def send_notification(user_id: str, target_id: str, text: str, access_token: str):
    try:
        data = await monday_query("""
            mutation($userId: ID!, $targetId: ID!, $text: String!) {
                create_notification(
                    user_id:     $userId,
                    target_id:   $targetId,
                    text:        $text,
                    target_type: Post
                ) { text }
            }
        """, {"userId": str(user_id), "targetId": str(target_id), "text": text}, access_token)
        return data["create_notification"]
    except Exception:
        data = await monday_query("""
            mutation($userId: ID!, $targetId: ID!, $text: String!) {
                create_notification(
                    user_id:     $userId,
                    target_id:   $targetId,
                    text:        $text,
                    target_type: Project
                ) { text }
            }
        """, {"userId": str(user_id), "targetId": str(target_id), "text": text}, access_token)
        return data["create_notification"]


async def register_webhook(board_id: str, event: str, access_token: str):
    webhook_url = f"{APP_URL}/webhooks/receive"
    query = f"""
        mutation {{
            create_webhook(
                board_id: {board_id},
                url: "{webhook_url}",
                event: {event}
            ) {{ id board_id }}
        }}
    """
    print(f"🔗 Registering webhook → board:{board_id} event:{event}")
    data = await monday_query(query, {}, access_token)
    return data["create_webhook"]


async def delete_webhook(webhook_id: str, access_token: str):
    data = await monday_query("""
        mutation($id: ID!) {
            delete_webhook(id: $id) { id }
        }
    """, {"id": webhook_id}, access_token)
    return data["delete_webhook"]