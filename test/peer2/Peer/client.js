import fs from 'fs';
import os from 'os';
import path from 'path';
import net from 'net';
import axios from 'axios';
import bencode from 'bencode';
import { URL } from 'url';
import querystring from 'querystring';
import crypto from 'crypto';

class Client {
    constructor(host, localPath) {
        this.host = host;
        this.localPath = localPath;
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true });
        }
        const chunkListPath = path.join(localPath, 'Chunk_List');
        if (!fs.existsSync(chunkListPath)) {
            fs.mkdirSync(chunkListPath, { recursive: true });
        }
    }

    async getPeersWithFile(trackerUrl, fileName) {
        console.log(`Client: Fetching peers with file ${fileName} from tracker ${trackerUrl}`);
        try {
            const response = await axios.get(`${trackerUrl}/peers`, { params: { fileName: fileName } });
            if (response.status === 200) {
                const peers = response.data.peers || [];
                const resIP = [];
                const resPort = [];
                peers.forEach(peer => {
                    resIP.push(peer.ip);
                    resPort.push(peer.port);
                });
                return { resIP, resPort };
            } else {
                console.error(`Error fetching peers: ${response.data}`);
            }
        } catch (error) {
            console.error(`Error fetching peers: ${error}`);
        }
    }

    static readTorrentFile(encodedData) {
        const decodedData = bencode.decode(encodedData);
        const torrentData = {};

        Object.keys(decodedData).forEach(key => {
            const value = decodedData[key];
            if (Buffer.isBuffer(value)) {
                torrentData[key.toString()] = value.toString();
            } else if (typeof value === 'object') {
                torrentData[key.toString()] = {};
                Object.keys(value).forEach(subKey => {
                    const subValue = value[subKey];
                    torrentData[key.toString()][subKey.toString()] = Buffer.isBuffer(subValue) ?
                        subValue.toString() :
                        subValue;
                });
            } else {
                torrentData[key.toString()] = value;
            }
        });

        return torrentData;
    }

    static parseMagnetLink(magnetLink) {
        const parsed = new URL(magnetLink);
        if (parsed.protocol !== 'magnet:') {
            throw new Error('Invalid magnet link!');
        }

        // console.log(parsed);

        const params = querystring.parse(parsed.searchParams.toString());
        const infoHash = params['xt'] ? params['xt'].replace('urn:btih:', '') : null;
        const fileName = params['dn'] || null;
        const trackerUrl = params['tr'] ? params['tr'] : null;
        const numChunks = parseInt(params['x.n'], 10);
        const chunkSize = parseInt(params['x.c'], 10);
        const fileSize = parseInt(params['x.s'], 10);

        return {
            announce: trackerUrl || null,
            hashinfo: {
                file_name: fileName,
                num_chunks: numChunks,
                chunk_size: chunkSize,
                file_size: fileSize,
                info_hash: infoHash
            }
        };
    }

    async downloadFile(fileName, peerIp, peerPort, startChunk = 0, endChunk = null,
        downloadsDir = path.join('./Downloads'),
        CHUNK_DIR = path.join('./chunks'),
        SHARE_DIR = path.join('./Share_File')) {

        if (!fs.existsSync(CHUNK_DIR)) {
            fs.mkdirSync(CHUNK_DIR);
        } else {
            fs.rmSync(CHUNK_DIR, { recursive: true });
            fs.mkdirSync(CHUNK_DIR);
        }

        if (!fs.existsSync(SHARE_DIR)) {
            fs.mkdirSync(SHARE_DIR);
        }

        if (!fs.existsSync(downloadsDir)) {
            fs.mkdirSync(downloadsDir);
        }

        console.log(`*****Connecting to peer ${peerIp}:${peerPort}`);

        const client = new net.Socket();

        client.connect(peerPort, peerIp, () => {
            console.log('Connected to server');
            client.write(fileName); // Request the specific file
        });

        client.on('data', async(data) => {
            const message = data.toString();
            if (message === 'Starts') {
                console.log('Peer is preparing the file...');
            } else if (message.startsWith('Ready')) {
                const numChunks = parseInt(message.split(' ')[1], 10);
                console.log(`Peer is ready to send ${numChunks} chunks`);
                if (endChunk === null) {
                    endChunk = numChunks - 1;
                }
                await this.requestChunks(client, fileName, startChunk, endChunk);
            }
        });

        client.on('end', () => {
            console.log('Initial connection ended');
        });

        client.on('error', (err) => {
            console.log('Error: ' + err.message);
        });
    }

    async requestChunks(clientSocket, fileName, startChunk, endChunk) {
        const chunkPath = path.join('./Downloads', 'Chunk_List');
        if (!fs.existsSync(chunkPath)) {
            fs.mkdirSync(chunkPath);
        } else {
            fs.rmSync(chunkPath, { recursive: true });
            fs.mkdirSync(chunkPath);
        }

        console.log(`Client: Requesting chunks ${startChunk} to ${endChunk} from Peer`);
        clientSocket.write('Request for chunk from Peer');

        let chunkIndex = startChunk;

        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        clientSocket.on('data', async(data) => {
            if (data.toString() === 'Start') {
                clientSocket.write(startChunk.toString());
            } else if (data.toString() === 'End') {
                clientSocket.write(endChunk.toString());
            } else {
                const fileData = Buffer.from(data, 'base64');
                const filePath = path.join(chunkPath, `chunk${chunkIndex}.txt`);
                try {
                    fs.writeFileSync(filePath, fileData);
                    console.log(`Client: Received chunk ${chunkIndex++}`);
                    await delay(100); // Add delay to ensure proper synchronization
                } catch (err) {
                    console.error(`Error writing chunk ${chunkIndex}: ${err.message}`);
                }

                if (chunkIndex > endChunk) {
                    clientSocket.end();
                }
            }
        });

        clientSocket.on('end', () => {
            console.log('All requested chunks received');
            this.fileMake(fileName);
        });

        clientSocket.on('error', (err) => {
            console.log('Error: ' + err.message);
        });
    }

    async recvAll(socket, size) {
        console.log(`Client: Receiving ${size} bytes...`);
        return new Promise((resolve, reject) => {
            let data = Buffer.alloc(0);

            socket.on('data', (chunk) => {
                data = Buffer.concat([data, chunk]);
                console.log(`Received ${data.length} bytes so far...`);

                // Resolve only when we reach or exceed the required size
                if (data.length >= size) {
                    resolve(data.slice(0, size)); // Trim any excess data
                    socket.removeAllListeners('data'); // Stop listening for more data
                    socket.end(); // Optionally close the socket
                }
            });

            socket.on('end', () => {
                if (data.length < size) {
                    console.log(`Connection ended before receiving the required data. Total received: ${data.length}`);
                }
                resolve(data);
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err);
                reject(err);
            });
        });
    }

    async hashFile(filePath) {
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

    async verify(filename) {
        try {
            const response = await axios.get(`http://localhost:5000/hash?file_name=${filename}`);
            const serverHash = response.data.hash;
            const filePath = path.join("./Downloads", filename);
            const localHash = await this.hashFile(filePath);
            console.log("Local hash: ", localHash);
            console.log("Server hash: ", serverHash);

            if (serverHash === localHash) {
                console.log('>>>>>> Hashes match! File is verified.');
                return true;
            } else {
                console.log('>>>>>> Hashes do not match! File may be corrupted.');
                console.log('>>>>>> Attempting to redownload the file...');
                await this.downloadFile(filename, peerIp, peerPort);
                return false;
            }
        } catch (error) {
            console.error('Error verifying file:', error);
            return false;
        }
    }

    fileMake(fileName) {
        const chunkListPath = path.join("./Downloads", 'Chunk_List');
        const files = fs.readdirSync(chunkListPath);

        // Sort the files to ensure they are in the correct order
        files.sort((a, b) => {
            const aIndex = parseInt(a.match(/chunk(\d+)\.txt/)[1], 10);
            const bIndex = parseInt(b.match(/chunk(\d+)\.txt/)[1], 10);
            return aIndex - bIndex;
        });

        const fileM = fs.createWriteStream(path.join("./Downloads", fileName));

        files.forEach((file) => {
            const chunk = fs.readFileSync(path.join(chunkListPath, file));
            fileM.write(chunk);
        });

        fileM.end();
        console.log('Client: Merge all chunks completed');
        this.verify(fileName);
        return { status: "Finished", message: "File downloaded successfully" };
    }
}

export default Client;