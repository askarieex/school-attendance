#!/bin/bash

# 🌍 ZKTeco K40 Pro - Timezone Setup Script
# Quick command-line tool to configure device timezone permanently

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3001}"
API_VERSION="${API_VERSION:-v1}"

# Print banner
echo -e "${BLUE}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       🌍 ZKTeco K40 Pro - Timezone Setup Tool             ║"
echo "║       Permanently configure device timezone (IST)          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo -e "${RED}❌ Error: curl is not installed${NC}"
    echo "Please install curl: brew install curl (macOS) or apt-get install curl (Linux)"
    exit 1
fi

# Check if jq is available (optional, for pretty JSON)
JQ_AVAILABLE=0
if command -v jq &> /dev/null; then
    JQ_AVAILABLE=1
fi

# Function to print JSON nicely
print_json() {
    if [ $JQ_AVAILABLE -eq 1 ]; then
        echo "$1" | jq '.'
    else
        echo "$1"
    fi
}

# Function to list devices
list_devices() {
    echo -e "${BLUE}📋 Fetching available devices...${NC}"

    response=$(curl -s "${API_BASE_URL}/api/${API_VERSION}/test/devices")

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to fetch devices${NC}"
        echo "Make sure the backend server is running on ${API_BASE_URL}"
        exit 1
    fi

    echo ""
    print_json "$response"
    echo ""
}

# Function to setup timezone
setup_timezone() {
    local device_id=$1
    local timezone=${2:-+0530}

    echo -e "${PURPLE}🌍 Setting up timezone for device ${device_id}...${NC}"
    echo "   Timezone: ${timezone}"
    echo "   This will:"
    echo "   1. Set timezone offset to ${timezone}"
    echo "   2. Disable DST (prevent time jumps)"
    echo "   3. Save to flash memory (survive reboot)"
    echo ""

    response=$(curl -s -X POST "${API_BASE_URL}/api/${API_VERSION}/test/timezone/setup/${device_id}" \
        -H "Content-Type: application/json" \
        -d "{\"timezone\": \"${timezone}\"}")

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to setup timezone${NC}"
        exit 1
    fi

    # Check if response contains "success":true
    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ Timezone setup commands queued successfully!${NC}"
        echo ""
        print_json "$response"
        echo ""
        echo -e "${YELLOW}⏳ Please wait 90 seconds for device to execute all commands...${NC}"
        echo ""
    else
        echo -e "${RED}❌ Setup failed:${NC}"
        print_json "$response"
        exit 1
    fi
}

# Function to verify timezone
verify_timezone() {
    local device_id=$1

    echo -e "${BLUE}🔍 Verifying timezone for device ${device_id}...${NC}"

    response=$(curl -s -X POST "${API_BASE_URL}/api/${API_VERSION}/test/timezone/verify/${device_id}")

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to verify timezone${NC}"
        exit 1
    fi

    echo ""
    print_json "$response"
    echo ""
    echo -e "${YELLOW}⏳ Watch backend console logs for device response...${NC}"
    echo "   Look for: 🌍 ========== DEVICE TIMEZONE REPORT =========="
    echo ""
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  list                          List all devices"
    echo "  setup <device_id> [timezone]  Setup timezone (default: +0530)"
    echo "  verify <device_id>            Verify timezone configuration"
    echo "  help                          Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 list"
    echo "  $0 setup 1"
    echo "  $0 setup 1 +0530"
    echo "  $0 verify 1"
    echo ""
    echo "Timezone formats:"
    echo "  +0530  India (IST)"
    echo "  +0545  Nepal"
    echo "  +0600  Bangladesh"
    echo "  +0500  Pakistan"
    echo "  -0500  USA (EST)"
    echo ""
}

# Main script logic
main() {
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi

    command=$1

    case $command in
        list)
            list_devices
            ;;
        setup)
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Error: Device ID is required${NC}"
                echo "Usage: $0 setup <device_id> [timezone]"
                exit 1
            fi
            setup_timezone "$2" "${3:-+0530}"
            ;;
        verify)
            if [ -z "$2" ]; then
                echo -e "${RED}❌ Error: Device ID is required${NC}"
                echo "Usage: $0 verify <device_id>"
                exit 1
            fi
            verify_timezone "$2"
            ;;
        help|--help|-h)
            show_usage
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $command${NC}"
            echo ""
            show_usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
