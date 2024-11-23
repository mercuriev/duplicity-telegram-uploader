require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { startClient, client } = require('./src/client');
const channel = require('./src/channel');
const fs = require('fs');
const path = require('path');
const { parseISO, format } = require('date-fns');
const glob = require("glob").glob; // Note: `glob` needs to be imported differently in CommonJS.
const { Api } = require("telegram");

const lockFilePath = path.join(__dirname, '.uploading');
if (fs.existsSync(lockFilePath)) {
    console.error("Another instance of the script is running.");
    process.exit(1);
}
fs.writeFileSync(lockFilePath, '');

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

// Store already uploaded files
const dbFile = path.join(dirPath, '.uploaded.json');
let uploaded = {};
if (fs.existsSync(dbFile)) {
    uploaded = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

// there may be more than one full archive set
async function processFull(dateId, hostname) {
    const date = parseISO(dateId);

    let chat = uploaded[dateId]?.chat;
    if (!chat) {
        const { id, title } = await channel.create(`Backup: ${hostname} - ` + format(date, 'dd MMM yyyy'));
        console.log(`Created ${id.value} - ${title}`);
        uploaded[dateId] = {
            chat: Number(id.value),
            title: title,
            files: []
        };
        fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
        chat = uploaded[dateId].chat;
    }

    // encrypt and upload files, oldest first
    let files = (await glob(`*.${dateId}.*`, { cwd: dirPath, ignore: '*.gpg', stat: true, withFileTypes: true }))
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map(path => path.name);
    for (let file of files) {
        if (uploaded[dateId].files.includes(file)) continue;

        const execSync = require('child_process').execSync;
        console.log(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
        execSync(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
        file = file + '.gpg';

        console.log(`Uploading ${file}...`);
        await client.sendFile(new Api.PeerChannel({ channelId: chat }), {
            file: path.join(dirPath, file),
            caption: ''
        })
        fs.unlinkSync(path.join(dirPath, file));

        // write immediately in case of later errors
        uploaded[dateId].files.push(file);
        fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
    }
}

process.on('exit', () => {
    if (fs.existsSync(lockFilePath)) {
        fs.unlinkSync(lockFilePath);
    }
});
process.on('SIGINT', () => process.exit());
process.on('SIGTERM', () => process.exit());

(async () => {
    await startClient();

    // Process each full backup one by one
    const files = await glob('*.manifest', { cwd: dirPath, ignore: '*.to.*' });
    for (const file of files) {
        const match = file.match(/(.*?)_duplicity-full\.(\d{8}T\d{6}Z)\.manifest/);
        if (!match) throw new Error('Invalid manifest filename format.');
        await processFull(match[2], match[1]);
    }

    await client.disconnect();
    fs.unlinkSync(lockFilePath);
    process.exit(0);
})();
