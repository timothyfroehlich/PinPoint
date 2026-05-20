#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

async function main() {
  let inputData = '';
  for await (const chunk of process.stdin) {
    inputData += chunk;
  }

  if (!inputData.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(inputData);
  } catch (err) {
    process.exit(0);
  }

  const conversationId = input.conversationId || '';
  const invocationNum = input.invocationNum || 1;
  const workspacePath = input.workspacePaths?.[0] || process.cwd();

  // Adapt the input JSON to match Claude hook expectations
  const claudePayload = {
    session_id: conversationId,
    // Construct a fake path to prevent subagent detection rules from firing
    transcript_path: path.join(workspacePath, `${conversationId}.jsonl`),
    cwd: workspacePath,
    hook_event_name: invocationNum === 1 ? 'SessionStart' : 'UserPromptSubmit',
    source: 'startup'
  };

  const payloadString = JSON.stringify(claudePayload);

  if (invocationNum === 1) {
    let combinedOutput = '';

    // 1. Run bd prime to get task list and guidelines
    try {
      const beadsOutput = execSync('bd prime', { 
        cwd: workspacePath,
        encoding: 'utf8' 
      }).trim();
      if (beadsOutput) {
        combinedOutput += beadsOutput + '\n\n';
      }
    } catch (err) {
      process.stderr.write(`[agy-beads-bootstrap] Error running bd prime: ${err.message}\n`);
    }

    // 2. Run huddle-session-start.sh to announce session identity
    try {
      const huddleStartScript = path.join(workspacePath, 'scripts/hooks/huddle-session-start.sh');
      const huddleOutput = execSync(`bash "${huddleStartScript}"`, {
        input: payloadString,
        cwd: workspacePath,
        encoding: 'utf8'
      }).trim();
      if (huddleOutput) {
        combinedOutput += huddleOutput;
      }
    } catch (err) {
      process.stderr.write(`[agy-beads-bootstrap] Error running huddle-session-start.sh: ${err.message}\n`);
    }

    if (combinedOutput.trim()) {
      const response = {
        injectSteps: [
          {
            userMessage: combinedOutput.trim()
          }
        ]
      };
      process.stdout.write(JSON.stringify(response));
    } else {
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
    }

  } else {
    // invocationNum > 1: Run huddle-poll.sh to fetch updates
    try {
      const huddlePollScript = path.join(workspacePath, 'scripts/hooks/huddle-poll.sh');
      const huddleOutput = execSync(`bash "${huddlePollScript}"`, {
        input: payloadString,
        cwd: workspacePath,
        encoding: 'utf8'
      }).trim();

      if (huddleOutput) {
        const response = {
          injectSteps: [
            {
              userMessage: huddleOutput
            }
          ]
        };
        process.stdout.write(JSON.stringify(response));
      } else {
        process.stdout.write(JSON.stringify({ injectSteps: [] }));
      }
    } catch (err) {
      process.stderr.write(`[agy-beads-bootstrap] Error running huddle-poll.sh: ${err.message}\n`);
      process.stdout.write(JSON.stringify({ injectSteps: [] }));
    }
  }
}

main().catch((err) => {
  process.stderr.write(`[agy-beads-bootstrap] Hook error: ${err.message}\n`);
  process.exit(0);
});
