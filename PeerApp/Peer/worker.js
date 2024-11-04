// worker.js
import { parentPort, workerData } from 'worker_threads';

const { chunks, startChunk, endChunk } = workerData;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

for (let chunk = startChunk; chunk <= endChunk; chunk++) {
    const chunkData = chunks[chunk];
    parentPort.postMessage({ chunk, data: chunkData });
    await delay(100); // Add delay to simulate network latency
}