import React, { useState } from "react";
import UploadButton from "./UploadButton";

const trackerUrl = "http://localhost:4000/announce";

const FileConverter = ({ onConvert }) => {
  const [file, setFile] = useState(null);
  const [magnetLink, setMagnetLink] = useState("");
  const [torrentLink, setTorrentLink] = useState("");
  const [trackerUrl, setTrackerUrl] = useState(
    "http://localhost:4000/announce"
  );

  const convertToMagnet = async () => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:4000/create-magnet", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error("Failed to create magnet link");
        }

        const data = await response.json();
        const magnetLink = data.magnetLink; // Assuming the API returns a `magnetLink` field
        setMagnetLink(magnetLink);
        onConvert(magnetLink);
      } catch (error) {
        console.error("Error creating magnet link:", error);
      }
    } else {
      console.error("No file selected.");
    }
  };

  const convertToTorrent = async () => {
    if (file) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("http://localhost:4000/create-torrent", {
          method: "POST",
          body: { formData, trackerUrl: trackerUrl },
        });

        if (!response.ok) {
          throw new Error("Failed to create torrent file");
        }

        const data = await response.json();
        const torrentFilePath = data.torrentFilePath; // Assuming the API returns a `torrentFilePath` field
        setTorrentLink(torrentFilePath);
        console.log(`Torrent file created: ${torrentFilePath}`);
      } catch (error) {
        console.error("Error creating torrent file:", error);
      }
    } else {
      console.error("No file selected.");
    }
  };

  const handleTrackerUrlChange = (event) => {
    const url = event.target.value;
    if (url) {
      setTrackerUrl(url);
    }
  };

  return (
    <div>
      <UploadButton />
      <label htmlFor="trackerUrl">Tracker Url: </label>
      <input
        type="text"
        onChange={handleTrackerUrlChange}
        id="trackerUrl"
        value={trackerUrl}
      />
      <button onClick={convertToMagnet}>Convert to Magnet</button>
      <button onClick={convertToTorrent}>Convert to Torrent</button>
      {magnetLink && <p>Magnet Link: {magnetLink}</p>}
      {torrentLink && <p>Torrent File: {torrentLink}</p>}
    </div>
  );
};

export default FileConverter;
