import type { CommandArgs } from ".";
import type { CommandMessage } from "@mtripg6666tdr/eris-command-resolver";

import { BaseCommand } from ".";
import Util from "../Util";

export default class Volume extends BaseCommand {
  constructor(){
    super({
      name: "ボリューム",
      alias: ["volume", "vol"],
      description: "音量を調節します。1から200の間で指定します(デフォルト100)。何も引数を付けないと現在の音量を表示します。不安定になった場合には100に戻してください。",
      unlist: false,
      category: "voice",
      examples: "volume [音量]",
      usage: "volume 120",
      argument: [{
        type: "integer",
        name: "volume",
        description: "変更先の音量。20~200までが指定できます。",
        required: false
      }]
    });
  }

  async run(message:CommandMessage, options:CommandArgs){
    options.server.updateBoundChannel(message);
    if(options.rawArgs === ""){
      await message.reply(`:loud_sound:現在の音量は**${options.server.player.volume}**です(デフォルト:100)`)
        .catch(e => Util.logger.log(e, "error"))
      ;
      return;
    }
    const newval = Number(options.rawArgs);
    if(isNaN(newval) || newval < 1 || newval > 200){
      message.reply(":bangbang:音量を変更する際は1から200の数字で指定してください。")
        .catch(e => Util.logger.log(e, "error"));
      return;
    }
    const result = options.server.player.setVolume(newval);
    await message.reply(`:loud_sound:音量を**${newval}**に変更しました。\r\n${!result ? "次の曲から適用されます。現在再生中の曲に設定を適用するには、`頭出し`コマンドなどを使用してください。" : ""}`)
      .catch(e => Util.logger.log(e, "error"));
  }
}
