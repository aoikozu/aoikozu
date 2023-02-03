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

import type { exportableStatuses } from ".";
import type { GuildDataContainer, YmxFormat } from "../../Structure";
import type { DataType, MusicBotBase } from "../../botBase";

import candyget from "candyget";

import { Backupper } from ".";
import Util from "../../Util";

const MIME_JSON = "application/json";

export class HttpBackupper extends Backupper {
  private _queueModifiedGuilds:string[] = [];
  private _previousStatuses:{[guildId:string]:string} = {};

  constructor(bot:MusicBotBase, getData:() => DataType){
    super(bot, getData);
    this.Log("Initializing http based backup server adapter...");
    // ボットの準備完了直前に実行する
    this.bot.once("beforeReady", () => {
      // コンテナにイベントハンドラを設定する関数
      const setContainerEvent = (container:GuildDataContainer) => (["change", "changeWithoutCurrent"] as const).forEach(event => container.queue.on(event, () => this.addModifiedGuild(container.guildId)));
      // すでに登録されているコンテナにイベントハンドラを登録する
      this.data.forEach(setContainerEvent);
      // これから登録されるコンテナにイベントハンドラを登録する
      this.bot.on("guildDataAdded", setContainerEvent);
      // バックアップのタイマーをセット
      this.bot.on("tick", (count) => count % 2 === 0 && this.backup());
      
      this.Log("Hook was set up successfully");
    });
  }

  /**
   * 指定したサーバーIDのキューを、変更済みとしてマークします  
   * マークされたサーバーのキューは、次回のティックにバックアップが試行されます
   */
  addModifiedGuild(guildId:string){
    if(!this._queueModifiedGuilds.includes(guildId)) this._queueModifiedGuilds.push(guildId);
  }

  static get backuppable(){
    return !!(process.env.GAS_TOKEN && process.env.GAS_URL);
  }

  backup():Promise<any>|void{
    if(HttpBackupper.backuppable){
      return this.backupQueue().then(() => this.backupStatus());
    }
  }

  /**
   * キューをバックアップします
   */
  private async backupQueue(){
    try{
      const queue = this._queueModifiedGuilds.map(id => ({
        guildid: id,
        queue: JSON.stringify(this.data.get(id).exportQueue())
      }));
      if(queue.length > 0){
        this.Log("Backing up modified queue...");
        if(await this._backupQueueData(queue)){
          this._queueModifiedGuilds = [];
        }else{
          this.Log("Something went wrong while backing up queue", "warn");
        }
      }else{
        this.Log("No modified queue found, skipping", "debug");
      }
    }
    catch(e){
      this.Log(e, "error");
    }
  }

  /**
   * 接続ステータス等をバックアップします
   */
  private async backupStatus(){
    try{
      // 参加ステータスの送信
      const speaking = [] as {guildid:string, value:string}[];
      const currentStatuses = Object.assign({}, this._previousStatuses) as {[guildId:string]:string};
      this.data.forEach(container => {
        const currentStatus = ((status:exportableStatuses) => [
          status.voiceChannelId,
          status.boundChannelId,
          status.loopEnabled ? "1" : "0",
          status.queueLoopEnabled ? "1" : "0",
          status.addRelatedSongs ? "1" : "0",
          status.equallyPlayback ? "1" : "0",
          status.volume,
        ].join(":"))(container.exportStatus());
        if(!this._previousStatuses[container.guildId] || this._previousStatuses[container.guildId] !== currentStatus){
          speaking.push({
            guildid: container.guildId,
            value: currentStatus,
          });
          currentStatuses[container.guildId] = currentStatus;
        }
      });
      if(speaking.length > 0){
        this.Log("Backing up modified status..");
        if(await this._backupStatusData(speaking)){
          this._previousStatuses = currentStatuses;
        }else{
          this.Log("Something went wrong while backing up statuses", "warn");
        }
      }else{
        this.Log("No modified status found, skipping", "debug");
      }
    }
    catch(e){
      this.Log(e, "warn");
    }
  }

  async getStatusFromBackup(guildids:string[]){
    if(HttpBackupper.backuppable){
      const t = Util.time.timer.start("GetIsSpeking");
      try{
        const result = await this._requestHttp("GET", process.env.GAS_URL, {
          token: process.env.GAS_TOKEN,
          guildid: guildids.join(","),
          type: "j"
        } as requestBody, MIME_JSON);
        if(result.status === 200){
          const frozenGuildStatuses = result.data as {[guildid:string]:string};
          const map = new Map<string, exportableStatuses>();
          Object.keys(frozenGuildStatuses).forEach(key => {
            const [
              voiceChannelId,
              boundChannelId,
              loopEnabled,
              queueLoopEnabled,
              addRelatedSongs,
              equallyPlayback,
              volume,
            ] = frozenGuildStatuses[key].split(":");
            const numVolume = Number(volume) || 100;
            const b = (v:string) => v === "1";
            map.set(key, {
              voiceChannelId,
              boundChannelId,
              loopEnabled: b(loopEnabled),
              queueLoopEnabled: b(queueLoopEnabled),
              addRelatedSongs: b(addRelatedSongs),
              equallyPlayback: b(equallyPlayback),
              volume: numVolume >= 1 && numVolume <= 200 ? numVolume : 100,
            });
          });
          return map;
        }else{
          return null;
        }
      }
      catch(er){
        this.Log(er, "error");
        this.Log("Status restoring failed!", "warn");
        return null;
      }
      finally{
        t.end();
      }
    }else{
      return null;
    }
  }

  async getQueueDataFromBackup(guildids:string[]){
    if(HttpBackupper.backuppable){
      const t = Util.time.timer.start("GetQueueData");
      try{
        const result = await this._requestHttp("GET", process.env.GAS_URL, {
          token: process.env.GAS_TOKEN,
          guildid: guildids.join(","),
          type: "queue"
        } as requestBody, MIME_JSON);
        if(result.status === 200){
          const frozenQueues = result.data as {[guildid:string]:string};
          const res = new Map<string, YmxFormat>();
          Object.keys(frozenQueues).forEach(key => {
            try{
              const ymx = JSON.parse(frozenQueues[key]);
              res.set(key, ymx);
            }
            catch{ /* empty */ }
          });
          return res;
        }else{
          return null;
        }
      }
      catch(er){
        this.Log(er, "error");
        this.Log("Queue restoring failed!", "warn");
        return null;
      }
      finally{
        t.end();
      }
    }else{
      return null;
    }
  }

  /**
   * ステータス情報をサーバーへバックアップする
   */
  private async _backupStatusData(data:{guildid:string, value:string}[]){
    if(HttpBackupper.backuppable){
      const t = Util.time.timer.start("backupStatusData");
      const ids = data.map(d => d.guildid).join(",");
      const rawData = {} as {[key:string]:string};
      data.forEach(d => rawData[d.guildid] = d.value);
      try{
        const result = await this._requestHttp("POST", process.env.GAS_URL, {
          token: process.env.GAS_TOKEN,
          guildid: ids,
          data: JSON.stringify(rawData),
          type: "j"
        } as requestBody, MIME_JSON);
        if(result.status === 200){
          return true;
        }else{
          return false;
        }
      }
      catch(er){
        this.Log(er, "error");
        this.Log("Status backup failed!", "warn");
        return false;
      }
      finally{
        t.end();
      }
    }else{
      return false;
    }
  }

  /**
   * キューのデータをサーバーへバックアップする
   */
  private async _backupQueueData(data:{guildid:string, queue:string}[]){
    if(HttpBackupper.backuppable){
      const t = Util.time.timer.start("SetQueueData");
      const ids = data.map(d => d.guildid).join(",");
      const rawData = {} as {[guildid:string]:string};
      data.forEach(d => rawData[d.guildid] = encodeURIComponent(d.queue));
      try{
        const result = await this._requestHttp("POST", process.env.GAS_URL, {
          token: process.env.GAS_TOKEN,
          guildid: ids,
          data: JSON.stringify(rawData),
          type: "queue"
        } as requestBody, MIME_JSON);
        return result.status === 200;
      }
      catch(er){
        this.Log(er, "error");
        this.Log("Queue backup failed!", "warn");
        return false;
      }
      finally{
        t.end();
      }
    }else{
      return false;
    }
  }

  /**
   * HTTPでデータをバックアップするユーティリティメソッド
   */
  private async _requestHttp(method:"GET"|"POST", url:string, data?:requestBody, mimeType?:string){
    return new Promise<postResult>((resolve, reject) => {
      if(method === "GET"){
        url += "?" + (Object.keys(data) as (keyof requestBody)[]).map(k => encodeURIComponent(k) + "=" + encodeURIComponent(data[k])).join("&");
      }

      candyget(method, url, "json", {
        headers: {
          "Content-Type": mimeType,
          "User-Agent": `mtripg6666tdr/Discord-SimpleMusicBot#${this.bot.version || "unknown"} http based backup server adapter`
        },
        body: method === "POST" ? data : undefined,
      }).then(result => {
        if(typeof result.body === "string"){
          reject(result.body);
        }else{
          resolve(result.body);
        }
      });
    });
  }
}

type getResult = {
  status: 200|404,
};
type postResult = getResult & {
  data:any,
};
type requestBody = {
  token:string,
  guildid:string,
  data?:any,
  type:"queue"|"j",
};
