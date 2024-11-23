const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');

const apiId = parseInt(process.env.TELEGRAM_API_ID || '');
const apiHash = process.env.TELEGRAM_API_HASH || '';

if (!apiId || !apiHash) {
    throw new Error('API ID or API Hash is missing');
}

const stringSession = new StringSession(process.env.TELEGRAM_SESSION || '');

const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
});

async function startClient() {
    await client.start({
        phoneNumber: async () => await input.text('Please enter your number: '),
        password: async () => await input.text('Please enter your password: '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => console.error(err),
    });

    console.log('You are now connected.');
    saveSession(client.session.save());
}

function saveSession(session) {
    const envPath = __dirname + '/../.env';
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('TELEGRAM_SESSION')) {
        envContent = envContent.replace(/TELEGRAM_SESSION=.*/, `TELEGRAM_SESSION=${session}`);
    } else {
        envContent += `\nTELEGRAM_SESSION=${session}`;
        console.log('Session string saved to .env file');
    }

    fs.writeFileSync(envPath, envContent);
}

module.exports = { client, startClient };
