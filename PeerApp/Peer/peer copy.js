const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const net = require('net');
const { Worker, isMainThread, parentPort } = require('worker_threads');
const ps = require('ps-node');

// Constants
const chunk_SIZE = 512 * 1024;
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
        // Use a file upload package for Express, e.g., multer in Node.js to handle file uploads
        console.log('Upload file logic needed with Node.js (use something like multer)');
        return null;
    }

    async announceToTracker(trackerUrl, files) {
        const data = {
            ip: this.IP,
            port: this.port,
            files: files
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

    server(serverSocket) {
        const progressBar = (current, total, barLength = 50) => {
            const progress = current / total;
            const block = Math.floor(barLength * progress);
            const bar = '#'.repeat(block) + '-'.repeat(barLength - block);
            const percent = (progress * 100).toFixed(2);
            process.stdout.write(`\rDownloading: [${bar}] ${percent}%`);
        };

        console.log(`Peer ${this.peerID}: Ready to send file`);

        serverSocket.on('connection', (socket) => {
            socket.on('data', (data) => {
                const request = data.toString();

                if (request === "Request for chunk from Peer") {
                    socket.write("Start");
                    socket.once('data', (startChunkData) => {
                        const startChunk = parseInt(startChunkData.toString(), 10);
                        socket.write("End");
                        socket.once('data', (endChunkData) => {
                            const endChunk = parseInt(endChunkData.toString(), 10);

                            for (let chunk = startChunk; chunk <= endChunk; chunk++) {
                                progressBar(chunk - startChunk + 1, endChunk - startChunk + 1);
                                const fileData = fs.readFileSync(path.join(this.localPath, `Chunk_List`, `chunk${chunk}.txt`));
                                socket.write(fileData);
                            }

                            socket.end();
                        });
                    });
                } else if (request === "Client had been successfully received all file") {
                    console.log(`Peer ${this.peerID}: All chunks received by client`);
                    socket.write("All chunks are received");
                    serverSocket.close();
                }
            });
        });
    }

    breakFile(fileName) {
        const chunkDir = path.join(this.localPath, 'Chunk_List');
        if (!fs.existsSync(chunkDir)) {
            fs.mkdirSync(chunkDir);
        }

        const fileR = fs.createReadStream(path.join(this.localPath, fileName), { highWaterMark: chunk_SIZE });
        let chunk = 0;

        fileR.on('data', (chunkData) => {
            const chunkPath = path.join(chunkDir, `chunk${chunk}.txt`);
            fs.writeFileSync(chunkPath, chunkData);
            chunk++;
        });

        fileR.on('end', () => {
            console.log(`File ${fileName} broken into chunks`);
        });
    }

    start(serverSocket) {
        const worker = new Worker(__filename, { workerData: { port: this.port, peerID: this.peerID, localPath: this.localPath } });
        worker.on('message', (message) => console.log(`Worker message: ${message}`));
    }
}

(async function main() {
    const peerID = await Peer.getPeersCount(tracker_url) + 1;
    const port = 3000;
    this.port = port;
    await Peer.uploadFile();

    const peer = new Peer('localhost', port, peerID, "Share_File");
    const files = getFilesToShare("./Share_File");

    console.log("Joining the swarm...");
    await peer.announceToTracker(tracker_url, files);

    console.log("Listening...");
    const serverSocket = net.createServer();
    serverSocket.listen(port, 'localhost');

    serverSocket.on('connection', (socket) => {
        socket.once('data', (fileNameBuffer) => {
            const fileName = fileNameBuffer.toString();
            console.log(`File requested by client: ${fileName}`);
            peer.breakFile(fileName);
            peer.start(serverSocket);
        });
    });
})();