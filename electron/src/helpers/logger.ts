import electronLog from 'electron-log';
export type LoggerArgs = any[]

const levelRemap = {
  debug: { name: "DEBUG", level: 0, letter: 'D' },
  info: { name: "INFO", level: 1, letter: 'I' },
  warn: { name: "WARNING", level: 2, letter: 'W' },
  error: { name: "ERROR", level: 3, letter: 'E' },
} as const;

export type LogLevel = keyof typeof levelRemap;

export class Logger {
  private static tags: Set<string> = new Set();

  private static getTags() {
    const tags: string[] = []
    this.tags.forEach(t => tags.push(`[${t}]`));
    return tags.join("");
  }

  public static addTag(tag: string) {
    this.tags.add(tag);

    return this;
  }

  public static clearTags() {
    this.tags.clear();

    return this;
  }

  public static removeTag(tag: string) {
    if(this.tags.has(tag)) {
      this.tags.delete(tag);
    }

    return this;
  }

  public static debug(...loggerArgs: LoggerArgs) {
    this.log("debug", ...loggerArgs);
  }

  public static info(...loggerArgs: LoggerArgs) {
    this.log("info", ...loggerArgs);
  }

  public static warn(...loggerArgs: LoggerArgs) {
    this.log("warn", ...loggerArgs);
  }

  public static error(...loggerArgs: LoggerArgs) {
    this.log("error", ...loggerArgs);
  }


  private static log(level: LogLevel, ...data: LoggerArgs) {
    const currentLevel = levelRemap[level];

    const tags = this.getTags();

    if (tags) {
      data.splice(0, 0, tags);
    }

    const labels = this.getLabels(level);
    electronLog[level](labels.join(''), ...data);
  }

  private static getLabels(level: LogLevel) {
    const currentLevel = levelRemap[level];

    // La data non serve
    // const date = new Date(); // Todo: use clock service

    // const year = date.getUTCFullYear();
    // const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
    // const day = date.getUTCDate().toString().padStart(2, '0');
    // const hours = date.getUTCHours().toString().padStart(2, '0');
    // const minutes = date.getUTCMinutes().toString().padStart(2, '0');
    // const seconds = date.getUTCSeconds().toString().padStart(2, '0');
    // const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');

    // const dateLabel = `${year}-${month}-${day} ${hours}:${minutes}:${seconds},${milliseconds}`;

    // return [`[${currentLevel.letter}]`, `[${dateLabel}]`];
    return [`[${currentLevel.letter}]`];
  }
}