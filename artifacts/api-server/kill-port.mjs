#!/usr/bin/env node
// Kills any process currently listening on $PORT by reading /proc/net/tcp.
// Safe: only kills other PIDs, never the calling process.
import { readFileSync, readdirSync, readlinkSync } from "fs";

const port = Number(process.env.PORT ?? 8080);
const hexPort = port.toString(16).toUpperCase().padStart(4, "0");
const myPid = process.pid;

function findInodeForPort() {
  try {
    const tcp = readFileSync("/proc/net/tcp", "utf8");
    for (const line of tcp.split("\n").slice(1)) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const localHexPort = parts[1]?.split(":")[1];
      if (localHexPort !== hexPort) continue;
      return parts[9]; // inode
    }
  } catch {}
  return null;
}

function findPidByInode(inode) {
  try {
    for (const pidStr of readdirSync("/proc")) {
      const pid = Number(pidStr);
      if (!pid || pid === myPid) continue;
      try {
        for (const fd of readdirSync(`/proc/${pid}/fd`)) {
          try {
            const link = readlinkSync(`/proc/${pid}/fd/${fd}`);
            if (link === `socket:[${inode}]`) return pid;
          } catch {}
        }
      } catch {}
    }
  } catch {}
  return null;
}

const inode = findInodeForPort();
if (!inode) {
  console.log(`[kill-port] Port ${port} is free`);
  process.exit(0);
}

const pid = findPidByInode(inode);
if (pid) {
  try {
    process.kill(pid, "SIGKILL");
    console.log(`[kill-port] Killed PID ${pid} (was holding port ${port})`);
    await new Promise(r => setTimeout(r, 600));
  } catch (e) {
    console.log(`[kill-port] Could not kill PID ${pid}: ${e.message}`);
  }
} else {
  console.log(`[kill-port] Port ${port} busy but owner PID not found`);
}
