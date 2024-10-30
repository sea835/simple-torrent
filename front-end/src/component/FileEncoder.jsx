import React, { useState } from "react";
import axios from "axios";

const trackerUrl = "http://localhost:4000"; // Update with your tracker URL

const FileEncoder = () => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [torrentInfo, setTorrentInfo] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  // Function to parse magnet link
  const parseMagnetLink = (magnetLink) => {
    const url = new URL(magnetLink);
    if (url.protocol !== "magnet:") {
      throw new Error("Invalid magnet link");
    }

    const params = new URLSearchParams(url.search);
    const result = {};

    for (const [key, value] of params.entries()) {
      if (key === "xt" && value.startsWith("urn:btih:")) {
        result.infoHash = value.substring(9);
      } else {
        result[key] = value;
      }
    }

    return result;
  };

  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleTranslate = () => {
    try {
      const parsed = parseMagnetLink(input);
      setOutput(JSON.stringify(parsed, null, 2));
    } catch (error) {
      setOutput("Invalid magnet link");
    }
  };

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  // Function to upload the torrent file to the server
  const handleFileUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file to upload.");
      return;
    }

    const formData = new FormData();
    formData.append("torrentFile", selectedFile);

    try {
      const response = await axios.post(
        `${trackerUrl}/upload-torrent`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );
      setOutput(`Torrent file uploaded: ${response.data}`);
    } catch (error) {
      setOutput(`Failed to upload torrent file: ${error.message}`);
    }
  };

  // Function to read a torrent file from the server
  const handleReadTorrent = async () => {
    const fileName = selectedFile.name; // Assuming the file is already uploaded
    try {
      const response = await axios.get(
        `${trackerUrl}/read-torrent/${fileName}`
      );
      const torrentData = response.data;

      setTorrentInfo(torrentData);
      setOutput(JSON.stringify(torrentData, null, 2));
    } catch (error) {
      setOutput(`Failed to read torrent file: ${error.message}`);
    }
  };

  return (
    <div>
      <h1>Magnet Link and Torrent Reader</h1>

      {/* Magnet Link Input */}
      <textarea
        value={input}
        onChange={handleInputChange}
        placeholder="Enter magnet link"
        rows="5"
        cols="50"
      />
      <br />
      <button onClick={handleTranslate}>Translate Magnet Link</button>

      {/* File Upload Input */}
      <input type="file" accept=".torrent" onChange={handleFileChange} />
      <br />

      {/* Upload and Read Buttons */}
      <button onClick={handleFileUpload}>Upload Torrent File</button>
      <button onClick={handleReadTorrent}>Read Torrent File</button>

      <pre>{output}</pre>

      {/* Display Torrent Information */}
      {torrentInfo && (
        <div>
          <h2>Torrent Information</h2>
          <p>
            <strong>Announce URL:</strong> {torrentInfo.announce}
          </p>
          <p>
            <strong>Piece Length:</strong> {torrentInfo.pieceLength} bytes
          </p>
          <p>
            <strong>Number of Pieces:</strong> {torrentInfo.pieces.length / 20}{" "}
            {/* Pieces are 20 bytes each */}
          </p>
          <h3>Full Info</h3>
          <pre>{JSON.stringify(torrentInfo.info, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default FileEncoder;
