#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

cleanup() {
    echo ""
    echo -e "${CYAN}Shutting down...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    wait $BACKEND_PID 2>/dev/null || true
    wait $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}All services stopped.${NC}"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Kill any process currently listening on the given port
kill_port() {
    local port=$1
    local pids=""

    case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*)
            # Windows (Git Bash): parse netstat for LISTENING sockets on the port
            pids=$(netstat -ano 2>/dev/null | tr -d '\r' \
                | awk -v p=":$port" '$1=="TCP" && $2 ~ p"$" && $4=="LISTENING" {print $5}' \
                | sort -u)
            for pid in $pids; do
                [ "$pid" = "0" ] && continue
                echo -e "${RED}Port $port in use by PID $pid - killing...${NC}"
                taskkill //F //T //PID "$pid" >/dev/null 2>&1 || true
            done
            ;;
        *)
            if command -v lsof >/dev/null 2>&1; then
                pids=$(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null || true)
            elif command -v fuser >/dev/null 2>&1; then
                pids=$(fuser "$port"/tcp 2>/dev/null || true)
            fi
            for pid in $pids; do
                echo -e "${RED}Port $port in use by PID $pid - killing...${NC}"
                kill -9 "$pid" 2>/dev/null || true
            done
            ;;
    esac

    [ -n "$pids" ] && sleep 1
    return 0
}

kill_port 3010
kill_port 3009

# Check dependencies
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
    echo -e "${CYAN}Installing backend dependencies...${NC}"
    cd "$BACKEND_DIR" && npm install
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    echo -e "${CYAN}Installing frontend dependencies...${NC}"
    cd "$FRONTEND_DIR" && npm install
fi

echo -e "${GREEN}Starting backend on port 3010...${NC}"
cd "$BACKEND_DIR" && node server.js &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 2

echo -e "${GREEN}Starting frontend on port 3009...${NC}"
cd "$FRONTEND_DIR" && npx vite --host &
FRONTEND_PID=$!

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${GREEN}  Backend:  http://localhost:3010${NC}"
echo -e "${GREEN}  Frontend: http://localhost:3009${NC}"
echo -e "${CYAN}========================================${NC}"
echo -e "Press ${RED}Ctrl+C${NC} to stop all services."
echo ""

# Wait for both processes
wait
