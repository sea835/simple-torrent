import fs from 'fs';
import crypto from 'crypto';
import path from 'path';

// Constants
const chunk_SIZE = 512 * 1024;

// Helper function to calculate the number of chunks
export function calculateNumberOfChunks(filePath) {
    const fileSize = fs.statSync(filePath).size;
    return Math.ceil(fileSize / chunk_SIZE);
}

// Helper function to create a magnet link
export function createMagnetLink(torrentData) {
    const trackerUrl = torrentData.announce;
    const fileName = torrentData.hashinfo.file_name;
    const numChunks = torrentData.hashinfo.num_chunks;
    const chunkSize = torrentData.hashinfo.chunk_size;
    const fileSize = torrentData.hashinfo.file_size;
    const hashinfoStr = `${fileName}${chunkSize}${numChunks}`;

    // Generate SHA1 hash
    const infoHash = crypto.createHash('sha1').update(hashinfoStr).digest('hex');

    // Construct magnet link
    const magnetLink = `magnet:?xt=urn:btih:${infoHash}` +
        `&dn=${encodeURIComponent(fileName)}` +
        `&tr=${encodeURIComponent(trackerUrl)}` +
        `&x.n=${numChunks}` +
        `&x.c=${chunkSize}` +
        `&x.s=${fileSize}`;

    return magnetLink;
}

// File and torrent data
// const fileName = "a.pdf";
// const filePath = path.join("./Share_File", fileName);
// const numChunks = calculateNumberOfChunks(filePath);
// const trackerUrl = "http://localhost:5000";
// const fileSize = fs.statSync(filePath).size;

// const torrentData = {
//     announce: trackerUrl,
//     hashinfo: {
//         file_name: fileName,
//         num_chunks: numChunks,
//         chunk_size: chunk_SIZE,
//         file_size: fileSize
//     }
// };

// // Create the magnet link
// // const magnetLink = createMagnetLink(torrentData);
// console.log("Magnet Link:", magnetLink);