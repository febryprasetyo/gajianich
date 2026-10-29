export interface OrganizationGroup {id:number;code:'CMC'|'MGM';name:string}
export function restoreGroupSelection(groups:OrganizationGroup[],stored:string|null):number|null {
  if(groups.length===1) return groups[0].id;
  const id=stored===null?null:Number(stored);
  return id!==null && groups.some(group=>group.id===id)?id:null;
}
export function organizationCacheKey(key:string,groupId:number|null):string {
  return `${key}:organization:${groupId??'all'}`;
}
export class OrganizationRequestRuntime {
  groupId:number|null=null;
  revision=0;
  private active=new Set<AbortController>();
  change(groupId:number|null,force=false){
    if(this.groupId===groupId && !force) return;
    this.groupId=groupId;this.revision++;
    for(const controller of this.active) controller.abort();
    this.active.clear();
  }
  begin(external?:AbortSignal|null){
    const groupId=this.groupId,revision=this.revision;
    const controller=new AbortController();this.active.add(controller);
    const abort=()=>controller.abort();
    if(external?.aborted) abort(); else external?.addEventListener('abort',abort,{once:true});
    return {groupId,signal:controller.signal,
      assertCurrent:()=>{if(revision!==this.revision || controller.signal.aborted) throw new DOMException('Kelompok aktif telah berubah','AbortError');},
      finish:()=>{this.active.delete(controller);external?.removeEventListener('abort',abort);}};
  }
}
export const organizationRequests=new OrganizationRequestRuntime();
