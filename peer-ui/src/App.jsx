import React, { useEffect, useState } from "react";
import FileConverter from "./FileConverter";
import FileDownloader from "./FileDownloader";
import DownloadProgress from "./DownloadProgress";
import FileEncoder from "./FileEncoder";
import UploadButton from "./UploadButton";

const App = () => {
  const [magnetLink, setMagnetLink] = useState("");
  const [files, setFiles] = useState([]);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Fetch shared files from the server
    const fetchSharedFiles = async () => {
      const response = await fetch("http://localhost:3001/shared-files");
      const data = await response.json();
      setFiles(data); // Update state with the list of shared files
    };

    fetchSharedFiles();
  }, []);

  const handleConvert = (link) => {
    setMagnetLink(link);
  };

  const handleDownload = async (fileName) => {
    const response = await fetch(`http://localhost:3001/download/${fileName}`); // Update with your actual download endpoint
    const reader = response.body.getReader();
    const contentLength = +response.headers.get("Content-Length");

    let receivedLength = 0; // Received bytes
    let chunks = []; // Array of received binary chunks (comprises the body)

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      receivedLength += value.length;

      // Calculate progress
      setDownloadProgress(Math.round((receivedLength / contentLength) * 100));
    }

    // Concatenate chunks into a single Blob
    const chunksAll = new Uint8Array(receivedLength); // Create a new Uint8Array to hold all the data
    let position = 0;
    for (let chunk of chunks) {
      chunksAll.set(chunk, position); // Set each chunk in the right position
      position += chunk.length; // Increment position by the length of the chunk
    }

    // Create a Blob from the concatenated chunks
    const blob = new Blob([chunksAll]);
    const url = window.URL.createObjectURL(blob);

    // Create an anchor element and download the file
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = fileName; // Specify the filename
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url); // Clean up the URL object
  };

  return (
    <div>
      <h1>Peer-to-Peer File Sharing</h1>
      <FileConverter onConvert={handleConvert} />
      {magnetLink && <p>Magnet Link: {magnetLink}</p>}

      <FileEncoder />
      {/* <FileDownloader files={files} onDownload={handleDownload} />
      <DownloadProgress progress={downloadProgress} /> */}
    </div>
  );
};

export default App;
