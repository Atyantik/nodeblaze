import { spawn } from 'node:child_process';
import { freemem } from 'node:os';

// Function to parse command-line arguments
const parseArgs = () => {
  const args = process.argv.slice(2);
  const entryIndex = args.indexOf('--entry');
  if (entryIndex === -1 || entryIndex === args.length - 1) {
    throw new Error('Please provide an entry file with --entry option');
  }
  return args[entryIndex + 1];
};

// Get the entry file from the command-line arguments
const entryFile = parseArgs();

// Get free system memory in megabytes
const freeMemoryMB = freemem() / 1024 / 1024;

// Calculate 90% of free memory
const allocatedMemoryMB = freeMemoryMB * 0.9;

// Round down to the nearest whole number
const maxOldSpaceSize = Math.floor(allocatedMemoryMB);
const logs = [
  `Free System Memory: ${freeMemoryMB.toFixed(2)} MB`,
  `Allocated Memory for Node.js: ${maxOldSpaceSize} MB`,
  `Starting ${entryFile} with ${maxOldSpaceSize} MB of memory`,
  '\n',
]
console.info(logs.join('\n'));

// Construct the command to start the Node.js process with the calculated memory limit
const nodeArgs = ['--expose-gc', `--max-old-space-size=${maxOldSpaceSize}`, entryFile];

// Start the Node.js process
const child = spawn('node', nodeArgs, { stdio: 'inherit' });

child.on('error', (error) => {
  console.error(`Error starting Node.js process: ${error.message}`);
});

child.on('exit', (code, signal) => {
  if (code !== null) {
    console.log(`Node.js process exited with code ${code}`);
  }
  if (signal !== null) {
    console.log(`Node.js process was killed with signal ${signal}`);
  }
});
