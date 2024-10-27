const net = require('net');
const fs = require('fs');
const path = require('path');

class Peer {
    constructor(peerPort) {
        this.peerPort = peerPort;
        this.sharedDirectory = './shared_files'; // Thư mục chứa tệp chia sẻ
        this.server = null;
    }

    // 1. Lấy danh sách các tệp sẵn sàng chia sẻ
    getLocalFiles() {
        return fs.readdirSync(this.sharedDirectory);
    }

    // 2. Gửi toàn bộ tệp tới một peer khác
    sendFileToClient(ipAddress, filePath) {
        const client = net.createConnection({ host: ipAddress, port: this.peerPort }, () => {
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(client);
        });
    }

    // 3. Gửi một mảnh cụ thể của tệp tới một peer khác
    sendPiece(ipAddress, filePath, pieceIdx, pieceSize = 1024) {
        const client = net.createConnection({ host: ipAddress, port: this.peerPort }, () => {
            const start = pieceIdx * pieceSize;
            const end = start + pieceSize - 1;
            const fileStream = fs.createReadStream(filePath, { start, end });
            fileStream.pipe(client);
        });
    }

    // 4. Kết nối tới server (tracker)
    connectToServer(host, port) {
        const client = net.createConnection({ host, port }, () => {
            console.log(`Connected to server at ${host}:${port}`);
        });
        client.on('data', (data) => {
            console.log(`Server response: ${data.toString()}`);
        });
        client.on('end', () => {
            console.log('Disconnected from server');
        });
        return client;
    }

    // 5. Yêu cầu tệp từ server (tracker)
    requestFileFromServer(client, fname) {
        client.write(`REQUEST_FILE ${fname}`);
    }

    // 6. Yêu cầu các phần tệp từ peer khác
    requestFilePieceFromPeer(selfIpAddress, ipAddress, fname, pieces) {
        pieces.forEach((pieceIdx) => {
            this.sendPiece(ipAddress, path.join(this.sharedDirectory, fname), pieceIdx);
        });
    }

    // 7. Lấy một tệp qua mạng
    fetchFile(sock, fname) {
        const filePath = path.join(this.sharedDirectory, fname);
        const writeStream = fs.createWriteStream(filePath);
        sock.pipe(writeStream);
    }

    // 8. Kết hợp các mảnh tệp thành một tệp hoàn chỉnh
    mergeFile(fname, totalPieces, pieceSize = 1024) {
        const filePath = path.join(this.sharedDirectory, fname);
        const writeStream = fs.createWriteStream(filePath);
        for (let i = 0; i < totalPieces; i++) {
            const piecePath = `${filePath}.part${i}`;
            const pieceStream = fs.createReadStream(piecePath);
            pieceStream.pipe(writeStream, { end: false });
            pieceStream.on('end', () => fs.unlinkSync(piecePath));
        }
    }

    // 9. Đăng tải tệp lên tracker để chia sẻ
    publishFile(sock, fname) {
        sock.write(`PUBLISH_FILE ${fname}`);
    }

    // 10. Thông báo cho tracker về các mảnh sẵn sàng chia sẻ
    notifyTracker(sock, fname, pieceIdx) {
        sock.write(`NOTIFY_TRACKER ${fname} ${pieceIdx.join(',')}`);
    }

    // 11. Tiếp tục gửi một phần cụ thể nếu quá trình truyền bị gián đoạn
    resumeSend(ipAddress, filePath, pieceIdx, pieceSize = 1024) {
        this.sendPiece(ipAddress, filePath, pieceIdx, pieceSize);
    }

    // Khởi tạo server để peer sẵn sàng nhận tệp từ các peer khác
    startPeerServer() {
        this.server = net.createServer((socket) => {
            socket.on('data', (data) => {
                const request = data.toString().trim();
                const [command, ...args] = request.split(' ');

                if (command === 'REQUEST_FILE') {
                    const [fileName] = args;
                    this.sendFileToClient(socket.remoteAddress, path.join(this.sharedDirectory, fileName));
                } else if (command === 'REQUEST_PIECE') {
                    const [fileName, pieceIdx] = args;
                    this.sendPiece(socket.remoteAddress, path.join(this.sharedDirectory, fileName), parseInt(pieceIdx, 10));
                }
            });
        });

        this.server.listen(this.peerPort, () => {
            console.log(`Peer server listening on port ${this.peerPort}`);
        });
    }
}

// Sử dụng lớp Peer
const peer = new Peer(9000);
peer.startPeerServer();

// Ví dụ: Kết nối tới tracker server và yêu cầu tệp
const trackerClient = peer.connectToServer('127.0.0.1', 8000);
peer.requestFileFromServer(trackerClient, 'example.txt');