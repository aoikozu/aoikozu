import * as HttpsProxyAgent from "https-proxy-agent";
import * as ytdl from "ytdl-core";
import { Cache, Strategy } from "./base";
import * as voice from "@discordjs/voice";
import Util from "../../../Util";
import { ReadableStreamInfo, UrlStreamInfo } from "../../audiosource";
import { SecondaryUserAgent } from "../../../Util/ua";
import { Readable } from "stream";
import { createChunkedYTStream } from "../stream";
const ua = SecondaryUserAgent;

type ytdlCore = "ytdlCore";
export const ytdlCore:ytdlCore = "ytdlCore";

export class ytdlCoreStrategy extends Strategy<Cache<ytdlCore, ytdl.videoInfo>>{
  async getInfo(url:string){
    this.useLog();
    const agent = Util.config.proxy && HttpsProxyAgent.default(Util.config.proxy);
    const requestOptions = agent ? {agent} : undefined;
    const t = Util.time.timer.start(`YouTube(Strategy#${this.priority})#init->GetInfo()`);
    const info = await ytdl.getInfo(url, {
      lang: "ja",
      requestOptions,
    });
    t.end();
    return {
      data: this.mapToExportable(url, info),
      cache: {
        type: ytdlCore,
        data: info,
      }
    };
  }

  async fetch(url: string, forceUrl: boolean = false, cache?: Cache<any, any>){
    this.useLog();
    const info = await (() => {
      if(cache && cache.type === "ytdlCore"){
        Util.logger.log("[AudioSource:youtube] using cache without obtaining");
        return cache.data as ytdl.videoInfo;
      }else{
        Util.logger.log("[AudioSource:youtube] obtaining info");
        const agent = Util.config.proxy && HttpsProxyAgent.default(Util.config.proxy);
        const requestOptions = agent ? {agent} : undefined;
        const t = Util.time.timer.start(`YouTube(Strategy#${this.priority})#fetch->GetInfo`);
        const info = ytdl.getInfo(url, {
          lang: "ja",
          requestOptions,
        });
        t.end();
        return info;
      }
    })();
    const format = ytdl.chooseFormat(info.formats, info.videoDetails.liveBroadcastDetails?.isLiveNow ? {
      filter: null,
      quality: null,
      isHLS: false
    } as ytdl.chooseFormatOptions : {
      filter: "audioonly",
      quality: "highestaudio",
    });
    Util.logger.log(`[AudioSource:youtube]Format: ${format.itag}, Bitrate: ${format.bitrate}bps, Audio codec:${format.audioCodec}, Container: ${format.container}`);
    const partialResult = {
      info: this.mapToExportable(url, info),
      relatedVideos: info.related_videos.map(video => ({
        url: "https://www.youtube.com/watch?v=" + video.id,
        title: video.title,
        description: "関連動画として取得したため詳細は表示されません",
        length: video.length_seconds,
        channel: (video.author as ytdl.Author)?.name,
        channelUrl: (video.author as ytdl.Author)?.channel_url,
        thumbnail: video.thumbnails[0].url,
        isLive: video.isLive
      })).filter(v => !v.isLive),
    };
    if(forceUrl){
      return {
        ...partialResult,
        stream: {
          type: "url",
          url: format.url,
          userAgent: ua,
        } as UrlStreamInfo
      };
    }else{
      let readable = null as Readable;
      if(info.videoDetails.liveBroadcastDetails && info.videoDetails.liveBroadcastDetails.isLiveNow){
        readable = ytdl.downloadFromInfo(info, {format, lang: "ja"});
      }else{
        readable = createChunkedYTStream(info, format, {lang: "ja"}, 1 * 1024 * 1024);
      }
      return {
        ...partialResult,
        stream: {
          type: "readable",
          stream: readable,
          streamType: format.container === "webm" && format.audioCodec === "opus" ? voice.StreamType.WebmOpus : undefined
        } as ReadableStreamInfo
      };
    }
  }

  protected mapToExportable(url:string, info:ytdl.videoInfo){
    return {
      url,
      title: info.videoDetails.title,
      description: info.videoDetails.description,
      length: Number(info.videoDetails.lengthSeconds),
      channel: info.videoDetails.ownerChannelName,
      channelUrl: info.videoDetails.author.channel_url,
      thumbnail: info.videoDetails.thumbnails[0].url,
      isLive: info.videoDetails.isLiveContent && info.videoDetails.liveBroadcastDetails?.isLiveNow,
    };
  }
}