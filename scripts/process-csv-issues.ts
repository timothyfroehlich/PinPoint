import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

interface CSVIssue {
  'Report Timestamp': string;
  'Email Address': string;
  'Game': string;
  'Severity': string;
  'Consistency': string;
  'Fix Status': string;
  'Description': string;
  'Assigned Technician': string;
  'Owner': string;
  'Work Log': string;
  'Owner Notified': string;
  'Email of owner': string;
  'Owner Comments/Plans to Address': string;
  'Last Updated': string;
}

interface ProcessedIssue {
  title: string;
  description: string;
  severity: string;
  consistency?: string;
  status: string;
  gameTitle: string;
  reporterEmail: string;
  assignedTo?: string;
  owner?: string;
  workLog?: string;
  createdAt: string;
  updatedAt: string;
}

// Load fixture data to get available games
const fixtureData = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../src/lib/pinballmap/__tests__/fixtures/api_responses/locations/location_26454_machine_details.json'),
    'utf8'
  )
);

// Create game title mapping from CSV names to fixture data
const gameTitleMappings: Record<string, string> = {};
const availableGames = new Set(fixtureData.machines.map((m: any) => m.name.toLowerCase()));

console.log('Available games in fixture data:');
fixtureData.machines.forEach((machine: any) => {
  console.log(`- ${machine.name}`);
});

// Map CSV game names to fixture names (case-insensitive matching)
const csvGameMappings: Record<string, string | null> = {
  'Ultraman': 'Ultraman: Kaiju Rumble (Blood Sucker Edition)',
  'Xenon': 'Xenon',
  'Cleopatra': 'Cleopatra',
  'Revenge From Mars': 'Revenge from Mars',
  'Star Trek TNG': 'Star Trek: The Next Generation',
  'Lord of the Rings': 'Lord of the Rings',
  'El Paso': null, // Not found in fixtures - will be dropped
};

// User email mappings to test users
const userMappings: Record<string, string> = {
  'rmh5989@gmail.com': 'roger.sharpe@example.com',
  'lgscott3@gmail.com': 'gary.stern@example.com',
  'rebecca.salam@gmail.com': 'george.gomez@example.com',
  'ted.gaunt@gmail.com': 'harry.williams@example.com',
};

// Owner/technician mappings to test users
const ownerMappings: Record<string, string> = {
  'Eric E': 'Roger Sharpe',
  'Chris E': 'Gary Stern',
  'Eric E/Chris E': 'George Gomez',
  'Ryan': 'Harry Williams',
  'Ryan/Chris E': 'Roger Sharpe',
  'Neil Wilson': 'Gary Stern',
  'Mark': 'George Gomez',
};

// Status mappings from CSV to our database statuses
const statusMappings: Record<string, string> = {
  'New': 'New',
  'In Progress': 'In Progress',
  'Needs expert help': 'Needs expert help',
  'Needs Parts': 'Needs Parts',
  'Fixed': 'Fixed',
  'Not to be Fixed': 'Not to be Fixed',
  'Not Reproducible': 'Not Reproducible',
};

// Severity mappings
const severityMappings: Record<string, string> = {
  'Severe': 'Critical',
  'Major': 'High',
  'Minor': 'Medium',
  'Cosmetic': 'Low',
};

async function processCSVFiles() {
  const reportedIssues: ProcessedIssue[] = [];
  const resolvedIssues: ProcessedIssue[] = [];
  
  console.log('\n=== Processing Reported Issues ===');
  
  // Process reported issues CSV
  await new Promise<void>((resolve) => {
    fs.createReadStream(path.join(__dirname, '../Games and Maintenance - Reported Issues.csv'))
      .pipe(csv())
      .on('data', (row: CSVIssue) => {
        const processed = processIssueRow(row);
        if (processed) {
          reportedIssues.push(processed);
          console.log(`✓ Processed: ${processed.title}`);
        }
      })
      .on('end', () => {
        console.log(`Processed ${reportedIssues.length} reported issues`);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error processing reported issues:', error);
        resolve();
      });
  });

  console.log('\n=== Processing Resolved Issues ===');
  
  // Process resolved issues CSV
  await new Promise<void>((resolve) => {
    const resolvedPath = path.join(__dirname, '../Games and Maintenance - Resolved.csv');
    if (fs.existsSync(resolvedPath)) {
      fs.createReadStream(resolvedPath)
        .pipe(csv())
        .on('data', (row: CSVIssue) => {
          const processed = processIssueRow(row);
          if (processed) {
            resolvedIssues.push(processed);
            console.log(`✓ Processed: ${processed.title}`);
          }
        })
        .on('end', () => {
          console.log(`Processed ${resolvedIssues.length} resolved issues`);
          resolve();
        })
        .on('error', (error) => {
          console.error('Error processing resolved issues:', error);
          resolve();
        });
    } else {
      console.log('Resolved issues file not found, skipping');
      resolve();
    }
  });
  
  // Write processed data
  const outputData = {
    reportedIssues,
    resolvedIssues,
    summary: {
      totalReported: reportedIssues.length,
      totalResolved: resolvedIssues.length,
      totalIssues: reportedIssues.length + resolvedIssues.length,
    },
  };
  
  fs.writeFileSync(
    path.join(__dirname, '../processed-issues.json'),
    JSON.stringify(outputData, null, 2)
  );
  
  console.log('\n=== Summary ===');
  console.log(`Total reported issues: ${reportedIssues.length}`);
  console.log(`Total resolved issues: ${resolvedIssues.length}`);
  console.log(`Total issues: ${reportedIssues.length + resolvedIssues.length}`);
  console.log('Processed data saved to processed-issues.json');
}

function processIssueRow(row: CSVIssue): ProcessedIssue | null {
  // Skip empty rows
  if (!row.Game || !row.Description) {
    return null;
  }
  
  // Skip games not in our fixture data
  const mappedGameName = csvGameMappings[row.Game];
  if (mappedGameName === null) {
    console.log(`⚠ Skipping issue for game not in fixtures: ${row.Game}`);
    return null;
  }
  
  const gameTitle = mappedGameName || row.Game;
  
  // Check if game exists in our fixture data
  const gameExists = fixtureData.machines.some(
    (machine: any) => machine.name === gameTitle
  );
  
  if (!gameExists) {
    console.log(`⚠ Skipping issue for unmapped game: ${row.Game} -> ${gameTitle}`);
    return null;
  }
  
  return {
    title: generateTitle(gameTitle, row.Description),
    description: row.Description,
    severity: severityMappings[row.Severity] || 'Medium',
    consistency: row.Consistency || undefined,
    status: statusMappings[row['Fix Status']] || 'New',
    gameTitle: gameTitle,
    reporterEmail: userMappings[row['Email Address']] || 'anonymous@example.com',
    assignedTo: mapUser(row['Assigned Technician']),
    owner: mapUser(row.Owner),
    workLog: row['Work Log'] || undefined,
    createdAt: parseDate(row['Report Timestamp']),
    updatedAt: parseDate(row['Last Updated']),
  };
}

function generateTitle(game: string, description: string): string {
  // Generate a concise title from game and description
  const shortDesc = description.split('.')[0]?.substring(0, 40) || 'Issue';
  return `${game}: ${shortDesc}`;
}

function mapUser(user: string): string | undefined {
  if (!user) return undefined;
  
  return ownerMappings[user] || undefined;
}

function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  
  try {
    // Handle MM/DD/YYYY format
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  } catch (error) {
    return new Date().toISOString();
  }
}

// Run the processing
processCSVFiles().catch(console.error);
