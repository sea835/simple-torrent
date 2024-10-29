const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const axios = require('axios');
const bencode = require('bencode');
const url = require('url');
const querystring = require('querystring');

const chunk_SIZE = 512 * 1024;

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
        try {
            const response = await axios.get(`${trackerUrl}/peers`, { params: { file: fileName } });
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
        const parsed = url.parse(magnetLink);
        if (parsed.protocol !== 'magnet:') {
            throw new Error('Invalid magnet link!');
        }

        const params = querystring.parse(parsed.query);
        const infoHash = params['xt'] ? params['xt'].replace('urn:btih:', '') : null;
        const fileName = params['dn'] || null;
        const trackerUrl = params['tr'] ? params['tr'][0] : null;
        const numChunks = parseInt(params['x.n'][0], 10);
        const chunkSize = parseInt(params['x.c'][0], 10);
        const fileSize = parseInt(params['x.s'][0], 10);

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

    async requestChunk(serverIP, startChunk, endChunk, serverPort, peerID) {
        const clientSocket = new net.Socket();
        return new Promise((resolve, reject) => {
            clientSocket.connect(serverPort, serverIP, () => {
                console.log(`Client ${peerID}: Connected to server`);
                clientSocket.write('Request for chunk from Peer');
            });

            clientSocket.on('data', async data => {
                const response = data.toString();
                if (response === 'Acknowledged') {
                    clientSocket.write(startChunk.toString());
                } else if (response === `Chunk ${startChunk} received`) {
                    clientSocket.write(endChunk.toString());
                } else {
                    // Receiving chunks
                    for (let chunk = startChunk; chunk <= endChunk; chunk++) {
                        const receivedData = await this.recvAll(clientSocket, chunk_SIZE);
                        console.log(`Received chunk ${chunk}`);
                        fs.writeFileSync(path.join(this.localPath, 'Chunk_List', `chunk${chunk}.txt`), receivedData);
                    }
                    clientSocket.end();
                    resolve();
                }
            });

            clientSocket.on('error', err => {
                console.error(`Client error: ${err.message}`);
                reject(err);
            });
        });
    }

    async recvAll(socket, size) {
        return new Promise((resolve, reject) => {
            let data = Buffer.alloc(0);
            socket.on('data', chunk => {
                data = Buffer.concat([data, chunk]);
                if (data.length >= size) {
                    resolve(data);
                }
            });

            socket.on('end', () => {
                resolve(data);
            });

            socket.on('error', err => {
                reject(err);
            });
        });
    }

    fileMake(fileName) {
        const chunkListPath = path.join(this.localPath, 'Chunk_List');
        const files = fs.readdirSync(chunkListPath);
        const fileM = fs.createWriteStream(path.join(this.localPath, fileName));

        files.forEach((file, index) => {
            const chunk = fs.readFileSync(path.join(chunkListPath, file));
            fileM.write(chunk);
        });

        fileM.end();
        console.log('Client: Merge all chunks completed');
    }

    async clientProcess(fileName, peerNum, serverIPs, serverPorts, chunkNum) {
        const chunkForEachPeer = Math.floor(chunkNum / peerNum);
        let startChunk = 0;
        const promises = [];

        for (let i = 0; i < peerNum; i++) {
            const endChunk = i === peerNum - 1 ? chunkNum - 1 : startChunk + chunkForEachPeer - 1;
            console.log(`Client: Requesting chunks ${startChunk} to ${endChunk} from Peer ${i + 1}`);
            promises.push(this.requestChunk(serverIPs[i], startChunk, endChunk, serverPorts[i], i + 1));
            startChunk = endChunk + 1;
        }

        await Promise.all(promises);
        this.fileMake(fileName);
    }
}

module.exports = Client;