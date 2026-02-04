process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const {
	makeWASocket,
	fetchLatestBaileysVersion,
	DisconnectReason,
	useMultiFileAuthState,
	makeCacheableSignalKeyStore,
	Browsers,
} = require("@whiskeysockets/baileys");
const fs = require("fs");
const Pino = require("pino");
const chalk = require("chalk");
const qrcode = require("qrcode");
const moment = require("moment-timezone");
moment.tz.setDefault("Asia/karachi").locale("id");
const { Messages } = require("./lib/messages.js");
const donet = "https://EngineerQadeer.free.nf";

// Baileys
const Logger = {
	level: "error",
};
const logger = Pino({
	...Logger,
});

// Store is no longer available in newer Baileys versions
const store = null;

const color = (text, color) => {
	return !color ? chalk.green(text) : chalk.keyword(color)(text);
};

async function connectToWhatsApp(use_pairing_code = false) {
	const { state, saveCreds } = await useMultiFileAuthState("yusril");

	const { version } = await fetchLatestBaileysVersion();
	const sock = makeWASocket({
		auth: {
			creds: state.creds,
			keys: makeCacheableSignalKeyStore(state.keys, logger),
		},
		version: version,
		logger: logger,
		markOnlineOnConnect: true,
		generateHighQualityLinkPreview: true,
		browser: Browsers.macOS('Chrome'),
		getMessage
	});

	// Store binding removed (not available in Baileys v6.7+)

	sock.ev.process(async (ev) => {
		if (ev["creds.update"]) {
			await saveCreds();
		}
		if (ev["connection.update"]) {
			const update = ev["connection.update"];
			const { connection, lastDisconnect, qr } = update;

			// Display QR code when available

			if (qr) {
				console.log(chalk.yellow("\n Scan this QR code with WhatsApp:\n"));
				qrcode.toString(qr, {
					type: 'terminal',
					small: true,
					errorCorrectionLevel: 'L'  // Forces the smallest version possible
				}, function (err, url) {
					console.log(url)
				})
				console.log(chalk.cyan("\nOpen WhatsApp → Settings → Linked Devices → Link a Device\n"));
			}

			if (connection === "close") {
				const shouldReconnect =
					lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
				console.log(
					"connection closed due to ",
					lastDisconnect.error,
					", reconnecting ",
					shouldReconnect
				);
				// reconnect if not logged out
				if (shouldReconnect) {
					connectToWhatsApp();
				}
			} else if (connection === "open") {
				const botNumber = sock.user.id
				console.log("opened connection");
				console.log(color("Bot success conneted to server", "green"));
				console.log(color("Donate for creator https://EngineerQadeer.free.nf", "yellow"));
				console.log(color("Type /menu to see menu"));
				sock.sendMessage(botNumber, { text: `Bot started!\n\n Creator Engineer Qadeer :)\n${donet}` });
			}
		}

		const upsert = ev["messages.upsert"];
		if (upsert) {
			if (upsert.type !== "notify") {
				return;
			}
			const message = Messages(upsert, sock);
			if (!message) {
				return;
			}

			require("./sansekai.js")(upsert, sock, store, message);
		}
	});
	/**
	 *
	 * @param {import("@whiskeysockets/baileys").WAMessageKey} key
	 * @returns {import("@whiskeysockets/baileys").WAMessageContent | undefined}
	 */
	async function getMessage(key) {
		// Store is not available in newer Baileys versions
		return undefined;
	}
	return sock;
}
connectToWhatsApp()
// Baileys

let file = require.resolve(__filename);
fs.watchFile(file, () => {
	fs.unwatchFile(file);
	console.log(chalk.redBright(`Update ${__filename}`));
	delete require.cache[file];
	require(file);
});