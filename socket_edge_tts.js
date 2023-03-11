class SocketEdgeTTS {
	constructor(_filename, _voice, _rate, _volume, _text) {
		this.my_filename = _filename
		this.my_voice = _voice
		this.my_rate = _rate
		this.my_volume = _volume
		this.my_text = _text
		this.my_uint8Array = new Uint8Array(0)
		this.audios = []
		this.socket		
	}

	date_to_string() {
		const date = new Date()
		const options = {
			weekday: 'short',
			month: 'short',
			day: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			timeZoneName: 'short',
		}
		const dateString = date.toLocaleString('en-US', options)
		return dateString.replace(/\u200E/g, '') + ' GMT+0000 (Coordinated Universal Time)'
	}	

	onSocketOpen(event) {
		var my_data = this.date_to_string()
		this.socket.send(
			"X-Timestamp:" + my_data + "\r\n" +
			"Content-Type:application/json; charset=utf-8\r\n" +
			"Path:speech.config\r\n\r\n" +
			'{"context":{"synthesis":{"audio":{"metadataoptions":{' +
			'"sentenceBoundaryEnabled":false,"wordBoundaryEnabled":true},' +
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
		const data = await event.data
		if ( typeof data == "string" ) {
			if (data.includes("Path:turn.end")) {				
				//Обработка частей Blob с последующим сохранением в mp3
				for (let _ind = 0; _ind < this.audios.length; _ind++) {
					const reader_result = await this.audios[_ind].arrayBuffer()
					const uint8_Array = await new Uint8Array(reader_result)
					
					// Ищем все позиции байтов, равных "\r\n"
					const bytes = new TextEncoder().encode("Path:audio\r\n")
					const separator = new Uint8Array(bytes)
					//const separator = new Uint8Array([13, 10]) //[ 116, 117, 114, 110, 46, 101, 110, 100 ]
					let startIndex = 0
					let endIndex = this.findIndex(uint8_Array, separator)
					const parts = []
					if (endIndex !== -1) {
						// Разрезаем Blob на части
						const partBlob = this.audios[_ind].slice(startIndex, endIndex)
						parts.push(partBlob)
					
						// Обновляем индексы начала и конца следующей части
						startIndex = endIndex + separator.length
						endIndex = this.findIndex(uint8_Array.subarray(startIndex), separator)
						if (endIndex !== -1) {
							endIndex += startIndex
						}
					}
					if (startIndex < this.audios[_ind].size) {
						// Добавляем последнюю часть
						const partBlob = this.audios[_ind].slice(startIndex)
						parts.push(partBlob)
					}
					
					if (parts.length > 0 && parts[1] instanceof Blob) {
						const buffer = await parts[1].arrayBuffer()
						const uint8_Array2 = await new Uint8Array(buffer)
						const combinedUint8Array = await new Uint8Array(this.my_uint8Array.length + uint8_Array2.length)
						combinedUint8Array.set(this.my_uint8Array, 0)
						combinedUint8Array.set(uint8_Array2, this.my_uint8Array.length)
						this.my_uint8Array = await combinedUint8Array
					}					
				}
				console.log(this.audios.length)
				this.save_mp3()
			}
		}
		
		if (data instanceof Blob) {
			await this.audios.push(data)
		}
	}

	onSocketClose() {
		console.log("Сlosed...")//console.log(this.my_filename + " closed...")
	}
	
	start_works() {
		console.log(" start works...")//console.log(this.my_filename + " start works...")
		if ("WebSocket" in window) {
			this.socket = new WebSocket(
				"wss://speech.platform.bing.com/consumer/speech/synthesize/" +
				"readaloud/edge/v1?TrustedClientToken=" +
				"6A5AA1D4EAFF4E9FB37E23D68491D6F4" +
				"&ConnectionId=" + this.connect_id())
			this.socket.addEventListener('open', this.onSocketOpen.bind(this))
			this.socket.addEventListener('message', this.onSocketMessage.bind(this))
			this.socket.addEventListener('close', this.onSocketClose.bind(this))
		} else {
			console.log("WebSocket NOT supported by your Browser!");
		}
	}

	mkssml() {
		return (
			"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>\n" +
			"<voice name='" + this.my_voice + "'><prosody pitch='+0Hz' rate='" + this.my_rate + "' volume='" + this.my_volume + "'>\n" +
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
	
	save_mp3() {
		console.log("Save_mp3");
		if ( this.my_uint8Array.length > 0 ) {
			var blob_mp3 = new Blob([this.my_uint8Array.buffer]);
			const url = window.URL.createObjectURL(blob_mp3);
			const link = document.createElement('a');
			link.href = url;
			link.download = this.my_filename + '.mp3';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);				
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