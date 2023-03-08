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

import type { exportableCustom } from ".";
import type { ReadableStreamInfo } from "./audiosource";
import type { EmbedField } from "oceanic.js";

import * as fs from "fs";
import * as path from "path";

import { AudioSource } from "./audiosource";
import { Util } from "../Util";

export class FsStream extends AudioSource<string> {
  constructor(){
    super("fs");
  }

  async init(url: string){
    this.url = url;
    this.title = "カスタムストリーム";
    try{
      this.lengthSeconds = await Util.web.RetriveLengthSeconds(url);
    }
    catch{ /* empty */ }
    return this;
  }

  async fetch(): Promise<ReadableStreamInfo>{
    return {
      type: "readable",
      stream: fs.createReadStream(path.join(__dirname, "../../", this.url)),
      streamType: "unknown",
    };
  }

  toField(){
    return [{
      name: ":asterisk:詳細",
      value: "カスタムストリーム",
    }] as EmbedField[];
  }

  npAdditional(){
    return "";
  }

  exportData(): exportableCustom{
    return {
      url: this.url,
      length: this.lengthSeconds,
      title: this.title,
    };
  }
}
