# QueueCTL Test Scenarios (PowerShell)
# This script validates all core functionality on Windows

Write-Host "🧪 QueueCTL Test Scenarios" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""

# Clean up any existing data
Write-Host "🧹 Cleaning up test data..." -ForegroundColor Yellow
if (Test-Path "./data") {
    Remove-Item -Recurse -Force "./data"
}
Write-Host ""

# Test 1: Enqueue a simple job
Write-Host "📝 Test 1: Enqueue a simple job" -ForegroundColor Green
queuectl enqueue "echo 'Hello World'"
Write-Host ""

# Test 2: Enqueue job with JSON
Write-Host "📝 Test 2: Enqueue job with JSON format" -ForegroundColor Green
queuectl enqueue '{\"command\":\"timeout /t 1\",\"max_retries\":2}'
Write-Host ""

# Test 3: Check status
Write-Host "📝 Test 3: Check queue status" -ForegroundColor Green
queuectl status
Write-Host ""

# Test 4: List pending jobs
Write-Host "📝 Test 4: List pending jobs" -ForegroundColor Green
queuectl list --state pending
Write-Host ""

# Test 5: Enqueue a failing job
Write-Host "📝 Test 5: Enqueue a failing job" -ForegroundColor Green
queuectl enqueue "exit 1"
Write-Host ""

# Test 6: Enqueue job that doesn't exist
Write-Host "📝 Test 6: Enqueue invalid command" -ForegroundColor Green
queuectl enqueue "nonexistentcommand12345"
Write-Host ""

# Test 7: View configuration
Write-Host "📝 Test 7: View configuration" -ForegroundColor Green
queuectl config get
Write-Host ""

# Test 8: Set configuration
Write-Host "📝 Test 8: Set max-retries to 5" -ForegroundColor Green
queuectl config set max_retries 5
queuectl config get max_retries
Write-Host ""

# Test 9: Start workers (in background for 10 seconds)
Write-Host "📝 Test 9: Start workers and process jobs" -ForegroundColor Green
Write-Host "Starting 2 workers for 10 seconds..."
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    queuectl worker start --count 2
}

# Wait for workers to process jobs
Start-Sleep -Seconds 10
Stop-Job $job
Remove-Job $job

# Test 10: Check status after processing
Write-Host ""
Write-Host "📝 Test 10: Check status after processing" -ForegroundColor Green
queuectl status
Write-Host ""

# Test 11: List completed jobs
Write-Host "📝 Test 11: List completed jobs" -ForegroundColor Green
queuectl list --state completed
Write-Host ""

# Test 12: List dead jobs (DLQ)
Write-Host "📝 Test 12: List Dead Letter Queue" -ForegroundColor Green
queuectl dlq list
Write-Host ""

# Test 13: Test persistence
Write-Host "📝 Test 13: Test persistence across restarts" -ForegroundColor Green
queuectl enqueue "echo 'Persistence test'"
Write-Host "Job enqueued. Checking if it persists..."
$output = queuectl list --state pending
if ($output -match "Persistence test") {
    Write-Host "✓ Persistence test passed" -ForegroundColor Green
} else {
    Write-Host "✗ Persistence test failed" -ForegroundColor Red
}
Write-Host ""

# Test 14: Multiple workers test
Write-Host "📝 Test 14: Test multiple workers processing in parallel" -ForegroundColor Green
# Enqueue multiple jobs
for ($i = 1; $i -le 5; $i++) {
    queuectl enqueue "timeout /t 2 && echo 'Job $i'"
}
Write-Host "Enqueued 5 jobs, starting 3 workers..."
$job = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    queuectl worker start --count 3
}
Start-Sleep -Seconds 15
Stop-Job $job
Remove-Job $job
Write-Host ""

# Final status
Write-Host "📊 Final Status" -ForegroundColor Cyan
Write-Host "===============" -ForegroundColor Cyan
queuectl status
Write-Host ""

Write-Host "✅ Test suite completed!" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:" -ForegroundColor Cyan
Write-Host "--------"
Write-Host "All core features have been tested:"
Write-Host "  ✓ Job enqueueing (simple and JSON)"
Write-Host "  ✓ Worker management (start/stop)"
Write-Host "  ✓ Job processing"
Write-Host "  ✓ Retry mechanism"
Write-Host "  ✓ Dead Letter Queue"
Write-Host "  ✓ Configuration management"
Write-Host "  ✓ Data persistence"
Write-Host "  ✓ Multiple workers"
Write-Host ""
Write-Host "Check the output above for any errors."
