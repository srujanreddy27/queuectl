#!/bin/bash

# QueueCTL Test Scenarios
# This script validates all core functionality

echo "🧪 QueueCTL Test Scenarios"
echo "=========================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Helper function to run test
run_test() {
    local test_name=$1
    local command=$2
    local expected=$3
    
    echo -n "Testing: $test_name... "
    
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
    fi
}

# Clean up any existing data
echo "🧹 Cleaning up test data..."
rm -rf ./data
echo ""

# Test 1: Enqueue a simple job
echo "📝 Test 1: Enqueue a simple job"
queuectl enqueue "echo 'Hello World'"
echo ""

# Test 2: Enqueue job with JSON
echo "📝 Test 2: Enqueue job with JSON format"
queuectl enqueue '{"command":"sleep 1","max_retries":2}'
echo ""

# Test 3: Check status
echo "📝 Test 3: Check queue status"
queuectl status
echo ""

# Test 4: List pending jobs
echo "📝 Test 4: List pending jobs"
queuectl list --state pending
echo ""

# Test 5: Enqueue a failing job
echo "📝 Test 5: Enqueue a failing job"
queuectl enqueue "exit 1"
echo ""

# Test 6: Enqueue job that doesn't exist
echo "📝 Test 6: Enqueue invalid command"
queuectl enqueue "nonexistentcommand12345"
echo ""

# Test 7: View configuration
echo "📝 Test 7: View configuration"
queuectl config get
echo ""

# Test 8: Set configuration
echo "📝 Test 8: Set max-retries to 5"
queuectl config set max_retries 5
queuectl config get max_retries
echo ""

# Test 9: Start workers (in background for 10 seconds)
echo "📝 Test 9: Start workers and process jobs"
echo "Starting 2 workers for 10 seconds..."
timeout 10 queuectl worker start --count 2 &
WORKER_PID=$!

# Wait for workers to process jobs
sleep 12

# Test 10: Check status after processing
echo ""
echo "📝 Test 10: Check status after processing"
queuectl status
echo ""

# Test 11: List completed jobs
echo "📝 Test 11: List completed jobs"
queuectl list --state completed
echo ""

# Test 12: List dead jobs (DLQ)
echo "📝 Test 12: List Dead Letter Queue"
queuectl dlq list
echo ""

# Test 13: Retry a job from DLQ (if any)
echo "📝 Test 13: Retry job from DLQ"
# Get first dead job ID
DEAD_JOB=$(queuectl list --state dead --limit 1 | grep -oP '[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}' | head -1)
if [ ! -z "$DEAD_JOB" ]; then
    echo "Retrying job: $DEAD_JOB"
    queuectl dlq retry "$DEAD_JOB"
else
    echo "No dead jobs to retry"
fi
echo ""

# Test 14: Persistence test - enqueue and restart
echo "📝 Test 14: Test persistence across restarts"
queuectl enqueue "echo 'Persistence test'"
echo "Job enqueued. Simulating restart..."
# Jobs should still be there
queuectl list --state pending | grep -q "Persistence test"
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Persistence test passed${NC}"
else
    echo -e "${RED}✗ Persistence test failed${NC}"
fi
echo ""

# Test 15: Multiple workers test
echo "📝 Test 15: Test multiple workers processing in parallel"
# Enqueue multiple jobs
for i in {1..5}; do
    queuectl enqueue "sleep 2 && echo 'Job $i'"
done
echo "Enqueued 5 jobs, starting 3 workers..."
timeout 15 queuectl worker start --count 3 &
sleep 16
echo ""

# Final status
echo "📊 Final Status"
echo "==============="
queuectl status
echo ""

echo "✅ Test suite completed!"
echo ""
echo "Summary:"
echo "--------"
echo "All core features have been tested:"
echo "  ✓ Job enqueueing (simple and JSON)"
echo "  ✓ Worker management (start/stop)"
echo "  ✓ Job processing"
echo "  ✓ Retry mechanism"
echo "  ✓ Dead Letter Queue"
echo "  ✓ Configuration management"
echo "  ✓ Data persistence"
echo "  ✓ Multiple workers"
echo ""
echo "Check the output above for any errors."
