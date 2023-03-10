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

import type { AudioEffect } from "./AudioEffect";
import type { YmxFormat } from "./YmxFormat";
import type { exportableCustom, exportableSpotify } from "../AudioSource";
import type { CommandMessage } from "../Component/CommandMessage";
import type { SearchPanel } from "../Component/SearchPanel";
import type { exportableStatuses } from "../Component/backupper";
import type { MusicBotBase } from "../botBase";
import type { VoiceConnection } from "@discordjs/voice";
import type { AnyGuildTextChannel, Message, StageChannel, VoiceChannel } from "oceanic.js";
import type { Playlist } from "spotify-url-info";

import { LockObj, lock } from "@mtripg6666tdr/async-lock";
import { MessageEmbedBuilder } from "@mtripg6666tdr/oceanic-command-resolver/helper";

import { entersState, VoiceConnectionStatus } from "@discordjs/voice";
import { TextChannel } from "oceanic.js";
import Soundcloud from "soundcloud.ts";
import * as ytpl from "ytpl";

import { LogEmitter } from "./LogEmitter";
import { YmxVersion } from "./YmxFormat";
import { Spotify } from "../AudioSource";
import { SoundCloudS } from "../AudioSource";
import { PageToggle } from "../Component/PageToggle";
import { PlayManager } from "../Component/PlayManager";
import { QueueManager } from "../Component/QueueManager";
import { SearchPanelManager } from "../Component/SearchPanelManager";
import { SkipManager } from "../Component/SkipManager";
import { TaskCancellationManager } from "../Component/TaskCancellationManager";
import * as Util from "../Util";
import { useConfig } from "../config";
import { getLogger } from "../logger";

interface GuildDataContainerEvents {
  updateBoundChannel: [string];
}

const config = useConfig();

/**
 * サーバーごとデータを保存するコンテナ
 */
export class GuildDataContainer extends LogEmitter<GuildDataContainerEvents> {
  private readonly _cancellations = [] as TaskCancellationManager[];
  private get cancellations(): Readonly<TaskCancellationManager[]>{
    return this._cancellations;
  }
  
  /** プレフィックス */
  prefix: string;

  protected _queue: QueueManager;
  /** キューマネジャ */
  get queue(){
    return this._queue;
  }

  protected _player: PlayManager;
  /** 再生マネジャ */
  get player(){
    return this._player;
  }

  protected _searchPanel: SearchPanelManager;
  /** 検索窓の格納します */
  get searchPanel(){
    return this._searchPanel;
  }

  protected _skipSession: SkipManager;
  /** Skipマネージャ */
  get skipSession(){
    return this._skipSession;
  }

  private _boundTextChannel: string;
  /** 紐づけテキストチャンネルを取得します */
  get boundTextChannel(){
    return this._boundTextChannel;
  }
  /** 紐づけテキストチャンネルを設定します */
  private set boundTextChannel(val: string){
    this._boundTextChannel = val;
  }

  /** メインボット */
  readonly bot: MusicBotBase;
  /** オーディオエフェクトエフェクトの設定 */
  readonly effectPrefs: AudioEffect;
  /** 関連動画自動追加が有効 */
  addRelated: boolean;
  /** 均等再生が有効 */
  equallyPlayback: boolean;
  /** VCへの接続 */
  connection: VoiceConnection;
  /** VC */
  connectingVoiceChannel: VoiceChannel | StageChannel;
  /** VCのping */
  vcPing: number;

  constructor(guildId: string, boundchannelid: string, bot: MusicBotBase){
    super("GuildDataContainer", guildId);
    if(!guildId){
      throw new Error("invalid guild id was given");
    }
    this.boundTextChannel = boundchannelid;
    if(!this.boundTextChannel){
      throw new Error("invalid bound textchannel id was given");
    }
    this.bot = bot;
    this.addRelated = false;
    this.effectPrefs = {
      BassBoost: false,
      Reverb: false,
      LoudnessEqualization: false,
    };
    this.prefix = ">";
    this.equallyPlayback = false;
    this.connection = null;
    this.vcPing = null;
    this.initPlayManager();
    this.initQueueManager();
    this.initSearchPanelManager();
  }

  protected initPlayManager(){
    this._player = new PlayManager(this);
  }

  protected initQueueManager(){
    this._queue = new QueueManager(this);
    const pageToggleOrganizer = () => PageToggle.organize(this.bot.toggles, 5, this.getGuildId());
    this._queue.on("change", pageToggleOrganizer);
    this._queue.on("changeWithoutCurrent", pageToggleOrganizer);
  }

  protected initSearchPanelManager(){
    this._searchPanel = new SearchPanelManager(this);
  }

  /**
   * 状況に応じてバインドチャンネルを更新します
   * @param message 更新元となるメッセージ
   */
  updateBoundChannel(message: CommandMessage|string){
    if(typeof message === "string"){
      this.boundTextChannel = message;
      return;
    }
    if(
      !this.player.isConnecting
      || (
        message.member.voiceState.channelID && this.bot.client.getChannel<VoiceChannel|StageChannel>(message.member.voiceState.channelID).voiceMembers.has(this.bot.client.user.id)
      )
      || message.content.includes("join")
    ){
      if(message.content !== this.prefix) this.boundTextChannel = message.channelId;
    }
  }

  /**
   * キューをエクスポートしてYMX形式で出力します
   * @returns YMX化されたキュー
   */
  exportQueue(): YmxFormat{
    return {
      version: YmxVersion,
      data: this.queue.map(q => ({
        ...q.basicInfo.exportData(),
        addBy: q.additionalInfo.addedBy,
      })),
    };
  }

  /**
   * YMXからキューをインポートします。
   * @param exportedQueue YMXデータ
   * @returns 成功したかどうか
   */
  async importQueue(exportedQueue: YmxFormat){
    if(exportedQueue.version === YmxVersion){
      const { data } = exportedQueue;
      for(let i = 0; i < data.length; i++){
        const item = data[i];
        await this.queue.addQueueOnly({
          url: item.url,
          addedBy: item.addBy,
          gotData: item,
        });
      }
      return true;
    }
    return false;
  }

  /**
   * ステータスをエクスポートします
   * @returns ステータスのオブジェクト
   */
  exportStatus(): exportableStatuses{
    // VCのID:バインドチャンネルのID:ループ:キューループ:関連曲
    return {
      voiceChannelId: this.player.isPlaying && !this.player.isPaused ? this.connectingVoiceChannel.id : "0",
      boundChannelId: this.boundTextChannel,
      loopEnabled: this.queue.loopEnabled,
      queueLoopEnabled: this.queue.queueLoopEnabled,
      addRelatedSongs: this.addRelated,
      equallyPlayback: this.equallyPlayback,
      volume: this.player.volume,
    };
  }

  /**
   * ステータスをオブジェクトからインポートします。
   * @param param0 読み取り元のオブジェクト
   */
  importStatus(statuses: exportableStatuses){
    //VCのID:バインドチャンネルのID:ループ:キューループ:関連曲
    this.queue.loopEnabled = statuses.loopEnabled;
    this.queue.queueLoopEnabled = statuses.queueLoopEnabled;
    this.addRelated = statuses.addRelatedSongs;
    this.equallyPlayback = statuses.equallyPlayback;
    this.player.setVolume(statuses.volume);
    if(statuses.voiceChannelId !== "0"){
      this.joinVoiceChannelOnly(statuses.voiceChannelId)
        .then(() => this.player.play())
        .catch(this.logger.error)
      ;
    }
  }

  /**
   * キャンセルマネージャーをサーバーと紐づけます
   * @param cancellation キャンセルマネージャー
   */
  bindCancellation(cancellation: TaskCancellationManager){
    if(!this.cancellations.includes(cancellation)){
      this._cancellations.push(cancellation);
    }
    return cancellation;
  }

  /**
   * キャンセルマネージャーにキャンセルを発行します
   * @returns キャンセルができたものがあればtrue
   */
  cancelAll(){
    const results = this.cancellations.map(c => c.cancel());
    return results.some(r => r);
  }

  /**
   * キャンセルマネージャーを破棄します
   * @param cancellation 破棄するキャンセルマネージャー
   * @returns 成功したかどうか
   */
  unbindCancellation(cancellation: TaskCancellationManager){
    const index = this.cancellations.findIndex(c => c === cancellation);
    if(index < 0) return false;
    this._cancellations.splice(index, 1);
    return true;
  }

  /**
   * 指定されたボイスチャンネルに参加し、接続を保存し、適切なイベントハンドラを設定します。
   * @param channelId 接続先のボイスチャンネルのID
   * @internal
   */
  async joinVoiceChannelOnly(channelId: string){
    const targetChannel = this.bot.client.getChannel<VoiceChannel | StageChannel>(channelId);
    const connection = targetChannel.join({
      selfDeaf: true,
      debug: config.debug,
    });
    this.connectingVoiceChannel = targetChannel;
    if(this.connection === connection) return;

    // Temporary fix for voice stucking
    // remove below code after the @discordjs/voice fixed and updated
    // ref: https://github.com/discordjs/discord.js/issues/9185#issuecomment-1459083216
    const networkStateChangeHandler = (oldState: any, newState: any) => {
      const newUdp = Reflect.get(newState, "udp");
      clearInterval(newUdp?.keepAliveInterval);
    };
    connection.on("stateChange", (oldState, newState) => {
      Reflect.get(oldState, "networking")?.off("stateChange", networkStateChangeHandler);
      Reflect.get(newState, "networking")?.on("stateChange", networkStateChangeHandler);
    });

    await entersState(connection, VoiceConnectionStatus.Ready, 10e3);

    const connectionLogger = getLogger("Connection");
    connectionLogger.addContext("id", this.getGuildId());

    connection
      .on("error", err => {
        connectionLogger.error(err);
      })
    ;
    this.connection = connection;
    if(config.debug){
      connection.on("debug", connectionLogger.debug);
    }

    this.logger.info(`Connected to ${channelId}`);
  }

  private readonly joinVoiceChannelLocker: LockObj = new LockObj();
  /**
   * ボイスチャンネルに接続します
   * @param message コマンドを表すメッセージ
   * @param reply 応答が必要な際に、コマンドに対して返信で応じるか新しいメッセージとして応答するか。(trueで返信で応じ、falseで新規メッセージを作成します。デフォルトではfalse)
   * @returns 成功した場合はtrue、それ以外の場合にはfalse
   */
  async joinVoiceChannel(message: CommandMessage, reply: boolean = false, replyOnFail: boolean = false): Promise<boolean>{
    return lock(this.joinVoiceChannelLocker, async () => {
      if(message.member.voiceState.channelID){
        const targetVC = this.bot.client.getChannel<VoiceChannel | StageChannel>(message.member.voiceState.channelID);

        if(targetVC.voiceMembers.has(this.bot.client.user.id)){
          // すでにそのにVC入ってるよ～
          if(this.connection){
            return true;
          }
        }else if(this.connection && !message.member.permissions.has("MOVE_MEMBERS")){
          // すでになにかしらのVCに参加している場合
          const replyFailMessage = reply || replyOnFail
            ? message.reply.bind(message)
            : message.channel.createMessage.bind(message.channel);
          await replyFailMessage({
            content: ":warning:既にほかのボイスチャンネルに接続中です。この操作を実行する権限がありません。",
          }).catch(this.logger.error);
          return false;
        }

        // 入ってないね～参加しよう
        const replyMessage = reply ? message.reply.bind(message) : message.channel.createMessage.bind(message.channel);
        const connectingMessage = await replyMessage({
          content: ":electric_plug:接続中...",
        });
        try{
          if(!targetVC.permissionsOf(this.bot.client.user.id).has("CONNECT")){
            throw new Error("ボイスチャンネルに参加できません。権限を確認してください。");
          }
          await this.joinVoiceChannelOnly(targetVC.id);
          await connectingMessage.edit({
            content: `:+1:ボイスチャンネル:speaker:\`${targetVC.name}\`に接続しました!`,
          });
          return true;
        }
        catch(e){
          this.logger.error(e);
          const failedMsg = `😑接続に失敗しました…もう一度お試しください: ${typeof e === "object" && "message" in e ? `${e.message}` : e}`;
          if(!reply && replyOnFail){
            await connectingMessage.delete()
              .catch(this.logger.error);
            await message.reply({
              content: failedMsg,
            })
              .catch(this.logger.error);
          }else{
            await connectingMessage?.edit({
              content: failedMsg,
            })
              .catch(this.logger.error);
          }
          this.player.disconnect();
          return false;
        }
      }else{
        // あらメッセージの送信者さんはボイチャ入ってないん…
        const replyFailedMessage = reply || replyOnFail ? message.reply.bind(message) : message.channel.createMessage.bind(message.channel);
        await replyFailedMessage({
          content: "ボイスチャンネルに参加してからコマンドを送信してください:relieved:",
        }).catch(this.logger.error);
        return false;
      }
    });
  }

  /**
   * メッセージからストリームを判定してキューに追加し、状況に応じて再生を開始します
   * @param first キューの先頭に追加するかどうか
   */
  async playFromURL(message: CommandMessage, rawArg: string|string[], first: boolean = true, cancellable: boolean = false){
    if(Array.isArray(rawArg)){
      const [firstUrl, ...restUrls] = rawArg
        .flatMap(fragment => Util.normalizeText(fragment).split(" "))
        .filter(url => url.startsWith("http"));

      if(firstUrl){
        await this.playFromURL(message, firstUrl, first, false);

        if(restUrls){
          for(let i = 0; i < restUrls.length; i++){
            await this.queue.addQueue({
              url: restUrls[i],
              addedBy: message.member,
              channel: message.channel,
            });
          }
        }
      }
      return;
    }
    setTimeout(() => message.suppressEmbeds(true).catch(this.logger.error), 4000).unref();
    if(!config.isDisabledSource("custom") && rawArg.match(/^https?:\/\/(www\.|canary\.|ptb\.)?discord(app)?\.com\/channels\/[0-9]+\/[0-9]+\/[0-9]+$/)){
      // Discordメッセへのリンクならば
      const smsg = await message.reply("🔍メッセージを取得しています...");
      try{
        // URLを分析してチャンネルIDとメッセージIDを抽出
        const ids = rawArg.split("/");
        const ch = this.bot.client.getChannel(ids[ids.length - 2]);

        if(!(ch instanceof TextChannel)){
          throw new Error("サーバーのテキストチャンネルではありません");
        }

        const msg = await ch.getMessage(ids[ids.length - 1]);

        if(ch.guild.id !== msg.channel.guild.id){
          throw new Error("異なるサーバーのコンテンツは再生できません");
        }else if(msg.attachments.size <= 0 || !Util.isAvailableRawAudioURL(msg.attachments.first()?.url)){
          throw new Error("添付ファイルが見つかりません");
        }

        await this.queue.addQueue({
          url: msg.attachments.first().url,
          addedBy: message.member,
          first,
          message: smsg,
        });
        await this.player.play();
        return;
      }
      catch(e){
        this.logger.error(e);
        await smsg.edit("✘追加できませんでした")
          .catch(this.logger.error);
      }
    }else if(!config.isDisabledSource("custom") && Util.isAvailableRawAudioURL(rawArg)){
      // オーディオファイルへの直リンク？
      await this.queue.addQueue({
        url: rawArg,
        addedBy: message.member,
        sourceType: "custom",
        first,
        channel: message.channel,
      });
      await this.player.play();
    }else if(!config.isDisabledSource("youtube") && !rawArg.includes("v=") && !rawArg.includes("/channel/") && ytpl.validateID(rawArg)){
      //違うならYouTubeプレイリストの直リンクか？
      const msg = await message.reply(":hourglass_flowing_sand:プレイリストを処理しています。お待ちください。");
      const cancellation = this.bindCancellation(new TaskCancellationManager());
      try{
        const id = await ytpl.getPlaylistID(rawArg);
        const result = await ytpl.default(id, {
          gl: "JP",
          hl: "ja",
          limit: 999 - this.queue.length,
        });
        const index = await this.queue.processPlaylist(
          msg,
          cancellation,
          first,
          /* known source */ "youtube",
          /* result */ result.items,
          /* playlist name */ result.title,
          /* tracks count */ result.estimatedItemCount,
          /* consumer */ (c) => ({
            url: c.url,
            channel: c.author.name,
            description: "プレイリストから指定のため詳細は表示されません",
            isLive: c.isLive,
            length: c.durationSec,
            thumbnail: c.thumbnails[0].url,
            title: c.title,
          } as exportableCustom)
        );
        if(cancellation.Cancelled){
          await msg.edit("✅キャンセルされました。");
        }else{
          const embed = new MessageEmbedBuilder()
            .setTitle("✅プレイリストが処理されました")
            // \`(${result.author.name})\` author has been null lately
            .setDescription(`[${result.title}](${result.url}) \r\n${index}曲が追加されました`)
            .setThumbnail(result.bestThumbnail.url)
            .setColor(Util.color.getColor("PLAYLIST_COMPLETED"));
          await msg.edit({
            content: "",
            embeds: [embed.toOceanic()],
          });
        }
      }
      catch(e){
        this.logger.error(e);
        await msg.edit(
          "✘追加できませんでした"
        ).catch(this.logger.error);
      }
      finally{
        this.unbindCancellation(cancellation);
      }
      await this.player.play();
    }else if(!config.isDisabledSource("soundcloud") && SoundCloudS.validatePlaylistUrl(rawArg)){
      const msg = await message.reply(":hourglass_flowing_sand:プレイリストを処理しています。お待ちください。");
      const sc = new Soundcloud();
      const playlist = await sc.playlists.getV2(rawArg);
      const cancellation = this.bindCancellation(new TaskCancellationManager());
      try{
        const index = await this.queue.processPlaylist(
          msg,
          cancellation,
          first,
          "soundcloud",
          playlist.tracks,
          playlist.title,
          playlist.track_count,
          async (track) => {
            const item = await sc.tracks.getV2(track.id);
            return {
              url: item.permalink_url,
              title: item.title,
              description: item.description,
              length: Math.floor(item.duration / 1000),
              author: item.user.username,
              thumbnail: item.artwork_url,
            } as exportableCustom;
          }
        );
        if(cancellation.Cancelled){
          await msg.edit("✅キャンセルされました。");
        }else{
          const embed = new MessageEmbedBuilder()
            .setTitle("✅プレイリストが処理されました")
            .setDescription(
              `[${playlist.title}](${playlist.permalink_url}) \`(${playlist.user.username})\` \r\n${index}曲が追加されました`
            )
            .setThumbnail(playlist.artwork_url)
            .setColor(Util.color.getColor("PLAYLIST_COMPLETED"));
          await msg.edit({ content: "", embeds: [embed.toOceanic()] });
        }
      }
      catch(e){
        this.logger.error(e);
        await msg.edit(
          "✘追加できませんでした"
        ).catch(this.logger.error);
      }
      finally{
        this.unbindCancellation(cancellation);
      }
      await this.player.play();
    }else if(!config.isDisabledSource("spotify") && Spotify.validatePlaylistUrl(rawArg) && Spotify.available){
      const msg = await message.reply(":hourglass_flowing_sand:プレイリストを処理しています。お待ちください。");
      const cancellation = this.bindCancellation(new TaskCancellationManager());
      try{
        const playlist = await Spotify.client.getData(rawArg) as Playlist;
        const tracks = playlist.trackList.reverse();
        const index = await this.queue.processPlaylist(
          msg,
          cancellation,
          first,
          "spotify",
          tracks,
          playlist.name,
          tracks.length,
          async (track) => {
            return {
              url: Spotify.getTrackUrl(track.uri),
              title: track.title,
              artist: track.subtitle,
              length: Math.floor(track.duration / 1000),
            } as exportableSpotify;
          }
        );
        if(cancellation.Cancelled){
          await msg.edit("✅キャンセルされました。");
        }else{
          const embed = new MessageEmbedBuilder()
            .setTitle("✅プレイリストが処理されました")
            .setDescription(
              `[${playlist.title}](${Spotify.getPlaylistUrl(playlist.uri, playlist.type)}) \`(${playlist.subtitle})\` \r\n${index}曲が追加されました`
            )
            .setThumbnail(playlist.coverArt.sources[0].url)
            .setFields({
              name: ":warning:注意",
              value: "Spotifyのタイトルは、正しく再生されない場合があります",
            })
            .setColor(Util.color.getColor("PLAYLIST_COMPLETED"));
          await msg.edit({ content: "", embeds: [embed.toOceanic()] });
        }
      }
      catch(e){
        this.logger.error(e);
        await msg.edit("✘追加できませんでした")
          .catch(this.logger.error);
      }
      finally{
        this.unbindCancellation(cancellation);
      }
      await this.player.play();
    }else{
      try{
        const success = await this.queue.addQueue({
          url: rawArg,
          addedBy: message.member,
          first,
          message: await message.reply("お待ちください..."),
          cancellable,
        });
        if(success) this.player.play();
        return;
      }
      catch(er){
        this.logger.error(er);
        // なに指定したし…
        await message.reply("🔭有効なURLを指定してください。キーワードで再生する場合はsearchコマンドを使用してください。")
          .catch(this.logger.error);
      }
    }
  }

  /**
   * プレフィックス更新します
   * @param message 更新元となるメッセージ
   */
  updatePrefix(message: CommandMessage|Message<AnyGuildTextChannel>){
    const oldPrefix = this.prefix;
    const member = message.guild.members.get(this.bot.client.user.id);
    const pmatch = (member.nick || member.username).match(/^(\[(?<prefix0>[a-zA-Z!?_-]+)\]|【(?<prefix1>[a-zA-Z!?_-]+)】)/);
    if(pmatch){
      if(this.prefix !== (pmatch.groups.prefix0 || pmatch.groups.prefix1)){
        this.prefix = Util.normalizeText(pmatch.groups.prefix0 || pmatch.groups.prefix1);
      }
    }else if(this.prefix !== config.prefix){
      this.prefix = config.prefix;
    }
    if(this.prefix !== oldPrefix){
      this.logger.info(`Prefix was set to '${this.prefix}'`);
    }
  }

  /**
   * 検索パネルのオプション番号を表すインデックス番号から再生します
   * @param nums インデックス番号の配列
   * @param message 
   */
  async playFromSearchPanelOptions(nums: string[], panel: SearchPanel){
    const includingNums = panel.filterOnlyIncludes(nums.map(n => Number(n)).filter(n => !isNaN(n)));
    const {
      urls: items,
      responseMessage,
    } = panel.decideItems(includingNums);
    const [first, ...rest] = items;
    // いっこめをしょり
    await this.queue.addQueue({
      url: first,
      addedBy: panel.commandMessage.member,
      fromSearch: responseMessage,
      cancellable: this.queue.length >= 1,
    });
    // 現在の状態を確認してVCに接続中なら接続試行
    if(panel.commandMessage.member.voiceState.channelID){
      await this.joinVoiceChannel(panel.commandMessage, false, false);
    }
    // 接続中なら再生を開始
    if(this.player.isConnecting && !this.player.isPlaying){
      this.player.play();
    }
    // 二個目以上を処理
    for(let i = 0; i < rest.length; i++){
      await this.queue.addQueue({
        url: rest[i],
        addedBy: panel.commandMessage.member,
        channel: panel.commandMessage.channel,
      });
    }
  }

  /**
   * 指定されたコマンドメッセージをもとに、スキップ投票を作成します
   * @param message ベースとなるコマンドメッセージ
   */
  async createSkipSession(message: CommandMessage){
    this._skipSession = new SkipManager(this);
    await this._skipSession.init(message);
    const destroy = () => {
      this._skipSession?.destroy();
      this._skipSession = null;
    };
    this.queue.once("change", destroy);
    this.player.once("disconnect", destroy);
  }
}
