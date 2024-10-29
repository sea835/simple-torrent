import express from 'express';
const app = express();

app.use(express.json());

let peers = {};

// Endpoint to register a peer
app.post('/announce', (req, res) => {
    const { ip, port, files } = req.body;

    if (ip && files) {
        peers[ip] = { port, files };
        return res.status(200).json({ message: 'Peer registered successfully' });
    }
    return res.status(400).json({ error: 'Invalid data' });
});

// Endpoint to retrieve peers who have a specific file
app.get('/peers', (req, res) => {
    const fileName = req.query.file;

    if (fileName) {
        const matchingPeers = Object.keys(peers).filter(ip => peers[ip].files.includes(fileName)).map(ip => ({
            ip,
            port: peers[ip].port
        }));

        return res.status(200).json({ peers: matchingPeers });
    }
    return res.status(400).json({ error: 'File not specified' });
});

// Endpoint to get the total number of peers
app.get('/peers_count', (req, res) => {
    const peerCount = Object.keys(peers).length;
    try {
        return res.status(200).json({ peer_count: peerCount });
    } catch (error) {
        return res.status(400).json({ error: 'Error fetching peer count' });
    }
});

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});