const net = require('net');
const crypto = require('crypto');

class Tracker {
    constructor() {
        this.peers = {}; // Lưu trữ thông tin các peer
    }

    // Bắt đầu server Tracker
    startServer(host, port) {
        const server = net.createServer((socket) => {
            console.log('Peer connected:', socket.remoteAddress);
            socket.on('data', (data) => this.clientHandleRequest(socket, data));
            socket.on('end', () => console.log('Peer disconnected:', socket.remoteAddress));
        });

        server.listen(port, host, () => {
            console.log(`Tracker server started on ${host}:${port}`);
        });
    }

    // Xử lý yêu cầu của client
    clientHandleRequest(socket, data) {
        const request = data.toString().trim();
        const [command, ...args] = request.split(' ');

        switch (command) {
            case 'START':
                this.updateClientInfo(args[0], args[1]);
                socket.write('Client info updated');
                break;
            case 'STOP':
                this.removePeer(args[0]);
                socket.write('Peer removed');
                break;
            case 'REQUEST_FILE_LIST':
                const fileList = this.requestFileListFromClient(args[0]);
                socket.write(fileList.join(', '));
                break;
            case 'DISCOVER_FILES':
                this.discoverFiles(args[0], socket);
                break;
            case 'PING':
                const isOnline = this.pingHost(args[0]);
                socket.write(isOnline ? 'Peer is online' : 'Peer is offline');
                break;
            case 'TORRENT_TO_MAGNET':
                const magnetLink = this.torrentToMagnetLink(args[0]);
                socket.write(magnetLink);
                break;
            case 'MAGNET_TO_TORRENT':
                const torrentFile = this.magnetLinkToTorrent(args[0]);
                socket.write(torrentFile.toString('hex'));
                break;
            default:
                socket.write('Unknown command');
        }
    }

    // Cập nhật thông tin peer
    updateClientInfo(hostname, port) {
        this.peers[hostname] = { port, status: 'online' };
        console.log(`Updated client info for ${hostname} at port ${port}`);
    }

    // Xóa peer
    removePeer(hostname) {
        delete this.peers[hostname];
        console.log(`Removed peer: ${hostname}`);
    }

    // Yêu cầu danh sách tệp từ peer
    requestFileListFromClient(hostname) {
        if (this.peers[hostname]) {
            // Giả lập danh sách tệp của client (trả về một mảng)
            return ['file1', 'file2', 'file3'];
        } else {
            return [];
        }
    }

    // Khám phá file từ peer khác
    discoverFiles(hostname, socket) {
        if (this.peers[hostname]) {
            const peer = this.peers[hostname];
            const client = net.createConnection({ host: hostname, port: peer.port }, () => {
                client.write('REQUEST_FILE_LIST');
            });
            client.on('data', (data) => {
                console.log(`Files from ${hostname}: ${data.toString()}`);
                socket.write(data.toString());
                client.end();
            });
        } else {
            socket.write(`Peer ${hostname} not found`);
        }
    }

    // Kiểm tra peer có trực tuyến không
    pingHost(hostname) {
        return this.peers[hostname] && this.peers[hostname].status === 'online';
    }

    // Chuyển đổi torrent thành magnet link
    torrentToMagnetLink(torrentFile) {
        const hash = crypto.createHash('sha1').update(torrentFile).digest('hex');
        return `magnet:?xt=urn:btih:${hash}`;
    }

    // Chuyển đổi magnet link thành torrent
    magnetLinkToTorrent(magnetLink) {
        const hash = magnetLink.split('btih:')[1];
        return Buffer.from(hash, 'hex');
    }
}

// Khởi động tracker server
const tracker = new Tracker();
tracker.startServer('127.0.0.1', 8000);