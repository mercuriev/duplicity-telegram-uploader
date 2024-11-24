require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { startClient, client } = require('./src/client');
const fs = require('fs');
const path = require('path');
const { parseISO, format } = require('date-fns');
const glob = require("glob").glob;
const { Api } = require("telegram");
const { spawn } = require('child_process');
const {CustomFile} = require("telegram/client/uploads");

const dirPath = process.argv[2];
if (!dirPath) {
    console.error("Please provide a directory path as the first argument.");
    process.exit(1);
}
const recipient = process.env.TELEGRAM_GPG_RECIPIENT;
if (!recipient) {
    console.error("Please provide the TELEGRAM_GPG_RECIPIENT in the .env file.");
    process.exit(1);
}

// only one uploading instance per directory
const lockFilePath = path.join(dirPath, '.uploading');
if (fs.existsSync(lockFilePath)) {
    console.error("Another instance of the script is running.");
    process.exit(1);
}
fs.writeFileSync(lockFilePath, '');
process.on('exit', () => {
    if (fs.existsSync(lockFilePath)) fs.unlinkSync(lockFilePath);
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

// Store already uploaded files
const dbFile = path.join(dirPath, '.uploaded.json');
let uploaded = {};
if (fs.existsSync(dbFile)) {
    uploaded = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

// there may be more than one full archive set
async function processFull(dateId, forum) {
    let topic = uploaded[dateId]?.topic;
    if (!topic) {
        // service message to start topic's thread. topic is just replies to this service message
        const { updates } = await client.invoke(new Api.channels.CreateForumTopic({
            title: format(parseISO(dateId), 'dd MMM yyyy'),
            channel: forum,
        }));

        uploaded[dateId] = {
            topic: updates[1].message.id,
            files: []
        };
        fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
        topic = uploaded[dateId].topic;
    }

    // encrypt and upload files, oldest first
    let files = (await glob(`*.${dateId}.*`, { cwd: dirPath, ignore: '*.gpg', stat: true, withFileTypes: true }))
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map(path => path.name);
    for (let file of files) {
        if (uploaded[dateId].files.includes(file)) continue;

        console.log(`Encrypting ${file}...`);
        const buffer = await gpg(file);
        buffer.name = file;

        console.log(`Uploading ${file}...`);
        // must use uploadFile() to set maxBufferSize, it fails to create CustomBuffer otherwise
        const uploadedFile = await client.uploadFile({
            file: new CustomFile(file, buffer.length, '', buffer),
            maxBufferSize: buffer.length
        });
        await client.sendFile(new Api.PeerChannel({ channelId: forum }), {
            file: uploadedFile,
            caption: '',
            replyTo: topic
        })

        // write immediately in case of later errors
        uploaded[dateId].files.push(file);
        fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
    }
}

(async () => {
    await startClient();

    // Process each full backup one by one
    const files = await glob('*.manifest', { cwd: dirPath, ignore: '*.to.*' });
    for (const file of files) {
        const match = file.match(/(.*?)_duplicity-full\.(\d{8}T\d{6}Z)\.manifest/);
        if (!match) throw new Error('Invalid manifest filename format.');

        const hostname = match[1];
        if (!uploaded['forum']) {
            const channel = await client.invoke(new Api.channels.CreateChannel({
                title: `Backups of ${hostname}`,
                about: '',
                forum: true
            }))
            uploaded['forum'] = Number(channel.chats[0].id);
            console.log(`Created forum ${uploaded['forum']}`);

            fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
        }

        await processFull(match[2], uploaded['forum']);
    }

    await client.disconnect();
    fs.unlinkSync(lockFilePath);
    process.exit(0);
})();

function gpg(file) {
    return new Promise((resolve, reject) => {
        const gpg = spawn(
            'gpg',
            ['--batch', '--yes', '-o', '-', '-e', '-r', recipient, path.join(dirPath, file)]
        );
        const chunks = [];

        gpg.stdout.on('data', (chunk) => {
            chunks.push(chunk);
        });

        gpg.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with code ${code}`));
            } else {
                const buffer = Buffer.concat(chunks);
                resolve(buffer);
            }
        });
    });
}
