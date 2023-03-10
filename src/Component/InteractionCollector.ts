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

import type { ResponseMessage } from "./ResponseMessage";
import type { AnyGuildTextChannel, ComponentInteraction, ComponentTypes, Message } from "oceanic.js";

import { LogEmitter } from "../Structure";
import { generateUUID } from "../Util";

interface InteractionCollectorManagerEvents {
  createInteraction: [collector: InteractionCollector<any>];
}

export class InteractionCollectorManager extends LogEmitter<InteractionCollectorManagerEvents> {
  protected collectors = new Map<string, InteractionCollector<any>>();

  constructor(){
    super("InteractionCollectorManager");
  }

  create(){
    const collector = new InteractionCollector(this);
    this.logger.debug(`(${collector.collectorId}) collector created`);
    collector
      .on("customIdsCreate", customIds => {
        this.logger.debug(`(${collector.collectorId}) customIds registered`);
        customIds.forEach(customId => {
          this.collectors.set(customId, collector);
        });
      })
      .once("destroy", () => {
        const customIds = collector.getCustomIds();
        this.logger.debug(`(${collector.collectorId}) customIds unregistered`);
        customIds.forEach(customId => {
          this.collectors.delete(customId);
        });
        this.logger.debug(`CustomIds count: ${this.collectors.size}`);
      });
    return collector;
  }

  interactionCreate(interaction: ComponentInteraction<any, AnyGuildTextChannel>){
    const collector = this.collectors.get(interaction.data.customID);
    if(!collector){
      return false;
    }else{
      this.logger.debug(`passed an interaction successfully: ${interaction.data.customID} => ${collector.collectorId}`);
      collector.handleInteraction(interaction);
      return true;
    }
  }
}

interface InteractionCollectorEvents {
  customIdsCreate: [customIds: string[]];
  destroy: [];
  timeout: [];
}

export class InteractionCollector<T extends InteractionCollectorEvents = InteractionCollectorEvents> extends LogEmitter<T> {
  // <customId, componentId>
  protected customIdMap = new Map<string, string>();
  protected receivedCount = 0;
  protected maxReceiveCount = 1;
  protected userId: string = null;
  protected timer: NodeJS.Timeout = null;
  protected timeout: number = null;
  protected destroyed = false;
  protected _collectorId: string = null;
  protected resetTimeoutOnInteraction = false;
  protected message: Message | ResponseMessage = null;

  getCustomIds(){
    return [...this.customIdMap.keys()];
  }

  get collectorId(){
    return this._collectorId;
  }

  constructor(protected parent: InteractionCollectorManager){
    const collectorId = generateUUID();
    super("InteractionCollector", collectorId);
    this._collectorId = collectorId;
  }

  setMaxInteraction(count: number){
    this.maxReceiveCount = count;
    this.logger.debug(`max interaction count: ${count}`);
    return this;
  }

  setTimeout(timeout: number){
    if(this.timer){
      clearTimeout(this.timer);
    }
    this.logger.debug(`timeout: ${timeout}`);
    this.timer = setTimeout(() => {
      this.destroy();
      this.emit("timeout");
    }, timeout).unref();
    this.timeout = timeout;
    return this;
  }

  setAuthorIdFilter(userId: string){
    this.userId = userId;
    this.logger.debug(`author filter: ${this.userId}`);
    return this;
  }

  setResetTimeoutOnInteraction(reset: boolean){
    this.resetTimeoutOnInteraction = reset;
    return this;
  }

  createCustomIds<
    U extends Record<string, "button"|"selectMenu"> & { [key in keyof T]?: never }
  >(componentTypes: U): {
    customIdMap: { [key in keyof U]: string },
    collector: InteractionCollector<T & {
      [key in keyof U]: U[key] extends "button"
        ? [ComponentInteraction<ComponentTypes.BUTTON>]
        : [ComponentInteraction<ComponentTypes.STRING_SELECT>]
    }>,
  } {
    const existingComponentIds = [...this.customIdMap.values()];
    const componentIds = Object.keys(componentTypes) as (keyof U)[];
    if(componentIds.some(id => existingComponentIds.includes(id as string))){
      throw new Error("Duplicated key");
    }
    const customIds = Array.from({ length: componentIds.length }, () => `collector-${generateUUID()}`);
    const componentIdCustomIdMap = {} as { [key in keyof U]: string };
    customIds.forEach((customId, i) => {
      this.customIdMap.set(customId, componentIds[i] as string);
      componentIdCustomIdMap[componentIds[i]] = customId;
    });
    this.emit("customIdsCreate", customIds);
    this.logger.debug("customId created", componentIdCustomIdMap);
    return {
      customIdMap: componentIdCustomIdMap,
      collector: this,
    };
  }

  handleInteraction(interaction: ComponentInteraction<any, AnyGuildTextChannel>){
    const componentId = this.customIdMap.get(interaction.data.customID);
    if(!componentId){
      this.logger.warn(`unknown custom id: ${interaction.data.customID}`);
      return;
    }else if(this.userId && interaction.member.id !== this.userId){
      this.logger.warn(`forbidden interaction; ignoring: ${interaction.data.customID}`);
      return;
    }
    this.logger.debug(`id mapped ${interaction.data.customID} => ${componentId}`);
    if(this.resetTimeoutOnInteraction){
      this.setTimeout(this.timeout);
    }
    this.emit(componentId as any, interaction);
    this.receivedCount++;
    if(this.receivedCount >= this.maxReceiveCount){
      this.destroy();
    }
  }

  setMessage(message: Message | ResponseMessage){
    this.message = message;
    return message;
  }

  destroy(){
    if(!this.destroyed){
      this.destroyed = true;
      this.emit("destroy");
      this.logger.debug("destroyed");
    }
    if(this.message){
      this.message.edit({
        components: [],
      });
      this.message = null;
    }
    if(this.timer){
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
