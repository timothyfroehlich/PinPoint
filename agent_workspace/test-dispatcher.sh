#!/bin/bash

# Test script to validate the generic dispatcher logic
echo "=== Testing Agent Task Dispatcher ==="
echo ""

echo "Available task files in agent_workspace/:"
ls -1 *.md | grep -v SUBAGENT_TASK

echo ""
echo "=== Testing Agent Type Discovery ==="

# Test 1: Implementation Agent
echo "1. Testing Implementation Agent pattern (implement-*-task.md):"
IMPL_TASK=$(ls implement-*-task.md 2>/dev/null | head -1)
if [ -n "$IMPL_TASK" ]; then
    echo "   ✅ Found: $IMPL_TASK"
else
    echo "   ❌ No implement-*-task.md found"
fi

# Test 2: Fix Agent  
echo "2. Testing Fix Agent pattern (fix-*-task.md):"
FIX_TASK=$(ls fix-*-task.md 2>/dev/null | head -1)
if [ -n "$FIX_TASK" ]; then
    echo "   ✅ Found: $FIX_TASK"
else
    echo "   ❌ No fix-*-task.md found"
fi

# Test 3: Test Agent
echo "3. Testing Test Agent pattern (test-*-task.md):"
TEST_TASK=$(ls test-*-task.md 2>/dev/null | head -1)
if [ -n "$TEST_TASK" ]; then
    echo "   ✅ Found: $TEST_TASK"
else
    echo "   ❌ No test-*-task.md found"
fi

# Test 4: Simple task fallback
echo "4. Testing Simple Task fallback (simple-task.md):"
if [ -f "simple-task.md" ]; then
    echo "   ✅ Found: simple-task.md"
else
    echo "   ❌ No simple-task.md found (this is normal - created by orchestrator)"
fi

echo ""
echo "=== Dispatcher Logic Test ==="
echo "If I were an Implementation Agent, I would use: $IMPL_TASK"
echo "If I were a Fix Agent, I would use: $FIX_TASK"
echo "If no specific pattern matched, I would look for: simple-task.md"

echo ""
echo "=== Testing Task File Content Access ==="
if [ -n "$IMPL_TASK" ]; then
    echo "First few lines of Implementation Agent task:"
    head -5 "$IMPL_TASK"
fi