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
import type { CommandMessage } from "../Component/CommandMessage";

import { MessageEmbedBuilder } from "@mtripg6666tdr/oceanic-command-resolver/helper";

import { BaseCommand } from ".";
import { getColor } from "../Util/color";

export default class Uptime extends BaseCommand {
  constructor(){
    super({
      name: "ピング",
      alias: ["ping", "latency"],
      description: "ボットのping時間(レイテンシ)を表示します。",
      unlist: false,
      category: "utility",
      requiredPermissionsOr: [],
      shouldDefer: false,
    });
  }

  async run(message: CommandMessage, options: CommandArgs){
    const now = Date.now();
    const embed = new MessageEmbedBuilder()
      .setColor(getColor("UPTIME"))
      .setTitle("ping情報")
      .addField(
        "ボット接続実測値",
        `${now - message.createdTimestamp.getTime()}ms`
      )
      .addField(
        "ボットWebSocket接続実測値",
        `${message.guild.shard.latency === Infinity ? "-" : message.guild.shard.latency}ms`
      )
      .addField(
        "ボイスチャンネルUDP接続実測値",
        `${options.server.player.isConnecting && options.server.vcPing || "-"}ms`
      )
      .setTimestamp(Date.now())
      .setAuthor({
        iconURL: options.client.user.avatarURL(),
        name: options.client.user.username,
      })
      .toOceanic()
    ;
    message.reply({ embeds: [embed] }).catch(this.logger.error);
  }
}
