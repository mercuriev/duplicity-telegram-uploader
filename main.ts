// src/main.ts
import { startClient, client } from 'client';
import * as channel from 'channel';
import * as fs from 'fs';
import * as path from 'path';
import { parseISO, format } from 'date-fns';
import * as dotenv from 'dotenv';

(async () => {
    // Read the directory path from first CLI argument
    const dirPath = process.argv[2];
    if (!dirPath) {
        console.error("Please provide a directory path as the first argument.");
        process.exit(1);
    }

    dotenv.config();
    const recipient = process.env.TELEGRAM_GPG_RECIPIENT;
    if (!recipient) {
        console.error("Please provide the TELEGRAM_GPG_RECIPIENT in the .env file.");
        process.exit(1);
    }

    // Get the list of files in the directory and sort sequentially by volume number
    let volumes: string[] = [];
    let manifestFile: string | undefined = undefined;

    try {
        let files = fs.readdirSync(dirPath);

        manifestFile = files.find(file => file.endsWith('.manifest'));
        if (!manifestFile) throw new Error('No manifest file found.');
        const match = manifestFile.match(/(.*?)_duplicity-full\.(\d{8}T\d{6}Z)\.manifest/);
        if (!match) throw new Error('Invalid manifest filename format.');

        const hostname = match[1];
        const date = parseISO(match[2]);

        // Encrypt files
        for (const file of files) {
            if (!file.endsWith('.gpg') && !fs.existsSync(`${path.join(dirPath, file)}.gpg`)) {
                const execSync = require('child_process').execSync;
                console.log(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
                execSync(`gpg -e -r ${recipient} ${path.join(dirPath, file)}`);
            }
        }
        files = fs.readdirSync(dirPath);
        files = files.filter(file => file.endsWith('.gpg'));

        /**
         * Uploading starts here.
         */
        await startClient();

        const chat = await channel.create(`Backup: ${hostname} - ` + format(date, 'dd MMM yyyy'));
        console.log(`Created ${chat.id.value} - ${chat.title}`);

        for (const file of files) {
            console.log(`Uploading ${file}...`);
            await client.sendFile(chat.id.value, {
                file: path.join(dirPath, file),
                caption: ''
            })
            fs.unlinkSync(file);
        }
    }
    catch (error) {
        console.error(error);
        process.exit(1);
    }

    await client.disconnect();
})();
