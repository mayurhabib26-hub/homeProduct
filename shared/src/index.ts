// Types and helpers shared by frontend and backend.
//
// Nothing here may have runtime side effects: no database client, no React,
// no process.env. If it cannot be imported by both a browser bundle and a
// Node process, it does not belong here. See docs/ARCHITECTURE.md §3.3.

export * from './types';
export * from './money';
