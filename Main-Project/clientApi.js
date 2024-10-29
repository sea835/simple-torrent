import express from 'express';
import client from './client.js';
import multer from 'multer';
import fs from 'fs';

// Create an express app
const app = express();
const PORT = 3000;


// Middleware to parse JSON bodies
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

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
        const client = new Client('localhost', 'Local_Client'); // Replace with correct values
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