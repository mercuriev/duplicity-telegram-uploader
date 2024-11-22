import { startClient, client } from 'client';
import * as channel from 'channel';
import * as fs from 'fs';
import * as path from 'path';
import { parseISO, format } from 'date-fns';
import * as dotenv from 'dotenv';
import {glob} from "glob";
import {Api} from "telegram";

dotenv.config();

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
let uploaded: any = {};
if (fs.existsSync(dbFile)) {
    uploaded = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
}

// there may be than one full archive set
async function processFull(dateId: string, hostname: string)
{
    const date: Date = parseISO(dateId);

    // create channel
    let chat = uploaded[dateId]?.chat;
    if (!chat) {
        const {id, title} = await channel.create(`Backup: ${hostname} - ` + format(date, 'dd MMM yyyy'));
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
    let files = (await glob(`*.${dateId}.*`, {cwd: dirPath, ignore: '*.gpg', stat: true, withFileTypes: true}))
        // @ts-ignore
        .sort((a, b) => a.mtimeMs - b.mtimeMs)
        .map(path => path.name);
    for (let file of files) {
        if (uploaded[dateId].files.includes(file)) continue;

        const execSync = require('child_process').execSync;
        console.log(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
        execSync(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
        file = file + '.gpg';

        console.log(`Uploading ${file}...`);
        await client.sendFile(new Api.PeerChat(chat), {
            file: path.join(dirPath, file),
            caption: ''
        })
        fs.unlinkSync(file);

        // write immediately in case of later errors
        uploaded[dateId].files.push(file);
        fs.writeFileSync(dbFile, JSON.stringify(uploaded, null, 2));
    }
}

(async () =>
{
    await startClient();

    // Process each full backup one by one
    const files = await glob('*.manifest', {cwd: dirPath, ignore: '*.to.*'}); // ignore increments manifest
    for (const file of files) {
        const match = file.match(/(.*?)_duplicity-full\.(\d{8}T\d{6}Z)\.manifest/);
        if (!match) throw new Error('Invalid manifest filename format.');
        await processFull(match[2], match[1]);
    }

    await client.disconnect();
})();
