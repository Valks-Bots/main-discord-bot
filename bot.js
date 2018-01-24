// Stable Release
const Discord = require('discord.js');
const client = new Discord.Client();
const tokens = require('./tokens.json');
const sql = require('sqlite');
sql.open('./database.sqlite'); // Create the database!!

const commands = {
	'help': (msg) => {
		// General
		const general_title = '__**General**__';
		const general_cmds = ['ping', 'invite'];
		
		// Leveling
		const leveling_title = '__**Leveling**__';
		const leveling_cmds = ['leaderboard', 'xp'];
		
		// Administration
		const administration_title = '__**Administration**__';
		const administration_cmds = ['settings [enable|disable] [module]'];
		
		const general = general_title + '\n\n' + general_cmds.join('\n');
		const leveling = leveling_title + '\n\n' + leveling_cmds.join('\n');
		const administration = administration_title + '\n\n' + administration_cmds.join('\n');
		
		const help = general + '\n\n' + leveling + '\n\n' + administration;
		
		sendEmbed(msg, msg.channel.id, help);
	},
	'invite': (msg) => {
		sendEmbed(msg, msg.channel.id, 'https://discordapp.com/api/oauth2/authorize?client_id=403185760276185088&scope=bot&permissions=26624');
	},
	'say': (msg) => {
		const args = msg.content.slice(2).trim().split(/ +/g).slice(1);
		msg.channel.send(args.join(' '));
	},
	'xp': (msg) => {
		sql.get('SELECT * FROM settings WHERE guildid = ?', [msg.guild.id]).then(row => {
			if (!row.leveling){
				sendEmbed(msg, msg.channel.id, 'Leveling disabled on this guild.');
			} else {
				sql.get('SELECT * FROM leveling WHERE userid = ?', [msg.author.id]).then(row => {
					sendEmbed(msg, msg.channel.id, `${msg.author.tag}, you have **${row.xp}** xp.`);
				});	
			}
		});
		// Grab xp values of specified user.
	},
	'settings': (msg) => {
		const args = msg.content.slice(tokens.prefix.length).trim().split(/ +/g).slice(1);
		const string = msg.content.slice(tokens.prefix.length).trim().split(/ +/g).slice(3).join(' ');
		const valid = ['leveling', 'streaming', 'welcome', 'farewell', 'joinrole', 'welcomemsg', 'farewellmsg', 'invites'];
		switch (args[0]){
			case 'enable':
				if (valid.includes(args[1])){
					if (args[1] === 'welcomemsg' || args[1] === 'farewellmsg'){
						updateSetting(msg, 'enable', args[1], string);
					} else {
						updateSetting(msg, 'enable', args[1], args[2]);
					}
				}
				break;
			case 'disable':
				if (valid.includes(args[1])){
					updateSetting(msg, 'disable', args[1]);
				}
				break;
			default:
				sql.get('SELECT * FROM settings WHERE guildid = ?', [msg.guild.id]).then(row => {
					let str = [
						`Leveling: ${row.leveling}`,
						`Streaming: ${row.streaming}`,
						`Join Role: ${row.joinrole}`,
						`Welcome: ${row.welcome}`,
						`Welcome Message: ${row.welcomemsg}`,
						`Farewell: ${row.farewell}`,
						`Farewell Message: ${row.farewellmsg}`,
						`Invites: ${row.invites}`
					];
					let strjoin = str.join('\n');
					const message = `__**Settings**__\`\`\`${strjoin}\`\`\``;
					return sendEmbed(msg, msg.channel.id, message);
				});
				break;
		}
	},
	'leaderboard': (msg) => {
		sql.all('SELECT * FROM leveling').then(row => {
			let leaderboard = [];
			for (let i = 0; i < row.length; i++){ // Grab all Values
				const username = client.users.get(row[i].userid).tag;
				const level = row[i].level;
				const exp = row[i].xp;
				leaderboard.push({name: username, lvl: level, xp: exp});
			}
			
			for (let i = 1; i < leaderboard.length; i++){ // Sort
				if (leaderboard[i].xp > leaderboard[i - 1].xp){
					const higher = leaderboard[i];
					leaderboard[i] = leaderboard[i - 1];
					leaderboard[i - 1] = higher;
				}
			}
			
			let message = '__**Leaderboard**__\n';
			let count = 1;
			for (let i = 0; i < leaderboard.length; i++){ // Append top 10
				if (i > 10) break;
				const username = client.users.get(row[i].userid).tag;
				const level = row[i].level;
				const xp = row[i].xp;
				message += `\n${count}. **User:** \`${username}\` **XP** \`${xp}\` **Level:** \`${level}\``;
				count++;
			}
			
			sendEmbed(msg, msg.channel.id, message);
		});
	}
}

client.on('ready', () => {
	// We have connected!
	client.user.setActivity("Beta", {url: "https://www.twitch.tv/valkyrienyanko"});
  console.log(`${client.user.tag} running on ${client.guilds.size} guilds with ${client.users.size} users.`);
	// Create the tables if they do not exist.
	sql.run('CREATE TABLE IF NOT EXISTS leveling (userid TEXT UNIQUE, xp INTEGER, level INTEGER)');
	
	sql.run('CREATE TABLE IF NOT EXISTS settings (guildid TEXT UNIQUE, leveling CHARACTER, streaming CHARACTER, joinrole CHARACTER, welcome CHARACTER, welcomemsg VARCHAR, farewell CHARACTER, farewellmsg VARCHAR, invites CHARACTER)').then(() => {
		for (const guild of client.guilds.values()){
			sql.run('INSERT OR IGNORE INTO settings (guildid, leveling, streaming, joinrole, welcome, welcomemsg, farewell, farewellmsg, invites) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [guild.id, null, null, null, null, 'Welcome %user%!', null, 'Goodbye %user%!', null]);
		}
	});
});

client.on('presenceUpdate', (oldMember, newMember) => {
	sql.get('SELECT * FROM settings WHERE guildid = ?', [newMember.guild.id]).then(settings => {
		if (settings.streaming !== null){
			if (newMember.presence.game != null){
				if (newMember.presence.game.streaming){
					try {
						const channel = client.channels.get(settings.streaming);
						channel.send(`**${newMember.user.tag}** is now streaming at <${newMember.presence.game.url}>`);
					} catch(err){
						msg.channel.send("Err: " + err + ". Disabled streaming.");
						sql.run('UPDATE settings SET streaming = 0 WHERE guildid = ?', [msg.guild.id]);
					}
				}
			}
		}
	});
});

client.on('guildMemberAdd', (member) => {
  sql.get('SELECT * FROM settings WHERE guildid = ?', [member.guild.id]).then(settings => {
    if (settings.joinrole !== null) {
      for (const role of member.guild.roles.values()) {
        if (role.id === settings.joinrole) {
          member.addRole(settings.joinrole);
        }
      }
    }

    if (settings.welcome !== null && settings.welcomemsg !== null) {
      let str = settings.welcomemsg;
      member.guild.channels.get(settings.welcome).send(str.replace(/%user%/gi, member.user.username));
    }

    if (settings.invites !== null) {
      member.guild.fetchInvites().then(invites => {
        let leaderboard = [];
        for (const invite of invites.values()) {
          if (invite.inviter != undefined && invite.uses !== 0 && !invite.temporary) {
            leaderboard.push({
              inviter: invite.inviter.tag,
              invites: invite.uses
            });
          }
        }

        for (let a = 0; a < 30; a++) {
          for (let i = 1; i < leaderboard.length; i++) {
            if (leaderboard[i].invites > leaderboard[i - 1].invites) {
              const higher = leaderboard[i];
              leaderboard[i] = leaderboard[i - 1];
              leaderboard[i - 1] = higher;
            }
          }
        }

        let msglead = '**Total Invites ~ Top 10** *(Only permanent invites are tracked.)*\n\n';
        let emote = ':star2:';
        for (let i = 0; i < leaderboard.length; i++) {
          if (i >= 10) {
            break;
          }
          if (i + 1 != 1) emote = ':star:';
          msglead += `${emote} **${i+1}. ${leaderboard[i].inviter}** \`${leaderboard[i].invites}\`\n`;
        }

        msglead += `\n*Latest Member:* ${member.user}`;

        let edited = false;
        member.guild.channels.get(settings.invites).fetchMessages({
          limit: 100
        }).then(msgs => {
          msgs.find(m => {
            if (m.author.id === client.user.id) {
              m.edit(msglead);
              edited = true;
							return;
            }
          });

          if (!edited) {
            member.guild.channels.get(settings.invites).send(msglead);
						return;
          }
        });
      });
    }
  });
});

client.on('guildMemberRemove', (member) => {
	sql.get('SELECT * FROM settings WHERE guildid = ?', [member.guild.id]).then(settings => {
		if (settings.farewell !== null && settings.farewellmsg !== null){
			let str = settings.farewellmsg;
			member.guild.channels.get(settings.farewell).send(str.replace(/%user%/gi, member.user.username));
		}
	});	
});

client.on('guildCreate', (guild) => {
	console.log(`I have joined the guild ${guild.name}`);
	sql.run('INSERT OR IGNORE INTO settings (guildid) VALUES (?)', [guild.id]);
});

client.on('guildDelete', (guild) => {
	console.log(`I have left the guild ${guild.name}`);
	//Lets keep the settings stored even if they remove the bot.
	//sql.run('DELETE * FROM settings WHERE guildid = ?', [guild.id]);
});

client.on('message', async msg => {
	// Handle the bot and channel type.
	if (msg.author.bot) return; // We don't want the bot reacting to itself..
	if (msg.channel.type !== 'text') return; // Lets focus on the use of text channels.
	
	if (msg.content.startsWith(tokens.prefix + "ping")){
		const m = await msg.channel.send("Ping?");
		m.edit(`Pong! Latency is ${m.createdTimestamp - msg.createdTimestamp}ms. API Latency is ${Math.round(client.ping)}ms.`);
		return;
	}
	
	levelModule(msg);
	
	commandsModule(msg);
});

client.login(tokens.token);

function levelModule(msg){
	// Handle Leveling Module
	sql.get('SELECT * FROM settings WHERE guildid = ?', [msg.guild.id]).then(settings => {
		if (settings.leveling !== null) { // Check if the guild owner enabled leveling.
			// Insert only if there are no duplicates.
			sql.run('INSERT OR IGNORE INTO leveling (userid, xp, level) VALUES (?, ?, ?)', [msg.author.id, 0, 0]).then(() => {
				sql.run('UPDATE leveling SET xp = xp + 1 WHERE userid = ?', [msg.author.id]);
				sql.get('SELECT * FROM leveling WHERE userid = ?', [msg.author.id]).then(row => {
					let curLevel = Math.floor(0.1 * Math.sqrt(row.xp + 1));
					if (curLevel > row.level){
						row.level = curLevel;
						sql.run('UPDATE leveling SET level = level + 1 WHERE userid = ?', [msg.author.id]);
						sendEmbed(msg, settings.leveling, 'You leveled up to level ' + curLevel);
					}
				});
			});
		}
	});
}

function commandsModule(msg){
	// Handle Commands Module
	if (!msg.content.startsWith(tokens.prefix)) return; // The start of commands.
	console.log(`[${msg.guild.name}] ${msg.author.tag} >> ${msg.content}`); // Log commands.
	const cmd = msg.content.toLowerCase().slice(tokens.prefix.length).split(' ')[0]; //Grab the command.
	if (commands.hasOwnProperty(cmd)){ // Check to see if commands has the command.
		commands[cmd](msg); // Push the cmd to the commands object.
	}
}

function sendEmbed(msg, id, str){
	const embed_object = {
		embed: {
			description: str,
			color: 0xffc4f9
		}
	}
	
	if (!msg.channel.permissionsFor(client.user).has('EMBED_LINKS')){
		return msg.channel.send('I need the embed links permission.');
	}
	
	if (!msg.channel.permissionsFor(client.user).has('MANAGE_MESSAGES')){
		return msg.channel.send('I need manage messages permission.');
	}
	
	client.channels.get(id).send(embed_object).then(m => {
		//msg.delete(20000);
		//m.delete(20000);
	});
}

function updateSetting(msg, operation, setting, args){
	let type = null;
	if (operation === 'enable'){
		if (msg.guild.channels.has(args)){
			type = 'channel';
		}
		if (msg.guild.roles.has(args)){
			type = 'role';
		}
		switch (type){
			case 'channel':
				if (args === undefined || !msg.guild.channels.has(args)){
					sendEmbed(msg, msg.channel.id, 'Specify a valid channel id.');
					return;
				}
				break;
			case 'role':
				if (args === undefined || !msg.guild.roles.has(args)){
					sendEmbed(msg, msg.channel.id, 'Specify a valid role id.');
					return;
				}
			default:
				break;
		}
		sql.run(`UPDATE settings SET ${setting} = ? WHERE guildid = ?`, [args, msg.guild.id]);
	}
	
	if (operation === 'disable'){
		sql.run(`UPDATE settings SET ${setting} = ? WHERE guildid = ?`, [null, msg.guild.id]);
	}
	
	sendEmbed(msg, msg.channel.id, `Value ${setting} updated.`);
}