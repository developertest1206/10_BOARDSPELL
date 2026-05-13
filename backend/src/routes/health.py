from fastapi import APIRouter
from src.models.db import database

router = APIRouter()


@router.post("/check-boards")
async def check_deleted_boards():
    """
    Check all active automations — pause any whose trigger
    board no longer exists in the workspace
    """
    paused = []

    automations = await database.fetch_all("""
        SELECT a.id, a.trigger_board_id, a.workspace_id, w.access_token
        FROM automations a
        JOIN workspaces w ON w.workspace_id = a.workspace_id
        WHERE a.is_active = TRUE
    """)

    from src.services.monday_api import get_boards
    workspace_boards: dict = {}

    for auto in automations:
        auto         = dict(auto)
        workspace_id = auto["workspace_id"]

        if workspace_id not in workspace_boards:
            try:
                boards = await get_boards(auto["access_token"])
                workspace_boards[workspace_id] = [b["id"] for b in boards]
            except Exception:
                workspace_boards[workspace_id] = []

        board_ids = workspace_boards.get(workspace_id, [])

        if auto["trigger_board_id"] not in board_ids:
            await database.execute(
                "UPDATE automations SET is_active = FALSE WHERE id = :id",
                values={"id": auto["id"]}
            )
            paused.append(auto["id"])
            print(f"⏸ Auto-paused: {auto['id']} — board {auto['trigger_board_id']} not found")

    return {"paused_count": len(paused), "paused_ids": paused}


@router.post("/check-tokens")
async def check_revoked_tokens():
    """
    Check all workspaces — pause all automations
    for any workspace with a revoked token
    """
    paused_workspaces = []

    workspaces = await database.fetch_all("SELECT * FROM workspaces")

    from src.services.monday_api import monday_query
    for ws in workspaces:
        ws = dict(ws)
        try:
            await monday_query(
                "query { users(limit:1) { id } }",
                {},
                ws["access_token"]
            )
        except Exception as e:
            if "unauthorized" in str(e).lower():
                await database.execute("""
                    UPDATE automations SET is_active = FALSE
                    WHERE workspace_id = :workspace_id
                """, values={"workspace_id": ws["workspace_id"]})
                paused_workspaces.append(ws["workspace_id"])
                print(f"⏸ Token revoked for workspace {ws['workspace_id']}")

    return {"revoked_workspaces": paused_workspaces}