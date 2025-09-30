#!/bin/bash

###############################################################################
# RAGFlow Local Build and Run Script
#
# This script builds RAGFlow from local source code and starts all services
# using Docker Compose.
#
# Usage:
#   ./build-and-run.sh [options]
#
# Options:
#   --build-only      Only build the image, don't start services
#   --no-cache        Build without using Docker cache
#   --slim            Build slim version (without embedding models)
#   --full            Build full version (with embedding models)
#   --gpu             Use GPU compose file
#   --rebuild         Rebuild and restart (stop, build, start)
#   --clean           Clean up old containers and volumes before starting
#   --help            Show this help message
#
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
BUILD_ONLY=false
NO_CACHE=false
LIGHTEN=0
USE_GPU=false
REBUILD=false
CLEAN=false
IMAGE_TAG="ragflow-local:latest"
COMPOSE_FILE="docker/docker-compose.yml"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --build-only)
            BUILD_ONLY=true
            shift
            ;;
        --no-cache)
            NO_CACHE=true
            shift
            ;;
        --slim)
            LIGHTEN=1
            IMAGE_TAG="ragflow-local:slim"
            shift
            ;;
        --full)
            LIGHTEN=0
            IMAGE_TAG="ragflow-local:full"
            shift
            ;;
        --gpu)
            USE_GPU=true
            COMPOSE_FILE="docker/docker-compose-gpu.yml"
            shift
            ;;
        --rebuild)
            REBUILD=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        --help)
            grep "^#" "$0" | grep -v "^#!/" | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                RAGFlow Local Build and Run Script                  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker is running${NC}"

# Check if docker-compose is available
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker Compose is available${NC}"
echo ""

# Clean up if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}► Cleaning up old containers and volumes...${NC}"
    cd docker
    docker compose down -v 2>/dev/null || true
    cd ..
    echo -e "${GREEN}✓ Cleanup completed${NC}"
    echo ""
fi

# Stop services if rebuild is requested
if [ "$REBUILD" = true ]; then
    echo -e "${YELLOW}► Stopping existing services...${NC}"
    cd docker
    docker compose down 2>/dev/null || true
    cd ..
    echo -e "${GREEN}✓ Services stopped${NC}"
    echo ""
fi

# Build the Docker image from local Dockerfile
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Building Docker Image from Local Source               ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Build Source:  ${GREEN}Local Dockerfile (./Dockerfile)${NC}"
echo -e "  Image Tag:     ${GREEN}${IMAGE_TAG}${NC}"
echo -e "  Build Type:    ${GREEN}$([ "$LIGHTEN" -eq 1 ] && echo "Slim (without embedding models)" || echo "Full (with embedding models)")${NC}"
echo -e "  Use Cache:     ${GREEN}$([ "$NO_CACHE" = true ] && echo "No" || echo "Yes")${NC}"
echo -e "  Build Context: ${GREEN}$(pwd)${NC}"
echo ""

BUILD_ARGS="--build-arg LIGHTEN=${LIGHTEN}"
if [ "$NO_CACHE" = true ]; then
    BUILD_ARGS="$BUILD_ARGS --no-cache"
fi

echo -e "${YELLOW}► Starting Docker build from local source code...${NC}"
echo -e "${YELLOW}  This will build RAGFlow using ./Dockerfile${NC}"
echo -e "${YELLOW}  Estimated time: 10-30 minutes depending on your system...${NC}"
echo ""

if docker build ${BUILD_ARGS} -t ${IMAGE_TAG} -f Dockerfile .; then
    echo ""
    echo -e "${GREEN}✓ Docker image built successfully: ${IMAGE_TAG}${NC}"
else
    echo ""
    echo -e "${RED}✗ Docker build failed${NC}"
    exit 1
fi

# Get image size
IMAGE_SIZE=$(docker images ${IMAGE_TAG} --format "{{.Size}}")
echo -e "${GREEN}  Image Size: ${IMAGE_SIZE}${NC}"
echo ""

# Exit if build-only mode
if [ "$BUILD_ONLY" = true ]; then
    echo -e "${GREEN}✓ Build completed (build-only mode)${NC}"
    echo ""
    echo -e "${YELLOW}To start services, run:${NC}"
    echo -e "  cd docker && RAGFLOW_IMAGE=${IMAGE_TAG} docker compose up -d"
    exit 0
fi

# Update .env file to use local image
echo -e "${YELLOW}► Updating docker/.env to use local image...${NC}"
if [ -f "docker/.env" ]; then
    # Backup original .env
    cp docker/.env docker/.env.backup

    # Update RAGFLOW_IMAGE in .env
    if grep -q "^RAGFLOW_IMAGE=" docker/.env; then
        sed -i.tmp "s|^RAGFLOW_IMAGE=.*|RAGFLOW_IMAGE=${IMAGE_TAG}|" docker/.env
        rm -f docker/.env.tmp
    else
        echo "RAGFLOW_IMAGE=${IMAGE_TAG}" >> docker/.env
    fi

    echo -e "${GREEN}✓ Updated docker/.env${NC}"
    echo -e "${GREEN}  Backup saved to docker/.env.backup${NC}"
else
    echo -e "${RED}✗ docker/.env file not found${NC}"
    exit 1
fi
echo ""

# Start services
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                        Starting Services                           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd docker

# Start services
echo -e "${YELLOW}► Starting Docker Compose services...${NC}"
if [ "$USE_GPU" = true ]; then
    echo -e "${YELLOW}  Using GPU compose file${NC}"
    docker compose -f docker-compose-gpu.yml up -d
else
    docker compose -f docker-compose.yml up -d
fi

# Wait for services to be ready
echo ""
echo -e "${YELLOW}► Waiting for services to be ready...${NC}"
echo -e "${YELLOW}  Checking RAGFlow server logs...${NC}"
echo ""

# Wait up to 120 seconds for the server to start
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if docker logs ragflow-server 2>&1 | grep -q "Running on all addresses"; then
        echo -e "${GREEN}✓ RAGFlow server is ready!${NC}"
        break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -ne "${YELLOW}  Waiting... ${ELAPSED}s/${TIMEOUT}s\r${NC}"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
    echo ""
    echo -e "${RED}✗ Timeout waiting for RAGFlow server${NC}"
    echo -e "${YELLOW}Check logs with: docker logs ragflow-server${NC}"
    exit 1
fi

cd ..

# Print success message
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    🎉 Deployment Successful! 🎉                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}RAGFlow is now running with your local code!${NC}"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo -e "  Web UI:      ${GREEN}http://localhost:10080${NC}"
echo -e "  HTTPS:       ${GREEN}https://localhost:10443${NC}"
echo -e "  API:         ${GREEN}http://localhost:9380${NC}"
echo -e "  MinIO:       ${GREEN}http://localhost:9001${NC}"
echo -e "  Kibana:      ${GREEN}http://localhost:6601${NC}"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo -e "  View logs:          ${GREEN}docker logs -f ragflow-server${NC}"
echo -e "  Stop services:      ${GREEN}cd docker && docker compose down${NC}"
echo -e "  Restart services:   ${GREEN}cd docker && docker compose restart${NC}"
echo -e "  View all services:  ${GREEN}docker ps${NC}"
echo ""
echo -e "${YELLOW}Modified Files:${NC}"
echo -e "  - Frontend: web/src/pages/agent/chat/knowledge-base-selector.tsx"
echo -e "  - Frontend: web/src/components/folder-upload/index.tsx"
echo -e "  - Backend:  api/apps/file_folder_app.py"
echo -e "  - Backend:  api/db/services/canvas_service.py"
echo -e "  - Backend:  agent/canvas.py"
echo -e "  - Backend:  agent/tools/retrieval.py"
echo -e "  - Database: api/db/db_models.py (auto-migration)"
echo ""
echo -e "${GREEN}✓ All modifications are included in the running container${NC}"
echo ""
