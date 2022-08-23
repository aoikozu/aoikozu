import type { AudioSource, YouTube } from "../AudioSource";
import type { GuildDataContainer } from "../Structure";
import type { Client, Message, TextChannel } from "eris";

import { Helper } from "@mtripg6666tdr/eris-command-resolver";

import { ManagerBase } from "../Structure";
import { Util } from "../Util";
import { getColor } from "../Util/color";
import { getFFmpegEffectArgs } from "../Util/effect";
import { FallBackNotice } from "../definition";
import { resolveStreamToPlayable } from "./stream";

/**
 * サーバーごとの再生を管理するマネージャー。
 * 再生や一時停止などの処理を行います。
 */
export class PlayManager extends ManagerBase {
  private readonly retryLimit = 3;
  private seek = 0;
  private errorReportChannel = null as TextChannel;
  error = false;
  errorCount = 0;
  errorUrl = "";
  preparing = false;
  get CurrentAudioUrl():string{
    if(this.CurrentAudioInfo) return this.CurrentAudioInfo.Url;
    else return "";
  }

  CurrentAudioInfo:AudioSource;
  /**
   *  接続され、再生途中にあるか（たとえ一時停止されていても）
   */
  get isPlaying():boolean{
    return this.isConnecting && this.info.Connection.playing;
  }

  /**
   *  VCに接続中かどうか
   */
  get isConnecting():boolean{
    return this.info.Connection && (this.info.Connection.connecting || this.info.Connection.ready);
  }

  /**
   * 一時停止されているか
   */
  get isPaused():boolean{
    return this.isConnecting && this.info.Connection.paused;
  }

  /**
   *  現在ストリーミングした時間(ミリ秒!)
   * @remarks ミリ秒単位なので秒に直すには1000分の一する必要がある
   */
  get currentTime():number{
    return this.isPlaying ? this.seek * 1000 + this.info.Connection.current?.playTime : 0;
  }

  /**
   * クライアント
   */
  get client(){return this._client;}
  // コンストラクタ
  constructor(private readonly _client:Client){
    super();
    this.SetTag("PlayManager");
    this.Log("Play Manager instantiated");
  }

  /**
   *  親となるGuildVoiceInfoをセットする関数（一回のみ呼び出せます）
   */
  setBinding(data:GuildDataContainer){
    this.Log("Set data of guild id " + data.GuildID);
    super.setBinding(data);
  }

  /**
   *  再生します
   */
  async play(time:number = 0):Promise<PlayManager>{
    /* eslint-disable no-irregular-whitespace */
    // 再生できる状態か確認
    const badCondition
    /* なにかしら再生中でない  　　　 */ = this.isPlaying
    /* キューが空　　　　　　　　　　 */ || this.info.Queue.hasNothing
    /* 準備中　　　　　　　　　　　　 */ || this.preparing
    ;
    /* eslint-enable no-irregular-whitespace */
    if(badCondition){
      this.Log("Play called but operated nothing", "warn");
      return this;
    }
    this.Log("Play called");
    this.preparing = true;
    let mes:Message = null;
    let ch:TextChannel = null;
    this.CurrentAudioInfo = this.info.Queue.get(0).BasicInfo;
    if(this.info.boundTextChannel){
      ch = this.client.getChannel(this.info.boundTextChannel) as TextChannel;
      const [min, sec] = Util.time.CalcMinSec(this.CurrentAudioInfo.LengthSeconds);
      const isLive = this.CurrentAudioInfo.isYouTube() && this.CurrentAudioInfo.LiveStream;
      mes = await ch.createMessage(`:hourglass_flowing_sand: \`${this.CurrentAudioInfo.Title}\` \`(${isLive ? "ライブストリーム" : `${min}:${sec}`})\`の再生準備中...`);
    }
    try{
      // シーク位置を確認
      if(this.CurrentAudioInfo.LengthSeconds <= time) time = 0;
      this.seek = time;
      const t = Util.time.timer.start("PlayManager#Play->FetchAudioSource");
      // QueueContentからストリーム情報を取得
      const rawStream = await this.CurrentAudioInfo.fetch(time > 0);
      // 情報からストリームを作成
      const { stream } = resolveStreamToPlayable(rawStream, getFFmpegEffectArgs(this.info), this.seek, false, 1);
      this.errorReportChannel = mes.channel as TextChannel;
      const connection = this.info.Connection;
      this.error = false;
      t.end();
      // 再生
      const u = Util.time.timer.start("PlayManager#Play->EnterPlayingState");
      connection.play(stream.stream, {
        format: stream.streamType
      });
      stream.stream.on("end", this.onStreamFinished.bind(this));
      // wait for entering playing state
      await Util.general.waitForEnteringState(() => this.info.Connection.playing);
      this.preparing = false;
      u.end();
      this.Log("Play started successfully");
      if(this.info.boundTextChannel && ch && mes){
        // 再生開始メッセージ
        const _t = Number(this.CurrentAudioInfo.LengthSeconds);
        const [min, sec] = Util.time.CalcMinSec(_t);
        const embed = new Helper.MessageEmbedBuilder({
          title: ":cd:現在再生中:musical_note:",
          description:
              `[${this.CurrentAudioInfo.Title}](${this.CurrentAudioUrl}) \``
            + (this.CurrentAudioInfo.ServiceIdentifer === "youtube" && (this.CurrentAudioInfo as YouTube).LiveStream ? "(ライブストリーム)" : _t === 0 ? "(不明)" : min + ":" + sec)
            + "`"
        });
        embed.setColor(getColor("AUTO_NP"));
        embed.addField("リクエスト", this.info.Queue.get(0).AdditionalInfo.AddedBy.displayName, true);
        embed.addField("次の曲",
          // トラックループオンなら現在の曲
          this.info.Queue.loopEnabled ? this.info.Queue.get(0).BasicInfo.Title :
          // (トラックループはオフ)長さが2以上ならオフセット1の曲
            this.info.Queue.length >= 2 ? this.info.Queue.get(1).BasicInfo.Title :
            // (トラックループオフ,長さ1)キューループがオンなら現在の曲
              this.info.Queue.queueLoopEnabled ? this.info.Queue.get(0).BasicInfo.Title :
              // (トラックループオフ,長さ1,キューループオフ)次の曲はなし
                "次の曲がまだ登録されていません"
          , true);
        const [qhour, qmin, qsec] = Util.time.CalcHourMinSec(this.info.Queue.lengthSeconds - this.CurrentAudioInfo.LengthSeconds);
        embed.addField("再生待ちの曲", this.info.Queue.loopEnabled ? "ループします" : (this.info.Queue.length - 1) + "曲(" + (qhour === "0" ? "" : qhour + ":") + qmin + ":" + qsec + ")", true);
        embed.setThumbnail(this.CurrentAudioInfo.Thumnail);
        if(this.CurrentAudioInfo.ServiceIdentifer === "youtube" && (this.CurrentAudioInfo as YouTube).IsFallbacked){
          embed.addField(":warning:注意", FallBackNotice);
        }
        mes.edit({content: "", embeds: [embed.toEris()]}).catch(e => Util.logger.log(e, "error"));
      }
    }
    catch(e){
      Util.logger.log(Util.general.StringifyObject(e), "error");
      try{
        const t = typeof e === "string" ? e : Util.general.StringifyObject(e);
        if(t.includes("429")){
          mes.edit(":sob:レート制限が検出されました。しばらくの間YouTubeはご利用いただけません。").catch(er => Util.logger.log(er, "error"));
          this.Log("Rate limit detected", "error");
          this.stop();
          this.preparing = false;
          return this;
        }
        // eslint-disable-next-line no-empty
      } catch{}
      if(this.info.boundTextChannel && ch && mes){
        mes.edit(`:tired_face:曲の再生に失敗しました...。(${Util.general.StringifyObject(e)})` + (this.errorCount + 1 >= this.retryLimit ? "スキップします。" : "再試行します。"));
        this.onStreamFailed();
      }
    }
    return this;
  }

  /** 
   * 停止します。切断するにはDisconnectを使用してください。
   * @returns this
  */
  stop():PlayManager{
    this.Log("Stop called");
    this.info.Connection?.stopPlaying();
    this.info.Bot.backupData();
    return this;
  }

  /**
   * 切断します。内部的にはStopも呼ばれています。これを呼ぶ前にStopを呼ぶ必要はありません。
   * @returns this
   */
  disconnect():PlayManager{
    this.stop();
    if(this.isConnecting){
      const connection = this.info.Connection;
      this.Log("Disconnected from " + connection.channelID);
      connection.disconnect();
    }else{
      this.Log("Disconnect called but no connection", "warn");
    }
    if(typeof global.gc === "function"){
      global.gc();
      this.Log("Called exposed gc");
    }
    return this;
  }

  /**
   * 一時停止します。
   * @returns this
   */
  pause():PlayManager{
    this.info.Bot.backupStatus();
    this.Log("Pause called");
    this.info.Connection?.pause();
    return this;
  }

  /**
   * 一時停止再生します。
   * @returns this
   */
  resume():PlayManager{
    this.info.Bot.backupStatus();
    this.Log("Resume called");
    this.info.Connection?.resume();
    return this;
  }

  /**
   * 頭出しをします。
   * @returns this
   */
  rewind():PlayManager{
    this.Log("Rewind called");
    this.stop().play();
    return this;
  }

  handleError(er:any){
    Util.logger.log("Error", "error");
    if(er){
      Util.logger.log(Util.general.StringifyObject(er), "error");
      if(Util.config.debug){
        console.error(er);
      }
    }
    this.errorReportChannel.createMessage(":tired_face:曲の再生に失敗しました...。" + (this.errorCount + 1 >= this.retryLimit ? "スキップします。" : "再試行します。"));
    this.onStreamFailed();
  }

  private async onStreamFinished(){
    await Util.general.waitForEnteringState(() => !this.info.Connection.playing).catch(() => {
      this.Log("Stream has not ended in time and will force stream into destroying", "warn");
      this.stop();
    });
    // ストリームが終了したら時間を確認しつつ次の曲へ移行
    this.Log("Stream finished");
    // 再生が終わったら
    this.errorCount = 0;
    this.errorUrl = "";
    if(this.info.Queue.loopEnabled){
      // 曲ループオンならばもう一度再生
      this.play();
      return;
    }else if(this.info.Queue.onceLoopEnabled){
      // ワンスループが有効ならもう一度同じものを再生
      this.info.Queue.onceLoopEnabled = false;
      this.play();
      return;
    }else{
      // キュー整理
      await this.info.Queue.next();
    }
    // キューがなくなったら接続終了
    if(this.info.Queue.length === 0){
      this.Log("Queue empty");
      if(this.info.boundTextChannel){
        const ch = this.client.getChannel(this.info.boundTextChannel) as TextChannel;
        await ch.createMessage(":wave:キューが空になったため終了します").catch(e => Util.logger.log(e, "error"));
      }
      this.disconnect();
    // なくなってないなら再生開始！
    }else{
      this.play();
    }
  }

  private async onStreamFailed(){
    if(this.info.Queue.loopEnabled) this.info.Queue.loopEnabled = false;
    if(this.info.Queue.length === 1 && this.info.Queue.queueLoopEnabled) this.info.Queue.queueLoopEnabled = false;
    if(this.errorUrl === this.CurrentAudioInfo.Url){
      this.errorCount++;
    }else{
      this.errorCount = 1;
      this.errorUrl = this.CurrentAudioInfo.Url;
      if(this.CurrentAudioInfo.isYouTube()) this.CurrentAudioInfo.disableCache();
    }
    this.Log(`Play failed, (${this.errorCount}times)`, "warn");
    this.error = this.preparing = false;
    this.stop();
    if(this.errorCount >= this.retryLimit){
      await this.info.Queue.next();
    }
    this.play();
  }
}
