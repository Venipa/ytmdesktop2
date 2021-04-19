import chalk from "chalk";

const types = ["debug", "info", "error", "warn"];

type LoggerStyle = chalk.Chalk;

interface ILoggerConfig {
  moduleStyle: LoggerStyle;
  timestampStyle: LoggerStyle;
  debugStyle: LoggerStyle;
  infoStyle: LoggerStyle;
  warnStyle: LoggerStyle;
  errorStyle: LoggerStyle;

  padSeverity: boolean;
  padModule: boolean;
  // TODO: alignTimestamp

  showMilliseconds: boolean;
  showDebug: boolean;
  format: string;
}

const styles = {
  black: chalk.black,
  blue: chalk.blue,
  blackBright: chalk.blackBright,
  blueBright: chalk.blueBright,
  cyan: chalk.cyan,
  cyanBright: chalk.cyanBright,
  green: chalk.green,
  greenBright: chalk.greenBright,
  grey: chalk.grey, // No, it is not spelt 'gray'.
  magenta: chalk.magenta,
  magentaBright: chalk.magentaBright,
  orange: chalk.keyword("orange"),
  red: chalk.red,
  redBright: chalk.redBright,
  white: chalk.white,
  whiteBright: chalk.whiteBright,
  yellow: chalk.yellow,
  yellowBright: chalk.yellowBright,
};

const defaultConfig: ILoggerConfig = {
  moduleStyle: styles.magentaBright,
  timestampStyle: styles.yellow,
  debugStyle: styles.green,
  infoStyle: styles.blueBright,
  warnStyle: styles.orange,
  errorStyle: styles.redBright,

  padSeverity: true,
  padModule: true,

  showMilliseconds: false,
  showDebug: true,

  format: "$t  $m  $s ",
};

export default class Logger {
  public static styles = styles;
  public static hex = chalk.hex;
  public static rgb = chalk.rgb;

  public static defaults: ILoggerConfig = defaultConfig;

  private alignedTypes: string[] = [];

  private static longestModule: number = 0;

  private config: ILoggerConfig;

  public static enableProduction() {
    this.defaults.showDebug = false;
  }

  constructor(public moduleName: string, config: Partial<ILoggerConfig> = {}) {
    this.config = Object.assign({}, defaultConfig, config);

    const maxLength = types.reduce((p, c) => (c.length > p ? c.length : p), 0);

    if (this.config.padSeverity) {
      types.forEach(
        (type, i) =>
          (this.alignedTypes[i] = `${type}${new Array(maxLength - type.length)
            .fill(" ")
            .join("")}`)
      );
    } else {
      this.alignedTypes = types;
    }

    if (moduleName.length > Logger.longestModule)
      Logger.longestModule = moduleName.length;
  }

  public as(moduleName: string): Logger {
    const RenamedLogger = this.constructor as { new (...args: any[]): Logger };
    const logger = new RenamedLogger(moduleName, this.config);
    Object.assign(logger, this);

    logger.moduleName = moduleName;

    return logger;
  }

  public debug(...args: any): void {
    if (this.config.showDebug) this.print(this.config.debugStyle(this.alignedTypes[0]), ...args);
  }

  public info(...args: any): void {
    this.print(this.config.infoStyle(this.alignedTypes[1]), ...args);
  }

  public warn(...args: any): void {
    this.print(this.config.warnStyle(this.alignedTypes[3]), ...args);
  }

  public error(...args: any): void {
    this.print(this.config.errorStyle(this.alignedTypes[2]), ...args);
  }

  // TODO: Make this method as logic-less (and therefore performant) as possible
  // Calling 3 RegEx queries on each log for example isn't great
  private print(type: string, ...args: any): void {
    const now = new Date();
    let time = now.toLocaleTimeString("en-GB", { hour12: false });

    if (this.config.showMilliseconds) time += `.${now.getMilliseconds()}`;

    const difference = Logger.longestModule - this.moduleName.length;
    const module =
      !this.config.padModule || difference === 0
        ? this.moduleName
        : `${this.moduleName}${new Array(difference)
            .fill(" ")
            .reduce((p, c) => p + c)}`;

    console.log(
      this.config.format
        .replace(/\$t/g, this.config.timestampStyle(time))
        .replace(/\$m/g, this.config.moduleStyle(module))
        .replace(/\$s/g, type),
      ...args
    );
  }
}
