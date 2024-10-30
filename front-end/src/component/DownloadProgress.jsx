import React from "react";

const DownloadProgress = ({ progress }) => {
  return (
    <div>
      <h3>Download Progress</h3>
      <progress value={progress} max="100"></progress>
      <span>{progress}%</span>
    </div>
  );
};

export default DownloadProgress;
