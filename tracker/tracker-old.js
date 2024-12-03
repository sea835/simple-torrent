import express from 'express';
import path from 'path';
import cors from 'cors';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise'; // Using mysql2 for async/await support

const app = express();
app.use(express.json());
app.use(cors());

const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection (assuming you have a database.js file with connection logic)
const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root', // Replace with your DB user
    password: '123456', // Replace with your DB password
    database: 'tracker'
});

// Serve the index.html file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Endpoint to register a peer
app.post('/announce', async(req, res) => {
    console.log('=====================');
    const { ip, port, files, file_hash } = req.body;
    const host_name = `${ip}:${port}`;

    if (host_name && ip && port && files) {
        try {
            // Check if the host_name already exists
            const [rows] = await db.execute(
                'SELECT COUNT(*) as count FROM Hosts WHERE host_name = ?', [host_name]
            );

            if (rows[0].count === 0) {
                // Insert the peer into the Hosts table if it doesn't exist
                await db.execute(
                    'INSERT INTO Hosts (host_name, ip, port) VALUES (?, ?, ?)', [host_name, ip, port]
                );
            }

            // Insert the files into the Files table (if not already inserted)
            const filePromises = files.map(async(file, index) => {
                // Check if the file already exists for the host
                const [fileRows] = await db.execute(
                    'SELECT COUNT(*) as count FROM Files WHERE host_name = ? AND file_name = ?', [host_name, file]
                );

                if (fileRows[0].count === 0) {
                    // Insert only if the file doesn't already exist
                    return db.execute(
                        'INSERT INTO Files (host_name, file_name, file_hash) VALUES (?, ?, ?)', [host_name, file, file_hash[index]]
                    );
                }
            });
            await Promise.all(filePromises);

            return res.status(200).json({ message: 'Peer registered or updated successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Database error' });
        }
    }
    return res.status(400).json({ error: 'Invalid data' });
});

// Endpoint to retrieve peers who have a specific file
app.get('/peers', async(req, res) => {
    const { fileName } = req.query;

    if (fileName) {
        try {
            // Query the database for peers with the specified file
            const [rows] = await db.execute(`
                SELECT Hosts.ip, Hosts.port 
                FROM Hosts
                JOIN Files ON Hosts.host_name = Files.host_name
                WHERE Files.file_name = ?
            `, [fileName]);

            const matchingPeers = rows.map(row => ({
                ip: row.ip,
                port: row.port
            }));

            return res.status(200).json({ peers: matchingPeers });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Database error' });
        }
    }
    return res.status(400).json({ error: 'File not specified' });
});

app.get('/all-peers', async(req, res) => {

    try {
        // Query the database for peers with the specified file
        const [rows] = await db.execute(`
                SELECT 
                    Hosts.host_name, 
                    Hosts.ip, 
                    Hosts.port, 
                    GROUP_CONCAT(Files.file_name SEPARATOR ', ') AS files
                FROM 
                    Hosts
                JOIN 
                    Files ON Hosts.host_name = Files.host_name
                WHERE files.file_name!="Chunk_List"
                GROUP BY 
                    Hosts.host_name, Hosts.ip, Hosts.port;
            `);

        const peers = rows.map(row => ({
            host_name: row.host_name,
            ip: row.ip,
            port: row.port,
            file_name: row.files
        }));

        return res.status(200).json({ peers });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Database error' });
    }
});

// Endpoint to get the total number of peers
app.get('/peers_count', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT COUNT(*) as peer_count FROM Hosts');
        const peerCount = rows[0].peer_count;
        return res.status(200).json({ peer_count: peerCount });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Error fetching peer count' });
    }
});

// 1. Register a new download
app.post('/downloads', async(req, res) => {
    const { downloader_host_name, sender_host_name, file_name } = req.body;

    if (downloader_host_name && sender_host_name && file_name) {
        try {
            // Insert a new download record with current timestamp
            await db.execute(
                `INSERT INTO Downloads (downloader_host_name, sender_host_name, file_name)
                 VALUES (?, ?, ?)`, [downloader_host_name, sender_host_name, file_name]
            );
            return res.status(200).json({ message: 'Download registered successfully' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Database error' });
        }
    }
    return res.status(400).json({ error: 'Invalid data' });
});

// 2. Retrieve all downloads
app.get('/downloads', async(req, res) => {
    try {
        const [rows] = await db.execute('SELECT * FROM Downloads');
        return res.status(200).json({ downloads: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Database error' });
    }
});

// 3. Retrieve downloads by file, downloader, or sender
app.get('/downloads/search', async(req, res) => {
    const { file_name, downloader_host_name, sender_host_name } = req.query;
    let query = 'SELECT * FROM Downloads WHERE 1=1'; // Start with a true condition
    const params = [];

    // Add conditions based on query parameters
    if (file_name) {
        query += ' AND file_name = ?';
        params.push(file_name);
    }
    if (downloader_host_name) {
        query += ' AND downloader_host_name = ?';
        params.push(downloader_host_name);
    }
    if (sender_host_name) {
        query += ' AND sender_host_name = ?';
        params.push(sender_host_name);
    }

    try {
        const [rows] = await db.execute(query, params);
        return res.status(200).json({ downloads: rows });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Database error' });
    }
});

app.get('/hash', async(req, res) => {
    const { file_name } = req.query;
    const [rows] = await db.execute('SELECT * FROM files where ?=files.file_name', [file_name]);
    res.status(200).json({ hash: rows[0].file_hash });
})

// Start the server
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`Tracker running on port ${PORT}`);
});