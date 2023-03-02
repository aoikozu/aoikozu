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

import type { Cache } from "./base";
import type { exportableYouTube } from "..";
import type { BinaryManager } from "../../../Component/BinaryManager";
import type { ReadableStreamInfo, UrlStreamInfo } from "../../audiosource";

import miniget from "miniget";

import { Strategy } from "./base";
import { Util } from "../../../Util";

export class baseYoutubeDlStrategy<T extends string> extends Strategy<Cache<T, YoutubeDlInfo>, YoutubeDlInfo> {
  constructor(priority: number, protected id: T, protected binaryManager: BinaryManager){
    super(priority);
  }

  get cacheType(){
    return this.id;
  }
  
  last: number = 0;

  async getInfo(url: string){
    this.useLog();
    const t = Util.time.timer.start(`YouTube(Strategy${this.priority})#getInfo`);
    let info = null as YoutubeDlInfo;
    try{
      info = JSON.parse(await this.binaryManager.exec(["--skip-download", "--print-json", url])) as YoutubeDlInfo;
    }
    finally{
      t.end(this.logger);
    }
    return {
      data: this.mapToExportable(url, info),
      cache: {
        type: this.id,
        data: info,
      }
    };
  }

  async fetch(url: string, forceUrl: boolean = false, cache?: Cache<any, any>){
    this.useLog();
    const t = Util.time.timer.start(`YouTube(Strategy${this.priority})#fetch`);
    let info = null as YoutubeDlInfo;
    try{
      const availableCache = cache?.type === this.id && cache.data as YoutubeDlInfo;
      this.logger(`[AudioSource:youtube] ${availableCache ? "using cache without obtaining" : "obtaining info"}`);
      info = availableCache || JSON.parse(await this.binaryManager.exec(["--skip-download", "--print-json", url])) as YoutubeDlInfo;
    }
    finally{
      t.end(this.logger);
    }
    const partialResult = {
      info: this.mapToExportable(url, info),
      relatedVideos: null as exportableYouTube[],
    };
    if(info.is_live){
      const format = info.formats.filter(f => f.format_id === info.format_id);
      return {
        ...partialResult,
        stream: {
          type: "url",
          url: format[0].url,
          userAgent: format[0].http_headers["User-Agent"]
        } as UrlStreamInfo
      };
    }else{
      const formats = info.formats.filter(f => (f.format_note === "tiny" || f.video_ext === "none" && f.abr));
      if(formats.length === 0) throw new Error("no format found!");
      const [format] = formats.sort((fa, fb) => fb.abr - fa.abr);
      const stream = miniget(format.url, {
        headers: {
          ...format.http_headers,
        }
      });
      if(forceUrl){
        return {
          ...partialResult,
          stream: {
            type: "url",
            url: format.url,
            streamType: format.ext === "webm" && format.acodec === "opus" ? "webm" : undefined,
            userAgent: format.http_headers["User-Agent"],
          } as UrlStreamInfo
        };
      }
      return {
        ...partialResult,
        stream: {
          type: "readable",
          stream,
          streamType: format.ext === "webm" && format.acodec === "opus" ? "webm" : undefined,
        } as ReadableStreamInfo,
      };
    }
  }

  protected mapToExportable(url: string, info: YoutubeDlInfo): exportableYouTube{
    return {
      url: url,
      title: info.title,
      description: info.description,
      length: Number(info.duration),
      channel: info.channel,
      channelUrl: info.channel_url,
      thumbnail: info.thumbnail,
      isLive: info.is_live,
    };
  }
}

// QuickType of youtube-dl json
export interface YoutubeDlInfo {
  id: string;
  title: string;
  formats: Format[];
  thumbnails: Thumbnail[];
  description: string;
  upload_date: string;
  uploader: string;
  uploader_id: string;
  uploader_url: string;
  channel_id: string;
  channel_url: string;
  duration: number;
  view_count: number;
  average_rating: number;
  age_limit: number;
  webpage_url: string;
  categories: string[];
  tags: string[];
  is_live: null;
  automatic_captions: { [key: string]: any[] };
  subtitles: any;
  like_count: number;
  dislike_count: number;
  channel: string;
  track: string;
  artist: string;
  album: string;
  creator: string;
  alt_title: string;
  extractor: string;
  webpage_url_basename: string;
  extractor_key: string;
  playlist: null;
  playlist_index: null;
  thumbnail: string;
  display_id: string;
  requested_subtitles: null;
  requested_formats: Format[];
  format: string;
  format_id: string;
  width: number;
  height: number;
  resolution: null;
  fps: number;
  vcodec: string;
  vbr: number;
  stretched_ratio: null;
  acodec: Acodec;
  abr: number;
  ext: TempEXT;
  fulltitle: string;
  _filename: string;
}

enum Acodec {
  Mp4A402 = "mp4a.40.2",
  None = "none",
  Opus = "opus"
}

enum TempEXT {
  M4A = "m4a",
  Mp4 = "mp4",
  Webm = "webm"
}

interface Format {
  asr: number | null;
  filesize: number;
  format_id: string;
  format_note: string;
  fps: number | null;
  height: number | null;
  quality: number;
  tbr: number;
  url: string;
  width: number | null;
  ext: TempEXT;
  vcodec: string;
  acodec: Acodec;
  abr?: number;
  downloader_options?: DownloaderOptions;
  container?: Container;
  format: string;
  protocol: Protocol;
  http_headers: HTTPHeaders;
  vbr?: number;
  video_ext?: string;
}

enum Container {
  M4ADash = "m4a_dash",
  Mp4Dash = "mp4_dash",
  WebmDash = "webm_dash"
}

interface DownloaderOptions {
  http_chunk_size: number;
}

interface HTTPHeaders {
  "User-Agent": string;
  "Accept-Charset": AcceptCharset;
  Accept: Accept;
  "Accept-Encoding": AcceptEncoding;
  "Accept-Language": AcceptLanguage;
}

enum Accept {
  TextHTMLApplicationXHTMLXMLApplicationXMLQ09Q08 = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
}

enum AcceptCharset {
  ISO88591UTF8Q07Q07 = "ISO-8859-1,utf-8;q=0.7,*;q=0.7"
}

enum AcceptEncoding {
  GzipDeflate = "gzip, deflate"
}

enum AcceptLanguage {
  EnUsEnQ05 = "en-us,en;q=0.5"
}

enum Protocol {
  HTTPS = "https"
}

interface Thumbnail {
  height: number;
  url: string;
  width: number;
  resolution: string;
  id: string;
}