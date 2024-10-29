const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');


const app = express();
const PORT = 4000;

app.use(cors());

const decodeBencode = (buffer) => {
    let index = 0;

    // Hàm chính
    function decode() {
        const char = String.fromCharCode(buffer[index]);

        // Xác định loại dữ liệu dựa trên byte đầu tiên
        if (char === 'i') {
            return decodeInteger();
        } else if (char === 'l') {
            return decodeList();
        } else if (char === 'd') {
            return decodeDictionary();
        } else if (isDigit(char)) {
            return decodeString();
        } else {
            throw new Error('Invalid bencode format.');
        }
    }

    // Giải mã số nguyên
    function decodeInteger() {
        index++; // Bỏ qua 'i'
        const end = buffer.indexOf('e'.charCodeAt(0), index);
        const number = parseInt(buffer.slice(index, end).toString(), 10);
        index = end + 1; // Cập nhật vị trí con trỏ sau 'e'
        return number;
    }

    // Giải mã chuỗi
    function decodeString() {
        const colonIndex = buffer.indexOf(':'.charCodeAt(0), index);
        const length = parseInt(buffer.slice(index, colonIndex).toString(), 10);
        index = colonIndex + 1; // Bỏ qua ':'
        const str = buffer.slice(index, index + length).toString();
        index += length;
        return str;
    }

    // Giải mã danh sách
    function decodeList() {
        index++; // Bỏ qua 'l'
        const list = [];
        while (String.fromCharCode(buffer[index]) !== 'e') {
            list.push(decode());
        }
        index++; // Bỏ qua 'e'
        return list;
    }

    // Giải mã từ điển
    function decodeDictionary() {
        index++; // Bỏ qua 'd'
        const dict = {};
        while (String.fromCharCode(buffer[index]) !== 'e') {
            const key = decodeString();
            const value = decode();
            dict[key] = value;
        }
        index++; // Bỏ qua 'e'
        return dict;
    }

    // Kiểm tra ký tự có phải là chữ số không
    function isDigit(char) {
        return char >= '0' && char <= '9';
    }

    // Bắt đầu giải mã
    return decode();
};

const bencode = {
    encode: function(data) {
        if (typeof data === 'number') {
            return this.encodeInteger(data);
        } else if (typeof data === 'string') {
            return this.encodeString(data);
        } else if (Array.isArray(data)) {
            return this.encodeList(data);
        } else if (typeof data === 'object') {
            return this.encodeDictionary(data);
        } else {
            throw new Error('Unsupported data type');
        }
    },

    encodeInteger: function(num) {
        return `i${num}e`;
    },

    encodeString: function(str) {
        return `${str.length}:${str}`;
    },

    encodeList: function(list) {
        const encodedItems = list.map(item => this.encode(item)).join('');
        return `l${encodedItems}e`;
    },

    encodeDictionary: function(dict) {
        const encodedItems = Object.keys(dict)
            .sort() // Sort keys for consistent encoding
            .map(key => this.encodeString(key) + this.encode(dict[key]))
            .join('');
        return `d${encodedItems}e`;
    }
};

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

app.use(bodyParser.json());

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir); // Save uploads to 'uploads' folder
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Keep the original file name
    }
});

const readTorrentFile = (filePath) => {
    const torrentFile = fs.readFileSync(filePath);
    const decoded = decodeBencode(torrentFile);

    const announce = decoded.announce; // Tracker URL
    const info = decoded.info; // Info about file pieces, file names, etc.
    const pieces = info.pieces; // File pieces (hashed)
    const pieceLength = info['piece length']; // Length of each piece

    return {
        announce,
        pieces,
        pieceLength,
        info,
    };
}

// Helper function to create torrent file
const createTorrentFile = (fileName, filePath, trackerUrl) => {
    const fileData = fs.readFileSync(filePath);
    const pieceLength = 512 * 1024; // Each piece is 512KB
    const numPieces = Math.ceil(fileData.length / pieceLength);

    try {
        let piecesBuffer = Buffer.alloc(0);

        // Hash each piece and append it to the pieces buffer
        for (let i = 0; i < numPieces; i++) {
            const piece = fileData.slice(i * pieceLength, (i + 1) * pieceLength);
            const hashedPiece = crypto.createHash('sha1').update(piece).digest();
            piecesBuffer = Buffer.concat([piecesBuffer, hashedPiece]);
        }

        // Create torrent info
        const torrent = {
            announce: trackerUrl,
            info: {
                name: fileName,
                'piece length': pieceLength,
                length: fileData.length,
                pieces: piecesBuffer.toString('hex')
            }
        };

        const encodedTorrent = bencode.encode(torrent);
        const torrentFileName = `${fileName}.torrent`;
        const torrentFilePath = path.join(uploadsDir, torrentFileName);
        fs.writeFileSync(torrentFilePath, encodedTorrent);

        return torrentFilePath;
    } catch (err) {
        console.log(err);
    }
};

const upload = multer({ storage });

// Danh sách các node và tệp của chúng
let nodes = {};
let fileStorage = {};
let peers = {};

// Parse URL-encoded data
app.use(bodyParser.urlencoded({ extended: true }));

// Peer Registration via /announce
app.get('/announce', (req, res) => {
    const { info_hash, peer_id, port, event } = req.query;

    // Validate required parameters
    if (!info_hash || !peer_id || !port) {
        return res.status(400).send('Missing required parameters: info_hash, peer_id, port');
    }

    const torrentHash = info_hash.toString('hex'); // Assuming the info_hash is in binary, convert it to a hex string for storage

    // Handle different events
    if (event === 'started') {
        // Register this peer
        if (!peers[torrentHash]) {
            peers[torrentHash] = [];
        }

        // Add peer to list if it doesn't already exist
        if (!peers[torrentHash].some(peer => peer.peer_id === peer_id)) {
            peers[torrentHash].push({ peer_id, port });
        }
    } else if (event === 'stopped') {
        // Remove peer from the list if they stop sharing
        peers[torrentHash] = peers[torrentHash].filter(peer => peer.peer_id !== peer_id);
    }

    // Return list of other peers for this torrent (excluding the requesting peer)
    const peerList = peers[torrentHash] ? peers[torrentHash].filter(peer => peer.peer_id !== peer_id) : [];

    // Build response in compact form (list of IP:port)
    const response = {
        'interval': 1800, // Time in seconds for next announce (typically around 30 minutes)
        'peers': peerList
    };

    res.json(response);
});

// API cho node đăng ký tệp của nó
app.post('/register', (req, res) => {
    const { nodeId, files } = req.body;

    if (!nodeId || !files || !Array.isArray(files)) {
        return res.status(400).send('Node ID and files (as an array) are required.');
    }

    // Cập nhật thông tin node
    nodes[nodeId] = { files };
    files.forEach(file => {
        if (!fileStorage[file]) {
            fileStorage[file] = [];
        }
        fileStorage[file].push(nodeId); // Lưu trữ node chứa tệp này
    });

    res.send('Node registered successfully.');
});

// API để tải lên tệp torrent
app.post('/upload-torrent', upload.single('torrentFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    // Cập nhật fileStorage với tệp mới được tải lên
    const fileName = req.file.originalname;
    if (!fileStorage[fileName]) {
        fileStorage[fileName] = [];
    }
    fileStorage[fileName].push(req.body.nodeId); // Ghi nhận node đã tải lên tệp này

    res.send(`Torrent file ${fileName} uploaded successfully.`);
});

// API cho node yêu cầu tệp
app.get('/get-file/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const availableNodes = fileStorage[fileName];

    if (!availableNodes || availableNodes.length === 0) {
        return res.status(404).send('File not found.');
    }

    res.json({ nodes: availableNodes });
});

// API để lấy danh sách peer cho một tệp
app.post('/peers', (req, res) => {
    const { fileName } = req.body;
    const availableNodes = fileStorage[fileName];

    if (!availableNodes || availableNodes.length === 0) {
        return res.status(404).send('No peers available for this file.');
    }

    res.json({ peers: availableNodes });
});

// API để lấy danh sách các torrent hiện có
app.get('/files', (req, res) => {
    const availableFiles = Object.keys(fileStorage);
    res.json({ files: availableFiles });
});

// API to create a torrent and save it to the uploads directory
app.post('/create-torrent', (req, res) => {
    const { fileName, trackerUrl } = req.body;
    const filePath = path.join(uploadsDir, fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found.');
    }

    try {
        // Create the torrent file and get its path
        const torrentFilePath = createTorrentFile(fileName, filePath, trackerUrl);

        // Save the torrent file path in fileStorage
        if (!fileStorage[fileName]) {
            fileStorage[fileName] = [];
        }
        fileStorage[fileName].push(torrentFilePath); // Save the torrent file

        res.send(`Torrent file created and saved at ${torrentFilePath}`);
    } catch (error) {
        res.status(500).send('Error creating torrent.', error);
    }
});

// NEW: API to read a torrent file and return its details
app.get('/read-torrent/:fileName', (req, res) => {
    const torrentFileName = req.params.fileName;
    const filePath = path.join(uploadsDir, torrentFileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Torrent file not found.');
    }

    try {
        const torrentDetails = readTorrentFile(filePath);
        res.json(torrentDetails);
    } catch (error) {
        res.status(500).send('Error reading torrent file.');
    }
});


app.listen(PORT, () => {
    console.log(`Tracker is running on port ${PORT}`);
});