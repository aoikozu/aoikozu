import type { exportableYouTube } from "..";
import { StreamInfo } from "../../audiosource";
import { Util } from "../../../Util";

export type Cache<T extends string, U> = {
  type:T,
  data:U,
};

export abstract class Strategy<T extends Cache<any, any>>{
  constructor(protected priority:number){}

  abstract getInfo(url:string):Promise<{
    data:exportableYouTube,
    cache:T,
  }>;
  
  abstract fetch(url:string, forceCache?: boolean, cache?:Cache<any, any>):Promise<{
    stream:StreamInfo,
    info:exportableYouTube,
    relatedVideos:exportableYouTube[],
  }>;
  
  protected useLog(){
    Util.logger.log("[AudioSource:youtube] using strategy #" + this.priority);
  }
}
