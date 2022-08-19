import type { CommandArgs} from ".";
import type { CommandMessage } from "../Component/CommandMessage";

import * as os from "os";

import { generateDependencyReport } from "@discordjs/voice";
import * as discord from "discord.js";

import { BaseCommand } from ".";
import { Util } from "../Util";
import { getColor } from "../Util/color";


export default class SystemInfo extends BaseCommand {
  constructor(){
    super({
      name: "システム情報",
      alias: ["ログ", "log", "システム情報", "systeminfo", "sysinfo"],
      description: "ホストされているサーバーやプロセスに関する技術的な情報を表示します。引数(`mem`、`cpu`、`basic`のうちいずれか)を指定して特定の内容のみ取得することもできます。",
      unlist: false,
      category: "utility",
      examples: "sysinfo mem",
      usage: "sysinfo [mem|cpu]",
      argument: [{
        type: "string",
        name: "content",
        description: "memまたはcpuのどちらかを指定できます",
        required: false,
        choices: {
          "基本情報": "basic",
          "メモリ": "mem",
          "CPU": "cpu",
          "ログ(管理者のみ)": "log",
        }
      }]
    });
  }

  async run(message:CommandMessage, options:CommandArgs){
    options.updateBoundChannel(message);
    // Run default logger
    options.bot.PeriodicLog();
    await message.reply("実行します");

    const embeds = [] as discord.MessageEmbed[];

    if(options.args.includes("basic") || options.args.length === 0){
      embeds.push(
        new discord.MessageEmbed()
          .setTitle("Discord-SimpleMusicBot")
          .setDescription("Basic info")
          .addField("Version (commit hash)", `\`${options.bot.Version}\``, true)
          .addField("Managed embed toggles", `\`${options.EmbedPageToggle.length}\``, true)
          .addField("Guilds that have modified data", `\`${options.bot.QueueModifiedGuilds.length}\``, true)
          .addField("Voice environment configuration", `\`\`\`\r\n${generateDependencyReport()}\r\n\`\`\``, true)
          .setColor(getColor("UPTIME"))
      );
    }

    if(message.author.id === (Util.config.adminId ?? "593758391395155978") && (options.args.includes("log") || options.args.length === 0)){
      // Process Logs
      const logEmbed = new discord.MessageEmbed();
      logEmbed.setColor(getColor("UPTIME"));
      logEmbed.title = "Log";
      logEmbed.description = "Last " + Util.logger.logStore.data.length + " bot logs\r\n```\r\n" + Util.logger.logStore.data.join("\r\n") + "\r\n```";
      embeds.push(logEmbed);
    }

    if(options.args.includes("cpu") || options.args.length === 0){
      // Process CPU Info
      const cpuInfoEmbed = new discord.MessageEmbed();
      cpuInfoEmbed.setColor(getColor("UPTIME"));
      const cpus = os.cpus();
      cpuInfoEmbed.title = "CPU Info";
      for(let i = 0; i < cpus.length; i++){
        const all = cpus[i].times.user + cpus[i].times.sys + cpus[i].times.nice + cpus[i].times.irq + cpus[i].times.idle;
        cpuInfoEmbed.addField(
          "CPU" + (i + 1), "Model: `" + cpus[i].model + "`\r\n"
        + "Speed: `" + cpus[i].speed + "MHz`\r\n"
        + "Times(user): `" + Math.round(cpus[i].times.user / 1000) + "s(" + Util.math.GetPercentage(cpus[i].times.user, all) + "%)`\r\n"
        + "Times(sys): `" + Math.round(cpus[i].times.sys / 1000) + "s(" + Util.math.GetPercentage(cpus[i].times.sys, all) + "%)`\r\n"
        + "Times(nice): `" + Math.round(cpus[i].times.nice / 1000) + "s(" + Util.math.GetPercentage(cpus[i].times.nice, all) + "%)`\r\n"
        + "Times(irq): `" + Math.round(cpus[i].times.irq / 1000) + "s(" + Util.math.GetPercentage(cpus[i].times.irq, all) + "%)`\r\n"
        + "Times(idle): `" + Math.round(cpus[i].times.idle / 1000) + "s(" + Util.math.GetPercentage(cpus[i].times.idle, all) + "%)`"
        , true);
      }
      embeds.push(cpuInfoEmbed);
    }

    if(options.args.includes("mem") || options.args.length === 0){
      // Process Mem Info
      const memInfoEmbed = new discord.MessageEmbed();
      memInfoEmbed.setColor(getColor("UPTIME"));
      const memory = Util.system.GetMemInfo();
      const nMem = process.memoryUsage();
      memInfoEmbed.title = "Memory Info";
      memInfoEmbed.addField("Total Memory",
          "Total: `" + memory.total + "MB`\r\n"
        + "Used: `" + memory.used + "MB`\r\n"
        + "Free: `" + memory.free + "MB`\r\n"
        + "Usage: `" + memory.usage + "%`"
      , true);
      const rss = Util.system.GetMBytes(nMem.rss);
      const ext = Util.system.GetMBytes(nMem.external);
      memInfoEmbed.addField("Main Process Memory",
          "RSS: `" + rss + "MB`\r\n"
        + "Heap total: `" + Util.system.GetMBytes(nMem.heapTotal) + "MB`\r\n"
        + "Heap used: `" + Util.system.GetMBytes(nMem.heapUsed) + "MB`\r\n"
        + "Array buffers: `" + Util.system.GetMBytes(nMem.arrayBuffers) + "MB`\r\n"
        + "External: `" + ext + "MB`\r\n"
        + "Total: `" + Util.math.GetPercentage(rss + ext, memory.total) + "%`"
      , true);
      embeds.push(memInfoEmbed);
    }
    
    message.channel.send({embeds}).catch(e => Util.logger.log(e, "error"));
  }
}
