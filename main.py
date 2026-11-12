import asyncio
import random
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Universe Simulator Telemetry & ML Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MLAnomalyDetector:
    """Simulates a lightweight machine learning anomaly detection model."""
    def __init__(self):
        self.threshold = 27.5

    def evaluate(self, hull_temp: float, radiation: float) -> str:
        # Simple threshold/isolation forest heuristic evaluation
        if hull_temp > self.threshold or radiation > 0.14:
            return "⚠️ THERMAL/RADIATION ANOMALY DETECTED"
        return "NOMINAL"

detector = MLAnomalyDetector()

@app.websocket("/ws/telemetry")
async def telemetry_websocket(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Generate simulated spacecraft telemetry stream
            hull_temp = round(24.0 + random.uniform(0.0, 5.0), 1)
            radiation = round(0.10 + random.uniform(0.0, 0.06), 2)
            status = detector.evaluate(hull_temp, radiation)

            payload = {
                "hullTemp": hull_temp,
                "radiation": radiation,
                "status": status
            }

            await websocket.send_json(payload)
            await asyncio.sleep(2) # Stream every 2 seconds
    except WebSocketDisconnect:
        print("Client disconnected from telemetry stream")