import { client } from 'client';
import { Api } from 'telegram';

export async function create(name: string): Promise<void> {
    try {
        const result = await client.invoke(
            new Api.channels.CreateChannel({
                title: name,
                about: '',
                megagroup: false,
            })
        );
        return result.chats[0];
    } catch (error) {
        console.error("Error creating channel:", error);
    }
}
