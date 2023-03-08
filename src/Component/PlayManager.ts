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

import type { AudioSource, YouTube } from "../AudioSource";
import type { GuildDataContainer } from "../Structure";
import type { AudioPlayer, AudioResource } from "@discordjs/voice";
import type { Message, TextChannel } from "oceanic.js";
import type { Readable } from "stream";

import { MessageActionRowBuilder, MessageButtonBuilder, MessageEmbedBuilder } from "@mtripg6666tdr/oceanic-command-resolver/helper";

import { AudioPlayerStatus, createAudioResource, createAudioPlayer, entersState, StreamType, VoiceConnectionStatus } from "@discordjs/voice";

import { resolveStreamToPlayable } from "./streams";
import { Normalizer } from "./streams/normalizer";
import { ServerManagerBase } from "../Structure";
import { Util } from "../Util";
import { getColor } from "../Util/color";
import { getFFmpegEffectArgs } from "../Util/effect";
import { FallBackNotice } from "../definition";

/**
 * サーバーごとの再生を管理するマネージャー。
 * 再生や一時停止などの処理を行います。
 */
export class PlayManager extends ServerManagerBase {
  protected readonly retryLimit = 3;
  protected _seek = 0;
  protected _errorReportChannel: TextChannel = null;
  protected _volume = 100;
  protected _errorCount = 0;
  protected _errorUrl = "";
  protected _preparing = false;
  protected _currentAudioInfo: AudioSource = null;
  protected _currentAudioStream: Readable = null;
  protected _cost = 0;
  protected _finishTimeout = false;
  protected _player: AudioPlayer = null;
  protected _resource: AudioResource = null;
  protected waitForLive: boolean = false;

  get preparing(){
    return this._preparing;
  }

  private set preparing(val: boolean){
    this._preparing = val;
  }

  get currentAudioInfo(): Readonly<AudioSource>{
    return this._currentAudioInfo;
  }

  get currentAudioUrl(): string{
    if(this.currentAudioInfo) return this.currentAudioInfo.Url;
    else return "";
  }

  get cost(){
    return this._cost;
  }

  /**
   *  接続され、再生途中にあるか（たとえ一時停止されていても）
   */
  get isPlaying(): boolean{
    return this.isConnecting && this._player && (this._player.state.status === AudioPlayerStatus.Playing || this.waitForLive);
  }

  /**
   *  VCに接続中かどうか
   */
  get isConnecting(): boolean{
    return this.server.connection && this.server.connection.state.status === VoiceConnectionStatus.Ready;
  }

  /**
   * 一時停止されているか
   */
  get isPaused(): boolean{
    return this.isConnecting && this._player && this._player.state.status === AudioPlayerStatus.Paused;
  }

  /**
   *  現在ストリーミングした時間(ミリ秒!)
   * @remarks ミリ秒単位なので秒に直すには1000分の一する必要がある
   */
  get currentTime(): number{
    if(!this.isPlaying || this._player.state.status === AudioPlayerStatus.Idle || this._player.state.status === AudioPlayerStatus.Buffering){
      return 0;
    }
    return this._seek * 1000 + this._player.state.playbackDuration;
  }

  get volume(){
    return this._volume;
  }

  get finishTimeout(){
    return this._finishTimeout;
  }

  // コンストラクタ
  constructor(){
    super();
    this.setTag("PlayManager");
    this.Log("Play Manager instantiated");
  }

  /**
   *  親となるGuildVoiceInfoをセットする関数（一回のみ呼び出せます）
   */
  override setBinding(data: GuildDataContainer){
    this.Log("Set data of guild id " + data.guildId);
    super.setBinding(data);
  }

  setVolume(val: number){
    this._volume = val;
    if(this._resource.volume){
      this._resource.volume.setVolume(val / 100);
      return true;
    }
    return false;
  }

  /**
   *  再生します
   */
  async play(time: number = 0, quiet: boolean = false): Promise<PlayManager>{
    this.emit("playCalled", time);

    // 再生できる状態か確認
    const badCondition = this.getIsBadCondition();
    if(badCondition){
      this.Log("Play called but operated nothing", "warn");
      return this;
    }

    this.Log("Play called");
    this.emit("playPreparing", time);
    this.preparing = true;
    let mes: Message = null;
    this._currentAudioInfo = this.server.queue.get(0).basicInfo;

    // 通知メッセージを送信する（可能なら）
    if(this.getNoticeNeeded() && !quiet){
      const [min, sec] = Util.time.CalcMinSec(this.currentAudioInfo.LengthSeconds);
      const isLive = this.currentAudioInfo.isYouTube() && this.currentAudioInfo.LiveStream;
      if(this._currentAudioInfo.isYouTube() && this._currentAudioInfo.availableAfter){
        // まだ始まっていないライブを待機する
        mes = await this.server.bot.client.rest.channels.createMessage(
          this.server.boundTextChannel,
          {
            content: `:stopwatch: \`${this.currentAudioInfo.Title}\` \`(ライブストリーム)\`の開始を待機中...`,
          }
        );
        this.waitForLive = true;
        this.preparing = false;
        const waitTarget = this._currentAudioInfo;
        await new Promise<void>(resolve => {
          let timeout: NodeJS.Timeout = null;
          this.once("stop", () => {
            if(timeout) clearTimeout(timeout);
            resolve();
          });
          const checkForLive = () => {
            if(waitTarget !== this._currentAudioInfo) return;
            const startTime = this._currentAudioInfo.isYouTube() && this._currentAudioInfo.availableAfter;
            if(!startTime) resolve();
            const waitTime = Math.max(new Date(startTime).getTime() - Date.now(), 20 * 1000);
            this.Log(`Retrying after ${waitTime}ms`);
            timeout = setTimeout(async () => {
              if(waitTarget !== this._currentAudioInfo) return;
              if(this._currentAudioInfo.isYouTube()){
                this._currentAudioInfo.disableCache();
                await this._currentAudioInfo.init(this._currentAudioInfo.Url, null);
              }
              checkForLive();
            }, waitTime).unref();
          };
          checkForLive();
        });
        if(!this.waitForLive){
          await mes.edit({
            content: ":white_check_mark: 待機をキャンセルしました",
          });
          return this;
        }
        this.waitForLive = false;
        this.preparing = true;
      }else{
        mes = await this.server.bot.client.rest.channels.createMessage(
          this.server.boundTextChannel,
          {
            content: `:hourglass_flowing_sand: \`${this.currentAudioInfo.Title}\` \`(${isLive ? "ライブストリーム" : `${min}:${sec}`})\`の再生準備中...`,
          }
        );
      }
    }

    try{
      // シーク位置を確認
      if(this.currentAudioInfo.LengthSeconds <= time) time = 0;
      this._seek = time;
      const t = Util.time.timer.start("PlayManager#Play->FetchAudioSource");

      // QueueContentからストリーム情報を取得
      const rawStream = await this.currentAudioInfo.fetch(time > 0);

      // 情報からストリームを作成
      const voiceChannel = this.server.connectingVoiceChannel;
      if(!voiceChannel) return this;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { stream, streamType, cost, streams } = resolveStreamToPlayable(
        rawStream,
        getFFmpegEffectArgs(this.server),
        this._seek,
        this.volume !== 100,
        voiceChannel.bitrate
      );
      this._currentAudioStream = stream;

      // 各種準備
      this._errorReportChannel = mes?.channel as TextChannel;
      this._cost = cost;
      t.end();

      // 再生
      this.prepareAudioPlayer();
      const normalizer = new Normalizer(stream, this.volume !== 100);
      normalizer.once("end", this.onStreamFinished.bind(this));
      const resource = this._resource = createAudioResource(normalizer, {
        inputType:
          streamType === "webm/opus"
            ? StreamType.WebmOpus
            : streamType === "ogg/opus"
              ? StreamType.OggOpus
              : streamType === "raw"
                ? StreamType.Raw
                : StreamType.Arbitrary,
        inlineVolume: this.volume !== 100,
      });

      // 昔はこれないとダメだったので
      // 様子を見ながら考える
      // ノーマライザーがあるから大丈夫かもしれない
      // const fixedResource = FixedAudioResource.fromAudioResource(resource, this.currentAudioInfo.LengthSeconds - time);
      // this._player.play(fixedResource);

      this._player.play(resource);

      // setup volume
      this.setVolume(this.volume);

      // wait for entering playing state
      await entersState(this._player, AudioPlayerStatus.Playing, 10e3);
      this.preparing = false;
      this.emit("playStarted");

      this.Log("Play started successfully");

      if(mes && !quiet){
        // 再生開始メッセージ
        const _t = Number(this.currentAudioInfo.LengthSeconds);
        const [min, sec] = Util.time.CalcMinSec(_t);
        const timeFragments = Util.time.CalcHourMinSec(this.server.queue.lengthSecondsActual - (this.currentAudioInfo.LengthSeconds || 0));
        /* eslint-disable @typescript-eslint/indent */
        const embed = new MessageEmbedBuilder()
          .setTitle(":cd:現在再生中:musical_note:")
          .setDescription(
              `[${this.currentAudioInfo.Title}](${this.currentAudioUrl}) \``
            + (this.currentAudioInfo.ServiceIdentifer === "youtube" && (this.currentAudioInfo as YouTube).LiveStream ? "(ライブストリーム)" : _t === 0 ? "(不明)" : min + ":" + sec)
            + "`"
          )
          .setColor(getColor("AUTO_NP"))
          .addField("リクエスト", this.server.queue.get(0).additionalInfo.addedBy.displayName, true)
          .addField("次の曲",
            // トラックループオンなら現在の曲
            this.server.queue.loopEnabled ? this.server.queue.get(0).basicInfo.Title
            // (トラックループはオフ)長さが2以上ならオフセット1の曲
            : this.server.queue.length >= 2 ? this.server.queue.get(1).basicInfo.Title
            // (トラックループオフ,長さ1)キューループがオンなら現在の曲
            : this.server.queue.queueLoopEnabled ? this.server.queue.get(0).basicInfo.Title
            // (トラックループオフ,長さ1,キューループオフ)次の曲はなし
            : "次の曲がまだ登録されていません", true
          )
          .addField("再生待ちの曲", this.server.queue.loopEnabled ? "ループします" : this.server.queue.length - 1 + "曲(" + Util.time.HourMinSecToString(timeFragments) + ")", true)
        ;
        if(typeof this.currentAudioInfo.Thumbnail === "string"){
          embed.setThumbnail(this.currentAudioInfo.Thumbnail);
        }else{
          embed.setThumbnail("attachment://thumbnail." + this.currentAudioInfo.Thumbnail.ext);
        }
        /* eslint-enable @typescript-eslint/indent */
        if(this.currentAudioInfo.isYouTube() && this.currentAudioInfo.IsFallbacked){
          embed.addField(":warning:注意", FallBackNotice);
        }

        this.emit("playStartUIPrepared", embed);

        const components = [
          new MessageActionRowBuilder()
            .addComponents(
              new MessageButtonBuilder()
                .setCustomId("control_rewind")
                .setEmoji("⏮️")
                .setLabel("頭出し")
                .setStyle("SECONDARY"),
              new MessageButtonBuilder()
                .setCustomId("control_playpause")
                .setEmoji("⏯️")
                .setLabel("再生/一時停止")
                .setStyle("PRIMARY"),
              new MessageButtonBuilder()
                .setCustomId("control_skip")
                .setEmoji("⏭️")
                .setLabel("スキップ")
                .setStyle("SECONDARY"),
              new MessageButtonBuilder()
                .setCustomId("control_onceloop")
                .setEmoji("🔂")
                .setLabel("ワンスループ")
                .setStyle("SECONDARY"),
            )
            .toOceanic(),
        ];

        if(typeof this.currentAudioInfo.Thumbnail === "string"){
          mes.edit({
            content: "",
            embeds: [embed.toOceanic()],
            components,
          }).catch(e => Util.logger.log(e, "error"));
        }else{
          mes.edit({
            content: "",
            embeds: [embed.toOceanic()],
            components,
            files: [
              {
                name: "thumbnail." + this.currentAudioInfo.Thumbnail.ext,
                contents: this.currentAudioInfo.Thumbnail.data,
              },
            ],
          });
        }

        const removeControls = () => {
          this.off("playCompleted", removeControls);
          this.off("handledError", removeControls);
          this.off("stop", removeControls);
          mes.edit({
            components: [],
          }).catch(er => this.Log(er, "error"));
        };

        this.once("playCompleted", removeControls);
        this.once("handledError", removeControls);
        this.once("stop", removeControls);
      }
    }
    catch(e){
      Util.logger.log(e, "error");
      try{
        const t = typeof e === "string" ? e : Util.general.StringifyObject(e);
        if(t.includes("429")){
          mes?.edit({
            content: ":sob:レート制限が検出されました。しばらくの間YouTubeはご利用いただけません。",
          }).catch(er => Util.logger.log(er, "error"));
          this.Log("Rate limit detected", "error");
          this.stop();
          this.preparing = false;
          return this;
        }
      }
      catch{ /* empty */ }
      
      if(mes){
        mes.edit({
          content: `:tired_face:曲の再生に失敗しました...。${
            e ? `(${typeof e === "object" && "message" in e ? e.message : e
            })` : ""}`
            + (this._errorCount + 1 >= this.retryLimit ? "スキップします。" : "再試行します。"),
        });
        this.onStreamFailed();
      }
    }
    return this;
  }

  protected prepareAudioPlayer(){
    if(this._player || !this.server.connection) return;
    this._player = createAudioPlayer({
      debug: Util.config.debug,
    });
    if(Util.config.debug){
      this._player.on("debug", message => this.Log(`[InternalAudioPlayer] ${message}`, "debug"));
    }
    this._player.on("error", this.handleError.bind(this));
    this.server.connection.subscribe(this._player);
  }

  protected getIsBadCondition(){
    // 再生できる状態か確認
    return /* 接続していない */ !this.isConnecting
      // なにかしら再生中
      || this.isPlaying
      // キューが空
      || this.server.queue.isEmpty
      // 準備中
      || this.preparing
    ;
  }

  protected getNoticeNeeded(){
    return !!this.server.boundTextChannel;
  }

  /** 
   * 停止します。切断するにはDisconnectを使用してください。
   * @returns this
  */
  stop(): PlayManager{
    this.Log("Stop called");
    if(this.server.connection){
      this._player?.stop();
      this.waitForLive = false;
      this.emit("stop");
    }
    return this;
  }

  /**
   * 切断します。内部的にはStopも呼ばれています。これを呼ぶ前にStopを呼ぶ必要はありません。
   * @returns this
   */
  disconnect(): PlayManager{
    this.stop();
    this.emit("disconnectAttempt");

    if(this.server.connection){
      this.Log("Disconnected from " + this.server.connectingVoiceChannel.id);
      this.server.connection.disconnect();
      this.server.connection.destroy();
      this.emit("disconnect");
      this.destroyStream();
    }else{
      this.Log("Disconnect called but no connection", "warn");
    }

    this.server.connection = null;
    this.server.connectingVoiceChannel = null;
    this._player = null;

    if(typeof global.gc === "function"){
      global.gc();
      this.Log("Called exposed gc");
    }
    return this;
  }

  destroyStream(){
    if(this._currentAudioStream){
      setImmediate(() => {
        if(this._currentAudioStream){
          if(!this._currentAudioStream.destroyed){
            this._currentAudioStream.destroy();
          }
          this._currentAudioStream = null;
          if(this._resource){
            this._resource = null;
          }
        }
      });
    }
  }

  /**
   * 一時停止します。
   * @returns this
   */
  pause(): PlayManager{
    this.Log("Pause called");
    this.emit("pause");
    this._player.pause();
    return this;
  }

  /**
   * 一時停止再生します。
   * @returns this
   */
  resume(): PlayManager{
    this.Log("Resume called");
    this.emit("resume");
    this._player.unpause();
    return this;
  }

  /**
   * 頭出しをします。
   * @returns this
   */
  rewind(): PlayManager{
    this.Log("Rewind called");
    this.emit("rewind");
    this.stop().play();
    return this;
  }

  handleError(er: any){
    Util.logger.log("Error", "error");
    this.emit("handledError", er);
    if(er){
      Util.logger.log(Util.general.StringifyObject(er), "error");
      if(Util.config.debug){
        console.error(er);
      }
    }
    if(er instanceof Error){
      if("type" in er && er.type === "workaround"){
        this.onStreamFailed(/* quiet */ true);
        return;
      }
    }
    this._errorReportChannel?.createMessage({
      content: ":tired_face:曲の再生に失敗しました...。"
        + (this._errorCount + 1 >= this.retryLimit ? "スキップします。" : "再試行します。"),
    });
    this.onStreamFailed();
  }

  resetError(){
    this._errorCount = 0;
    this._errorUrl = "";
  }

  async onStreamFinished(){
    if(!this.currentAudioUrl){
      return;
    }
    this.Log("onStreamFinished called");

    if(this.server.connection && this._player.state.status === AudioPlayerStatus.Playing){
      await entersState(this._player, AudioPlayerStatus.Idle, 20e3)
        .catch(() => {
          this.Log("Stream has not ended in time and will force stream into destroying", "warn");
          this.stop();
        })
      ;
    }

    // ストリームが終了したら時間を確認しつつ次の曲へ移行
    this.Log("Stream finished");
    this.emit("playCompleted");

    // 再生が終わったら
    this._errorCount = 0;
    this._errorUrl = "";
    this._cost = 0;
    this.destroyStream();
    if(this.server.queue.loopEnabled){
      // 曲ループオンならばもう一度再生
      this.play();
      return;
    }else if(this.server.queue.onceLoopEnabled){
      // ワンスループが有効ならもう一度同じものを再生
      this.server.queue.onceLoopEnabled = false;
      this.play();
      return;
    }else{
      // キュー整理
      await this.server.queue.next();
    }
    // キューがなくなったら接続終了
    if(this.server.queue.isEmpty){
      await this.onQueueEmpty();
    // なくなってないなら再生開始！
    }else{
      this.play();
    }
  }

  async onQueueEmpty(){
    this.Log("Queue empty");
    this.destroyStream();

    if(this.server.boundTextChannel){
      await this.server.bot.client.rest.channels
        .createMessage(this.server.boundTextChannel, {
          content: ":upside_down: キューが空になりました",
        })
        .catch(e => Util.logger.log(e, "error"))
      ;
    }

    const timer = setTimeout(() => {
      this.off("playCalled", playHandler);
      this.off("disconnectAttempt", playHandler);
      this._finishTimeout = false;
      if(!this.isPlaying && this.server.boundTextChannel){
        this.server.bot.client.rest.channels
          .createMessage(this.server.boundTextChannel, {
            content: ":wave:キューが空になったため終了します",
          })
          .catch(e => Util.logger.log(e, "error"))
        ;
      }
      this.disconnect();
    }, 10 * 60 * 1000).unref();
    this._finishTimeout = true;
    const playHandler = () => {
      clearTimeout(timer);
      this._finishTimeout = false;
    };
    this.once("playCalled", playHandler);
    this.once("disconnectAttempt", playHandler);
  }

  async onStreamFailed(quiet: boolean = false){
    this.Log("onStreamFailed called");
    this._cost = 0;
    this.destroyStream();
    
    if(this._errorUrl === this.currentAudioInfo?.Url && !quiet){
      this._errorCount++;
    }else{
      this._errorCount = 1;
      this._errorUrl = this.currentAudioInfo.Url;
      if(this.currentAudioInfo.isYouTube()) this.currentAudioInfo.disableCache();
    }
    this.Log(`Play failed, (${this._errorCount}times)`, "warn");
    this.preparing = false;
    this.stop();
    if(this._errorCount >= this.retryLimit){
      if(this.server.queue.loopEnabled) this.server.queue.loopEnabled = false;
      if(this.server.queue.length === 1 && this.server.queue.queueLoopEnabled) this.server.queue.queueLoopEnabled = false;
      await this.server.queue.next();
    }
    this.play(0, quiet);
  }

  override emit<T extends keyof PlayManagerEvents>(eventName: T, ...args: PlayManagerEvents[T]){
    super.emit("all", ...args);
    return super.emit(eventName, ...args);
  }

  override on<T extends keyof PlayManagerEvents>(eventName: T, listener: (...args: PlayManagerEvents[T]) => void){
    return super.on(eventName, listener);
  }

  override once<T extends keyof PlayManagerEvents>(eventName: T, listener: (...args: PlayManagerEvents[T]) => void){
    return super.on(eventName, listener);
  }

  override off<T extends keyof PlayManagerEvents>(eventName: T, listener: (...args: PlayManagerEvents[T]) => void){
    return super.off(eventName, listener);
  }
}

interface PlayManagerEvents {
  volumeChanged: [volume:string];
  playCalled: [seek:number];
  playPreparing: [seek:number];
  playStarted: [];
  playStartUIPrepared: [message:MessageEmbedBuilder];
  playCompleted: [];
  stop: [];
  disconnect: [];
  disconnectAttempt: [];
  pause: [];
  resume: [];
  rewind: [];
  empty: [];
  handledError: [error:Error];
  all: [...any[]];
}
