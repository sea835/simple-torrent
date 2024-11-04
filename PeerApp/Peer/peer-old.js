import fs from 'fs';
import path from 'path';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import net from 'net';
import { Worker, isMainThread, workerData, parentPort } from 'worker_threads';
import { fileURLToPath } from 'url';
import os from 'os';

const app = express();
const CHUNK_SIZE = 512 * 1024;
const localPath = './PeerStorage';
const chunkDir = path.join(localPath, 'Chunk_List');
const tracker_url = "http://localhost:5000";

// Convert `import.meta.url` to `__filename` for ES module compatibility
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

var SHARE_DIR = path.join('./Share_File');
var CHUNK_DIR = path.join('./chunks');
var downloadsDir = path.join('./Downloads');
var fileName = 'sample.exe'; // Change the file name as needed
var filePath = path.join(downloadsDir, fileName);

// Ensure the necessary directories exist
if (!fs.existsSync(CHUNK_DIR)) {
    fs.mkdirSync(CHUNK_DIR);
}

if (!fs.existsSync(SHARE_DIR)) {
    fs.mkdirSync(SHARE_DIR);
}

if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Server part
var server = net.createServer(function(socket) {
    console.log('Connected: ' + socket.remoteAddress + ':' + socket.remotePort);

    socket.on('data', function(data) {
        var fileName = data.toString().trim();
        var filePath = path.join(SHARE_DIR, fileName);

        if (fs.existsSync(filePath)) {
            var readStream = fs.createReadStream(filePath, { highWaterMark: CHUNK_SIZE });
            var chunkIndex = 0;

            readStream.on('data', function(chunk) {
                var chunkFilePath = path.join(CHUNK_DIR, fileName + 'chunk_' + chunkIndex);
                fs.writeFileSync(chunkFilePath, chunk);
                socket.write(chunk);
                chunkIndex++;
            });

            readStream.on('end', function() {
                socket.end();
            });

            readStream.on('error', function(err) {
                console.log('File read error:', err);
                socket.end('Error reading file');
            });
        } else {
            socket.write('File not found');
            socket.end();
        }
    });

    socket.on('end', function() {
        console.log('Disconnected: ' + socket.remoteAddress + ':' + socket.remotePort);
    });
});

server.listen(3000, 'localhost', function() {
    console.log('Peer socket listening on 127.0.0.1:3000');
});