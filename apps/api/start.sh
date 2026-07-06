#!/bin/bash
# Start the RQ worker in the background
rq worker &
# Start the FastAPI server in the foreground
uvicorn main:app --host 0.0.0.0 --port $PORT
