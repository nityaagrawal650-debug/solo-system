import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import dotenv from "dotenv";
dotenv.config();
const app=express();
app.disable("x-powered-by");
app.use(helmet({crossOriginResourcePolicy:{policy:"cross-origin"}}));
const allowedOrigins=(process.env.ALLOWED_ORIGINS||"").split(",").map(s=>s.trim()).filter(Boolean);
app.use((req,res,next)=>{const origin=req.headers.origin;if(origin&&allowedOrigins.includes(origin)){res.setHeader("Access-Control-Allow-Origin",origin);res.setHeader("Vary","Origin");res.setHeader("Access-Control-Allow-Headers","Content-Type");res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");}if(req.method==="OPTIONS")return res.sendStatus(204);next()});
app.use(express.json({limit:"12mb"}));
const limiter=rateLimit({windowMs:60_000,limit:20,standardHeaders:true,legacyHeaders:false});
app.use("/api/",limiter);
const PORT=process.env.PORT||3000;
const API_KEY=process.env.OPENAI_API_KEY;
const CHAT_MODEL=process.env.OPENAI_CHAT_MODEL||"gpt-5-mini";
const REALTIME_MODEL=process.env.OPENAI_REALTIME_MODEL||"gpt-realtime";
const VOICE=process.env.OPENAI_VOICE||"marin";
if(!API_KEY) console.warn("OPENAI_API_KEY is missing. Add it as a server environment variable, never to frontend files.");
function requireKey(res){if(!API_KEY){res.status(503).json({error:"AI backend is not configured. Add OPENAI_API_KEY in your hosting provider's environment variables."});return false}return true}
app.get("/api/health",(_req,res)=>res.json({ok:true,chatConfigured:!!API_KEY,voiceConfigured:!!API_KEY}));
app.post("/api/chat",async(req,res)=>{
  if(!requireKey(res))return;
  try{
    const {message,imageData,history=[],instructions="You are a helpful tutor.",player={}}=req.body||{};
    if(typeof message!=="string"||message.length>12000) return res.status(400).json({error:"Message is missing or too long (12,000 characters max)."});
    if(imageData && (typeof imageData!=="string"||!/^data:image\/(png|jpeg|webp);base64,/.test(imageData))) return res.status(400).json({error:"Image must be a PNG, JPG or WEBP data URL."});
    if(imageData && imageData.length>11_000_000) return res.status(413).json({error:"Image is too large. Please upload a smaller photo."});
    const safeHistory=Array.isArray(history)?history.slice(-16).filter(m=>m&&["user","assistant"].includes(m.role)&&typeof m.content==="string").map(m=>({role:m.role,content:m.content.slice(0,5000)})):[];
    const context=`\nCurrent study context (use only when relevant): ${JSON.stringify({name:String(player.name||"Hunter").slice(0,30),rank:String(player.rank||"F").slice(0,2),level:Number(player.level)||1,totalXP:Number(player.totalXP)||0,mockScores:Array.isArray(player.mockScores)?player.mockScores.slice(-5):[],activeQuests:Array.isArray(player.activeQuests)?player.activeQuests.slice(0,7):[]})}`;
    const content=[{type:"input_text",text:(message||"Read the uploaded question image and explain it step by step.")+context}];
    if(imageData)content.push({type:"input_image",image_url:imageData,detail:"high"});
    const input=[...safeHistory,{role:"user",content}];
    const r=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:CHAT_MODEL,instructions:String(instructions).slice(0,5000),input,max_output_tokens:1200})});
    const data=await r.json();
    if(!r.ok){console.error("Responses API error",r.status,data?.error?.message||"unknown");return res.status(502).json({error:data?.error?.message||"AI provider request failed. Check model access and API billing."})}
    const text=(data.output||[]).flatMap(item=>item.content||[]).filter(c=>c.type==="output_text").map(c=>c.text).join("\n").trim();
    return res.json({text:text||"I couldn't produce a clear answer. Please try again."});
  }catch(err){console.error("chat endpoint",err);return res.status(500).json({error:"Unexpected server error while answering. Please try again."})}
});
app.post("/api/realtime-token",async(req,res)=>{
  if(!requireKey(res))return;
  try{
    const instructions=typeof req.body?.instructions==="string"?req.body.instructions.slice(0,5000):"You are a helpful study tutor. Speak naturally and explain clearly.";
    const r=await fetch("https://api.openai.com/v1/realtime/client_secrets",{method:"POST",headers:{Authorization:`Bearer ${API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({expires_after:{anchor:"created_at",seconds:600},session:{type:"realtime",model:REALTIME_MODEL,instructions,output_modalities:["audio"],audio:{input:{turn_detection:{type:"server_vad"},transcription:{model:"gpt-4o-mini-transcribe",language:"en"}},output:{voice:VOICE}}}})});
    const data=await r.json();
    if(!r.ok){console.error("Realtime token error",r.status,data?.error?.message||"unknown");return res.status(502).json({error:data?.error?.message||"Realtime API unavailable. Check model access and billing."})}
    res.set("Cache-Control","no-store");return res.json(data);
  }catch(err){console.error("realtime-token endpoint",err);return res.status(500).json({error:"Could not create a temporary voice token."})}
});
// Optional production static serving if you place frontend files in ../public.
app.use(express.static(new URL("../public/",import.meta.url).pathname));
app.get("/",(_req,res)=>res.sendFile(new URL("../public/index.html",import.meta.url).pathname,err=>{if(err&&!res.headersSent)res.status(404).send("Frontend not found. Deploy the public folder or use GitHub Pages for the frontend.")}));
app.listen(PORT,()=>console.log(`Solo System AI backend listening on ${PORT}`));
