import fs from 'fs';
import axios from 'axios';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// Function to announce to the tracker
const announcePeer = async(ip, port, files) => {
    try {
        // Read files from Share_File directory
        const files = fs.readdirSync('./Share_File');
        const peerInfo = {
            ip, // Replace with actual peer IP if available
            port, // The port your peer will be listening on
            files
        };

        // Send announcement to tracker
        const response = await axios.post('http://localhost:5000/announce', peerInfo);
        console.log('Announced to tracker:', response.data);
    } catch (error) {
        console.error('Error announcing to tracker:', error.message);
    }
}

app.post("/connect", (req, res) => {
    // console.log('*********************');
    // console.log(req);
    const { ip, port, files } = req.body;
    announcePeer(ip, port, files);
    res.status(200).json({ message: 'Connected to tracker' });
    // console.log('*********************');
});

app.listen(3000, () => {
    console.log('Peer listening on port 3000');
});