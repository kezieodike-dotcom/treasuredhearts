const escapeHtml = value => String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function sendEmail({to,subject,message,key,env=process.env}){
  if(!to)return {status:'not_requested',message:'No email address is recorded for this invitation.'};
  if(!env.RESEND_API_KEY||!env.RESEND_FROM_EMAIL)return {status:'not_configured',message:'Your response is saved. Email notifications are not configured.'};
  try {
    const response=await fetch('https://api.resend.com/emails',{method:'POST',signal:AbortSignal.timeout(8000),headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:env.RESEND_FROM_EMAIL,to:[to],subject,html:'<!doctype html><html lang="en"><body style="margin:0;background:#F7F2E9;font-family:Arial,sans-serif;color:#111111"><main style="max-width:560px;margin:40px auto;padding:40px;background:#FFFFFF;border-top:3px solid #C5A46D"><p style="letter-spacing:3px;color:#766452;font-size:11px">MICHEAL’SPEACE</p><h1 style="font-family:Georgia,serif;font-weight:400">'+escapeHtml(subject)+'</h1><p style="line-height:1.8;white-space:pre-line">'+escapeHtml(message)+'</p><p style="color:#766452">With love, Peace and Micheal</p></main></body></html>',text:message})});
    const data=await response.json();
    if(!response.ok||!data.id)return {status:'failed',message:'Your response is saved, but the email notification could not be sent.'};
    return {status:'accepted',message:'Your response is saved and the email provider accepted your confirmation.',providerId:data.id};
  } catch{return {status:'failed',message:'Your response is saved, but the email notification could not be sent.'};}
}
export async function notifyRsvp(result,config,env){return sendEmail({to:result.guest.email,subject:result.updated?'Your RSVP has been updated':'Your RSVP confirmation',message:'Hello '+result.guest.fullName+',\n\nWe have saved your response: '+(result.rsvp.attendanceStatus==='attending'?'Attending, '+result.rsvp.attendeeCount+' attendee(s).':'Unable to attend.')+'\n\n'+config.eventDate+' · '+config.ceremonyStartTime+'\n'+config.venueName+'\n'+config.venueAddress+'\n\nFor RSVP enquiries: '+config.contactNumbers.join(', '),key:'rsvp/'+result.rsvp.id+'/'+result.rsvp.updatedAt,env});}
const WISHES_RECIPIENT='michael.chukuwu.241426@unn.edu.ng';
async function sendWishWithWeb3Forms(wish,env){
  if(!env.WEB3FORMS_ACCESS_KEY)return null;
  const subject='New wedding wish from '+wish.displayName;
  try {
    const response=await fetch('https://api.web3forms.com/submit',{method:'POST',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json'},body:JSON.stringify({access_key:env.WEB3FORMS_ACCESS_KEY,subject,from_name:'Michael’sPeace wedding website',name:wish.displayName,message:wish.message,moderation_status:'Pending approval',botcheck:''})});
    const data=await response.json();
    if(!response.ok||data.success!==true)return {status:'failed',message:'Your wish is saved, but the email notification could not be sent.'};
    return {status:'accepted',message:'Your wish is saved and the email provider accepted the notification.'};
  } catch{return {status:'failed',message:'Your wish is saved, but the email notification could not be sent.'};}
}
export async function notifyWish(wish,env){const web3=await sendWishWithWeb3Forms(wish,env);if(web3)return web3;return sendEmail({to:env.WISHES_NOTIFICATION_EMAIL||WISHES_RECIPIENT,subject:'New wedding wish from '+wish.displayName,message:'A new message has been submitted to the Peace & Michael wedding guestbook.\n\nFrom: '+wish.displayName+'\n\n'+wish.message+'\n\nThis wish is pending approval in the wedding team dashboard.',key:'wish/'+wish.id+'/'+wish.createdAt,env});}
