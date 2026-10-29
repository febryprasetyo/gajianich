'use client';
import {createContext,useContext,useEffect,useState,Fragment,type ReactNode} from 'react';
import {useAuth} from './AuthContext';
import {api} from '@/lib/api';
import {organizationRequests,restoreGroupSelection,type OrganizationGroup} from '@/lib/access/organizationScope';
interface OrganizationContextValue {
  availableGroups:OrganizationGroup[];selectedGroupId:number|null;
  selectGroup:(id:number|null)=>void;isGlobalAdministrator:boolean;isLoading:boolean;
  revision:number;error:string|null;
}
const OrganizationContext=createContext<OrganizationContextValue|undefined>(undefined);
export function OrganizationScopeProvider({children}:{children:ReactNode}){
  const {user,isLoading:authLoading}=useAuth();
  const userId=user?.id??null;
  const [state,setState]=useState({userId:null as number|null,availableGroups:[] as OrganizationGroup[],selectedGroupId:null as number|null,isGlobalAdministrator:false,revision:0,error:null as string|null});
  useEffect(()=>{
    let disposed=false;
    const load=async()=>{
      if(authLoading) return;
      if(userId===null){
        if(!disposed) setState(previous=>previous.userId===null?previous:{userId:null,availableGroups:[],selectedGroupId:null,isGlobalAdministrator:false,revision:organizationRequests.revision,error:null});
        return;
      }
      try {
        const response=await api.get<{user:{availableGroups?:OrganizationGroup[];organizationAccess?:{isGlobalAdministrator:boolean}}}>('/auth/me');
        if(disposed) return;
        const groups=response.user.availableGroups??[];
        const global=response.user.organizationAccess?.isGlobalAdministrator??false;
        let stored:string|null=null;
        try{stored=sessionStorage.getItem(`gajianich:organization:${userId}`);}catch{}
        const selected=stored==='all' && (global||groups.length>1)?null:restoreGroupSelection(groups,stored);
        organizationRequests.change(selected);
        setState({userId,availableGroups:groups,selectedGroupId:selected,isGlobalAdministrator:global,revision:organizationRequests.revision,error:null});
      }catch(error){
        if(disposed) return;
        organizationRequests.change(null,true);
        setState({userId,availableGroups:[],selectedGroupId:null,isGlobalAdministrator:false,revision:organizationRequests.revision,error:error instanceof Error?error.message:'Cakupan akses tidak tersedia'});
      }
    };
    void Promise.resolve().then(load);
    const focus=()=>{void load();};
    window.addEventListener('focus',focus);
    return()=>{disposed=true;window.removeEventListener('focus',focus);};
  },[userId,authLoading]);
  const selectGroup=(id:number|null)=>{
    if(id!==null && !state.availableGroups.some(group=>group.id===id)) return;
    if(id===null && !state.isGlobalAdministrator && state.availableGroups.length<=1) return;
    organizationRequests.change(id);
    try{sessionStorage.setItem(`gajianich:organization:${userId}`,id===null?'all':String(id));}catch{}
    setState(previous=>({...previous,selectedGroupId:id,revision:organizationRequests.revision}));
  };
  return <OrganizationContext.Provider value={{...state,selectGroup,isLoading:authLoading||state.userId!==userId}}><Fragment key={`${state.userId}:${state.revision}`}>{children}</Fragment></OrganizationContext.Provider>;
}
export function useOrganizationScope(){
  const value=useContext(OrganizationContext);
  if(!value) throw new Error('OrganizationScopeProvider is required');
  return value;
}
export function OrganizationScopeBoundary({children}:{children:ReactNode}){
  const {revision,isLoading,error}=useOrganizationScope();
  if(isLoading) return <p role="status" className="text-sm text-slate-600">Memuat cakupan akses…</p>;
  if(error) return <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{error}</p>;
  return <div key={revision}>{children}</div>;
}
