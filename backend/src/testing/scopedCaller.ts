import {eq} from 'drizzle-orm';
import {db} from '../db';
import {users,roles} from '../db/schema/users';
import {organizationGroups,userOrganizationGroupAccess} from '../db/schema/organizations';
import {loadCurrentIdentity} from '../services/currentIdentity';
import {getUserPermissions} from '../middleware/auth';
import {loadGroupAccess} from '../services/organizationScope';
import {resolveRequestScope} from '../domain/organizationAccess';
let hrId:number|undefined;
/** Supply real synthetic caller identity to tests that invoke controllers below routing. */
export function bindScopedCaller(handler:(req:any,res:any)=>Promise<any>,mode:'read'|'write'='write'){
 return async(req:any,res:any)=>{
  await db.insert(organizationGroups).values({code:'CMC',name:'CMC'}).onConflictDoNothing();
  const [group]=await db.select().from(organizationGroups).where(eq(organizationGroups.code,'CMC'));
  const hr=String(req.user?.roleName??'').toLowerCase().startsWith('hr');
  let actor=Number.isSafeInteger(req.user?.userId)?await loadCurrentIdentity(req.user.userId):null;
  if(!actor){
   if(hr){
    if(!hrId){
     const [role]=await db.select().from(roles).where(eq(roles.code,'hr_attendance'));
     const [user]=await db.insert(users).values({username:`scoped-hr-${process.pid}`,passwordHash:'unused',roleId:role.id,role:role.name}).returning();
     hrId=user.id;await db.insert(userOrganizationGroupAccess).values({userId:hrId,groupId:group.id});
    }
    actor=await loadCurrentIdentity(hrId);
   }else{
    const [admin]=await db.select().from(users).where(eq(users.username,'admin'));
    actor=await loadCurrentIdentity(admin.id);
   }
  }
  if(!actor)throw new Error('Synthetic caller unavailable');
  const access=await loadGroupAccess(actor.userId);
  return handler({...req,user:{...actor,permissions:await getUserPermissions(actor.roleId,actor.roleName)},organizationScope:resolveRequestScope({access,module:'users',mode,selectedGroupId:mode==='read'&&access.isGlobalAdministrator?null:group.id})},res);
 };
}
