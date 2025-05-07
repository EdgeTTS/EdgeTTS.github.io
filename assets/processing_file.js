class ProcessingFile {
	constructor(_file_name, _text, _FIRST_STRINGS_LENGTH, _LAST_STRINGS_LENGTH, _lang_lexx, _lexx_register) {
		this.file_names = []
		this.file_names.push([_file_name, 0])
		this.FIRST_STRINGS_LENGTH = _FIRST_STRINGS_LENGTH;
		this.LAST_STRINGS_LENGTH = _LAST_STRINGS_LENGTH;
		this.full_text = _text
		this.lang_lexx = _lang_lexx
		this.lexx_register = _lexx_register
		this.pre_sentences = this.getFixPoints(this.full_text)
		this.all_sentences = this.get_fix_section(this.pre_sentences)
	}

	getFixPoints(text) {
	  const result = [];
	  let fix_text = text.replace(/[~\|\*\^]/g, "-");
	  fix_text = fix_text.replace(/\\/g, "/");
	  fix_text = fix_text.replace(/&/g, " and ");
	  fix_text = fix_text.replace(/</g, "(");
	  fix_text = fix_text.replace(/>/g, ")");
//	  if ( fix_text.includes("\r\n") == true ) {
//		fix_text = fix_text.replace(/([^\.\,\!\?\:\;\-])\r\n/g, (match, p1) => p1 + ".\r\n")
//	  } else {
//		fix_text = fix_text.replace(/([^\.\,\!\?\:\;\-])\n/g, (match, p1) => p1 + ".\n")
//	  }
	  
	  //Применение словаря
	  if ( this.lang_lexx.length > 0 ) {
		  
		for (const rule of this.lang_lexx) {
		  const match = rule.match(/^regex"(.*)"="(.*)"/)
		  if (match) {
			//Применение regex
			const regex = new RegExp(match[1], 'g')
			const replacement = match[2].replace(/\\r/g, '\r').replace(/\\n/g, '\n')
			
			fix_text = fix_text.replace(regex, replacement)
		  } else if ( rule.length > 0 ) {
			//Применение не regex
			if ( rule[0] == '"' ) {
				const match_arr = rule.trim().replaceAll('"', "").split("=")
				if ( match_arr.length == 2 ) {
					if (this.lexx_register == true) {
						fix_text = fix_text.replaceAll(match_arr[0].toString(), match_arr[1].toString())
					} else {
						const regex = new RegExp(this.get_escaped(match_arr[0]), 'giu');
						fix_text = fix_text.replace(regex, match_arr[1]);
					}
				}
			} else {
				const match_arr = rule.trim().split("=")
				if (this.lexx_register == true) {
					const match_arr = rule.trim().split("=")
					const regex = new RegExp('(^|\\s)'+match_arr[0].toString()+'(?=\\s|$)', 'gi');				
					fix_text = fix_text.replace(regex, '$1'+match_arr[1].toString())
				} else {
					const escaped = this.get_escaped(match_arr[0]);
					if (this.is_punctuation(match_arr[0]) == true) {
						const regex = new RegExp(escaped, 'giu');
						fix_text = fix_text.replace(regex, match_arr[1]);
					} else {
						const regex = new RegExp('(^|\\s|\\p{P})' + escaped + '(?=\\p{P}|\\s|$)', 'giu');
						fix_text = fix_text.replace(regex, '$1' + match_arr[1]);
					}
				}
			}
		  }
		}
	  }
	  
	  if (pointsSelect.value !== 'Не заменять точки') {
		  if (pointsSelect.value == 'Заменять на три строки') {
			  fix_text = fix_text.replace(/\./g, '\r\n\r\n\r\n\r\n')
		  } else {
			  var new_point = pointsSelect.value[pointsSelect.value.length - 1]
			  if (pointsType.innerHTML === "V1") {
				  fix_text = fix_text.replace(/\./g, new_point)
			  } else if (pointsType.innerHTML === "V2") {
				  fix_text = fix_text.replace(new RegExp('\\.[ \\t]{1,}\\n', 'g'), '.\n')
				  fix_text = fix_text.replace(new RegExp('\\.(?![\\r\\n])', 'g'), new_point)
			  } else if (pointsType.innerHTML === "V3") {
				  fix_text = fix_text.replace(new RegExp('\\.[ \\t]{1,}\\n', 'g'), '.\n')
				  fix_text = fix_text.replace(new RegExp('\\.[ \\t]', 'g'), new_point + ' ')
			  }
		  }
	  }
	  
	  const pointsList = fix_text.split('\n').filter(Boolean);
	  return pointsList;
	}
	
	is_punctuation(str) {
		return str.length === 1 && /\p{P}/u.test(str);
	}
	
	get_escaped(str) {
	  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	}
	
	containsPronounceableChars(str) {
	  return /[\p{L}\p{N}]/u.test(str);
	}
	
	get_fix_section(sentences) {
	  let result = [];
	  let splitter = " ";
	  let current_text = "";

	  for (let i = 0; i < sentences.length; i++) {
		  
		if(i > 2 && sentences[i].trim() != "" && sentences[i-1].trim() == "" && sentences[i-2].trim() == "" && sentences[i-3].trim() == "" && this.containsPronounceableChars(current_text) == true) {
		  current_text += "\n";
		  if (current_text.length > 0) {
			result.push(current_text)
			current_text = ''
		  }
		}
		let line = sentences[i];
		let words = line.split(splitter);
		for (let j = 0; j < words.length; j++) {
		  let word = words[j];
		  if (current_text.length + word.length > this.LAST_STRINGS_LENGTH && [".", ",", "!", "?", ":", ";", "-"].includes(word[word.length - 1])) {
			result.push(current_text + splitter + word);
			current_text = "";
		  } else {
			if (current_text.length > 0) {
			  current_text += splitter;
			}
			current_text += word;
		  }
		}
		if (current_text.length > 0) {
		  current_text += "\n";
		}
	  }
	  if (current_text.length > 0) {
		result.push(current_text);
	  }
	  return result;
	}
	
	addNewText(_file_name, _text) {
		this.file_names[this.file_names.length-1][1] = this.all_sentences.length
		this.file_names.push([_file_name, 0])
		const pre_sentences = this.getFixPoints(_text)
		const new_sentences = this.get_fix_section(pre_sentences)
		this.all_sentences = [...this.all_sentences, ...new_sentences]
	}
	
	clear() {
		this.file_names.length = 0
		this.file_names = []
		this.file_names.push(["Книга", 0])
		this.full_text = ""
		this.pre_sentences.length = 0
		this.all_sentences.length = 0
	}
}

