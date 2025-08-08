#!/usr/bin/env node

/**
 * ShellCheck to SARIF Converter
 * 
 * Converts ShellCheck JSON output to SARIF v2.1.0 format for GitHub Code Scanning integration.
 * 
 * Usage: node scripts/shellcheck-to-sarif.cjs <input-json-file> <output-sarif-file>
 */

const fs = require('fs');
const path = require('path');

function convertShellCheckToSarif(shellCheckResults) {
  const sarif = {
    "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    "version": "2.1.0",
    "runs": [
      {
        "tool": {
          "driver": {
            "name": "ShellCheck",
            "version": "0.10.0",
            "informationUri": "https://github.com/koalaman/shellcheck",
            "shortDescription": {
              "text": "A shell script static analysis tool"
            },
            "fullDescription": {
              "text": "ShellCheck finds bugs in your shell scripts"
            },
            "rules": []
          }
        },
        "results": []
      }
    ]
  };

  const run = sarif.runs[0];
  const ruleMap = new Map();

  // Process each ShellCheck result
  for (const issue of shellCheckResults) {
    const ruleId = `SC${issue.code}`;
    
    // Add rule definition if not already present
    if (!ruleMap.has(ruleId)) {
      const rule = {
        "id": ruleId,
        "name": ruleId,
        "shortDescription": {
          "text": `ShellCheck ${ruleId}`
        },
        "fullDescription": {
          "text": issue.message
        },
        "helpUri": `https://www.shellcheck.net/wiki/SC${issue.code}`,
        "defaultConfiguration": {
          "level": mapShellCheckLevelToSarif(issue.level)
        }
      };
      
      run.tool.driver.rules.push(rule);
      ruleMap.set(ruleId, rule);
    }

    // Create SARIF result
    const result = {
      "ruleId": ruleId,
      "ruleIndex": run.tool.driver.rules.findIndex(r => r.id === ruleId),
      "level": mapShellCheckLevelToSarif(issue.level),
      "message": {
        "text": issue.message
      },
      "locations": [
        {
          "physicalLocation": {
            "artifactLocation": {
              "uri": issue.file
            },
            "region": {
              "startLine": issue.line,
              "startColumn": issue.column,
              "endLine": issue.endLine || issue.line,
              "endColumn": issue.endColumn || issue.column
            }
          }
        }
      ]
    };

    // Add fix information if available
    if (issue.fix && issue.fix.replacements && issue.fix.replacements.length > 0) {
      result.fixes = [
        {
          "description": {
            "text": "ShellCheck suggested fix"
          },
          "artifactChanges": [
            {
              "artifactLocation": {
                "uri": issue.file
              },
              "replacements": issue.fix.replacements.map(replacement => ({
                "deletedRegion": {
                  "startLine": replacement.line,
                  "startColumn": replacement.column,
                  "endLine": replacement.endLine,
                  "endColumn": replacement.endColumn
                },
                "insertedContent": {
                  "text": replacement.replacement
                }
              }))
            }
          ]
        }
      ];
    }

    run.results.push(result);
  }

  return sarif;
}

/**
 * Maps ShellCheck severity levels to SARIF levels
 */
function mapShellCheckLevelToSarif(shellCheckLevel) {
  switch (shellCheckLevel.toLowerCase()) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    case 'info':
    case 'style':
      return 'note';
    default:
      return 'warning';
  }
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('Usage: node scripts/shellcheck-to-sarif.cjs <input-json-file> <output-sarif-file>');
    process.exit(1);
  }

  const [inputFile, outputFile] = args;

  try {
    // Read ShellCheck JSON results
    let shellCheckResults = [];
    
    if (fs.existsSync(inputFile)) {
      const inputContent = fs.readFileSync(inputFile, 'utf8').trim();
      
      if (inputContent) {
        try {
          // Handle multiple JSON arrays on separate lines (from multiple shellcheck runs)
          const lines = inputContent.split('\n').filter(line => line.trim());
          shellCheckResults = [];
          
          for (const line of lines) {
            if (line.trim()) {
              const parsed = JSON.parse(line.trim());
              const results = Array.isArray(parsed) ? parsed : [parsed];
              shellCheckResults.push(...results);
            }
          }
        } catch (parseError) {
          console.warn('Warning: Could not parse ShellCheck JSON, creating empty SARIF');
          console.warn('Parse error:', parseError.message);
          shellCheckResults = [];
        }
      }
    } else {
      console.warn(`Warning: Input file ${inputFile} not found, creating empty SARIF`);
    }

    // Convert to SARIF
    const sarifOutput = convertShellCheckToSarif(shellCheckResults);
    
    // Write SARIF output
    fs.writeFileSync(outputFile, JSON.stringify(sarifOutput, null, 2));
    
    const resultCount = sarifOutput.runs[0].results.length;
    const ruleCount = sarifOutput.runs[0].tool.driver.rules.length;
    
    console.log(`✅ ShellCheck SARIF conversion complete:`);
    console.log(`   📁 Input: ${inputFile}`);
    console.log(`   📁 Output: ${outputFile}`);
    console.log(`   🔍 Issues found: ${resultCount}`);
    console.log(`   📏 Rules processed: ${ruleCount}`);
    
  } catch (error) {
    console.error('❌ Error converting ShellCheck to SARIF:', error.message);
    
    // Create empty SARIF file to avoid CI failures
    const emptySarif = {
      "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
      "version": "2.1.0",
      "runs": [
        {
          "tool": {
            "driver": {
              "name": "ShellCheck",
              "version": "0.10.0",
              "informationUri": "https://github.com/koalaman/shellcheck",
              "shortDescription": {
                "text": "A shell script static analysis tool"
              }
            }
          },
          "results": []
        }
      ]
    };
    
    fs.writeFileSync(outputFile, JSON.stringify(emptySarif, null, 2));
    console.log(`📝 Created empty SARIF file: ${outputFile}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertShellCheckToSarif, mapShellCheckLevelToSarif };