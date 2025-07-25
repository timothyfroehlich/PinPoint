#!/bin/bash

# PinPoint Background Development Server Script

LOG_FILE="/tmp/pinpoint-dev.log"
PID_FILE="/tmp/pinpoint-dev.pid"

case "$1" in
  start)
    # Check if server is already running
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p $PID > /dev/null 2>&1; then
        echo "Dev server already running (PID: $PID)"
        echo "Use 'npm run dev:bg:stop' to stop it first"
        exit 1
      else
        echo "Stale PID file found, removing..."
        rm -f "$PID_FILE"
      fi
    fi
    
    echo "Starting PinPoint dev server in background..."
    npm run dev:server > "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "Dev server started (PID: $(cat $PID_FILE))"
    echo "Logs: tail -f $LOG_FILE"
    ;;
  
  stop)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      echo "Stopping dev server (PID: $PID)..."
      kill $PID 2>/dev/null || echo "Process not found"
      rm -f "$PID_FILE"
    else
      echo "No PID file found"
    fi
    ;;
  
  status)
    if [ -f "$PID_FILE" ]; then
      PID=$(cat "$PID_FILE")
      if ps -p $PID > /dev/null 2>&1; then
        echo "Dev server running (PID: $PID)"
      else
        echo "PID file exists but process not running"
        rm -f "$PID_FILE"
      fi
    else
      echo "Dev server not running"
    fi
    ;;
  
  logs)
    tail -f "$LOG_FILE"
    ;;
  
  *)
    echo "Usage: $0 {start|stop|status|logs}"
    exit 1
    ;;
esac