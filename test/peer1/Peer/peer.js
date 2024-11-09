import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import net from 'net';
import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Constants
const chunk_SIZE = 50 * 1024; // 50 KB
const tracker_url = "http://localhost:5000";

// Helper function to calculate number of chunks
function calculateNumberOfChunks(filePath) {
    const fileSize = fs.statSync(filePath).size;
    return Math.ceil(fileSize / chunk_SIZE);
}

// Helper function to get files in a folder
function getFilesToShare(folderPath) {
    return fs.readdirSync(folderPath).filter(f => fs.statSync(path.join(folderPath, f)).isFile());
}

class Peer {
    constructor(IP, port, peerID, localPath) {
        this.IP = IP;
        this.port = port;
        this.peerID = peerID;
        this.localPath = localPath;
    }

    static async uploadFile() {
        console.log('Upload file logic needed with Node.js (use something like multer)');
        return null;
    }

    // Function to generate file hash
    static async hashFile(filePath) {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash('sha256');
            const stream = fs.createReadStream(filePath);

            stream.on('data', (chunk) => {
                hash.update(chunk);
            });

            stream.on('end', () => {
                resolve(hash.digest('hex')); // Output hash in hex format
            });

            stream.on('error', (err) => {
                reject(err);
            });
        });
    }

    async announceToTracker(trackerUrl, files, fileHash) {
        const data = {
            ip: this.IP,
            port: this.port,
            files: files,
            file_hash: fileHash, // Placeholder for file hash
        };
        try {
            const response = await axios.post(`${trackerUrl}/announce`, data);
            if (response.status === 200) {
                console.log("Successful registration with tracker");
            }
        } catch (error) {
            console.log(`Error registering with tracker: ${error.response?.data || error.message}`);
        }
    }

    static async getPeersCount(trackerUrl) {
        try {
            const response = await axios.get(`${trackerUrl}/peers_count`);
            if (response.status === 200) {
                return response.data.peer_count || 0;
            }
        } catch (error) {
            console.log(`Error fetching peer count: ${error.message}`);
            return 0;
        }
    }
}

(async function main() {
    const peerID = 1;
    const port = 10002;
    await Peer.uploadFile();

    const peer = new Peer('localhost', port, peerID, "Share_File");
    const files = getFilesToShare("./Share_File");

    console.log("Joining the swarm...");
    const fileHashes = await Promise.all(files.map(file => Peer.hashFile(path.join(peer.localPath, file))));
    //console.log("File hashes:", fileHashes);

    await peer.announceToTracker(tracker_url, files, fileHashes);

    console.log("Listening...");
    const serverSocket = net.createServer();
    serverSocket.listen(port, 'localhost', () => {
        console.log(`Peer ${peerID} listening on port ${port}`);
    });

    serverSocket.on('connection', async(socket) => {
        console.log(`Peer ${peerID}: New connection established`);
        socket.once('data', async(fileNameBuffer) => {
            const fileName = fileNameBuffer.toString();
            console.log(`File requested by client: ${fileName}`);

            const filePath = path.join(peer.localPath, fileName);
            const numChunks = calculateNumberOfChunks(filePath);
            console.log(`Number of chunks: ${numChunks}`);

            const chunks = [];
            const fileR = fs.createReadStream(filePath, { highWaterMark: chunk_SIZE });
            let chunk = 0;

            fileR.on('data', (chunkData) => {
                chunks.push(chunkData);
                chunk++;
            });

            fileR.on('end', () => {
                console.log(`File ${fileName} broken into ${numChunks} chunks`);
                socket.write(`Ready ${numChunks}`);
            });

            fileR.on('error', (err) => {
                console.error(`Error breaking file into chunks: ${err.message}`);
                socket.write("Error");
            });

            const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            // Handle chunk requests
            socket.on('data', async(data) => {
                console.log(`Peer ${peerID}: ${data.toString()}`);
                const request = data.toString();

                if (request === "Request for chunk from Peer") {
                    socket.write("Start");
                    socket.once('data', async(startChunkData) => {
                        const startChunk = parseInt(startChunkData.toString(), 10);
                        socket.write("End");
                        socket.once('data', async(endChunkData) => {
                            const endChunk = parseInt(endChunkData.toString(), 10);

                            const worker = new Worker('./worker.js', {
                                workerData: {
                                    chunks,
                                    startChunk,
                                    endChunk
                                }
                            });

                            worker.on('message', async(message) => {
                                const { chunk, data } = message;
                                socket.write(data);
                                console.log(`Sent chunk ${chunk}`);
                                await delay(100); // Add delay to ensure proper synchronization
                            });

                            worker.on('error', (err) => {
                                console.error(`Worker error: ${err.message}`);
                            });

                            worker.on('exit', (code) => {
                                if (code !== 0) {
                                    console.error(`Worker stopped with exit code ${code}`);
                                }
                                socket.end();
                            });
                        });
                    });
                } else if (request === "Client had been successfully received all file") {
                    console.log(`Peer ${peerID}: All chunks received by client`);
                    socket.write("All chunks are received");
                    serverSocket.close();
                }
            });
        });
    });

    serverSocket.on('error', (err) => {
        console.error(`Server error: ${err.message}`);
    });
})();