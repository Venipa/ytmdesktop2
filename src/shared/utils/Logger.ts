import { inspect } from "util";
import { createLogger, format, transports } from "winston";
// import DailyRotateFile from "winston-daily-rotate-file";
const myFormat = format.printf((info) => {
  const { level, message, timestamp, ...meta } = info;
  // @ts-ignore
  const msg = [message, ...(info[Symbol.for("splat")] || [])]
    .map((arg) => {
      if (typeof arg === "object") {
        return inspect(arg, true, 5);
      } else if (arg instanceof Error) return arg.stack;
      else return arg;
    })
    .join(" ");
  return `${timestamp} [${meta.label}]${meta.moduleName ? `[${meta.moduleName}]` : ""} ${level}: ${msg}`;
});
const logger = createLogger({
  defaultMeta: {
    label: "app",
  },
  format: format.combine(
    format.splat(),
    format.timestamp({
      format: "DD-MM-YYYY HH:mm:ss.ms",
    }),
    myFormat,
  ),
  transports: [],
});

if (import.meta.env.NODE_ENV !== "production") {
  const cliFormat = (level: string) =>
    new transports.Console({
      level,
      format: format.combine(
        format.splat(),
        format.colorize(),
        format.timestamp({
          format: "HH:mm:ss",
        }),
        myFormat,
      ),
    });
  logger.add(cliFormat("debug"));
}

export default logger;
