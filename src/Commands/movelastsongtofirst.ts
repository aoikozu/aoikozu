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

import { BaseCommand } from ".";

export default class Mltf extends BaseCommand {
  constructor(){
    super({
      name: "最後の曲を先頭へ",
      alias: ["movelastsongtofirst", "mlstf", "ml", "mltf", "mlf", "m1", "pt"],
      description: "キューの最後の曲をキューの先頭に移動します。",
      unlist: false,
      category: "playlist",
      requiredPermissionsOr: ["admin", "onlyListener", "dj"],
      shouldDefer: false,
    });
  }

  async run(message: CommandMessage, context: CommandArgs){
    context.server.updateBoundChannel(message);
    if(context.server.queue.length <= 2){
      message.reply("キューに3曲以上追加されているときに使用できます。").catch(this.logger.error);
      return;
    }
    const q = context.server.queue;
    const to = context.server.player.isPlaying ? 1 : 0;
    q.move(q.length - 1, to);
    const info = q.get(to);
    message.reply("✅`" + info.basicInfo.title + "`を一番最後からキューの先頭に移動しました").catch(this.logger.error);
  }
}
