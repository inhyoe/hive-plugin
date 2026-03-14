import { createReadStream, existsSync, statSync } from 'fs';
import { watch } from 'chokidar';
import { WebSocketServer, WebSocket } from 'ws';
import { resolve } from 'path';

const PORT = Number(process.env.PORT) || 3001;
const STATE_DIR = resolve(process.env.HIVE_STATE_DIR || '../../.hive-state');
const EVENTS_FILE = resolve(STATE_DIR, 'events.jsonl');
const MAX_REPLAY_BUFFER = 1000;

const wss = new WebSocketServer({ port: PORT });
const clients = new Set<WebSocket>();
const replayBuffer: string[] = [];
let fileOffset = 0;
let partialLine = '';

function broadcast(data: string) {
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

function processLine(line: string) {
  const trimmed = line.trim();
  if (!trimmed) return;
  try {
    JSON.parse(trimmed); // validate JSON
    // Add to replay buffer
    if (replayBuffer.length >= MAX_REPLAY_BUFFER) {
      replayBuffer.shift();
    }
    replayBuffer.push(trimmed);
    broadcast(trimmed);
  } catch {
    // skip malformed lines
  }
}

function readNewLines() {
  if (!existsSync(EVENTS_FILE)) return;

  const stat = statSync(EVENTS_FILE);

  // File rotation detection: file is smaller than our offset
  if (stat.size < fileOffset) {
    console.log('File rotation detected, resetting offset');
    fileOffset = 0;
    partialLine = '';
  }

  if (stat.size <= fileOffset) return;

  const stream = createReadStream(EVENTS_FILE, {
    start: fileOffset,
    encoding: 'utf-8',
  });

  let newData = '';
  stream.on('data', (chunk: string) => {
    newData += chunk;
  });

  stream.on('end', () => {
    fileOffset = stat.size;

    // Handle partial lines from previous read
    const combined = partialLine + newData;
    const lines = combined.split('\n');

    // Last element might be incomplete (no trailing newline)
    partialLine = lines.pop() || '';

    for (const line of lines) {
      processLine(line);
    }
  });
}

// Watch events.jsonl for changes
const watcher = watch(EVENTS_FILE, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
});

watcher.on('change', readNewLines);
watcher.on('add', () => {
  fileOffset = 0;
  partialLine = '';
  readNewLines();
});
watcher.on('unlink', () => {
  console.log('Events file deleted, resetting state');
  fileOffset = 0;
  partialLine = '';
});

// WebSocket connection handler — replay all buffered events
wss.on('connection', (ws) => {
  clients.add(ws);
  console.log(`Client connected (total: ${clients.size})`);

  // Replay buffered events for mid-session connections
  for (const event of replayBuffer) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(event);
    }
  }

  ws.on('close', () => {
    clients.delete(ws);
    console.log(`Client disconnected (total: ${clients.size})`);
  });
});

console.log(`Hive Event Server listening on ws://localhost:${PORT}`);
console.log(`Watching: ${EVENTS_FILE}`);

// Initialize: read existing file content into replay buffer
if (existsSync(EVENTS_FILE)) {
  readNewLines();
}
