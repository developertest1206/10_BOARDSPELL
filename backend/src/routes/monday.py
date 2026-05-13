from fastapi import APIRouter, HTTPException
from src.models.db import database
from src.services.monday_api import (
    monday_query,
    get_boards,
    get_board_columns,
    get_board_groups,
    get_users,
    get_board_items,
    get_status_column_settings,
)

router = APIRouter()


async def get_token(workspace_id: str) -> str:
    row = await database.fetch_one(
        "SELECT access_token FROM workspaces WHERE workspace_id = :id",
        values={"id": workspace_id}
    )
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"Workspace '{workspace_id}' not found. Please authenticate first via /oauth/start"
        )
    return row["access_token"]


@router.get("/boards/{workspace_id}")
async def fetch_boards(workspace_id: str):
    try:
        token  = await get_token(workspace_id)
        boards = await get_boards(token)
        # Filter out subitem boards
        boards = [b for b in boards if "Subitems" not in b.get("name", "")]
        return {"boards": boards}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/columns/{workspace_id}/{board_id}")
async def fetch_columns(workspace_id: str, board_id: str):
    try:
        token   = await get_token(workspace_id)
        columns = await get_board_columns(board_id, token)
        # Filter useful column types
        useful  = ["status", "date", "people", "text", "numbers", "dropdown", "color"]
        columns = [c for c in columns if c["type"] in useful or c["id"] == "name"]
        return {"columns": columns}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/groups/{workspace_id}/{board_id}")
async def fetch_groups(workspace_id: str, board_id: str):
    try:
        token  = await get_token(workspace_id)
        groups = await get_board_groups(board_id, token)
        return {"groups": groups}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/users/{workspace_id}")
async def fetch_users(workspace_id: str):
    try:
        token = await get_token(workspace_id)
        users = await get_users(token)
        return {"users": users}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/items/{workspace_id}/{board_id}")
async def fetch_items(workspace_id: str, board_id: str):
    try:
        token = await get_token(workspace_id)
        items = await get_board_items(board_id, token)
        return {"items": items}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status-labels/{workspace_id}/{board_id}/{column_id}")
async def fetch_status_labels(workspace_id: str, board_id: str, column_id: str):
    """Get all possible label values for a status column"""
    try:
        token  = await get_token(workspace_id)
        labels = await get_status_column_settings(board_id, column_id, token)
        return {"labels": labels}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/run-date-triggers/{workspace_id}")
async def run_date_triggers_now(workspace_id: str):
    """Manually run date trigger check"""
    try:
        from src.workers.cron_worker import run_date_triggers
        await run_date_triggers()
        return {"status": "✅ Date trigger check completed"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))