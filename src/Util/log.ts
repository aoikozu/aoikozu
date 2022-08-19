import * as fs from "fs";
import * as path from "path";
import { isMainThread } from "worker_threads";
import * as config from "./config";

type LogLevels = "log"|"warn"|"error"|"debug";
export type LoggerType = (content:string, level?:LogLevels)=>void;

class LogStore{
  private readonly loggingStream = null as fs.WriteStream;
  
  constructor(){
    if(config.debug && isMainThread){
      if(!fs.existsSync(path.join(__dirname, "../../logs"))){
        fs.mkdirSync(path.join(__dirname, "../../logs"));
      }
      this.loggingStream = fs.createWriteStream(path.join(__dirname, `../../logs/log-${Date.now()}.txt`));
      const onExit = () => {
        if(!this.loggingStream.destroyed){
          this.loggingStream.write(Buffer.from("[Logger] detect process exiting, closing stream..."));
          this.loggingStream.destroy();
        }
      };
      process.on("exit", onExit);
      process.on("SIGINT", onExit);
    }
  }

  log:boolean = true;
  maxLength = 30;
  data:string[] = [];
  
  addLog(level:LogLevels, log:string){
    if(level !== "debug"){
      this.data.push(`${level[0].toUpperCase()}:${log}`);
      if(this.data.length > this.maxLength){
        this.data.shift();
      }
    }
    if(this.loggingStream && !this.loggingStream.destroyed){
      this.loggingStream.write(Buffer.from(`${{
        "log": "INFO ",
        "warn": "WARN ",
        "error": "ERROR",
        "debug": "DEBUG",
      }[level]} ${new Date().toISOString()} ${log}\r\n`));
    }
  }
}

export const logStore = new LogStore();

export function log(content:string, level:LogLevels = "log"){
  if(!logStore.log && level === "log") return;
  if(content.length < 200){
    console[level](content);
  }else{
    console.warn("[Logger] truncated because content was too big; see logs directory to get complete logs (if not exists, make sure debug is set true in config.json)");
  }
  logStore.addLog(level, content);
}
