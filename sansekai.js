const { BufferJSON, WA_DEFAULT_EPHEMERAL, generateWAMessageFromContent, proto, generateWAMessageContent, generateWAMessage, prepareWAMessageMedia, areJidsSameUser, getContentType, downloadMediaMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const util = require("util");
const chalk = require("chalk");
const { GoogleGenerativeAI } = require("@google/generative-ai");
let setting = require("./key.json");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(setting.keygemini);
// Use gemini-2.5-flash
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Message storage file
const MESSAGE_STORAGE = "./messages.json";

// Initialize message storage
if (!fs.existsSync(MESSAGE_STORAGE)) {
  fs.writeFileSync(MESSAGE_STORAGE, JSON.stringify([], null, 2));
}

// Helper function to save messages
function saveMessage(messageData) {
  try {
    const messages = JSON.parse(fs.readFileSync(MESSAGE_STORAGE, "utf8"));
    messages.push({
      id: messageData.id,
      from: messageData.from,
      chat: messageData.chat,
      text: messageData.text,
      timestamp: messageData.timestamp,
      isGroup: messageData.isGroup,
    });
    fs.writeFileSync(MESSAGE_STORAGE, JSON.stringify(messages, null, 2));
  } catch (error) {
    console.log(chalk.red("Error saving message:"), error);
  }
}

module.exports = sansekai = async (upsert, sock, store, message) => {
  try {
    let budy = (typeof message.text == 'string' ? message.text : '')
    var prefix = /^[\\/!#.]/gi.test(budy) ? budy.match(/^[\\/!#.]/gi) : "/";
    const isCmd = budy.startsWith(prefix);
    const command = budy.replace(prefix, "").trim().split(/ +/).shift().toLowerCase();
    const args = budy.trim().split(/ +/).slice(1);
    const pushname = message.pushName || "No Name";
    const botNumber = sock.user.id;
    const itsMe = message.sender == botNumber ? true : false;
    let text = (q = args.join(" "));
    const arg = budy.trim().substring(budy.indexOf(" ") + 1);
    const arg1 = arg.trim().substring(arg.indexOf(" ") + 1);
    const from = message.chat;

    const color = (text, color) => {
      return !color ? chalk.green(text) : chalk.keyword(color)(text);
    };

    // Group
    const groupMetadata = message.isGroup ? await sock.groupMetadata(message.chat).catch((e) => { }) : "";
    const groupName = message.isGroup ? groupMetadata.subject : "";

    // --- DEBUGGING LOGS ---
    console.log("------------------------------------------------");
    console.log("Incoming Message Type:", message.mtype);
    console.log("Chat ID:", message.chat);
    console.log("Sender:", message.sender);
    // console.log("Full Message Object:", JSON.stringify(message, null, 2)); // Uncomment if needed, but might be spammy
    console.log("------------------------------------------------");

    // --- Anti-Delete Feature ---
    if (message.message && message.message.protocolMessage && message.message.protocolMessage.type === 0) { // 0 is REVOKE
      const key = message.message.protocolMessage.key;
      const messages = JSON.parse(fs.readFileSync(MESSAGE_STORAGE, "utf8"));
      const deletedMessage = messages.find(m => m.id === key.id);

      if (deletedMessage) {
        console.log(chalk.red("Anti-Delete Detected:"), deletedMessage);
        if (deletedMessage.text) {
          await sock.sendMessage(message.chat, {
            text: `*Anti-Delete Detected*\n\nUser @${deletedMessage.from.split('@')[0]} deleted a message:\n\n"${deletedMessage.text}"`,
            mentions: [deletedMessage.from]
          });
        }
      }
      return;
    }

    // --- Status Saver Feature ---
    if (message.chat === "status@broadcast") {
      if (message.mtype === "imageMessage" || message.mtype === "videoMessage") {
        try {
          const buffer = await downloadMediaMessage(message, "buffer", {}, { logger: console });
          const ext = message.mtype === "imageMessage" ? "jpg" : "mp4";
          const sender = message.key.participant || message.sender;
          const filename = `./media/stories/${sender.split('@')[0]}_${message.key.id}.${ext}`;
          fs.writeFileSync(filename, buffer);
          console.log(chalk.green(`Saved Status from ${sender} to ${filename}`));

          // Optionally send to yourself
          // await sock.sendMessage(botNumber, { document: { url: filename }, mimetype: message.mtype === "imageMessage" ? "image/jpeg" : "video/mp4", fileName: `Status_${message.sender}.${ext}` });
        } catch (e) {
          console.log("Error saving status:", e);
        }
      }
      return; // Don't process as command
    }

    // --- View Once Downloader Feature ---
    if (message.mtype === "viewOnceMessageV2" || message.mtype === "viewOnceMessage") {
      const msg = message.message.viewOnceMessageV2 ? message.message.viewOnceMessageV2.message : message.message.viewOnceMessage.message;
      const type = Object.keys(msg)[0];
      if (type === "imageMessage" || type === "videoMessage") {
        try {
          const buffer = await downloadMediaMessage(
            {
              key: message.key,
              message: msg // downloadMediaMessage expects the content message
            },
            "buffer",
            {},
            { logger: console }
          );

          const ext = type === "imageMessage" ? "jpg" : "mp4";
          const filename = `./media/view_once/${Date.now()}_${message.sender.split('@')[0]}.${ext}`;
          fs.writeFileSync(filename, buffer);
          console.log(chalk.green(`Saved View Once to ${filename}`));

          // Send back to chat (since user asked to "view" it)
          await sock.sendMessage(message.chat, {
            [type === "imageMessage" ? "image" : "video"]: buffer,
            caption: `*View Once Saved*\nFrom: @${message.sender.split('@')[0]}`,
            mentions: [message.sender]
          });
        } catch (e) {
          console.log("Error saving view once:", e);
        }
      }
    }


    // Save all text messages
    if (budy && !itsMe) {
      saveMessage({
        id: message.key.id,
        from: message.sender,
        chat: message.chat,
        text: budy,
        timestamp: Date.now(),
        isGroup: message.isGroup,
      });
    }

    // Push Message To Console
    let argsLog = budy.length > 30 ? `${q.substring(0, 30)}...` : budy;

    if (isCmd && !message.isGroup) {
      console.log(chalk.black(chalk.bgWhite("[ LOGS ]")), color(argsLog, "turquoise"), chalk.magenta("From"), chalk.green(pushname), chalk.yellow(`[ ${message.sender.replace("@s.whatsapp.net", "")} ]`));
    } else if (isCmd && message.isGroup) {
      console.log(
        chalk.black(chalk.bgWhite("[ LOGS ]")),
        color(argsLog, "turquoise"),
        chalk.magenta("From"),
        chalk.green(pushname),
        chalk.yellow(`[ ${message.sender.replace("@s.whatsapp.net", "")} ]`),
        chalk.blueBright("IN"),
        chalk.green(groupName)
      );
    }

    if (isCmd) {
      switch (command) {
        case "help": case "menu": case "start": case "info":
          message.reply(`*SmartWA-Bot by Engineer Qadeer*
            
*(Chat with AI)*
Cmd: ${prefix}ai 
Ask anything to Gemini AI
Supports: Text, Images, and Voice notes

*(Source Code)*
Cmd: ${prefix}sc
Show bot source code

*(New Features)*
- Anti-Delete (Text)
- View Once Saver
- Status Saver`)
          break;

        case "ai": case "gemini": case "ask":
          try {
            if (setting.keygemini === "ISI_APIKEY_GEMINI_DISINI") {
              return message.reply("Gemini API key not configured\\n\\nPlease add your API key in key.json\\n\\nGet your key at: https://aistudio.google.com/app/apikey");
            }

            const quotedMsg = message.quoted;
            let prompt = text;

            // Handle different message types
            if (quotedMsg) {
              const messageType = Object.keys(quotedMsg.message || {})[0];

              // Handle Image
              if (messageType === "imageMessage") {
                try {
                  const buffer = await downloadMediaMessage(quotedMsg, "buffer", {});
                  const base64Image = buffer.toString("base64");

                  const imagePart = {
                    inlineData: {
                      data: base64Image,
                      mimeType: quotedMsg.message.imageMessage.mimetype || "image/jpeg",
                    },
                  };

                  const result = await model.generateContent([
                    prompt || "Describe this image in detail",
                    imagePart,
                  ]);
                  const response = await result.response;
                  await message.reply(response.text());
                  return;
                } catch (error) {
                  console.log(error);
                  return message.reply("Error processing image: " + error.message);
                }
              }

              // Handle Audio/Voice
              if (messageType === "audioMessage") {
                try {
                  const buffer = await downloadMediaMessage(quotedMsg, "buffer", {});
                  const base64Audio = buffer.toString("base64");

                  const audioPart = {
                    inlineData: {
                      data: base64Audio,
                      mimeType: quotedMsg.message.audioMessage.mimetype || "audio/ogg",
                    },
                  };

                  const result = await model.generateContent([
                    "Transcribe this audio and respond to it:",
                    audioPart,
                  ]);
                  const response = await result.response;
                  await message.reply(response.text());
                  return;
                } catch (error) {
                  console.log(error);
                  return message.reply("Error processing audio: " + error.message);
                }
              }
            }

            // Handle text-only
            if (!text) {
              return message.reply(`Chat with Gemini AI\\n\\nExample:\\n${prefix}${command} What is quantum computing?\\n\\nYou can also reply to images or voice notes with this command!`);
            }

            const result = await model.generateContent(prompt);
            const response = await result.response;
            await message.reply(response.text());

          } catch (error) {
            console.log(error);
            message.reply("Error: " + error.message);
          }
          break;

        case "sc": case "script": case "scbot":
          message.reply("Bot using script from https://github.com/EngineerQadeer/SmartWA-Bot");
          break;

        default: {
          if (isCmd && budy.toLowerCase() != undefined) {
            if (message.chat.endsWith("broadcast")) return;
            if (message.isBaileys) return;
            if (!budy.toLowerCase()) return;
            if (argsLog || (isCmd && !message.isGroup)) {
              console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("not available", "turquoise"));
            } else if (argsLog || (isCmd && message.isGroup)) {
              console.log(chalk.black(chalk.bgRed("[ ERROR ]")), color("command", "turquoise"), color(`${prefix}${command}`, "turquoise"), color("not available", "turquoise"));
            }
          }
        }
      }
    }
  } catch (err) {
    console.log(util.format(err));
  }
};

let file = require.resolve(__filename);
fs.watchFile(file, () => {
  fs.unwatchFile(file);
  console.log(chalk.redBright(`Update ${__filename}`));
  delete require.cache[file];
  require(file);
});
