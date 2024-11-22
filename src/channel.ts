import { client } from 'client';
import { Api } from 'telegram';

export async function create(name: string): Promise<object> {
    const result = await client.invoke(
        new Api.channels.CreateChannel({
            title: name,
            about: '',
            megagroup: false,
        })
    );
    if (!result.chats[0]) throw new Error("Channel creation failed");
    return result.chats[0];
}
