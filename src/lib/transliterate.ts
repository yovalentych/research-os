const startSensitive = new Set(["Є", "Ї", "Й", "Ю", "Я", "є", "ї", "й", "ю", "я"]);

const mapDefault: Record<string, string> = {
  "А": "A",
  "Б": "B",
  "В": "V",
  "Г": "H",
  "Ґ": "G",
  "Д": "D",
  "Е": "E",
  "Є": "Ie",
  "Ж": "Zh",
  "З": "Z",
  "И": "Y",
  "І": "I",
  "Ї": "I",
  "Й": "I",
  "К": "K",
  "Л": "L",
  "М": "M",
  "Н": "N",
  "О": "O",
  "П": "P",
  "Р": "R",
  "С": "S",
  "Т": "T",
  "У": "U",
  "Ф": "F",
  "Х": "Kh",
  "Ц": "Ts",
  "Ч": "Ch",
  "Ш": "Sh",
  "Щ": "Shch",
  "Ь": "",
  "Ю": "Iu",
  "Я": "Ia",
  "а": "a",
  "б": "b",
  "в": "v",
  "г": "h",
  "ґ": "g",
  "д": "d",
  "е": "e",
  "є": "ie",
  "ж": "zh",
  "з": "z",
  "и": "y",
  "і": "i",
  "ї": "i",
  "й": "i",
  "к": "k",
  "л": "l",
  "м": "m",
  "н": "n",
  "о": "o",
  "п": "p",
  "р": "r",
  "с": "s",
  "т": "t",
  "у": "u",
  "ф": "f",
  "х": "kh",
  "ц": "ts",
  "ч": "ch",
  "ш": "sh",
  "щ": "shch",
  "ь": "",
  "ю": "iu",
  "я": "ia",
  "ʼ": "",
  "'": "",
};

const mapStart: Record<string, string> = {
  "Є": "Ye",
  "Ї": "Yi",
  "Й": "Y",
  "Ю": "Yu",
  "Я": "Ya",
  "є": "ye",
  "ї": "yi",
  "й": "y",
  "ю": "yu",
  "я": "ya",
};

function isWordChar(char: string) {
  return /[A-Za-zА-Яа-яІіЇїЄєҐґ]/.test(char);
}

export function transliterateUkrainian(input: string) {
  if (!input) return "";
  let result = "";
  let i = 0;
  while (i < input.length) {
    const char = input[i];
    const prev = i === 0 ? "" : input[i - 1];
    const isStart = i === 0 || !isWordChar(prev);
    const next = input[i + 1];

    if (isStart && (char === "З" || char === "з") && (next === "г" || next === "Г")) {
      result += char === "З" ? "Zgh" : "zgh";
      i += 2;
      continue;
    }

    if (isStart && startSensitive.has(char)) {
      result += mapStart[char] ?? mapDefault[char] ?? char;
    } else {
      result += mapDefault[char] ?? char;
    }
    i += 1;
  }
  return result;
}
