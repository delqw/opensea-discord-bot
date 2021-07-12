import 'dotenv/config';
import Discord, { TextChannel } from 'discord.js';
import fetch from 'node-fetch';
import { ethers } from "ethers";
const http = require('http');
import { parseISO } from 'date-fns'

const requestListener = function (req, res) {
    res.writeHead(200);
    res.end('Hello, World!');
}

const pushed = [];

const discordBot = new Discord.Client();
const  discordSetup = async (): Promise<TextChannel> => {
  return new Promise<TextChannel>((resolve, reject) => {
    ['DISCORD_BOT_TOKEN', 'DISCORD_CHANNEL_ID'].forEach((envVar) => {
      if (!process.env[envVar]) reject(`${envVar} not set`)
    })
  
    discordBot.login(process.env.DISCORD_BOT_TOKEN);
    discordBot.on('ready', async () => {
      const channel = await discordBot.channels.fetch(process.env.DISCORD_CHANNEL_ID!);
      resolve(channel as TextChannel);
    });
  })
}

const buildMessage = (sale: any) => (
  new Discord.MessageEmbed()
	.setColor('#0099ff')
	.setTitle(sale.asset.name + ' sold!')
	.setURL(sale.asset.permalink)
	.setAuthor('OpenSea Bot', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png', 'https://github.com/sbauch/opensea-discord-bot')
	.setThumbnail(sale.asset.collection.image_url)
	.addFields(
		{ name: 'Name', value: sale.asset.name },
		{ name: 'Amount', value: `${ethers.utils.formatEther(sale.total_price)}${ethers.constants.EtherSymbol}`},
		{ name: 'Buyer', value: sale?.winner_account?.address, },
		{ name: 'Seller', value: sale?.seller?.address,  },
	)
  .setImage(sale.asset.image_url)
	.setTimestamp(Date.parse(`${sale?.created_date}Z`))
	.setFooter('Sold on OpenSea', 'https://files.readme.io/566c72b-opensea-logomark-full-colored.png')
)

async function main() {
  const server = http.createServer(requestListener);
  server.listen(process.env.PORT || 8080);
  const channel = await discordSetup();
  const seconds = process.env.SECONDS ? parseInt(process.env.SECONDS) : 3_600;
  setInterval(() => check(channel, seconds), seconds * 1000)
}

async function check(channel, seconds) {
    try {
        const hoursAgo = (Math.round(new Date().getTime() / 1000) - (seconds * 10)); // in the last hour, run hourly?
        const openSeaResponse = await fetch(
            "https://api.opensea.io/api/v1/events?" + new URLSearchParams({
                offset: '0',
                limit: '100',
                event_type: 'successful',
                only_opensea: 'false',
                occurred_after: hoursAgo.toString(),
                collection_slug: process.env.COLLECTION_SLUG!,
                contract_address: process.env.CONTRACT_ADDRESS!
            }), {
                headers: {
                    "X-API-KEY": process.env.OPENSEA_KEY
                },
            }).then((resp) => resp.json());

        console.log('Data', openSeaResponse);

        await Promise.all(
            openSeaResponse?.asset_events?.reverse().map(async (sale: any) => {
                if (pushed.indexOf(sale.id) !== -1) return;
                const message = buildMessage(sale);
                pushed.push(sale.id);
                return channel.send(message)
            })
        );
    } catch (e) {
        console.error('Check Error', e);
    }
}

main();