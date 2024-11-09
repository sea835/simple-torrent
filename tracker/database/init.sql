-- Create the database
CREATE DATABASE Tracker;
-- Switch to the database
USE Tracker;
-- Create the hosts table
CREATE TABLE Hosts (
    host_name VARCHAR(255) NOT NULL,
    ip VARCHAR(255) NOT NULL,
    port INT NOT NULL,
    Primary key (host_name)
);
-- Create the files table
CREATE TABLE Files (
    host_name VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_hash VARCHAR(255) NOT NULL,
    primary key (host_name,file_name),
    FOREIGN KEY (host_name) REFERENCES Hosts(host_name) ON DELETE CASCADE
);
-- Create the Downloads table
CREATE TABLE Downloads (
    downloader_host_name VARCHAR(255) NOT NULL,  -- The host name of the downloader
    sender_host_name VARCHAR(255) NOT NULL,      -- The host name of the sender
    file_name VARCHAR(255) NOT NULL,             -- The name of the file being downloaded
    download_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,  -- The date and time of the download
    PRIMARY KEY (downloader_host_name, sender_host_name, file_name, download_date)
);


