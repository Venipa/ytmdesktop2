import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
const myFormat = format.printf(({ level, message, label, timestamp }) => {
  return `${timestamp} [${label}] ${level}: ${
    typeof (message as any) === "object" ? JSON.stringify(message) : message
  }`;
});
const logger = createLogger({
  defaultMeta: {
    label: "app",
  },
  format: format.combine(format.splat(), format.timestamp(), myFormat),
  transports: [],
});

if (process.env.NODE_ENV !== "production") {
  const cliFormat = (level: string) =>
    new transports.Console({
      level,
      format: format.combine(
        format.splat(),
        format.colorize(),
        format.timestamp(),
        myFormat
      ),
    });
  logger.add(cliFormat("debug"));
} else {
  logger.add(
    new DailyRotateFile({
      filename: "error-%DATE%.log",
      maxFiles: "14d",
      maxSize: "10m",
      zippedArchive: true,
      level: "error",
    })
  );
}

export default logger;
