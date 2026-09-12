import {getChatGPTUser} from '@/app/chatgpt-auth';
import {database} from '@/lib/quotes-db';
export type AgencySession={authenticatedUserId:string;agencyUserId:string;agencyId:string;role:string};
export class AgencySessionError extends Error{constructor(public status:number,public code:string){super(code)}}
export async function requireAgencySession():Promise<AgencySession>{const user=await getChatGPTUser();if(!user)throw new AgencySessionError(401,'unauthenticated');const member=await database().prepare("SELECT id,agency_id,role FROM agency_users WHERE authenticated_user_id=? AND status='active'").bind(user.userId).first<{id:string;agency_id:string;role:string}>();if(!member)throw new AgencySessionError(403,'onboarding_required');return {authenticatedUserId:user.userId,agencyUserId:member.id,agencyId:member.agency_id,role:member.role}}
