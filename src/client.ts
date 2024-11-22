import {TelegramClient} from 'telegram';
import {StringSession} from 'telegram/sessions';
import input from 'input';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config();

const apiId: number = parseInt(process.env.TELEGRAM_API_ID || '');
const apiHash: string = process.env.TELEGRAM_API_HASH || '';

if (!apiId || !apiHash) {
    throw new Error('API ID or API Hash is missing');
}

// Extract session from .env, default to empty string if not present
const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

export const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

export async function startClient(): Promise<void> {
    await client.start({
        phoneNumber: async () => await input.text('Please enter your number: '),
        password: async () => await input.text('Please enter your password: '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.error(err),
    });

    console.log('You are now connected.');
    // @ts-ignore
    saveSession(client.session.save());
}

// Function to save session string to .env file
function saveSession(session: string): void {
    const envPath = '.env';
    let envContent = fs.readFileSync(envPath, 'utf8');

    // Update the session string in the .env file
    if (envContent.includes('TELEGRAM_SESSION')) {
        envContent = envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION=${session}`);
    } else {
        envContent += `\nTELEGRAM_SESSION=${session}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('Session string saved to .env file');
}
