import { useState, useEffect, useCallback } from "react";
import axios from "axios";

function App() {
  const [torrent, setTorrent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [torrents, setTorrents] = useState([]);
  const [torrentData, setTorrentData] = useState({});
  const [peerData, setPeerData] = useState({});

  // Handle file selection
  const handleOnUpload = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // Upload Torrent File
  const uploadTorrent = async () => {
    try {
      const formData = new FormData();
      formData.append("file", selectedFile, selectedFile.name);

      const response = await axios.post(
        "http://localhost:10000/createTorrent",
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

  // Handle Torrent Creation
  const handleOnCreateTorrent = useCallback(() => {
    uploadTorrent();
  }, [selectedFile]);

  // Fetch Peers
  const getPeers = useCallback(async (fileName, announce) => {
    try {
      const response = await axios.get(
        `${announce.replace("/announce", "")}/peers?fileName=${fileName}`
      );
      setPeerData(response.data);
      console.log("Peers:", response.data);
    } catch (error) {
      console.error("Error fetching peers:", error);
    }
  }, []);

  // Handle Reading Torrent
  const handleOnReadTorrent = useCallback(async (file) => {
    try {
      const response = await axios.post("http://localhost:10000/readTorrent", {
        file: file,
      });

      const responsed = response.data;
      const announceString = String.fromCharCode(
        ...Object.values(responsed.announce)
      );
      const fileNameString = String.fromCharCode(
        ...Object.values(responsed.hashinfo.file_name)
      );

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

  // Fetch torrent data when `torrentData` changes
  useEffect(() => {
    if (torrentData.fileName && torrentData.announce) {
      getPeers(torrentData.fileName, torrentData.announce);
    }
  }, [torrentData, getPeers]);

  // useEffect(() => {
  const connectPeer = async () => {
    try {
      const response = await axios.post("http://localhost:3000/connect", {
        ip: "localhost",
        port: 5173,
        files: files,
      });
      console.log("Connected to tracker:", response.data);
    } catch (error) {
      console.error("Error connecting to tracker:", error);
    }
  };

  // }, [setFiles]);

  // Fetch Files from backend
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await axios.get("http://localhost:10000/files");
        setFiles(response.data.files || []); // Update file list
        connectPeer();
      } catch (error) {
        console.error("Error fetching files:", error);
      }
    };
    fetchFiles();
  }, []);

  // Fetch Torrents from backend
  useEffect(() => {
    const fetchTorrents = async () => {
      try {
        const response = await axios.get("http://localhost:10000/torrents");
        setTorrents(response.data.files || []); // Update torrent list
      } catch (error) {
        console.error("Error fetching torrents:", error);
      }
    };
    fetchTorrents();
  }, []);

  return (
    <div className="container flex flex-col w-[1200px] mx-auto bg-slate-100 px-20 py-20 rounded-xl">
      <h2 className="py-6 text-[30px] font-semibold">Torrent App</h2>

      {/* Files List Section */}
      <div className="border-2 w-full p-6 border-blue-500 rounded-xl mb-10">
        <h3 className="pb-6 text-[20px] font-semibold">Files in the shared:</h3>
        {files.length > 0 ? (
          <ul className="bg-slate-50 w-1/2 rounded-xl px-4 py-4">
            {files.map((file) => (
              <li
                key={file}
                className="pl-6 py-2 border-2 border-slate-200 w-full text-[16px] mb-2 rounded-lg"
              >
                {file}
              </li>
            ))}
          </ul>
        ) : (
          <p>No files found</p>
        )}
        <button
          onClick={handleOnCreateTorrent}
          className="px-10 py-2 bg-blue-500 rounded-lg text-white font-semibold"
        >
          Add shared file
        </button>
      </div>

      {/* Torrent Creation Section */}
      <div className="border-2 w-full p-6 border-blue-500 rounded-xl mb-10">
        <h3 className="pb-6 text-[20px] font-semibold">Create Torrent</h3>

        {/* Torrent Files List */}
        <div className="flex flex-row w-full">
          <div className="w-1/2 bg-slate-50 rounded-l-xl">
            {torrents.length > 0 ? (
              <ul className="w-full px-4 py-4">
                {torrents.map((file) => (
                  <>
                    {file !== "Chunk_List" ? (
                      <li
                        key={file}
                        className="pl-6 py-2 border-2 border-slate-200 w-full text-[16px] mb-2 rounded-lg"
                        onClick={() => handleOnReadTorrent(file)}
                      >
                        {file}
                      </li>
                    ) : (
                      <></>
                    )}
                  </>
                ))}
              </ul>
            ) : (
              <p>No torrent files found</p>
            )}
          </div>

          {/* Torrent Details Section */}
          <div className="w-1/2 bg-slate-50 rounded-r-xl px-4 py-4">
            <h3 className="pb-6 text-[20px] font-semibold">Torrent Details:</h3>
            {torrentData.fileName && (
              <div className="flex flex-row w-full">
                <div className="w-1/2">
                  <p className="py-2 font-semibold text-[16px]">Announce:</p>
                  <p className="py-2 font-semibold text-[16px]">File Name:</p>
                  <p className="py-2 font-semibold text-[16px]">Chunk Size:</p>
                  <p className="py-2 font-semibold text-[16px]">File Size:</p>
                  <p className="py-2 font-semibold text-[16px]">Num Chunks:</p>
                  <p className="py-2 font-semibold text-[16px]">
                    Number of Peers
                  </p>
                </div>
                <div className="w-1/2">
                  <p className="py-2 text-[16px]">{torrentData.announce}</p>
                  <p className="py-2 text-[16px]">{torrentData.fileName}</p>
                  <p className="py-2 text-[16px]">{torrentData.chunkSize}</p>
                  <p className="py-2 text-[16px]">{torrentData.fileSize}</p>
                  <p className="py-2 text-[16px]">{torrentData.numChunks}</p>
                  <p className="py-2 text-[16px]">
                    {peerData.peers ? peerData.peers.length : 0}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Upload Section */}
        <div className="bg-emerald-400 w-fit px-10 py-3 rounded-lg text-white font-semibold mt-4">
          <input type="file" onChange={handleOnUpload} />
          <button
            onClick={handleOnCreateTorrent}
            className="px-10 py-2 bg-blue-500 rounded-lg text-white font-semibold ml-4"
          >
            Create Torrent
          </button>
        </div>

        {/* Torrent Download Section */}
        {torrent && (
          <div className="bg-white w-fit px-10 pb-10 mt-10 rounded-xl">
            <p className="py-4 font-semibold text-[16px]">
              Torrent file created:
            </p>
            <a
              href={torrent}
              download
              className="px-10 py-2 bg-blue-500 rounded-lg text-white font-semibold"
            >
              Download Torrent File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
