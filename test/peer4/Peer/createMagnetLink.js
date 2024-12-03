import crypto from 'crypto';

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