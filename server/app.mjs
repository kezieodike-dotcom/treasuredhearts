import express from 'express';
import {randomBytes, scryptSync, timingSafeEqual, createHash} from 'node:crypto';
import {LocalRepository, supabaseRepository} from './repository.mjs';
import {defaultConfig} from './defaults.mjs';
import {ApiError, bad, text, newToken, hashToken, validateToken, assertInvitation, guestInput, responseInput, settingsInput, contentInput, guestCsv} from './validation.mjs';
import {notifyRsvp, notifyWish, sendEmail} from './email.mjs';
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res)).catch(next);
const cleanGuest = guest => {const {invitationTokenHash,invitationCode,...safe}=guest;return safe;};
const cleanImage = image => {const {imageData,contentType,...safe}=image;return safe;};
const cookies=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(v=>v.trim().split('=')).filter(v=>v.length===2));
export async function createApp(options={}) {
  const env=options.env||process.env;
  const production=env.NODE_ENV==='production'||!!env.VERCEL;
  const demo=options.demo===true||env.LOCAL_DEMO==='true';
  if(demo&&production)throw new Error('LOCAL_DEMO cannot run in production. Configure Supabase.');
  let repo=options.repository;
  if(!repo&&demo){repo=new LocalRepository(options.dbFile||env.LOCAL_DB_FILE||'server/data/local-demo.json');await repo.init();}
  if(!repo&&!demo&&env.SUPABASE_URL&&env.SUPABASE_SECRET_KEY&&env.SUPABASE_PUBLISHABLE_KEY)repo=await supabaseRepository(env.SUPABASE_URL,env.SUPABASE_SECRET_KEY,env.SUPABASE_PUBLISHABLE_KEY);
  const requireRepo=()=>{if(!repo)throw new ApiError(503,'Please configure the wedding database before using this feature.');return repo;};
  const app=express();app.disable('x-powered-by');
  if(env.VERCEL)app.set('trust proxy',1);
  const sessions=new Map();const limits=new Map();
  const adminEmail=options.adminEmail||env.LOCAL_ADMIN_EMAIL;
  const adminPassword=options.adminPassword||env.LOCAL_ADMIN_PASSWORD;
  const salt=randomBytes(16);const passwordHash=adminPassword?scryptSync(adminPassword,salt,64):null;
  const cookieOptions={httpOnly:true,secure:production,sameSite:'strict',path:'/api'};
  const setSession=(res,session)=>{res.cookie('mp_session',session.access_token,{...cookieOptions,maxAge:(session.expires_in||3600)*1000});if(session.refresh_token)res.cookie('mp_refresh',session.refresh_token,{...cookieOptions,maxAge:30*86400000});};
  async function authorized(req,res){
    const token=cookies(req).mp_session;
    if(demo){const session=sessions.get(token);if(!session||session.expires<Date.now()){sessions.delete(token);throw new ApiError(401,'Please sign in to continue.');}return session.user;}
    if(!token&&!cookies(req).mp_refresh)throw new ApiError(401,'Please sign in to continue.');
    const r=requireRepo();const client=r.authClient();let {data,error}=await client.auth.getUser(token);
    if(error&&cookies(req).mp_refresh){const renewed=await client.auth.refreshSession({refresh_token:cookies(req).mp_refresh});if(!renewed.error&&renewed.data.session){setSession(res,renewed.data.session);({data,error}=await client.auth.getUser(renewed.data.session.access_token));}}
    if(error||!data?.user)throw new ApiError(401,'Your session has expired. Please sign in again.');
    const profile=await r.profile(data.user.id);if(!profile)throw new ApiError(403,'This account is not authorized to administer this wedding.');
    return {id:data.user.id,username:data.user.email,name:profile.full_name,role:profile.role==='super_admin'?'super_admin':'wedding_coordinator'};
  }
  const admin=wrap(async(req,res)=>{req.admin=await authorized(req,res);});
  app.use('/api',(req,res,next)=>{res.set({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});if(['POST','PATCH','PUT','DELETE'].includes(req.method)){
    const forwardedHost=String(req.headers['x-forwarded-host']||'').split(',')[0].trim();
    const requestHost=forwardedHost||String(req.headers.host||'').trim();
    const hostOrigin=requestHost?(production?'https://':'http://')+requestHost:'';
    const allowed=[options.siteUrl||env.PUBLIC_SITE_URL||(!production?'http://'+req.headers.host:''),env.VERCEL_URL?'https://'+env.VERCEL_URL:'',hostOrigin].filter(Boolean).map(v=>new URL(v).origin);
    if(!req.headers.origin||!allowed.includes(req.headers.origin))return res.status(403).json({error:'Request origin is not allowed.'});
    if(!req.is('application/json'))return res.status(415).json({error:'Send JSON content.'});
  }next();});
  app.use('/api/admin/gallery/upload',express.json({limit:'12mb'}));app.use('/api',express.json({limit:'32kb'}));
  async function limit(req,scope,max=15,seconds=600){
    const key=createHash('sha256').update(scope+':'+(req.ip||'unknown')).digest('hex');const ceiling=options.rateLimit||max;
    if(repo&&!demo){if(!await repo.limit(key,ceiling,seconds))throw new ApiError(429,'Too many attempts. Please wait before trying again.');return;}
    const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
    const row=limits.get(key)||{count:0,until:now+seconds*1000};row.count++;limits.set(key,row);if(row.count>ceiling)throw new ApiError(429,'Too many attempts. Please wait before trying again.');
  }
  const storyPhotos=(stories,photos)=>stories.map(s=>({...s,imageUrl:s.imageId?(photos.find(p=>p.id===s.imageId)?.url||''):s.imageUrl||''}));
  const status=()=>demo?'demo':repo?'live':'setup';
  app.get('/api/health',(req,res)=>res.json({status:'ok',mode:status()}));
  app.get('/api/public',wrap(async(req,res)=>{
    if(!repo)return res.json({config:defaultConfig,gallery:[],stories:[],wishes:[],mode:'setup'});
    const [config,gallery,stories,wishes]=await Promise.all([repo.config(),repo.list('gallery'),repo.list('stories'),repo.list('wishes')]);
    const photos=await repo.galleryUrls(gallery.filter(r=>r.published).sort((a,b)=>a.displayOrder-b.displayOrder));
    res.json({config,gallery:photos.map(cleanImage),stories:storyPhotos(stories.filter(r=>r.published).sort((a,b)=>a.displayOrder-b.displayOrder),photos),wishes:wishes.filter(r=>r.moderationStatus==='approved').sort((a,b)=>b.createdAt.localeCompare(a.createdAt)),mode:status()});
  }));
  app.post('/api/invitations/verify',wrap(async(req,res)=>{await limit(req,'verify',12);const r=requireRepo();const hash=hashToken(validateToken(req.body.token));const [guest,config]=await Promise.all([r.byToken(hash),r.config()]);assertInvitation(guest,config);const response=(await r.list('rsvps')).find(v=>v.guestId===guest.id)||null;res.json({guest:{id:guest.id,fullName:guest.fullName,maxAttendees:guest.maxAttendees},rsvp:response,canUpdate:config.featureSettings.allowRsvpUpdates});}));
  app.post('/api/rsvp',wrap(async(req,res)=>{await limit(req,'rsvp',15);const r=requireRepo();const hash=hashToken(validateToken(req.body.token));const [guest,config]=await Promise.all([r.byToken(hash),r.config()]);assertInvitation(guest,config);const validated=responseInput(req.body,guest,config);const result=await r.submit(hash,validated);const email=await notifyRsvp(result,config,env);res.json({rsvp:result.rsvp,email});}));
  app.post('/api/wishes',wrap(async(req,res)=>{await limit(req,'wishes',3,3600);if(req.body.website)bad('Unable to accept this message.');const fields={displayName:text(req.body.displayName,'Your name',80),message:text(req.body.message,'Your wish',500),moderationStatus:'pending'};if(fields.message.length<10)bad('Your wish must contain at least 10 characters.');const row=repo?await repo.insert('wishes',fields):{id:'web3-'+Date.now().toString(36),createdAt:new Date().toISOString(),...fields};const email=await notifyWish(row,env);res.status(201).json({id:row.id,message:repo?'Thank you. Your wish will appear after the wedding team approves it.':'Thank you. Your wish has been sent to Peace and Michael.',email});}));
  app.post('/api/admin/login',wrap(async(req,res)=>{await limit(req,'login',6,900);const email=text(req.body.email,'Email',254).toLowerCase();const password=text(req.body.password,'Password',200);let user;
    if(demo){if(!adminEmail||!passwordHash)throw new ApiError(503,'Set LOCAL_ADMIN_EMAIL and LOCAL_ADMIN_PASSWORD for the local demonstration.');if(email!==adminEmail.toLowerCase()||!timingSafeEqual(scryptSync(password,salt,64),passwordHash))throw new ApiError(401,'Invalid sign-in details.');user={id:'local-admin',username:email,name:'Local demonstration coordinator',role:'super_admin'};const token=newToken();sessions.set(token,{user,expires:Date.now()+3600000});setSession(res,{access_token:token,expires_in:3600});}
    else{const r=requireRepo();const {data,error}=await r.authClient().auth.signInWithPassword({email,password});if(error||!data.session)throw new ApiError(401,'Invalid sign-in details.');const p=await r.profile(data.user.id);if(!p)throw new ApiError(403,'This account is not authorized to administer this wedding.');user={id:data.user.id,username:email,name:p.full_name,role:p.role==='super_admin'?'super_admin':'wedding_coordinator'};setSession(res,data.session);}
    res.json({user});
  }));
  app.use('/api/admin',(req,res,next)=>{if(req.path==='/login')return next();authorized(req,res).then(user=>{req.admin=user;next();}).catch(next);});
  app.get('/api/admin/me',(req,res)=>res.json({user:req.admin}));
  app.post('/api/admin/logout',wrap(async(req,res)=>{if(demo)sessions.delete(cookies(req).mp_session);else{const client=repo.authClient();const refresh=cookies(req).mp_refresh;if(refresh){const {error}=await client.auth.setSession({access_token:cookies(req).mp_session,refresh_token:refresh});if(!error)await client.auth.signOut();}}res.clearCookie('mp_session',cookieOptions);res.clearCookie('mp_refresh',cookieOptions);res.json({success:true});}));
  async function adminData(){const r=requireRepo();const [config,guests,rsvps,gallery,stories,wishes]=await Promise.all([r.config(),r.list('guests'),r.list('rsvps'),r.list('gallery'),r.list('stories'),r.list('wishes')]);return {config,guests:guests.map(cleanGuest),rsvps:rsvps.map(row=>({...row,guestName:guests.find(g=>g.id===row.guestId)?.fullName||''})),gallery:(await r.galleryUrls(gallery)).map(cleanImage),stories:storyPhotos(stories,await r.galleryUrls(gallery)),wishes};}
  app.get('/api/admin/data',wrap(async(req,res)=>res.json(await adminData())));
  app.get('/api/admin/export-csv',wrap(async(req,res)=>res.type('text/csv').attachment('MichealsPeace-guests.csv').send(guestCsv(await adminData()))));
  app.post('/api/admin/guests',wrap(async(req,res)=>{const token=newToken();const fields=guestInput(req.body);const guest=await requireRepo().insert('guests',{...fields,invitationStatus:'invited',invitationTokenHash:hashToken(token)});res.status(201).json({guest:cleanGuest(guest),token});}));
  app.patch('/api/admin/guests/:id',wrap(async(req,res)=>{const r=requireRepo();const fields=guestInput(req.body,true);if(fields.maxAttendees){const existing=(await r.list('rsvps')).find(v=>v.guestId===req.params.id);if(existing?.attendeeCount>fields.maxAttendees)bad('The limit is below the current confirmed attendance. Ask the guest to update their response first.');}res.json(cleanGuest(await r.update('guests',req.params.id,fields)));}));
  app.post('/api/admin/guests/:id/rotate',wrap(async(req,res)=>{const token=newToken();const guest=await requireRepo().update('guests',req.params.id,{invitationTokenHash:hashToken(token),invitationStatus:'invited'});res.json({guest:cleanGuest(guest),token});}));
  app.post('/api/admin/guests/:id/send',wrap(async(req,res)=>{const r=requireRepo();const guest=(await r.list('guests')).find(g=>g.id===req.params.id);if(!guest)throw new ApiError(404,'Guest not found.');if(!guest.email)bad('Add the guest email address first.');if(!env.RESEND_API_KEY||!env.RESEND_FROM_EMAIL)throw new ApiError(503,'Configure Resend and a verified sender first.');const site=env.PUBLIC_SITE_URL;if(!site||!site.startsWith('https://'))bad('Configure a public HTTPS site URL first.');const token=newToken();await r.update('guests',guest.id,{invitationTokenHash:hashToken(token),invitationStatus:'invited'});const config=await r.config();const email=await sendEmail({to:guest.email,subject:'You are invited · Peace and Micheal',message:'Hello '+guest.fullName+',\n\nYou are invited to celebrate with Peace and Micheal.\n'+config.eventDate+' · '+config.ceremonyStartTime+'\n'+config.venueName+'\n'+config.venueAddress+'\n\nYour private RSVP link: '+site.replace(/\/$/,'')+'/rsvp#token='+token+'\n\nFor RSVP enquiries: '+config.contactNumbers.join(', '),key:'invitation/'+guest.id+'/'+hashToken(token),env});res.json({email,token});}));
  app.patch('/api/admin/settings',wrap(async(req,res)=>res.json(await requireRepo().settings(settingsInput(req.body)))));
  const collections={story:'stories',gallery:'gallery',wishes:'wishes'};
  for(const [route,type] of Object.entries(collections)){
    if(type==='stories')app.post('/api/admin/'+route,wrap(async(req,res)=>res.status(201).json(await requireRepo().insert(type,{displayOrder:0,published:false,...contentInput(type,req.body)}))));
    app.patch('/api/admin/'+route+'/:id',wrap(async(req,res)=>res.json(await requireRepo().update(type,req.params.id,contentInput(type,req.body,true)))));
    app.delete('/api/admin/'+route+'/:id',wrap(async(req,res)=>res.json(await requireRepo().remove(type,req.params.id))));
  }
  app.delete('/api/admin/guests/:id',wrap(async(req,res)=>res.json(await requireRepo().remove('guests',req.params.id))));
  app.post('/api/admin/gallery/upload',wrap(async(req,res)=>{await limit(req,'upload',20,3600);const r=requireRepo();const contentType=req.body.contentType;if(!['image/jpeg','image/png','image/webp'].includes(contentType))bad('Upload a JPEG, PNG, or WebP photograph.');if(typeof req.body.data!=='string'||!/^[A-Za-z0-9+/]+={0,2}$/.test(req.body.data))bad('Invalid photograph data.');const bytes=Buffer.from(req.body.data,'base64');if(bytes.length>8*1024*1024||bytes.length<12)bad('Photographs must be smaller than 8 MB.');const valid=contentType==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:contentType==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)bad('The file does not match its photograph type.');const fields=contentInput('gallery',req.body);const uploaded=await r.upload(bytes,contentType);try{const row=await r.insert('gallery',{...uploaded,category:'portraits',displayOrder:0,...fields,published:false});res.status(201).json(cleanImage((await r.galleryUrls([row]))[0]));}catch(error){if(!demo)await r.client.storage.from('wedding-photos').remove([uploaded.storagePath]);throw error;}}));
  app.get('/api/media/:id',wrap(async(req,res)=>{const r=requireRepo();if(!demo)throw new ApiError(404,'Photograph not found.');const image=(await r.list('gallery')).find(r=>r.id===req.params.id);if(!image)throw new ApiError(404,'Photograph not found.');if(!image.published)await authorized(req,res);res.type(image.contentType).send(Buffer.from(image.imageData,'base64'));}));
  app.use('/api',(req,res)=>res.status(404).json({error:'Endpoint not found.'}));
  app.use((error,req,res,next)=>{if(res.headersSent)return next(error);const status=error.status||500;if(status>=500)console.error('[API]',error.message);res.status(status).json({error:status>=500&&!(error instanceof ApiError)?'The wedding service is temporarily unavailable. Please try again.':error.message});});
  return app;
}
