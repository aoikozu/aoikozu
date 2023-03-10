/*
 * Copyright 2021-2023 mtripg6666tdr
 * 
 * This file is part of mtripg6666tdr/Discord-SimpleMusicBot. 
 * (npm package name: 'discord-music-bot' / repository url: <https://github.com/mtripg6666tdr/Discord-SimpleMusicBot> )
 * 
 * mtripg6666tdr/Discord-SimpleMusicBot is free software: you can redistribute it and/or modify it 
 * under the terms of the GNU General Public License as published by the Free Software Foundation, 
 * either version 3 of the License, or (at your option) any later version.
 *
 * mtripg6666tdr/Discord-SimpleMusicBot is distributed in the hope that it will be useful, 
 * but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
 * See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with mtripg6666tdr/Discord-SimpleMusicBot. 
 * If not, see <https://www.gnu.org/licenses/>.
 */

import type { LoggingEvent } from "log4js";

import path from "path";
import { isMainThread } from "worker_threads";

import log4js from "log4js";

import { stringifyObject } from "./Util";
import { useConfig } from "./config";

const { debug } = useConfig();

const tokens = {
  category: function(logEvent: LoggingEvent){
    if(logEvent.context?.guildId){
      return `${logEvent.categoryName}/${logEvent.context?.id}`;
    }else{
      return logEvent.categoryName;
    }
  },
  level: function(logEvent: LoggingEvent){
    switch(logEvent.level.levelStr){
      case "INFO":
        return "INFO ";
      case "WARN":
        return "WARN ";
      default:
        return logEvent.level.levelStr;
    }
  },
};

const fileLayout = {
  type: "pattern",
  pattern: "%d %x{level} [%x{category}] %m",
  tokens,
};

const stdoutLayout = {
  type: "pattern",
  pattern: "%[%d%] %[%x{level}%] %[[%x{category}]%] %m",
  tokens,
};

const MEMORYSTORE_MAXSIZE = 40;
const memoryStore: string[] = [];
const memoryAppender = {
  configure: function(){
    return function(logEvent: LoggingEvent){
      const level = logEvent.level.levelStr[0];
      const logContent = `${level}:[${tokens.category(logEvent)}] ${logEvent.data.map(data => typeof data === "string" ? data : stringifyObject(data))}`;
      memoryStore.push(logContent);
      if(memoryStore.length > MEMORYSTORE_MAXSIZE){
        memoryStore.shift();
      }
      if(process.env.CONSOLE_ENABLE){
        console[level === "F" || level === "E" ? "error" : level === "W" ? "warn" : "log"](logContent);
      }
    };
  },
};

export const getLogs: (() => readonly string[]) = () => memoryStore;

const TRANSFER_PORT = Number(process.env.LOG_TRANSFER_PORT) || 5003;

if(isMainThread){
  if(debug){
    log4js.configure({
      appenders: {
        out: {
          type: "stdout",
          layout: stdoutLayout,
        },
        file: {
          type: "file",
          filename: path.join(__dirname, `../logs/log-${Date.now()}.log`),
          backups: 999,
          layout: fileLayout,
        },
        memory: {
          type: memoryAppender,
        },
        server: {
          type: "tcp-server",
          port: TRANSFER_PORT,
        },
      },
      categories: {
        default: { appenders: ["out", "file", "memory"], level: "debug" },
      },
    });
  }else{
    log4js.configure({
      appenders: {
        out: {
          type: "stdout",
          layout: stdoutLayout,
        },
        memory: {
          type: memoryAppender,
        },
        server: {
          type: "tcp-server",
          port: TRANSFER_PORT,
        },
      },
      categories: {
        default: { appenders: ["out", "memory"], level: "info" },
      },
    });
  }
}else{
  log4js.configure({
    appenders: {
      network: {
        type: "tcp",
        port: TRANSFER_PORT,
      },
    },
    categories: {
      default: { appenders: ["network"], level: "debug" },
    },
  });
}

export type LoggerObject = {
  debug: log4js.Logger["debug"],
  info: log4js.Logger["info"],
  warn: log4js.Logger["warn"],
  error: log4js.Logger["error"],
  fatal: log4js.Logger["fatal"],
  addContext: log4js.Logger["addContext"],
};

const loggerMap = new Map<string, LoggerObject>();

export function getLogger(tag: string){
  if(loggerMap.has(tag)){
    return loggerMap.get(tag);
  }else{
    const log4jsLogger = log4js.getLogger(tag);
    const logger: LoggerObject = {
      debug: log4jsLogger.debug.bind(log4jsLogger),
      info: log4jsLogger.info.bind(log4jsLogger),
      warn: log4jsLogger.warn.bind(log4jsLogger),
      error: log4jsLogger.error.bind(log4jsLogger),
      fatal: log4jsLogger.fatal.bind(log4jsLogger),
      addContext: log4jsLogger.addContext.bind(log4jsLogger),
    };
    loggerMap.set(tag, logger);
    return logger;
  }
}
