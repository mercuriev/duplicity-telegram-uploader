import { startClient, client } from 'client';
import {Api} from "telegram";

export async function createChannel(): Promise<void> {
    try {
        const result = await client.invoke(
            new Api.channels.CreateChannel({
                title: 'My Awesome Channel',
                about: 'This is a testing channel created using the Telegram API',
                megagroup: false,
            })
        );
        console.log('Channel Created:', result);
    } catch (error) {
        console.error("Error creating channel:", error);
    }
}

(async () => {
    await startClient();

    // After starting client, you can call other functions like createChannel
    await createChannel();

    // Disconnect the client after the operations
    await client.disconnect();
})();
