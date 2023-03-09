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

import type { KnownAudioSourceIdentifer } from "../Component/QueueManager";

import * as ytdl from "ytdl-core";

import * as AudioSource from ".";
import { isAvailableRawAudioURL } from "../Util";
import { useConfig } from "../config";

type AudioSourceBasicInfo = {
  type: KnownAudioSourceIdentifer,
  url: string,
  knownData: AudioSource.exportableCustom,
  forceCache: boolean,
};

const { isDisabledSource } = useConfig();

export async function resolve(info: AudioSourceBasicInfo){
  let basicInfo = null as AudioSource.AudioSource<any>;
  const { type, url, knownData: gotData, forceCache: cache } = info;
  if(!isDisabledSource("youtube") && (type === "youtube" || type === "unknown" && ytdl.validateURL(url))){
    // youtube
    basicInfo = await AudioSource.initYouTube(url, gotData as AudioSource.exportableYouTube, cache);
  }else if(!isDisabledSource("custom") && (type === "custom" || type === "unknown" && isAvailableRawAudioURL(url))){
    // カスタムストリーム
    basicInfo = await new AudioSource.CustomStream().init(url, info.knownData);
  }else if(!isDisabledSource("soundcloud") && (type === "soundcloud" || AudioSource.SoundCloudS.validateUrl(url))){
    // soundcloud
    basicInfo = await new AudioSource.SoundCloudS().init(url, gotData as AudioSource.exportableSoundCloud);
  }else if(!isDisabledSource("spotify") && (type === "spotify" || AudioSource.Spotify.validateTrackUrl(url)) && AudioSource.Spotify.available){
    // spotify
    basicInfo = await new AudioSource.Spotify().init(url, gotData as AudioSource.exportableSpotify);
  }else if(type === "unknown"){
    // google drive
    if(!isDisabledSource("googledrive") && AudioSource.GoogleDrive.validateUrl(url)){
      basicInfo = await new AudioSource.GoogleDrive().init(url, info.knownData);
    }else if(!isDisabledSource("streamable") && AudioSource.StreamableApi.getVideoId(url)){
      // Streamable
      basicInfo = await new AudioSource.Streamable().init(url, gotData as AudioSource.exportableStreamable);
    }else if(process.env.BD_ENABLE && AudioSource.BestdoriApi.getAudioId(url)){
      // Bestdori
      basicInfo = await new AudioSource.BestdoriS().init(url, gotData as AudioSource.exportableBestdori);
    }else if(process.env.HIBIKI_ENABLE && AudioSource.HibikiApi.validateURL(url)){
      // Hibiki
      basicInfo = await new AudioSource.Hibiki().init(url);
    }else if(!isDisabledSource("niconico") && AudioSource.NicoNicoS.validateUrl(url)){
      // NicoNico
      basicInfo = await new AudioSource.NicoNicoS().init(url, gotData as AudioSource.exportableNicoNico);
    }else if(!isDisabledSource("twitter") && AudioSource.Twitter.validateUrl(url)){
      // Twitter
      basicInfo = await new AudioSource.Twitter().init(url, gotData as AudioSource.exportableTwitter);
    }
  }

  return basicInfo;
}
