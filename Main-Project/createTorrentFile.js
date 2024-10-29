const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bencode = require('bencode'); // You need to install this package: npm install bencode

// Function to create a torrent file
function createTorrentFile(filePath, fileName, trackerUrl, chunkSize, outputFile) {
    const fileSize = fs.statSync(filePath).size;
    const numChunks = Math.ceil(fileSize / chunkSize);

    const torrentData = {
        announce: trackerUrl,
        hashinfo: {
            file_name: fileName,
            num_chunks: numChunks,
            chunk_size: chunkSize,
            file_size: fileSize
        }
    };

    // Bencode the torrent data
    const encodedData = bencode.encode(torrentData);

    // Write the bencoded data to a .torrent file
    fs.writeFileSync(outputFile, encodedData);

    console.log(`Torrent file '${outputFile}' created successfully!`);
}

// Set variables
const chunkSize = 512 * 1024;
const fileName = "a.pdf";
const filePath = path.join("./Share_File", fileName);
const trackerUrl = "http://192.168.1.13:5000";
const outputFile = path.join("./Torrent_File", "a.torrent");

// Call the function to create a torrent file
createTorrentFile(filePath, fileName, trackerUrl, chunkSize, outputFile);