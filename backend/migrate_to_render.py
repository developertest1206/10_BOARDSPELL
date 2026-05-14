import asyncio
import asyncpg

LOCAL_DB  = "postgresql://postgres:admin123@localhost:5432/boardspell"
RENDER_DB = "postgresql://boardspell_db_user:Gin0IToR1r4TpwdpjHwaexGZbMZh4C3l@dpg-d82mrmt0lvsc738kckh0-a.oregon-postgres.render.com/boardspell_db"

async def migrate():
    local  = await asyncpg.connect(LOCAL_DB)
    render = await asyncpg.connect(RENDER_DB)

    # Copy workspaces
    workspaces = await local.fetch("SELECT * FROM workspaces")
    for w in workspaces:
        await render.execute("""
            INSERT INTO workspaces (workspace_id, monday_account_id, access_token, created_at, plan_tier)
            VALUES ($1,$2,$3,$4,$5)
            ON CONFLICT (workspace_id) DO UPDATE SET access_token = $3
        """, w['workspace_id'], w['monday_account_id'], w['access_token'], w['created_at'], w['plan_tier'])
    print(f"✅ Copied {len(workspaces)} workspace(s)")

    # Copy automations
    automations = await local.fetch("SELECT * FROM automations")
    for a in automations:
        await render.execute("""
            INSERT INTO automations 
            (id, workspace_id, name, trigger_type, trigger_board_id,
             trigger_config, condition_config, action_type, action_board_id, 
             action_config, is_active, created_at)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
            ON CONFLICT (id) DO NOTHING
        """, a['id'], a['workspace_id'], a['name'], a['trigger_type'],
            a['trigger_board_id'], a['trigger_config'], a['condition_config'],
            a['action_type'], a['action_board_id'], a['action_config'],
            a['is_active'], a['created_at'])
    print(f"✅ Copied {len(automations)} automation(s)")

    await local.close()
    await render.close()
    print("🎉 Migration complete!")

asyncio.run(migrate())