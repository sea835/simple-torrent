import { useState, useEffect, useCallback } from "react";
import axios from "axios";

const chunk_SIZE = 50 * 1024;

const CLIENT_PORT = 10001;

function App() {
  const [torrent, setTorrent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [torrents, setTorrents] = useState([]);
  const [torrentData, setTorrentData] = useState({});
  const [peerData, setPeerData] = useState({});
  const [downloadedFiles, setDownloadedFiles] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("Not Started");
  const [chunk, setChunk] = useState(0);

  const [torrentFile, setTorrentFile] = useState(null);
  const [magnetLink, setMagnetLink] = useState("");
  const [createdMagnetLink, setCreatedMagnetLink] = useState("");
  const [parsedTorrentData, setParsedTorrentData] = useState(null);

  // Create Magnet Link
  const handleCreateMagnetLink = async () => {
    if (!torrentFile) {
      console.error("No torrent file selected");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("torrentFile", torrentFile);
      // console.log("torrentFile:", torrentFile);

      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/createMagnet`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setCreatedMagnetLink(response.data.magnetLink);
      //console.log("Magnet link created:", response.data.magnetLink);
    } catch (error) {
      console.error("Error creating magnet link:", error);
    }
  };

  // Parse Magnet Link
  const handleParseMagnetLink = async () => {
    if (!magnetLink) {
      console.error("No magnet link provided");
      return;
    }
    try {
      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/parseMagnet`,
        { magnetLink }
      );
      setParsedTorrentData(response.data);
      //console.log("Parsed torrent data:", response.data);
    } catch (error) {
      console.error("Error parsing magnet link:", error);
    }
  };

  // Handle file selection
  const handleOnUpload = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const uploadTorrent = async () => {
    try {
      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);

      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/createTorrent`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("Torrent uploaded successfully:", response.data);
      setTorrent(response.data); // Store the torrent file for download
    } catch (error) {
      console.error("Error uploading torrent:", error);
    }
  };

  const downloadFile = async (fileName) => {
    try {
      setDownloadStatus("In Progress");
      setDownloadProgress(0);

      const msg = await axios.get(
        `http://localhost:${CLIENT_PORT}/clearDownload`
      );
      // console.log(msg.data);

      // Initialize the download request
      axios.post(`http://localhost:${CLIENT_PORT}/download`, {
        fileName: fileName,
        trackerUrl: "http://localhost:5000",
        numChunks: chunk,
      });

      // Start checking download progress
      const interval = setInterval(async () => {
        const chunkResponse = await axios.get(
          `http://localhost:${CLIENT_PORT}/downloadProgress`,
          {
            params: { fileName },
          }
        );

        const receivedChunks = chunkResponse.data.receivedChunks;

        console.log("Received chunks:", receivedChunks);
        console.log("Total chunks:", chunk);

        // Calculate the percentage
        const progress = Math.ceil((receivedChunks / chunk) * 100);
        setDownloadProgress(progress);

        // Check if download is complete
        if (receivedChunks >= chunk) {
          setDownloadStatus("Finished");
          clearInterval(interval);
        }
      }, 500); // Adjust interval as needed
    } catch (error) {
      console.error("Error downloading file:", error);
      setDownloadStatus("Failed");
    }
  };

  const uploadSharedFile = async () => {
    try {
      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);

      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/uploadFile`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("File uploaded successfully:", response.data);
    } catch (error) {
      console.error("Error uploading file:", error);
    }
  };

  const handleOnCreateTorrent = useCallback(() => {
    uploadTorrent();
    uploadSharedFile();
  }, [selectedFile]);

  const handleOnDownloadFile = (fileName) => {
    downloadFile(fileName);
  };

  const getPeers = useCallback(async (fileName, announce) => {
    try {
      const response = await axios.get(
        `${announce.replace("/announce", "")}/peers?fileName=${fileName}`
      );
      setPeerData(response.data);
      console.log("Peers:", peerData);
    } catch (error) {
      console.error("Error fetching peers:", error);
    }
  }, []);

  const handleOnReadTorrent = useCallback(async (file) => {
    try {
      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/readTorrent`,
        {
          file: file,
        }
      );

      const responsed = response.data;
      const announceString = String.fromCharCode(
        ...Object.values(responsed.announce)
      );
      const fileNameString = String.fromCharCode(
        ...Object.values(responsed.hashinfo.file_name)
      );

      const numberOfChunks = Math.ceil(
        responsed.hashinfo.file_size / chunk_SIZE
      );

      setChunk(numberOfChunks);

      setTorrentData({
        announce: announceString,
        fileName: fileNameString,
        chunkSize: responsed.hashinfo.chunk_size,
        fileSize: responsed.hashinfo.file_size,
        numChunks: responsed.hashinfo.num_chunks,
      });
    } catch (error) {
      console.error("Error reading torrent:", error);
    }
  }, []);

  useEffect(() => {
    if (torrentData.fileName && torrentData.announce) {
      getPeers(torrentData.fileName, torrentData.announce);
    }
  }, [torrentData, getPeers]);

  const connectPeer = async () => {
    try {
      const response = await axios.post(
        `http://localhost:${CLIENT_PORT}/connect`,
        {
          ip: "localhost",
          port: CLIENT_PORT + 1,
          files: files,
        }
      );
      console.log("Connected to tracker:", response.data);
    } catch (error) {
      console.error("Error connecting to tracker:", error);
    }
  };

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get(
          `http://localhost:${CLIENT_PORT}/files`
        );
        setFiles(response.data.files || []); // Update file list
        connectPeer();
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };
    fetchFiles();
  }, []);

  useEffect(() => {
    const fetchDownloadFiles = async () => {
      try {
        const response = await axios.get(
          `http://localhost:${CLIENT_PORT}/downloadedFiles`
        );
        setDownloadedFiles(response.data.files || []); // Update file list
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };
    fetchDownloadFiles();
  }, [downloadFile]);

  useEffect(() => {
    const fetchTorrents = async () => {
      try {
        const response = await axios.get(
          `http://localhost:${CLIENT_PORT}/torrents`
        );
        setTorrents(response.data.files || []); // Update torrent list
      } catch (error) {
        console.error("Error fetching torrents:", error);
      }
    };
    fetchTorrents();
  }, [uploadTorrent]);

  return (
    <div className="container w-[1200px] mx-auto mt-6 bg-gray-900 text-white rounded-lg shadow-md">
      {/* Header */}
      <header className="p-6 text-center bg-gradient-to-r from-indigo-500 to-purple-700 rounded-t-lg">
        <h2 className="text-3xl font-bold">Simple Torrent Client</h2>
      </header>

      {/* Main row - Torrent files, Torrent details, and Shared files */}
      <div className="flex space-x-4 mt-4">
        {/* Torrent Files List */}
        <section className="w-1/3 p-6 bg-gray-800 rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Torrent Files</h3>
          <div className="bg-gray-700 p-4 rounded-lg h-[500px] overflow-y-auto">
            {torrents.length > 0 ? (
              <ul className="space-y-2">
                {torrents.map((file) => (
                  <li
                    key={file}
                    onClick={() => handleOnReadTorrent(file)}
                    className="py-1 pl-2 hover:bg-gray-600 rounded cursor-pointer"
                  >
                    {file}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No torrent files found</p>
            )}
          </div>
        </section>

        {/* Torrent Details */}
        <section className="w-1/3 p-6 bg-gray-800 border-l border-gray-700 border-r rounded-lg shadow-lg">
          <h3 className="text-xl font-semibold mb-4">Torrent Details</h3>
          {torrentData.fileName ? (
            <div className="space-y-2">
              <div>
                <p className="font-medium text-sm text-gray-400">File Name:</p>
                <p>{torrentData.fileName}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-gray-400">Announce:</p>
                <a
                  href={torrentData.announce}
                  className="text-blue-400 underline hover:text-blue-500"
                >
                  {torrentData.announce}
                </a>
              </div>
              <div>
                <p className="font-medium text-sm text-gray-400">File Size:</p>
                <p>{Math.round(torrentData.fileSize / 1024)} KB</p>
              </div>
              <div>
                <p className="font-medium text-sm text-gray-400">
                  Number of Chunks:
                </p>
                <p>{Math.round(torrentData.fileSize / 1024 / 50)}</p>
              </div>
              <div>
                <p className="font-medium text-sm text-gray-400">
                  Peers Connected:
                </p>
                <p>{peerData.peers ? peerData.peers.length : 0}</p>
              </div>
              <div className="space-x-2 mt-4">
                <button
                  onClick={() => handleOnDownloadFile(torrentData.fileName)}
                  className="px-6 py-2 bg-green-500 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Download File
                </button>
              </div>
              {downloadProgress > 0 && (
                <div className="mt-10">
                  <p className="font-medium text-sm text-gray-400">
                    Download Progress:
                  </p>
                  <div className="w-full bg-gray-600 rounded-full h-4">
                    <div
                      className="bg-green-500 h-4 rounded-full"
                      style={{ width: `${downloadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {Math.round(downloadProgress)}%
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    Status: {downloadStatus}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400">
              Select a torrent file to view details
            </p>
          )}
        </section>

        {/* Shared Files and Downloaded Files Section */}
        <aside className="w-1/3 flex flex-col space-y-6">
          <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Shared Files</h3>
            <div className="bg-gray-700 p-4 pt-0 rounded-lg h-[200px] overflow-y-auto">
              {files.length > 0 ? (
                <div>
                  <div className="grid grid-cols-2 font-semibold border-b border-gray-600 pb-2 pt-4 mb-2 sticky top-0 bg-gray-700">
                    <span>File Name</span>
                    <span className="text-right">Size (KB)</span>
                  </div>
                  <ul className="space-y-2">
                    {files
                      .filter((file) => file.fileName !== "Chunk_List")
                      .map((file) => (
                        <li
                          key={file.fileName}
                          className="flex justify-between py-1 px-2 hover:bg-gray-600 rounded cursor-pointer"
                        >
                          <span>{file.fileName}</span>
                          <span>{file.size}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-400">No files found</p>
              )}
            </div>
          </div>

          {/* Downloaded Files Section */}
          <div className="p-6 bg-gray-800 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold mb-4">Downloaded Files</h3>
            <div className="bg-gray-700 p-4 pt-0 rounded-lg h-[200px] overflow-y-auto">
              {downloadedFiles.length > 0 ? (
                <div>
                  <div className="grid grid-cols-2 font-semibold border-b border-gray-600 pb-2 pt-4 mb-2 sticky top-0 bg-gray-700">
                    <span>File Name</span>
                    {/* <span className="text-right">Size (KB)</span> */}
                  </div>
                  <ul className="space-y-2">
                    {downloadedFiles
                      .filter((file) => file.fileName !== "Chunk_List")
                      .map((file) => (
                        <li
                          key={file.fileName}
                          className="flex justify-between py-1 px-2 hover:bg-gray-600 rounded cursor-pointer"
                        >
                          <span>{file.fileName}</span>
                          {/* <span>{file.size}</span> */}
                        </li>
                      ))}
                  </ul>
                </div>
              ) : (
                <p className="text-gray-400">No downloaded files found</p>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Action buttons in Torrent Details */}
      <section className="flex p-6 bg-gray-800 border-t border-gray-700 mt-4 rounded-lg shadow-lg">
        <input
          type="file"
          onChange={handleOnUpload}
          className="text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:bg-blue-500 file:text-white file:border-none cursor-pointer"
        />
        <button
          onClick={handleOnCreateTorrent}
          className="px-6 py-2 bg-purple-500 rounded-lg font-semibold hover:bg-purple-600 transition ml-4"
        >
          Create Torrent
        </button>
        {torrent && (
          <a
            href={torrent}
            download
            className="px-6 py-2 bg-blue-500 rounded-lg font-semibold hover:bg-blue-600 transition ml-6"
          >
            Download Torrent File
          </a>
        )}
      </section>

      {/* Section for creating a magnet link */}
      <section className="p-6 bg-gray-800 rounded-lg shadow-lg mt-4">
        <h3 className="text-xl font-semibold mb-4">Create Magnet Link</h3>
        <input
          type="file"
          onChange={(e) => setTorrentFile(e.target.files[0])}
          className="text-gray-200 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:bg-blue-500 file:text-white file:border-none cursor-pointer"
        />
        <button
          onClick={() => handleCreateMagnetLink()}
          className="px-6 py-2 bg-green-500 rounded-lg font-semibold hover:bg-green-600 transition ml-4"
        >
          Generate Magnet Link
        </button>
        {createdMagnetLink && (
          <div className="mt-4">
            <p className="font-medium text-sm text-gray-400">Magnet Link:</p>
            <input
              type="text"
              value={createdMagnetLink}
              className="w-full text-green-400 bg-gray-700 p-2 rounded-lg"
            />
          </div>
        )}
      </section>

      {/* Section for parsing a magnet link */}
      <section className="p-6 bg-gray-800 rounded-lg shadow-lg mt-4">
        <h3 className="text-xl font-semibold mb-4">Parse Magnet Link</h3>
        <input
          type="text"
          value={magnetLink}
          onChange={(e) => setMagnetLink(e.target.value)}
          placeholder="Enter magnet link"
          className="w-full px-4 py-2 bg-gray-700 rounded-lg text-white"
        />
        <button
          onClick={handleParseMagnetLink}
          className="px-6 py-2 bg-purple-500 rounded-lg font-semibold hover:bg-purple-600 transition mt-4"
        >
          Parse Magnet Link
        </button>
        {parsedTorrentData && (
          <div className="mt-4 text-gray-300">
            <h4 className="font-semibold">Torrent Data:</h4>
            <pre className="bg-gray-700 p-4 rounded-lg overflow-x-auto">
              {JSON.stringify(parsedTorrentData, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="p-4 bg-gray-800 rounded-b-lg text-center text-gray-400 mt-6">
        <p className="text-sm">
          © 2024{" "}
          <span className="text-white font-semibold">
            Ho Chi Minh University
          </span>
          . All rights reserved.
        </p>
        <p className="text-xs">
          This is a demo Torrent Client for educational purposes only.
        </p>
      </footer>
    </div>
  );
}

export default App;
