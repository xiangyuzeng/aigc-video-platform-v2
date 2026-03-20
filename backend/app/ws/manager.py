from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, task_id: int, status: str, progress: int, error: str | None = None):
        message = json.dumps({
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "error": error,
        })
        dead = []
        for conn in self.connections:
            try:
                await conn.send_text(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            if d in self.connections:
                self.connections.remove(d)

    async def broadcast_pipeline(
        self,
        run_id: int,
        status: str,
        stage: str,
        progress: int,
        error: str | None = None,
    ):
        message = json.dumps({
            "type": "pipeline",
            "run_id": run_id,
            "status": status,
            "stage": stage,
            "progress": progress,
            "error": error,
        })
        dead = []
        for conn in self.connections:
            try:
                await conn.send_text(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            if d in self.connections:
                self.connections.remove(d)


ws_manager = ConnectionManager()
