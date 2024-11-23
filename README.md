## Overview

This project is designed to automate the process of securely uploading backup files to a Telegram channel. It utilizes the Telegram API for handling the communication with Telegram and GPG for encrypting the files before uploading.

Designed to upload files created by `duplicity`. Creates a channel for each full backup and uploads increments there.

## Prerequisites

1. **Node.js**: Ensure you have Node.js installed.
2. **Telegram API Credentials**: Obtain your Telegram API ID and Hash from [my.telegram.org](https://my.telegram.org).
3. **GPG**: Ensure GPG is installed on your system for encrypting files.

## Installation

Clone the repository and install the required dependencies:

```bash
git clone <repository-url>
cd <repository-directory>
npm install
```

## Configuration

1. Create a `.env` file in the project root directory with the following contents:

    ```dotenv
    TELEGRAM_API_ID=your_api_id
    TELEGRAM_API_HASH=your_api_hash
    TELEGRAM_GPG_RECIPIENT=recipient_key_id
    ```

2. The Telegram session token will be saved to this `.env` file upon first run.

## Usage

To start the client and upload the backup files, run the following command, providing the directory path containing your backup files as an argument:

```bash
node index.js /path/to/backup/files
```

During the first run, you will be prompted to log in to your Telegram account to save the session for future use.

## Functionality

The script processes the backup files as follows:

1. **Start Telegram Client**: Authenticates and connects to the Telegram API.
2. **Check Lock File**: Ensures no other instance is running.
3. **Process Manifests**: Scans for manifest files that identify full backups.
4. **Create Telegram Channel**: Creates a new Telegram channel for each backup.
5. **Encrypt and Upload Files**: Encrypts each file using GPG and uploads it to the corresponding Telegram channel.
6. **Update Database**: Keeps track of uploaded files to avoid re-uploads.
7. **Cleanup**: Handles script exit and cleanup operations properly.

## Handling Multiple Backup Sets

The script is designed to handle multiple full backups and uploads them in order based on the last modified time of the files.
