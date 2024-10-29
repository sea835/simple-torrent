import React, { useState } from "react";
import axios from "axios";
const trackerUrl = "http://localhost:4000";

const UploadButton = ({ onUpload }) => {
  const [output, setOutput] = useState("");

  const [selectedFile, setSelectedFile] = useState(null);

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
  return (
    <div>
      {/* File Upload Input */}
      <input type="file" onChange={handleFileChange} />
      <br />

      {/* Upload and Read Buttons */}
      <button onClick={handleFileUpload}>Upload File</button>
      <pre>{output}</pre>
    </div>
  );
};

export default UploadButton;
