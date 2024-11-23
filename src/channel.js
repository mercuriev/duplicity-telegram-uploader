const { client } = require('./client');
const { Api } = require('telegram');

async function create(name) {
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

module.exports = { create };