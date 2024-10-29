// server.js (Node.js server)

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

// Setup multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const sharedDir = path.join(__dirname, 'shared');
        fs.mkdirSync(sharedDir, { recursive: true }); // Create shared directory if it doesn't exist
        cb(null, sharedDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); // Save the file with its original name
    },
});

const upload = multer({ storage });

// Route to upload files
app.post('/upload', upload.single('file'), (req, res) => {
    res.send({ message: 'File uploaded successfully!', filename: req.file.originalname });
});

// Route to list shared files
app.get('/shared-files', (req, res) => {
    const sharedDir = path.join(__dirname, 'shared');
    fs.readdir(sharedDir, (err, files) => {
        if (err) return res.status(500).send('Unable to scan directory: ' + err);
        res.send(files); // Return list of files in shared directory
    });
});

// Route to download files
app.get('/download/:fileName', (req, res) => {
    const fileName = req.params.fileName;
    const filePath = path.join(__dirname, 'shared', fileName);
    res.download(filePath, fileName); // Send the file for download
});

// Start server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});