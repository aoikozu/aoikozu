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

import type { CommandArgs } from ".";
import type { CommandMessage } from "../Component/commandResolver/CommandMessage";

import { MessageEmbedBuilder } from "@mtripg6666tdr/oceanic-command-resolver/helper";

import i18next from "i18next";

import { BaseCommand } from ".";
import { Spotify } from "../AudioSource";
import { getColor } from "../Util/color";
import { useConfig } from "../config";

const config = useConfig();

export default class Help extends BaseCommand {
  constructor(){
    super({
      alias: ["help", "support"],
      unlist: false,
      category: "bot",
      requiredPermissionsOr: [],
      shouldDefer: false,
    });
  }

  async run(message: CommandMessage, context: CommandArgs){
    const developerId = "593758391395155978";
    const cachedUser = context.client.users.get(developerId);
    const developer = cachedUser
      ? cachedUser.username
      : await context.client.rest.users.get(developerId)
        .then(user => user.username)
        .catch(() => null as string)
      ;
    const { isDisabledSource } = config;
    const embed = new MessageEmbedBuilder()
      .setTitle(context.client.user.username + ":notes:")
      .setDescription(
        i18next.t("commands:help.embedDescription")
        + "\r\n"
        + i18next.t("commands:help.toLearnMore", { command: `\`${config.noMessageContent ? "/" : context.server.prefix}command\`` }))
      .addField("開発者", `[${developer || "mtripg6666tdr"}](https://github.com/mtripg6666tdr)`)
      .addField("バージョン", "`" + context.bot.version + "`")
      .addField("レポジトリ/ソースコード", "https://github.com/mtripg6666tdr/Discord-SimpleMusicBot")
      .addField("サポートサーバー", "https://discord.gg/7DrAEXBMHe")
      .addField("現在対応している再生ソース", [
        !isDisabledSource("youtube") && "・YouTube(キーワード検索)",
        !isDisabledSource("youtube") && "・YouTube(動画URL指定)",
        !isDisabledSource("youtube") && "・YouTube(プレイリストURL指定)",
        !isDisabledSource("soundcloud") && "・SoundCloud(キーワード検索)",
        !isDisabledSource("soundcloud") && "・SoundCloud(楽曲ページURL指定)",
        !isDisabledSource("streamable") && "・Streamable(動画ページURL指定)",
        !isDisabledSource("custom") && "・Discord(音声ファイルの添付付きメッセージのURL指定)",
        !isDisabledSource("googledrive") && "・Googleドライブ(音声ファイルの限定公開リンクのURL指定)",
        !isDisabledSource("niconico") && "・ニコニコ動画(動画ページURL指定)",
        !isDisabledSource("twitter") && "・Twitter(ツイートURL指定)",
        !isDisabledSource("spotify") && Spotify.available && "・Spotify(曲のURL、およびプレイリストのURL。曲を推測してYouTubeから再生します。)",
        !isDisabledSource("custom") && "・オーディオファイルへの直URL",
      ].filter(d => d).join("\r\n"))
      .setColor(getColor("HELP"))
      .toOceanic()
    ;
    await message.reply({ embeds: [embed] }).catch(this.logger.error);
  }
}
