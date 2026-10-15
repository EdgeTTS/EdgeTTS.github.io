const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4"
// Единственный источник версии Edge/Chromium: Sec-MS-GEC-Version выводится из неё (User-Agent ставит сам браузер Edge).
const CHROMIUM_FULL_VERSION = "143.0.3650.75"
const SEC_MS_GEC_VERSION = "2-" + CHROMIUM_FULL_VERSION
const GEC_ERRORS_BEFORE_SYNC = 3

class SocketEdgeTTS {
	constructor(_indexpart, _filename, _filenum,
				_voice, _pitch, _rate, _volume, _text,
				_statArea, _obj_threads_info, _save_to_var) {
		this.bytes_data_separator = new TextEncoder().encode("Path:audio\r\n")
		this.data_separator = new Uint8Array(this.bytes_data_separator)
		
		this.my_uint8Array = new Uint8Array(0)
		this.audios = []
		
		this.indexpart = _indexpart
		this.my_filename = _filename
		this.my_filenum = _filenum
		this.my_voice = _voice
		this.my_pitch = _pitch
		this.my_rate = _rate
		this.my_volume = _volume
		this.my_text = _text
		this.socket
		this.statArea = _statArea
		this.mp3_saved = false
		this.save_to_var = _save_to_var
		this.obj_threads_info = _obj_threads_info
		this.end_message_received = false
		this.start_save = false	
		this.restart_pending = false
		this.watchdog_id = 0
		
		//Start
		this.start_works()
	}

	clear() {
		//this.socket = null;	
		this.end_message_received = false	
		this.my_uint8Array = null
		this.my_uint8Array = new Uint8Array(0)
		for (let part of this.audios) {
			part = null
		}
		this.audios = []
		this.start_save = false
	}

	// UTC, как в приложении: локальное время сервер отклоняет.
	date_to_string() {
		const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
		const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		const d = new Date()
		const pad = n => String(n).padStart(2, '0')
		return days[d.getUTCDay()] + ' ' + months[d.getUTCMonth()] + ' ' + pad(d.getUTCDate()) + ' ' + d.getUTCFullYear() +
			' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()) +
			' GMT+0000 (Coordinated Universal Time)'
	}

	// Аналог тайм-аута в poll() приложения: тишина дольше restart_delay_msec — перезапуск.
	arm_watchdog() {
		clearTimeout(this.watchdog_id)
		if (Number.isFinite(restart_delay_msec)) {
			this.watchdog_id = setTimeout(() => {
				if (this.mp3_saved || this.restart_pending) return
				if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
					this.socket.close()
				} else {
					this.error_restart()
				}
			}, restart_delay_msec)
		}
	}

	onSocketOpen(event) {
		this.arm_watchdog()
		this.end_message_received = false
		this.update_stat("started")
		
		var my_data = this.date_to_string()
		this.socket.send(
			"X-Timestamp:" + my_data + "\r\n" +
			"Content-Type:application/json; charset=utf-8\r\n" +
			"Path:speech.config\r\n\r\n" +
			'{"context":{"synthesis":{"audio":{"metadataoptions":{' +
			'"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},' +
			'"outputFormat":"audio-24khz-96kbitrate-mono-mp3"' +
			"}}}}\r\n"
		)
			
		this.socket.send(
			this.ssml_headers_plus_data(
				this.connect_id(),
				my_data,
				this.mkssml()
			)
		)
	}
		
	async onSocketMessage(event) {
		this.arm_watchdog()
		const data = await event.data
		if ( typeof data == "string" ) {
			if (data.includes("Path:turn.end")) {
				this.end_message_received = true
				//console.log("Path:turn.end ", this.indexpart)
				//Обработка частей Blob с последующим сохранением в mp3
				for (let _ind = 0; _ind < this.audios.length; _ind++) {
					const reader_result = await this.audios[_ind].arrayBuffer()
					const uint8_Array = await new Uint8Array(reader_result)
					
					// Ищем все позиции байтов, равных "\r\n"
					let posIndex = this.findIndex(uint8_Array, this.data_separator)
					const parts = []
					if (posIndex !== -1) {
						// Разрезаем Blob на части
						const partBlob = this.audios[_ind].slice(posIndex + this.data_separator.length)
						parts.push(partBlob)

					}
					
					if (parts.length > 0 && parts[0] instanceof Blob) {
						const buffer = await parts[0].arrayBuffer()
						const uint8_Array2 = await new Uint8Array(buffer)
						const combinedUint8Array = await new Uint8Array(this.my_uint8Array.length + uint8_Array2.length)
						combinedUint8Array.set(this.my_uint8Array, 0)
						combinedUint8Array.set(uint8_Array2, this.my_uint8Array.length)
						this.my_uint8Array = await combinedUint8Array
					}
				}
				//console.log(this.audios.length)
				this.save_mp3()
			}
		}
		
		if (data instanceof Blob) {
			await this.audios.push(data)
		}
	}
	
	update_stat(msg) {
		updateStatusBox(this.indexpart, msg)
	}

	onSocketClose() {
		if ( !this.mp3_saved ) {
			if ( this.end_message_received && !this.restart_pending ) {
				this.update_stat("processing")
			} else {
				this.error_restart()
			}
		}
		add_edge_tts()
	}

	error_restart() {
		if (this.restart_pending || this.mp3_saved) return
		this.restart_pending = true
		clearTimeout(this.watchdog_id)
		this.update_stat("error")
		SocketEdgeTTS.gec_report_error()
		setTimeout(() => {
			this.restart_pending = false
			this.my_uint8Array = new Uint8Array(0)
			this.audios = []
			this.end_message_received = false
			this.start_works()
		}, 6000)
	}
	
	start_works() {
		if ("WebSocket" in window) {
			this.socket = new WebSocket(
				"wss://speech.platform.bing.com/consumer/speech/synthesize/" +
				"readaloud/edge/v1?TrustedClientToken=" + TRUSTED_CLIENT_TOKEN +
				"&Sec-MS-GEC=" + this.generateSecMsGec() +
				"&Sec-MS-GEC-Version=" + SEC_MS_GEC_VERSION +
				"&ConnectionId=" + this.connect_id()
			);
			
			this.socket.addEventListener('open', this.onSocketOpen.bind(this));
			this.socket.addEventListener('message', this.onSocketMessage.bind(this));
			this.socket.addEventListener('close', this.onSocketClose.bind(this));
			this.arm_watchdog()
		} else {
			console.log("WebSocket NOT supported by your Browser!");
		}
		add_edge_tts()
	}

	mkssml() {
		return (	
			"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\n" +
			"<voice name='" + this.my_voice + "'><prosody pitch='" + this.my_pitch + "' rate='" + this.my_rate + "' volume='" + this.my_volume + "'>\n" +
			this.my_text + "</prosody></voice></speak>"
		)
	}

	connect_id() {
		const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
			const r = (Math.random() * 16) | 0;
			const v = c == 'x' ? r : (r & 0x3) | 0x8;
			return v.toString(16);
		});
		return uuid.replace(/-/g, '');
	}
	
	
	// Обфусцированный SHA256 из rany2-edge-tts (drm.py): первый блок с иным K[14] и поправками.
	static SHA_INITIAL = [0x6A09E667,0xBB67AE85,0x3C6EF372,0xA54FF53A,0x510E527F,0x9B05688C,0x1F83D9AB,0x5BE0CD19]
	static SHA_STATE = [0xFD9FBEA2,0x91243CE7,0xBE499094,0xCD2E1E0A,0x6C006F49,0x04BD35AB,0xFEB0A7E4,0x03EFFBD2]
	static SHA_SCHEDULE = [0xEB24BF9E,0x1558691F,0xA0C09EE2,0x0CFA32BA,0xA622EE8C,0xD1DD9491,0xC0DD25A0,0xF9E70AB6,0xF0C31573,0x7058CE4E,0x7188E606,0x00E5AB33,0xD258B060,0x72766564]
	static SHA_K = [0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0x0FC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x06CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2]
	static SHA_K14_ADJ = 0xC9DC06A7
	static SHA_SIGMA0_ADJ = 0x059C0B80
	static SHA_SIGMA1_ADJ = 0x000B92C0
	// Контрольная сумма CS64 из drm.py.
	static CS64_COEF = [0xE82E91B1,0x44DE24C6,0x3BEB65BC,0xC89C5933,0x8D1EC211,0x314EF5D5,0xE92491B1,0xF0A5B9D5,0x06064CF3,0xDA79FA60,0xBED20560,0x89F9C9F8,0x35FA38C6,0xCB49E3C6]
	static CS64_OFFSET = [0xB32700D0,0x88DFF51D,0x29514038,0xB328CBDF,0xD405B4D5,0x26E55F3C,0x607801C6,0x82B2C1FB,0xFA51A3DA,0x207CC464,0x3C3C74F3,0xD2D14B61,0xBB04A2C1,0xC5626167]
	static CS64_FACTOR = 0x82893933
	static CS64_ADJ0 = 0xF2F90B1A
	static CS64_ADJ1 = 0x0B1A0000

	// Умножение по модулю 2^32 без потери старших бит (через BigInt).
	_mul(a, b) { return Number((BigInt(a >>> 0) * BigInt(b >>> 0)) & 0xFFFFFFFFn) >>> 0 }
	_rotr(v, n) { return ((v >>> n) | (v << (32 - n))) >>> 0 }
	_rol16(v) { return ((v << 16) | (v >>> 16)) >>> 0 }
	_sigma0(v) { return (this._rotr(v, 7) ^ this._rotr(v, 18) ^ (v >>> 3)) >>> 0 }
	_sigma1(v) { return (this._rotr(v, 17) ^ this._rotr(v, 19) ^ (v >>> 10)) >>> 0 }

	// Один проход 64 раундов; firstRound=14 в первом блоке подменяет K[14].
	_shaRounds(state, words, firstRound) {
		let [a, b, c, d, e, f, g, h] = state
		for (let i = firstRound; i < 64; i++) {
			const k = (firstRound === 14 && i === 14) ? SocketEdgeTTS.SHA_K14_ADJ : SocketEdgeTTS.SHA_K[i]
			const bs1 = (this._rotr(e, 6) ^ this._rotr(e, 11) ^ this._rotr(e, 25)) >>> 0
			const t1 = ((h + bs1 + (g ^ (e & (f ^ g))) + k + words[i]) & 0xFFFFFFFF) >>> 0
			const bs0 = (this._rotr(a, 2) ^ this._rotr(a, 13) ^ this._rotr(a, 22)) >>> 0
			const t2 = ((bs0 + ((a & b) | (c & (a | b)))) & 0xFFFFFFFF) >>> 0
			h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0
		}
		return [a, b, c, d, e, f, g, h]
	}

	_shaExpand(words, firstWord) {
		for (let i = firstWord; i < 64; i++)
			words.push(((this._sigma1(words[i-2]) + words[i-7] + this._sigma0(words[i-15]) + words[i-16]) & 0xFFFFFFFF) >>> 0)
	}

	// Состояние после первого блока: 14 нулевых слов + соль data[0..6] в словах 14/15.
	_shaInit(data) {
		const words = []
		for (let i = 0; i < 14; i++) words.push(0)
		words.push(((data[0] << 16) | (data[1] << 8) | data[2]) >>> 0)
		words.push(((data[3] << 24) | (data[4] << 16) | (data[5] << 8) | data[6]) >>> 0)
		for (let i = 16; i < 30; i++) {
			let v = SocketEdgeTTS.SHA_SCHEDULE[i - 16]
			if (i - 2 >= 14) v += (i === 16) ? (this._sigma1(words[i-2]) ^ SocketEdgeTTS.SHA_SIGMA1_ADJ) : this._sigma1(words[i-2])
			if (i - 7 >= 14) v += words[i-7]
			if (i - 15 >= 14) v += (i === 29) ? (this._sigma0(words[i-15]) ^ SocketEdgeTTS.SHA_SIGMA0_ADJ) : this._sigma0(words[i-15])
			words.push((v & 0xFFFFFFFF) >>> 0)
		}
		words.push(((this._sigma1(words[28]) + words[23] + this._sigma0(words[15]) + words[14]
			+ SocketEdgeTTS.SHA_K14_ADJ - SocketEdgeTTS.SHA_K[14]) & 0xFFFFFFFF) >>> 0)
		this._shaExpand(words, 31)
		const working = this._shaRounds(SocketEdgeTTS.SHA_STATE, words, 14)
		return SocketEdgeTTS.SHA_INITIAL.map((x, i) => (x + working[i]) >>> 0)
	}

	_shaDigest(data) {
		const length = 57 + data.length
		const padded = Array.from(data.slice(7))
		padded.push(0x80)
		const padN = ((55 - length) % 64 + 64) % 64
		for (let i = 0; i < padN; i++) padded.push(0x00)
		const bitLen = length * 8
		for (let i = 0; i < 8; i++) padded.push(Math.floor(bitLen / Math.pow(2, 56 - i * 8)) & 0xFF)
		let state = this._shaInit(data.slice(0, 7))
		for (let off = 0; off < padded.length; off += 64) {
			const words = []
			for (let w = 0; w < 16; w++) {
				const p = off + w * 4
				words.push(((padded[p] << 24) | (padded[p+1] << 16) | (padded[p+2] << 8) | padded[p+3]) >>> 0)
			}
			this._shaExpand(words, 16)
			const working = this._shaRounds(state, words, 0)
			state = state.map((x, i) => (x + working[i]) >>> 0)
		}
		const out = []
		for (let i = 0; i < 8; i++)
			out.push((state[i] >>> 24) & 0xFF, (state[i] >>> 16) & 0xFF, (state[i] >>> 8) & 0xFF, state[i] & 0xFF)
		return out
	}

	// Little-endian 32-битные слова data, дополненные нулями до чётного числа.
	_wordsLe4Even(data) {
		const words = []
		for (let i = 0; i < data.length; i += 4) {
			let w = 0
			for (let j = 0; j < 4; j++) if (i + j < data.length) w = (w | (data[i+j] << (j*8))) >>> 0
			words.push(w >>> 0)
		}
		if (words.length % 2) words.push(0)
		return words
	}

	_cs64Digest(data, digest) {
		const key_a = ((digest[0] | (digest[1]<<8) | (digest[2]<<16) | (digest[3]<<24)) | 1) >>> 0
		const key_b = ((digest[4] | (digest[5]<<8) | (digest[6]<<16) | (digest[7]<<24)) | 1) >>> 0
		const factors = [this._mul(key_a, SocketEdgeTTS.CS64_FACTOR), this._mul(key_b, SocketEdgeTTS.CS64_FACTOR)]
		const terms = [], offsets = []
		for (let i = 0; i < SocketEdgeTTS.CS64_COEF.length; i++) {
			terms.push(this._mul(SocketEdgeTTS.CS64_COEF[i], factors[i % 2]))
			offsets.push(SocketEdgeTTS.CS64_OFFSET[i])
		}
		const words = this._wordsLe4Even([0x00, ...data])
		for (let i = 0; i < words.length; i++) {
			const word = words[i]
			let term = this._mul(word, i % 2 === 0 ? key_a : key_b)
			let offset = this._mul(this._rol16(word), i % 2 === 0 ? 0xEF0569FB : 0xC31713DB)
			if (i === 0) { term = (term + this._mul(SocketEdgeTTS.CS64_ADJ0, factors[0])) >>> 0; offset = (offset + SocketEdgeTTS.CS64_ADJ1) >>> 0 }
			terms.push(term >>> 0); offsets.push(offset >>> 0)
		}
		let swap_acc = 0, swap_last = 0, state = 0, acc = 0
		for (let i = 0; i < terms.length; i += 2) {
			const x = terms[i], y = terms[i+1]
			let t = this._rol16((offsets[i] + x) >>> 0)
			let q = this._mul(t, 0x76F50F34)
			swap_acc = (swap_acc + ((this._mul(this._rol16(q), 0xC3EFEA97) + q) >>> 0)) >>> 0
			t = this._rol16((offsets[i+1] + y) >>> 0)
			q = this._mul(t, 0x1881CE3C)
			swap_last = ((this._mul(this._rol16(q), 0x35BD1EC9) + q) >>> 0)
			swap_acc = (swap_acc + swap_last) >>> 0
			state = (this._mul(state, key_a) + x) >>> 0
			state = this._mul(this._rol16(state), 0xCF98B111)
			state = this._mul(this._rol16(state), 0x87085B9F)
			state = this._mul(this._rol16(state), 0x12CEB96D)
			state = this._mul(this._rol16(state), 0x257E1D83)
			acc = (acc + state) >>> 0
			t = (this._mul(state, key_b) + y) >>> 0
			t = this._mul(this._rol16(t), 0xA27416F5)
			t = this._mul(this._rol16(t), 0xD38396FF)
			state = this._mul(this._rol16(this._mul(this._rol16(t), 0x7C932B89)), 0xBFA49F69)
			acc = (acc + state) >>> 0
		}
		return [(swap_last ^ state) >>> 0, (swap_acc ^ acc) >>> 0]
	}

	// 32-битное слово как little-endian hex uppercase (порядок байтов CS64).
	_u32leHex(v) {
		v >>>= 0
		const b = [v & 0xFF, (v>>>8)&0xFF, (v>>>16)&0xFF, (v>>>24)&0xFF]
		return b.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
	}

	generateSecMsGec() {
		const WIN_EPOCH = 11644473600
		const S_TO_NS = 1e9
		
		let ticks = Date.now() / 1000 + SocketEdgeTTS.gec_clock_skew
		ticks += WIN_EPOCH
		ticks -= ticks % 300
		ticks *= S_TO_NS / 100
		
		const strToHash = Math.floor(ticks) + TRUSTED_CLIENT_TOKEN
		// Токен v2: "<CS64 16 hex>-<обфусцированный SHA256 64 hex>"
		const data = Array.from(strToHash, ch => ch.charCodeAt(0))
		const digest = this._shaDigest(data)
		const cs64 = this._cs64Digest(data, digest)
		const hex = digest.map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase()
		return this._u32leHex(cs64[0]) + this._u32leHex(cs64[1]) + "-" + hex
	}

	static gec_clock_skew = 0
	static gec_error_count = 0
	static gec_sync_active = false

	static gec_report_success() {
		SocketEdgeTTS.gec_error_count = 0
	}

	static gec_report_error() {
		SocketEdgeTTS.gec_error_count += 1
		if (SocketEdgeTTS.gec_error_count >= GEC_ERRORS_BEFORE_SYNC && !SocketEdgeTTS.gec_sync_active) {
			SocketEdgeTTS.gec_error_count = 0
			SocketEdgeTTS.gec_sync_active = true
			SocketEdgeTTS.gec_sync_clock_skew().finally(() => SocketEdgeTTS.gec_sync_active = false)
		}
	}

	// Сдвиг часов (сек) по заголовку Date сервера озвучки; при неудаче остаётся прежним.
	static async gec_sync_clock_skew() {
		try {
			const response = await fetch("https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list?trustedclienttoken=" + TRUSTED_CLIENT_TOKEN, { cache: "no-store" })
			const server_date = Date.parse(response.headers.get("Date"))
			if (!isNaN(server_date)) SocketEdgeTTS.gec_clock_skew = (server_date - Date.now()) / 1000
		} catch (e) {}
	}

	async saveFiles(blob) {
		if (this.start_save == false) {
			this.start_save = true
			const new_folder_handle = await save_path_handle.getDirectoryHandle(this.my_filename, { create: true });			
			const fileHandle = await new_folder_handle.getFileHandle(this.my_filename + " " + this.my_filenum + '.mp3', { create: true });
			const writableStream = await fileHandle.createWritable();
			const writable = writableStream.getWriter();
			await writable.write(blob);
			await writable.close();
			this.clear()
		}
	}
	
	save_mp3() {
		//console.log("Save_mp3");
		if ( this.my_uint8Array.length > 0 ) {
			this.mp3_saved = true
			clearTimeout(this.watchdog_id)
			SocketEdgeTTS.gec_report_success()
			if ( !this.save_to_var ) {				
				var blob_mp3 = new Blob([this.my_uint8Array.buffer]);
				if (save_path_handle ?? false) {
					this.saveFiles(blob_mp3)
				} else {
					const url = window.URL.createObjectURL(blob_mp3);
					const link = document.createElement('a');
					link.href = url;
					link.download = this.my_filename + " " + this.my_filenum + '.mp3';
					document.body.appendChild(link);
					link.click();
					document.body.removeChild(link);
					window.URL.revokeObjectURL(url);
					this.clear()
				}
			}
			this.update_stat("saved")
			this.obj_threads_info.saved += 1
			const stat_total = this.obj_threads_info.stat.textContent.split(' / ')[1]
			this.obj_threads_info.stat.textContent = this.obj_threads_info.saved + " / " + stat_total
			add_edge_tts()
		} else {
			console.log("Bad Save_mp3");
			this.error_restart()
		}
	}

	ssml_headers_plus_data(request_id, timestamp, ssml) {
		return "X-RequestId:" + request_id + "\r\n" +
			"Content-Type:application/ssml+xml\r\n" +
			"X-Timestamp:" + timestamp + "Z\r\n" +
			"Path:ssml\r\n\r\n" +
			ssml
	}
		
	findIndex(uint8Array, separator) {
	  for (let i = 0; i < uint8Array.length - separator.length + 1; i++) {
		let found = true
		for (let j = 0; j < separator.length; j++) {
		  if (uint8Array[i + j] !== separator[j]) {
			found = false
			break
		  }
		}
		if (found) {
		  return i
		}
	  }
	  return -1
	}
}