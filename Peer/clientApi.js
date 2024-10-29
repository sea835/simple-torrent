import express from 'express';
import Client from './client.js';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { createTorrentFile } from './createTorrentFile.js';
import { createMagnetLink } from './createMagnetLink.js';

// Create an express app
const app = express();
const PORT = 3000;
const announceLink = 'http://localhost:5000/announce';

const client = new Client('localhost', './Torrent_File');

// Middleware to parse JSON bodies
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });
const shared = multer({ dest: 'Share_File/' });

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

        // Send the created torrent file as a download
        res.download(torrentFilePath, `${torrentName}.torrent`, (err) => {
            if (err) {
                console.error('Error sending the file:', err);
                res.status(500).json({ error: 'Could not download the file' });
            } else {
                // Optionally, you can delete the uploaded file after the torrent is created and downloaded
                fs.unlink(filePath, (err) => {
                    if (err) {
                        console.error('Error deleting the uploaded file:', err);
                    }
                });
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /createMagnet - Create a magnet link from the torrent file
app.post('/createMagnet', (req, res) => {
    const { torrentFile } = req.body;
    if (!torrentFile) {
        return res.status(400).json({ error: 'Torrent file is required' });
    }

    try {
        const magnetLink = createMagnetLink(torrentFile);
        res.json({ magnetLink });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
app.post('/uploadTorrent', upload.single('torrentFile'), (req, res) => {
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

// GET /peers - Fetch peers with the file from the tracker
app.get('/peers', async(req, res) => {
    const { trackerUrl, fileName } = req.query;
    if (!trackerUrl || !fileName) {
        return res.status(400).json({ error: 'trackerUrl and fileName are required' });
    }

    try {
        // const client = new Client('localhost', 'Local_Client'); // Replace with correct values
        const peers = await client.getPeersWithFile(trackerUrl, fileName);
        res.json(peers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /download - Start downloading chunks from peers
app.post('/download', async(req, res) => {
    const { trackerUrl, fileName } = req.body;
    if (!trackerUrl || !fileName) {
        return res.status(400).json({ error: 'trackerUrl and fileName are required' });
    }

    try {
        const client = new Client('localhost', 'Local_Client'); // Replace with correct values
        const { resIP, resPort } = await client.getPeersWithFile(trackerUrl, fileName);
        const peerNum = resIP.length;
        const torrentData = await client.getPeersWithFile(trackerUrl, fileName); // You may need to extract chunkNum

        // Replace chunkNum with actual value from the torrentData
        await client.clientProcess(fileName, peerNum, resIP, resPort, torrentData.num_chunks);

        res.json({ message: `Download completed for ${fileName}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});