import express from 'express';
import Client from './client.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import crypto from 'crypto';
import bencode from 'bencode';

import { createTorrentFile } from './createTorrentFile.js';
import { createMagnetLink } from './createMagnetLink.js';


// Create an express app
const app = express();
const PORT = 10001;
const announceLink = 'http://localhost:5000/announce';

app.use(cors());

const client = new Client('localhost', './Torrent_File');

// Middleware to parse JSON bodies
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });
const shared = multer({ dest: 'Share_File/' });
const torrent = multer({ dest: 'Torrent_File/' });

const folderPath = path.join('./Share_File'); // Ensure this is the correct path
const torrentPath = path.join('./Torrent_File');
const downloadPath = path.join('./Downloads');

// Route to get list of files in a folder
// Route to get list of files in a folder with their sizes
app.get('/files', (req, res) => {
    // Check if the folder exists
    fs.access(folderPath, fs.constants.F_OK, (err) => {
        if (err) {
            // Folder does not exist
            return res.status(404).json({ message: 'Directory not found', error: err });
        }

        // If folder exists, read the contents
        fs.readdir(folderPath, (err, files) => {
            if (err) {
                return res.status(500).json({ message: 'Unable to retrieve files', error: err });
            }

            // Map files to include size information
            const fileInfo = files.map(file => {
                const filePath = path.join(folderPath, file);
                const stats = fs.statSync(filePath);
                return { fileName: file, size: stats.size }; // Size is in bytes
            });

            res.json({ files: fileInfo });
        });
    });
});

// Route to get list of files in a folder with their sizes
app.get('/downloadedFiles', (req, res) => {
    // Check if the folder exists
    fs.access(downloadPath, fs.constants.F_OK, (err) => {
        if (err) {
            // Folder does not exist
            return res.status(404).json({ message: 'Directory not found', error: err });
        }

        // If folder exists, read the contents
        fs.readdir(downloadPath, (err, files) => {
            if (err) {
                return res.status(500).json({ message: 'Unable to retrieve files', error: err });
            }

            // Map files to include size information
            const fileInfo = files.map(file => {
                const filePath = path.join(downloadPath, file);
                const stats = fs.statSync(downloadPath);
                return { fileName: file, size: stats.size }; // Size is in bytes
            });

            res.json({ files: fileInfo });
        });
    });
});

app.get('/torrents', (req, res) => {
    // Check if the folder exists
    fs.access(torrentPath, fs.constants.F_OK, (err) => {
        if (err) {
            // Folder does not exist
            return res.status(404).json({ message: 'Directory not found', error: err });
        }

        // If folder exists, read the contents
        fs.readdir(torrentPath, (err, files) => {
            if (err) {
                return res.status(500).json({ message: 'Unable to retrieve files', error: err });
            }

            // You can send just the file names or even their full paths if needed
            res.json({ files });
        });
    });
});

app.post('/uploadFile', shared.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'File is required' });
    }

    try {
        const filePath = file.path;
        const fileName = file.originalname;
        const sharedPath = path.join("./Share_File", fileName);
        fs.copyFileSync(filePath, sharedPath);
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error('Error deleting the uploaded file:', err);
            }
        });
        res.json({ message: 'File uploaded successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /createTorrent - Create a torrent file from the uploaded file
app.post('/createTorrent', upload.single('file'), (req, res) => {
    const file = req.file;
    if (!file) {
        return res.status(400).json({ error: 'File is required' });
    }

    try {
        // File details
        const filePath = file.path; // Path to the uploaded file
        const fileName = file.originalname; // Name of the file
        const torrentName = fileName.split('.')[0];
        const trackerUrl = announceLink; // Replace with your tracker URL   
        const chunkSize = 512 * 1024; // 512 KB chunk size
        const outputFile = path.join("./Torrent_File", `${torrentName}.torrent`); // Path for torrent file
        const sharedFile = path.join("./Share_File");

        // Create the torrent file
        const torrentFilePath = createTorrentFile(filePath, fileName, trackerUrl, chunkSize, outputFile);
        res.json(torrentFilePath);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

const convertUint8ArrayToString = (data) => {
    if (data instanceof Uint8Array) {
        return new TextDecoder().decode(data);
    } else if (typeof data === 'object' && data !== null) {
        for (const key in data) {
            data[key] = convertUint8ArrayToString(data[key]);
        }
    }
    return data;
};

// POST /createMagnet - Create a magnet link from the torrent file
app.post('/createMagnet', upload.single('torrentFile'), (req, res) => {
    const torrentFilePath = req.file.path;

    try {
        const torrentFile = fs.readFileSync(torrentFilePath);
        const torrentData = bencode.decode(torrentFile);

        // Convert Uint8Array values to strings
        const readableTorrentData = convertUint8ArrayToString(torrentData);
        // console.log(readableTorrentData);

        // Create the magnet link (this is a simplified example)
        const magnetLink = createMagnetLink(readableTorrentData);

        // Clean up the uploaded file
        fs.unlinkSync(torrentFilePath);

        res.json({ magnetLink });
    } catch (error) {
        console.error('Error processing torrent file:', error);
        res.status(500).json({ error: 'Error processing torrent file' });
    }
});

// POST /parseMagnet - Parse magnet link and return torrent data
app.post('/parseMagnet', (req, res) => {
    const { magnetLink } = req.body;
    if (!magnetLink) {
        return res.status(400).json({ error: 'Magnet link is required' });
    }

    try {
        const torrentData = Client.parseMagnetLink(magnetLink);
        res.json(torrentData);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// POST /uploadTorrent - Upload torrent file and parse its content
app.post('/uploadTorrent', torrent.single('torrentFile'), (req, res) => {
    const torrentFile = req.file;
    if (!torrentFile) {
        return res.status(400).json({ error: 'Torrent file is required' });
    }

    try {
        const encodedData = fs.readFileSync(torrentFile.path);
        const torrentData = Client.readTorrentFile(encodedData);
        fs.unlinkSync(torrentFile.path); // Clean up uploaded file
        res.json(torrentData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/readTorrent', (req, res) => {
    const torrentFile = req.body.file;
    if (!torrentFile) {
        return res.status(400).json({ error: 'Torrent file is required' });
    }

    try {
        const torrentPath = path.join('./Torrent_File', torrentFile);
        const encodedData = fs.readFileSync(torrentPath);
        const torrentData = Client.readTorrentFile(encodedData);
        //  console.log(torrentData);
        res.json(torrentData);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


// GET /peers - Fetch peers with the file from the tracker
app.get('/peers', async(req, res) => {
    const { trackerUrl, fileName } = req.query;
    // console.log(trackerUrl, fileName);
    if (!trackerUrl || !fileName) {
        return res.status(400).json({ error: 'trackerUrl and fileName are required' });
    }

    try {
        // const client = new Client('localhost', 'Local_Client'); // Replace with correct values
        const peers = await client.getPeersWithFile(trackerUrl, fileName);
        // const addresses = peers.resIP.map((ip, index) => `${ip}:${peers.resPort[index]}`);
        res.json(peers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /download - Start downloading chunks from peers
app.post('/download', async(req, res) => {
    const { trackerUrl, fileName, numChunks } = req.body;

    try {
        const peers = await client.getPeersWithFile(trackerUrl, fileName);
        if (!peers || peers.resIP.length === 0) {
            return res.status(500).json({
                message: "No peers found",
                error: "No peers available for the requested file"
            });
        }

        peers.resIP.forEach((ip, index) => {
            axios.post(`${trackerUrl}/downloads`, {
                downloader_host_name: `localhost:${PORT}`,
                sender_host_name: `${ip}:${peers.resPort[index]}`,
                file_name: fileName
            }).then((response) => {
                console.log('+++++++Download registered:', response.data);
            }).catch((error) => {
                console.error('++++++Error registering download:', error.message);
            });
        })

        // Distribute chunks among peers
        const chunksPerPeer = Math.ceil(numChunks / peers.resIP.length);
        const downloadPromises = [];

        for (let i = 0; i < peers.resIP.length; i++) {
            const startChunk = i * chunksPerPeer;
            const endChunk = Math.min((i + 1) * chunksPerPeer - 1, numChunks - 1);

            downloadPromises.push(
                client.downloadFile(fileName, peers.resIP[i], peers.resPort[i], startChunk, endChunk)
            );
        }

        // Wait for all downloads to complete
        const downloadStatuses = await Promise.all(downloadPromises);
        res.json({ status: "Download completed", downloadStatuses });

    } catch (error) {
        res.status(500).json({
            message: "Error during download",
            error: error.message
        });
    }
});

// Endpoint to get download progress
app.get('/downloadProgress', (req, res) => {
    const { fileName } = req.query;
    const chunkListPath = path.join('./Downloads', 'Chunk_List');

    if (!fs.existsSync(chunkListPath)) {
        return res.status(404).json({ message: 'Chunk list not found' });
    }

    const files = fs.readdirSync(chunkListPath);
    const receivedChunks = files.length;

    res.json({ receivedChunks });
});

const hashFile = (filePath) => {
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

// Helper function to announce peer to tracker
const announcePeer = async(ip, port) => {
    try {
        const files = fs.readdirSync('./Share_File').filter(file => {
            const filePath = path.join('./Share_File', file);
            return fs.statSync(filePath).isFile();
        });
        const fileHashes = await Promise.all(files.map(async(file) => await hashFile(path.join('./Share_File', file))));
        const peerInfo = { ip, port, files, file_hase: fileHashes };
        const response = await axios.post('http://localhost:5000/announce', peerInfo);
        console.log('Announced to tracker:', response.data);
    } catch (error) {
        console.error('Error announcing to tracker:', error.message);
    }
};

// Endpoint to connect and announce to tracker
app.post("/connect", (req, res) => {
    const { ip, port } = req.body;
    announcePeer(ip, port);
    res.status(200).json({ message: 'Connected to tracker' });
});

// clear download chunk list
app.get('/clearDownload', (req, res) => {
    const chunkListPath = path.join('./Downloads', 'Chunk_List');
    if (fs.existsSync(chunkListPath)) {
        fs.rmdirSync(chunkListPath, { recursive: true });
    }
    res.json({ message: 'Download cleared' });
});


// Start the server
app.listen(PORT, () => {
    console.log(`Client running on port ${PORT}`);
});