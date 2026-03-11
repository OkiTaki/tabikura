"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

// ── 定数 ──────────────────────────────────────────────────────
const EMOJI_CANDIDATES = ["👍","🎉","🍜","☕","🏖","🌸","🍣","🍺","🎨","🗻","🌊","⛩","🍡","🦀","🎭","🌺","🚂","🦋","🍰","🎶","💯","🤩","😍","🥳","🌈","🎯"];
const CATEGORIES = ["すべて","グルメ","カフェ","宿泊","体験","観光","ショッピング"];
const CAT_EMOJI = { グルメ:"🍜", カフェ:"☕", 宿泊:"🏨", 体験:"🎨", 観光:"🗺", ショッピング:"🛍" };
const MY_CLR = "#6C63FF";
const CH_COLORS = ["#E8A87C","#7CB9E8","#7CE8B0","#E87CB9","#C8E87C"];
const MEMBER_COLORS = ["#6C63FF","#F4A261","#2A9D8F","#E87CB9","#C8E87C","#7CB9E8"];

// チャネルタイプ定義
const CH_TYPES = {
  memo:      { label: "メモ・スレッド", icon: "💬", desc: "行きたい場所やアイデアを自由に共有" },
  itinerary: { label: "計画・しおり",   icon: "🗓", desc: "日程と時間を決めて旅のしおりを作成" },
};

// ── 初期データ（空） ───────────────────────────────────────────
const EMPTY_CHANNELS = [];
const EMPTY_POSTS = {};

// ── チュートリアル用サンプルデータ ────────────────────────────
const DEMO_CHANNELS = [
  { id:"ch1", name:"🗾 東北旅行 2025夏",  members:["あなた","みく","たろう"],          color:"#E8A87C", type:"itinerary" },
  { id:"ch2", name:"🗼 東京デート",        members:["あなた","みく"],                   color:"#7CB9E8", type:"memo" },
];
const DEMO_POSTS = {
  ch1: [
    { id:"p1", author:"みく", avatar:"M", avatarColor:"#F4A261", title:"鳴子温泉 西多賀旅館", category:"宿泊", done:false,
      planDate:"2025-08-02", planTime:"15:00", hours:"IN 15:00 / OUT 10:00", closed:"不定休",
      reactions:{"❤️":["あなた","たろう"],"✈️":["あなた"]}, comments:[{id:"c1",author:"たろう",avatar:"T",avatarColor:"#2A9D8F",text:"露天風呂あるの？！行きたい！",time:"2時間前"}], time:"昨日" },
    { id:"p2", author:"たろう", avatar:"T", avatarColor:"#2A9D8F", title:"こけし工房 絵付け体験", category:"体験", done:true,
      planDate:"2025-08-03", planTime:"10:00", hours:"10:00〜16:00", closed:"水曜定休",
      reactions:{"🎨":["みく"]}, comments:[], time:"3日前" },
  ],
  ch2: [
    { id:"p4", author:"あなた", avatar:"A", avatarColor:"#6C63FF", title:"猿田彦珈琲 渋谷店", category:"カフェ", done:false,
      planDate:null, planTime:null, hours:"8:00〜22:00", closed:"無休",
      reactions:{"❤️":["みく"],"☕":["みく"]}, comments:[], time:"今日" },
  ],
};

// ── ユーティリティ ────────────────────────────────────────────
function calcDist(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  const d=R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  return d<1?`${Math.round(d*1000)}m`:`${d.toFixed(1)}km`;
}

function fmtDate(dateStr){
  if(!dateStr) return null;
  const d=new Date(dateStr);
  return `${d.getMonth()+1}/${d.getDate()}(${["日","月","火","水","木","金","土"][d.getDay()]})`;
}

// ── 共通コンポーネント ─────────────────────────────────────────
function Avt({i,c,s=32}){
  return <div style={{width:s,height:s,borderRadius:"50%",background:c,display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontWeight:800,fontSize:s*0.38,flexShrink:0}}>{i}</div>;
}

function ReactionBar({reactions,onReact}){
  const [showPicker,setShowPicker]=useState(false);
  const [customEmoji,setCustomEmoji]=useState("");
  const ref=useRef(null);
  useEffect(()=>{
    const h=(e)=>{ if(ref.current&&!ref.current.contains(e.target)) setShowPicker(false); };
    document.addEventListener("mousedown",h);
    return ()=>document.removeEventListener("mousedown",h);
  },[]);
  return(
    <div style={{padding:"0 10px 6px",display:"flex",gap:4,flexWrap:"wrap",alignItems:"center"}}>
      {Object.entries(reactions).map(([emoji,users])=>{
        const isMine=users.includes(ME);
        return(
          <button key={emoji} onClick={()=>onReact(emoji)} style={{background:isMine?"#6C63FF18":"#F5F0E8",border:`1px solid ${isMine?"#6C63FF55":"transparent"}`,borderRadius:20,padding:"4px 9px",cursor:"pointer",fontSize:13,color:isMine?"#6C63FF":"#555",fontWeight:isMine?700:400,display:"flex",alignItems:"center",gap:3}}>
            {emoji}{users.length>0&&<span style={{fontSize:10}}>{users.length}</span>}
          </button>
        );
      })}
      <div style={{position:"relative"}} ref={ref}>
        <button onClick={()=>setShowPicker(p=>!p)} style={{background:showPicker?"#1A1A2E":"#F0EEF8",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",color:showPicker?"white":"#888",fontSize:14,fontWeight:700,lineHeight:1}}>＋</button>
        {showPicker&&(
          <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:0,background:"white",borderRadius:14,padding:12,boxShadow:"0 8px 32px rgba(0,0,0,0.18)",zIndex:300,width:230}}>
            <div style={{fontSize:10,color:"#AAA",fontWeight:700,marginBottom:8,letterSpacing:1}}>よく使う絵文字</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:10}}>
              {EMOJI_CANDIDATES.map(e=>(
                <button key={e} onClick={()=>{onReact(e);setShowPicker(false);}} style={{background:"#F7F3EE",border:"none",borderRadius:8,padding:"5px 7px",cursor:"pointer",fontSize:17}}>{e}</button>
              ))}
            </div>
            <div style={{borderTop:"1px solid #F0EEF8",paddingTop:9}}>
              <div style={{fontSize:10,color:"#AAA",fontWeight:700,marginBottom:6}}>絵文字を直接入力</div>
              <div style={{display:"flex",gap:5}}>
                <input value={customEmoji} onChange={e=>setCustomEmoji(e.target.value)} placeholder="😊" maxLength={2} style={{flex:1,border:"1.5px solid #E8E0D5",borderRadius:8,padding:"6px 8px",fontSize:18,outline:"none",textAlign:"center"}}/>
                <button onClick={()=>{if(customEmoji.trim()){onReact(customEmoji.trim());setCustomEmoji("");setShowPicker(false);}}} style={{background:"#6C63FF",color:"white",border:"none",borderRadius:8,padding:"6px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>追加</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PostCard ──────────────────────────────────────────────────
function mapsUrl(title, location){
  if(location?.lat&&location?.lng)
    return `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(title)}`;
}

function PostCard({post,gps,expanded,onExpand,onToggleDone,onReact,onAddComment,onEditComment,onDeleteComment,onEdit,onDelete,isItinerary}){
  const [commentText,setCommentText]=useState("");
  const [editing,setEditing]=useState(false);
  const [editTitle,setEditTitle]=useState(post.title);
  const [editCat,setEditCat]=useState(post.category);
  const [editDate,setEditDate]=useState(post.planDate||"");
  const [editTime,setEditTime]=useState(post.planTime||"");
  const [editHours,setEditHours]=useState(post.hours||"");
  const [editClosed,setEditClosed]=useState(post.closed||"");
  const [showMenu,setShowMenu]=useState(false);
  const [editingComment,setEditingComment]=useState(null);
  const [editCommentText,setEditCommentText]=useState("");
  const dist=gps&&post.location?calcDist(gps.lat,gps.lng,post.location.lat,post.location.lng):null;
  const submitComment=()=>{ if(!commentText.trim()) return; onAddComment(post.id,commentText.trim()); setCommentText(""); };
  const submitEdit=()=>{ if(!editTitle.trim()) return; onEdit(post.id,editTitle.trim(),editCat,editDate||null,editTime||null,editHours||null,editClosed||null); setEditing(false); };
  const cancelEdit=()=>{ setEditing(false); setEditTitle(post.title); setEditCat(post.category); setEditHours(post.hours||""); setEditClosed(post.closed||""); };
  const startEditComment=(c)=>{ setEditingComment(c.id); setEditCommentText(c.text); };
  const submitEditComment=(cid)=>{ if(!editCommentText.trim()) return; onEditComment(post.id,cid,editCommentText.trim()); setEditingComment(null); };

  if(editing) return(
    <div style={{background:"white",borderRadius:14,marginBottom:10,padding:14,boxShadow:"0 1px 8px rgba(0,0,0,0.05)",border:"2px solid #6C63FF44"}}>
      <div style={{fontSize:11,color:"#6C63FF",fontWeight:700,marginBottom:10}}>✏️ 編集中</div>
      <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&submitEdit()} autoFocus
        placeholder="場所・お店名" style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"8px 12px",fontSize:13,outline:"none",marginBottom:10}}/>
      <div style={{display:"flex",gap:4,flexWrap:"wrap",marginBottom:10}}>
        {CATEGORIES.filter(c=>c!=="すべて").map(cat=>(
          <button key={cat} onClick={()=>setEditCat(cat)} style={{background:editCat===cat?"#1A1A2E":"#F5F0E8",color:editCat===cat?"white":"#888",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:editCat===cat?700:400}}>{CAT_EMOJI[cat]} {cat}</button>
        ))}
      </div>
      {isItinerary&&(
        <div style={{display:"flex",gap:8,marginBottom:10}}>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:4}}>📅 日付</div>
            <input type="date" value={editDate} onChange={e=>setEditDate(e.target.value)} style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:4}}>🕐 時刻</div>
            <input type="time" value={editTime} onChange={e=>setEditTime(e.target.value)} style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
          </div>
        </div>
      )}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:4}}>🕐 営業時間</div>
          <input value={editHours} onChange={e=>setEditHours(e.target.value)}
            placeholder="例: 10:00〜22:00" style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:4}}>🚫 定休日</div>
          <input value={editClosed} onChange={e=>setEditClosed(e.target.value)}
            placeholder="例: 水曜定休" style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
        </div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={cancelEdit} style={{flex:1,background:"#F5F0E8",color:"#888",border:"none",borderRadius:10,padding:"8px",cursor:"pointer",fontWeight:600,fontSize:12}}>キャンセル</button>
        <button onClick={submitEdit} style={{flex:2,background:"#6C63FF",color:"white",border:"none",borderRadius:10,padding:"8px",cursor:"pointer",fontWeight:700,fontSize:12}}>保存 ✓</button>
      </div>
    </div>
  );

  return(
    <div style={{background:"white",borderRadius:14,marginBottom:10,overflow:"visible",boxShadow:"0 1px 8px rgba(0,0,0,0.05)",border:post.done?"2px solid #2A9D8F30":"2px solid transparent",opacity:post.done?0.8:1}}>
      <div style={{padding:"14px 14px 6px",display:"flex",gap:10}}>
        <Avt i={post.avatar} c={post.avatarColor}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
            <span style={{fontWeight:700,fontSize:12,color:"#333"}}>{post.author}</span>
            <span style={{color:"#CCC",fontSize:10}}>{post.time}</span>
            <div style={{marginLeft:"auto",position:"relative"}}>
              <button onClick={()=>setShowMenu(p=>!p)} style={{background:"none",border:"none",cursor:"pointer",color:"#BBB",fontSize:18,padding:"0 4px",lineHeight:1}}>⋯</button>
              {showMenu&&(
                <div style={{position:"absolute",right:0,top:"100%",background:"white",borderRadius:10,boxShadow:"0 4px 20px rgba(0,0,0,0.15)",zIndex:100,overflow:"hidden",minWidth:110}}>
                  <button onClick={()=>{setEditing(true);setShowMenu(false);}} style={{width:"100%",background:"none",border:"none",padding:"10px 14px",cursor:"pointer",fontSize:12,color:"#333",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>✏️ 編集</button>
                  <button onClick={()=>{setShowMenu(false);onDelete(post.id);}} style={{width:"100%",background:"none",border:"none",padding:"10px 14px",cursor:"pointer",fontSize:12,color:"#E05",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>🗑 削除</button>
                </div>
              )}
            </div>
          </div>
          <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
            <button onClick={()=>onToggleDone(post.id)} style={{background:"none",border:"none",cursor:"pointer",padding:0,marginTop:2,flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:5,border:post.done?"none":"2px solid #DDD",background:post.done?"#2A9D8F":"white",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {post.done&&<span style={{color:"white",fontSize:11,fontWeight:800}}>✓</span>}
              </div>
            </button>
            <div style={{minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14,color:post.done?"#AAA":"#1A1A2E",textDecoration:post.done?"line-through":"none"}}>{post.title}</div>
              <div style={{display:"flex",gap:6,marginTop:4,flexWrap:"wrap",alignItems:"center"}}>
                <span style={{background:"#1A1A2E10",color:"#1A1A2E",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700}}>{CAT_EMOJI[post.category]||"📍"} {post.category}</span>
                {/* 日時バッジ (しおりモードのみ) */}
                {isItinerary&&post.planDate&&(
                  <span style={{background:"#6C63FF12",color:"#6C63FF",borderRadius:20,padding:"2px 9px",fontSize:10,fontWeight:700,display:"flex",alignItems:"center",gap:3}}>
                    📅 {fmtDate(post.planDate)}{post.planTime&&` ${post.planTime}`}
                  </span>
                )}
                {dist&&<span style={{fontSize:10,color:"#2A9D8F",fontWeight:600}}>📍 {dist}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {(post.hours||post.closed)&&(
        <div style={{padding:"0 14px 6px",display:"flex",gap:12,flexWrap:"wrap"}}>
          {post.hours&&<span style={{fontSize:10,color:"#888"}}>🕐 {post.hours}</span>}
          {post.closed&&<span style={{fontSize:10,color:"#E07"}}>🚫 {post.closed}</span>}
        </div>
      )}

      <ReactionBar reactions={post.reactions||{}} onReact={emoji=>onReact(post.id,emoji)}/>

      <div style={{padding:"0 10px 10px",display:"flex",gap:4,alignItems:"center"}}>
        <button onClick={()=>onExpand(post.id)} style={{background:expanded?"#6C63FF18":"#F5F0E8",border:`1px solid ${expanded?"#6C63FF55":"transparent"}`,borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:11,color:expanded?"#6C63FF":"#AAA",fontWeight:expanded?700:400,display:"flex",alignItems:"center",gap:3}}>
          💬{post.comments.length>0&&` ${post.comments.length}`}
        </button>
        <a href={mapsUrl(post.title,post.location)} target="_blank" rel="noopener noreferrer"
          style={{background:"#E8F4FE",border:"1px solid #4285F422",borderRadius:20,padding:"4px 10px",fontSize:10,color:"#4285F4",fontWeight:700,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#4285F4"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
          Google マップ
        </a>
      </div>

      {expanded&&(
        <div style={{borderTop:"1px solid #F5F0E8",background:"#FAFAF8"}}>
          {post.comments.map(c=>(
            <div key={c.id} style={{padding:"10px 14px",display:"flex",gap:8}}>
              <Avt i={c.avatar} c={c.avatarColor} s={26}/>
              <div style={{flex:1,minWidth:0}}>
                {editingComment===c.id?(
                  <div style={{background:"white",borderRadius:12,padding:"8px 12px",border:"1.5px solid #6C63FF44"}}>
                    <input value={editCommentText} onChange={e=>setEditCommentText(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter"&&!e.nativeEvent.isComposing)submitEditComment(c.id);if(e.key==="Escape")setEditingComment(null);}}
                      autoFocus style={{width:"100%",border:"none",outline:"none",fontSize:13,color:"#333",background:"transparent"}}/>
                    <div style={{display:"flex",gap:6,marginTop:6,justifyContent:"flex-end"}}>
                      <button onClick={()=>setEditingComment(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#AAA",fontWeight:600}}>キャンセル</button>
                      <button onClick={()=>submitEditComment(c.id)} style={{background:"#6C63FF",color:"white",border:"none",borderRadius:8,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:700}}>保存</button>
                    </div>
                  </div>
                ):(
                  <div style={{background:"white",borderRadius:12,padding:"7px 12px"}}>
                    <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:3}}>
                      <span style={{fontWeight:700,fontSize:11,color:"#333"}}>{c.author}</span>
                      <span style={{fontSize:9,color:"#CCC"}}>{c.time}</span>
                      {c.author===ME&&(
                        <div style={{marginLeft:"auto",display:"flex",gap:2}}>
                          <button onClick={()=>startEditComment(c)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#CCC",padding:"0 3px"}}>✏️</button>
                          <button onClick={()=>onDeleteComment(post.id,c.id)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:"#CCC",padding:"0 3px"}}>🗑</button>
                        </div>
                      )}
                    </div>
                    <span style={{fontSize:13,color:"#444"}}>{c.text}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div style={{padding:"8px 12px 12px",display:"flex",gap:6}}>
            <Avt i={MY_AVT} c={MY_CLR} s={26}/>
            <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&submitComment()} placeholder="コメントを追加..." style={{flex:1,border:"1.5px solid #E8E0D5",borderRadius:20,padding:"6px 14px",fontSize:12,outline:"none"}}/>
            <button onClick={submitComment} style={{background:"#6C63FF",color:"white",border:"none",borderRadius:20,padding:"6px 14px",fontSize:11,cursor:"pointer",fontWeight:700}}>送信</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── しおりモード: 日付グループヘッダー ──────────────────────────
function DateGroupHeader({dateStr, posts}){
  const done = posts.filter(p=>p.done).length;
  return(
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"18px 0 8px",padding:"0 2px"}}>
      <div style={{background:"#1A1A2E",color:"white",borderRadius:10,padding:"4px 12px",fontSize:12,fontWeight:900,flexShrink:0}}>
        📅 {fmtDate(dateStr)}
      </div>
      <div style={{flex:1,height:1,background:"#E8E0D5"}}/>
      <div style={{fontSize:10,color:"#AAA",fontWeight:600,flexShrink:0}}>{done}/{posts.length}</div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────
export default function App(){
  const [channels,setChannels]=useState(EMPTY_CHANNELS);
  const [posts,setPosts]=useState(EMPTY_POSTS);
  const [activeChannel,setActiveChannel]=useState(null);
  const [onboarding,setOnboarding]=useState(true);
  const [onboardingStep,setOnboardingStep]=useState(0);
  const [nickname,setNickname]=useState("");
  const [nicknameInput,setNicknameInput]=useState("");
  const [filterCat,setFilterCat]=useState("すべて");
  const [filterDone,setFilterDone]=useState("すべて");
  const [sortByDate,setSortByDate]=useState(true);
  const [expandedPost,setExpandedPost]=useState(null);
  const [gps,setGps]=useState(null);
  const [showNewPost,setShowNewPost]=useState(false);
  const [showNewCh,setShowNewCh]=useState(false);
  const [newPost,setNewPost]=useState({title:"",category:"グルメ",planDate:"",planTime:"",hours:"",closed:""});
  const [newCh,setNewCh]=useState({name:"",type:"memo"});
  const [showChSettings,setShowChSettings]=useState(null);
  const [editCh,setEditCh]=useState({name:"",type:"memo",color:""});
  const [showDeleteConfirm,setShowDeleteConfirm]=useState(false);
  const [showInvite,setShowInvite]=useState(false);
  const [copiedLink,setCopiedLink]=useState(false);
  const [showSidebar,setShowSidebar]=useState(false);
  const [joinInvite,setJoinInvite]=useState(null); // 招待参加モーダル用
  const [loaded,setLoaded]=useState(false);

  // ── Supabaseからデータ読み込み + リアルタイム購読 ──
  useEffect(()=>{
    // URLの招待パラメータチェック
    try {
      const params=new URLSearchParams(window.location.search);
      const joinParam=params.get("join");
      if(joinParam){
        const ch=JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(joinParam)))));
        setJoinInvite(ch);
        window.history.replaceState({},"",window.location.pathname);
      }
    } catch(e){}

    navigator.geolocation?.getCurrentPosition(p=>setGps({lat:p.coords.latitude,lng:p.coords.longitude}));

    // ニックネームをlocalStorageから読み込み
    const savedNick=localStorage.getItem("tabikura_nickname");
    if(savedNick) setNickname(savedNick);

    // 初回データ読み込み
    const loadData=async()=>{
      const {data:chs}=await supabase.from("channels").select("*").order("created_at");
      const {data:ps}=await supabase.from("posts").select("*").order("created_at");
      if(chs?.length){
        const myName=localStorage.getItem("tabikura_nickname")||"あなた"; const chList=chs.filter(c=>(c.members||[]).includes(myName)).map(c=>({id:c.id,name:c.name,color:c.color,type:c.type,members:c.members||[]}));
        setChannels(chList);
        setActiveChannel(chList[0].id);
        setOnboarding(false);
      }
      if(ps?.length){
        const postMap={};
        ps.forEach(p=>{
          if(!postMap[p.channel_id]) postMap[p.channel_id]=[];
          postMap[p.channel_id].push({
            id:p.id,author:p.author,avatar:p.avatar,avatarColor:p.avatar_color,
            title:p.title,category:p.category,done:p.done,
            planDate:p.plan_date,planTime:p.plan_time,
            location:p.location,hours:p.hours,closed:p.closed,
            reactions:p.reactions||{},comments:p.comments||[],time:p.time
          });
        });
        setPosts(postMap);
      }
      setLoaded(true);
    };
    loadData();

    // リアルタイム購読
    const chSub=supabase.channel("channels_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"channels"},()=>loadData())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"channels"},()=>loadData())
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"channels"},()=>loadData())
      .subscribe();
    const pSub=supabase.channel("posts_rt")
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"posts"},()=>loadData())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"posts"},()=>loadData())
      .on("postgres_changes",{event:"DELETE",schema:"public",table:"posts"},()=>loadData())
      .subscribe();

    return()=>{ supabase.removeChannel(chSub); supabase.removeChannel(pSub); };
  },[]);

  // ── 招待リンク生成 ──
  const getInviteUrl=(chId)=>{
    const ch=channels.find(c=>c.id===chId);
    if(!ch) return "";
    const data={id:ch.id,name:ch.name,color:ch.color,type:ch.type};
    const encoded=encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(data)))));
    return `${window.location.origin}?join=${encoded}`;
  };

  const finishOnboarding=()=>{ setOnboarding(false); };

  // ニックネーム確定
  const confirmNickname=()=>{
    const name=nicknameInput.trim();
    if(!name) return;
    setNickname(name);
    localStorage.setItem("tabikura_nickname",name);
    setOnboarding(false);
  };

  // SSR対策：ローカルストレージ読み込み前は何も表示しない
  if(!loaded) return null;

  const ME=nickname||"あなた";
  const MY_AVT=ME[0].toUpperCase();

  const ch=channels.find(c=>c.id===activeChannel);
  const isItinerary=ch?.type==="itinerary";
  const allPosts=posts[activeChannel]||[];
  const doneCount=allPosts.filter(p=>p.done).length;

  // フィルタリング
  let filtered=allPosts.filter(p=>{
    if(filterCat!=="すべて"&&p.category!==filterCat) return false;
    if(filterDone==="未完了"&&p.done) return false;
    if(filterDone==="完了"&&!p.done) return false;
    return true;
  });

  // しおりモードの日付順ソート
  if(isItinerary&&sortByDate){
    filtered=[...filtered].sort((a,b)=>{
      const da=(a.planDate||"9999")+(a.planTime||"99:99");
      const db=(b.planDate||"9999")+(b.planTime||"99:99");
      return da.localeCompare(db);
    });
  }

  // しおりモード: 日付グループ化
  const grouped=isItinerary&&sortByDate ? (() => {
    const map={};
    filtered.forEach(p=>{
      const key=p.planDate||"__nodate__";
      if(!map[key]) map[key]=[];
      map[key].push(p);
    });
    return map;
  })() : null;

  // ── ハンドラー（楽観的更新 + Supabase書き込み） ──
  const toggleDone=async(id)=>{
    const post=posts[activeChannel]?.find(p=>p.id===id);
    if(!post) return;
    // すぐにUI更新
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].map(x=>x.id===id?{...x,done:!x.done}:x)}));
    await supabase.from("posts").update({done:!post.done}).eq("id",id);
  };

  const toggleReaction=async(id,emoji)=>{
    const post=posts[activeChannel]?.find(p=>p.id===id);
    if(!post) return;
    const cur={...(post.reactions||{})};
    const users=cur[emoji]||[];
    const hasMe=users.includes(ME);
    const nu=hasMe?users.filter(u=>u!==ME):[...users,ME];
    if(nu.length===0) delete cur[emoji]; else cur[emoji]=nu;
    // すぐにUI更新
    setPosts(prev=>({...prev,[activeChannel]:prev[activeChannel].map(p=>p.id===id?{...p,reactions:cur}:p)}));
    await supabase.from("posts").update({reactions:cur}).eq("id",id);
  };

  const addComment=async(id,text)=>{
    const post=posts[activeChannel]?.find(p=>p.id===id);
    if(!post) return;
    const newComments=[...post.comments,{id:"c"+Date.now(),author:ME,avatar:MY_AVT,avatarColor:MY_CLR,text,time:"今"}];
    // すぐにUI更新
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].map(x=>x.id===id?{...x,comments:newComments}:x)}));
    await supabase.from("posts").update({comments:newComments}).eq("id",id);
  };

  const editComment=async(postId,cid,text)=>{
    const post=posts[activeChannel]?.find(p=>p.id===postId);
    if(!post) return;
    const newComments=post.comments.map(c=>c.id!==cid?c:{...c,text,time:"今(編集済み)"});
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].map(x=>x.id!==postId?x:{...x,comments:newComments})}));
    await supabase.from("posts").update({comments:newComments}).eq("id",postId);
  };

  const deleteComment=async(postId,cid)=>{
    const post=posts[activeChannel]?.find(p=>p.id===postId);
    if(!post) return;
    const newComments=post.comments.filter(c=>c.id!==cid);
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].map(x=>x.id!==postId?x:{...x,comments:newComments})}));
    await supabase.from("posts").update({comments:newComments}).eq("id",postId);
  };

  const editPost=async(id,title,category,planDate,planTime,hours,closed)=>{
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].map(x=>x.id!==id?x:{...x,title,category,planDate:planDate||null,planTime:planTime||null,hours:hours||null,closed:closed||null})}));
    await supabase.from("posts").update({title,category,plan_date:planDate||null,plan_time:planTime||null,hours:hours||null,closed:closed||null}).eq("id",id);
  };

  const deletePost=async(id)=>{
    setPosts(p=>({...p,[activeChannel]:p[activeChannel].filter(x=>x.id!==id)}));
    await supabase.from("posts").delete().eq("id",id);
  };

  const addPost=async()=>{
    if(!newPost.title.trim()) return;
    const id="p"+Date.now();
    const post={id,author:ME,avatar:MY_AVT,avatarColor:MY_CLR,title:newPost.title,category:newPost.category,done:false,
      planDate:newPost.planDate||null,planTime:newPost.planTime||null,
      location:null,hours:newPost.hours||null,closed:newPost.closed||null,reactions:{},comments:[],time:"今"};
    // すぐにUI更新
    setPosts(p=>({...p,[activeChannel]:[post,...(p[activeChannel]||[])]}));
    setNewPost({title:"",category:"グルメ",planDate:"",planTime:"",hours:"",closed:""});
    setShowNewPost(false);
    await supabase.from("posts").insert({
      id,channel_id:activeChannel,author:ME,avatar:MY_AVT,avatar_color:MY_CLR,
      title:post.title,category:post.category,done:false,
      plan_date:post.planDate,plan_time:post.planTime,
      location:null,hours:post.hours,closed:post.closed,
      reactions:{},comments:[],time:"今"
    });
  };

  const addChannel=async()=>{
    if(!newCh.name.trim()) return;
    const id="ch"+Date.now();
    const color=CH_COLORS[Math.floor(Math.random()*CH_COLORS.length)];
    const newChannel={id,name:newCh.name,members:[ME],color,type:newCh.type};
    // すぐにUI更新
    setChannels(p=>[...p,newChannel]);
    setPosts(p=>({...p,[id]:[]}));
    setActiveChannel(id);
    setNewCh({name:"",type:"memo"});
    setShowNewCh(false);
    if(onboarding) setOnboarding(false);
    await supabase.from("channels").insert({id,name:newCh.name,members:[ME],color,type:newCh.type});
  };

  const openChSettings=(c)=>{ setEditCh({name:c.name,type:c.type||"memo",color:c.color}); setShowDeleteConfirm(false); setShowChSettings(c.id); };
  const saveChSettings=async()=>{
    setChannels(p=>p.map(c=>c.id===showChSettings?{...c,name:editCh.name,type:editCh.type,color:editCh.color}:c));
    setShowChSettings(null);
    await supabase.from("channels").update({name:editCh.name,type:editCh.type,color:editCh.color}).eq("id",showChSettings);
  };
  const deleteChannel=async()=>{
    const remaining=channels.filter(c=>c.id!==showChSettings);
    setChannels(remaining);
    if(activeChannel===showChSettings) setActiveChannel(remaining[0]?.id||null);
    setShowChSettings(null);
    await supabase.from("channels").delete().eq("id",showChSettings);
  };

  const removeMember=async(name)=>{
    const ch=channels.find(c=>c.id===activeChannel);
    if(!ch) return;
    const newMembers=ch.members.filter(x=>x!==name);
    setChannels(p=>p.map(c=>c.id===activeChannel?{...c,members:newMembers}:c));
    await supabase.from("channels").update({members:newMembers}).eq("id",activeChannel);
  };

  const acceptJoinInvite=async()=>{
    if(!joinInvite) return;
    const {data:existing}=await supabase.from("channels").select("*").eq("id",joinInvite.id).single();
    if(existing){
      const newMembers=existing.members.includes(ME)?existing.members:[...existing.members,ME];
      await supabase.from("channels").update({members:newMembers}).eq("id",joinInvite.id);
    } else {
      await supabase.from("channels").insert({id:joinInvite.id,name:joinInvite.name,color:joinInvite.color,type:joinInvite.type,members:[ME]});
    }
    setActiveChannel(joinInvite.id);
    if(onboarding) setOnboarding(false);
    setJoinInvite(null);
  };
  const renderCard=(post,idx)=>(
    <PostCard key={post.id} post={post} idx={idx} gps={gps}
      expanded={expandedPost===post.id}
      onExpand={id=>setExpandedPost(p=>p===id?null:id)}
      onToggleDone={toggleDone} onReact={toggleReaction}
      onAddComment={addComment} onEditComment={editComment} onDeleteComment={deleteComment}
      onEdit={editPost} onDelete={deletePost}
      isItinerary={isItinerary}/>
  );

  // ── オンボーディング画面 ──
  const STEPS = [
    { icon:"🗺", title:"Tabikuraへようこそ！", desc:"行きたい場所ややりたいことを\n友だちと一緒にまとめられるアプリです。" },
    { icon:"💬", title:"チャネルで旅行ごとに整理", desc:"「東北旅行」「東京デート」など\n旅行グループごとにチャネルを作れます。" },
    { icon:"🗓", title:"しおりモードで日程管理", desc:"計画・しおりモードなら日付と時間を\n設定して時系列で並べられます。" },
    { icon:"👤", title:"ニックネームを設定", desc:"投稿に表示される名前を\n設定しましょう！" },
  ];

  if(onboarding) return(
    <div style={{height:"100vh",background:"#18172B",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",padding:24}}>
      <style>{`*{box-sizing:border-box;margin:0;padding:0;}button,input{font-family:inherit;}`}</style>

      {/* ロゴ */}
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:40}}>
        <div style={{width:48,height:48,borderRadius:16,background:"linear-gradient(135deg,#6C63FF,#F4A261)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>🗺</div>
        <div>
          <div style={{color:"white",fontWeight:900,fontSize:24}}>Tabikura</div>
          <div style={{color:"#6660A0",fontSize:12}}>行きたいをまとめよう</div>
        </div>
      </div>

      {/* ステップカード */}
      <div style={{background:"#22203A",borderRadius:24,padding:"28px 24px",width:"100%",maxWidth:360,marginBottom:28,minHeight:160,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <div style={{fontSize:52,marginBottom:14}}>{STEPS[onboardingStep].icon}</div>
        <div style={{color:"white",fontWeight:900,fontSize:18,marginBottom:10}}>{STEPS[onboardingStep].title}</div>
        <div style={{color:"#8884AA",fontSize:13,lineHeight:1.7,whiteSpace:"pre-line"}}>{STEPS[onboardingStep].desc}</div>
        {/* ニックネーム入力（最後のステップ） */}
        {onboardingStep===STEPS.length-1&&(
          <input
            value={nicknameInput}
            onChange={e=>setNicknameInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&confirmNickname()}
            placeholder="例：たろう、Miku..."
            autoFocus
            maxLength={12}
            style={{marginTop:16,width:"100%",background:"#18172B",border:"2px solid #6C63FF55",borderRadius:12,padding:"12px 14px",color:"white",fontSize:15,outline:"none",textAlign:"center"}}
          />
        )}
      </div>

      {/* ドット */}
      <div style={{display:"flex",gap:6,marginBottom:28}}>
        {STEPS.map((_,i)=>(
          <div key={i} style={{width:i===onboardingStep?20:6,height:6,borderRadius:3,background:i===onboardingStep?"#6C63FF":"#2A2940",transition:"width 0.2s"}}/>
        ))}
      </div>

      {/* ボタン */}
      {onboardingStep < STEPS.length-1 ? (
        <div style={{display:"flex",gap:10,width:"100%",maxWidth:360}}>
          <button onClick={()=>setOnboardingStep(STEPS.length-1)} style={{flex:1,background:"transparent",border:"1px solid #2A2940",borderRadius:14,padding:"13px",color:"#6660A0",cursor:"pointer",fontWeight:600,fontSize:13}}>スキップ</button>
          <button onClick={()=>setOnboardingStep(s=>s+1)} style={{flex:2,background:"#6C63FF",border:"none",borderRadius:14,padding:"13px",color:"white",cursor:"pointer",fontWeight:700,fontSize:14,boxShadow:"0 4px 20px #6C63FF44"}}>次へ →</button>
        </div>
      ):(
        <button onClick={confirmNickname} disabled={!nicknameInput.trim()} style={{width:"100%",maxWidth:360,background:nicknameInput.trim()?"linear-gradient(135deg,#6C63FF,#F4A261)":"#2A2940",border:"none",borderRadius:14,padding:"15px",color:nicknameInput.trim()?"white":"#4A4870",cursor:nicknameInput.trim()?"pointer":"default",fontWeight:900,fontSize:15,boxShadow:nicknameInput.trim()?"0 4px 20px #6C63FF44":"none",transition:"all 0.2s"}}>
          🎉 はじめる！
        </button>
      )}
    </div>
  );

  return(
    <div style={{display:"flex",height:"100vh",background:"#F7F3EE",fontFamily:"'Hiragino Sans','Noto Sans JP',sans-serif",overflow:"hidden"}}>
      <style>{`
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;}
        ::-webkit-scrollbar-thumb{background:#ddd;border-radius:3px;}
        button,input{font-family:inherit;}
        .sidebar{width:220px;background:#18172B;display:flex;flex-direction:column;flex-shrink:0;transition:transform 0.25s ease;}
        .sidebar-overlay{display:none;}
        @media(min-width:641px){
          .hamburger{display:none !important;}
        }
        @media(max-width:640px){
          .sidebar{position:fixed;top:0;left:0;height:100vh;z-index:500;transform:translateX(-100%);}
          .sidebar.open{transform:translateX(0);}
          .sidebar-overlay{display:block;position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:499;}
          .header-badge{display:none;}
          .header-members{display:none;}
          .progress-bar{display:none;}
        }
      `}</style>

      {/* モバイル時のオーバーレイ */}
      {showSidebar&&<div className="sidebar-overlay" onClick={()=>setShowSidebar(false)}/>}

      {/* ── SIDEBAR ── */}
      <div className={`sidebar${showSidebar?" open":""}`} style={{display:"flex",flexDirection:"column",height:"100%"}}>
        <div style={{padding:"16px 14px",flex:1,overflowY:"auto",minHeight:0,minHeight:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
            <div style={{width:32,height:32,borderRadius:10,background:"linear-gradient(135deg,#6C63FF,#F4A261)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16}}>🗺</div>
            <div style={{flex:1}}>
              <div style={{color:"white",fontWeight:900,fontSize:14}}>Tabikura</div>
              <div style={{color:"#6660A0",fontSize:9}}>行きたいをまとめよう</div>
            </div>
            {/* モバイル閉じるボタン */}
            <button onClick={()=>setShowSidebar(false)} style={{background:"none",border:"none",color:"#4A4870",fontSize:20,cursor:"pointer",lineHeight:1,padding:"0 2px"}}>×</button>
          </div>
          <div style={{background:"#22203A",borderRadius:8,padding:"5px 10px",marginBottom:12,display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:gps?"#2A9D8F":"#555"}}/>
            <div style={{color:gps?"#2A9D8F":"#555",fontSize:10,fontWeight:600}}>{gps?"現在地 取得済み":"現在地 取得中..."}</div>
          </div>
          <div style={{color:"#4A4870",fontSize:9,fontWeight:700,letterSpacing:1.5,marginBottom:6}}>CHANNELS</div>
          {channels.map(c=>(
            <div key={c.id} style={{position:"relative",marginBottom:2}} className="ch-row">
              <button onClick={()=>{setActiveChannel(c.id);setShowSidebar(false);}} style={{width:"100%",background:activeChannel===c.id?"#2A2940":"transparent",border:"none",borderRadius:8,padding:"7px 10px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,textAlign:"left",paddingRight:28}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{color:activeChannel===c.id?"white":"#8884AA",fontSize:11,fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                  <div style={{color:"#4A4870",fontSize:9,display:"flex",alignItems:"center",gap:4,marginTop:1}}>
                    <span>{CH_TYPES[c.type||"memo"].icon}</span>
                    <span>{CH_TYPES[c.type||"memo"].label}</span>
                  </div>
                </div>
                <div style={{background:"#2A2940",color:"#6660A0",fontSize:10,borderRadius:10,padding:"1px 5px",flexShrink:0}}>{(posts[c.id]||[]).length}</div>
              </button>
              <button onClick={e=>{e.stopPropagation();openChSettings(c);}} title="設定" style={{position:"absolute",right:4,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#4A4870",fontSize:12,padding:"3px 4px",lineHeight:1,borderRadius:6,opacity:0.7}}>⚙️</button>
            </div>
          ))}

          {showNewCh?(
            <div style={{background:"#22203A",borderRadius:10,padding:10,marginTop:4}}>
              <input value={newCh.name} onChange={e=>setNewCh(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&addChannel()}
                placeholder="チャネル名..." autoFocus style={{width:"100%",background:"#18172B",border:"none",borderRadius:6,padding:"6px 8px",color:"white",fontSize:11,outline:"none",marginBottom:8}}/>
              {/* タイプ選択 */}
              <div style={{display:"flex",gap:5,marginBottom:8}}>
                {Object.entries(CH_TYPES).map(([key,val])=>(
                  <button key={key} onClick={()=>setNewCh(p=>({...p,type:key}))} style={{flex:1,background:newCh.type===key?"#6C63FF":"#18172B",color:newCh.type===key?"white":"#6660A0",border:`1px solid ${newCh.type===key?"#6C63FF":"#2A2940"}`,borderRadius:8,padding:"6px 4px",cursor:"pointer",fontSize:10,fontWeight:700,textAlign:"center"}}>
                    {val.icon}<div style={{fontSize:9,marginTop:2}}>{val.label}</div>
                  </button>
                ))}
              </div>
              <div style={{display:"flex",gap:4}}>
                <button onClick={addChannel} style={{flex:1,background:"#6C63FF",color:"white",border:"none",borderRadius:6,padding:"5px 0",fontSize:11,cursor:"pointer",fontWeight:700}}>作成</button>
                <button onClick={()=>setShowNewCh(false)} style={{background:"#333",color:"#888",border:"none",borderRadius:6,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>×</button>
              </div>
            </div>
          ):(
            <button onClick={()=>setShowNewCh(true)} style={{width:"100%",background:"transparent",border:"1px dashed #2A2940",borderRadius:8,padding:"6px",color:"#4A4870",cursor:"pointer",fontSize:11,marginTop:4}}>＋ 新しいチャネル</button>
          )}
        </div>
        <div style={{padding:"10px 14px",borderTop:"1px solid #22203A",display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
          <Avt i={MY_AVT} c={MY_CLR} s={26}/>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:"white",fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ME}</div>
            <div style={{color:"#4A4870",fontSize:9}}>オーナー</div>
          </div>
          <button onClick={()=>{const n=prompt("ニックネームを変更",ME);if(n?.trim()){setNickname(n.trim());localStorage.setItem("tabikura_nickname",n.trim());}}} style={{background:"none",border:"none",cursor:"pointer",color:"#4A4870",fontSize:11,padding:"3px 5px",borderRadius:6}}>✏️</button>
        </div>
      </div>

      {/* ── MAIN ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* ヘッダー */}
        <div style={{background:"white",borderBottom:"1px solid #EDE8E0",padding:"10px 12px",display:"flex",alignItems:"center",gap:8}}>
          {/* ハンバーガー（モバイルのみ表示） */}
          <button onClick={()=>setShowSidebar(true)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px 6px",borderRadius:8,color:"#555",fontSize:20,lineHeight:1,flexShrink:0}} className="hamburger">
            ☰
          </button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
              <div style={{fontWeight:900,fontSize:15,color:"#1A1A2E",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} className="header-title">{ch?.name}</div>
              <span style={{background:isItinerary?"#6C63FF12":"#F4A26120",color:isItinerary?"#6C63FF":"#F4A261",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,flexShrink:0}} className="header-badge">
                {ch&&CH_TYPES[ch.type||"memo"].icon} {ch&&CH_TYPES[ch.type||"memo"].label}
              </span>
            </div>
            <div style={{fontSize:10,color:"#AAA",marginTop:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}} className="header-members">{ch?.members.join(" · ")} · {doneCount}/{allPosts.length} 完了</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:4,flexShrink:0}} className="progress-bar">
            <div style={{fontSize:11,color:"#2A9D8F",fontWeight:700}}>{allPosts.length?Math.round(doneCount/allPosts.length*100):0}%</div>
            <div style={{width:40,height:4,background:"#EEE",borderRadius:3,overflow:"hidden"}}>
              <div style={{width:`${allPosts.length?doneCount/allPosts.length*100:0}%`,height:"100%",background:"#2A9D8F",borderRadius:3}}/>
            </div>
          </div>
          <button onClick={()=>setShowInvite(true)} style={{background:"#F5F0E8",color:"#555",border:"none",borderRadius:10,padding:"7px 10px",cursor:"pointer",fontWeight:700,fontSize:11,flexShrink:0}}>👤＋</button>
          <button onClick={()=>setShowNewPost(true)} style={{background:"#6C63FF",color:"white",border:"none",borderRadius:10,padding:"7px 12px",cursor:"pointer",fontWeight:700,fontSize:12,boxShadow:"0 4px 12px #6C63FF44",flexShrink:0}}>＋ 追加</button>
        </div>

        {/* フィルターバー */}
        <div style={{background:"white",borderBottom:"1px solid #EDE8E0",padding:"6px 16px",display:"flex",gap:4,overflowX:"auto",alignItems:"center"}}>
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setFilterCat(cat)} style={{background:filterCat===cat?"#1A1A2E":"#F5F0E8",color:filterCat===cat?"white":"#888",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:filterCat===cat?700:400,whiteSpace:"nowrap"}}>{cat!=="すべて"&&CAT_EMOJI[cat]+" "}{cat}</button>
          ))}
          <div style={{width:1,height:16,background:"#EDE8E0",flexShrink:0,margin:"0 3px"}}/>
          {[["すべて","#888"],["未完了","#F4A261"],["完了","#2A9D8F"]].map(([f,col])=>(
            <button key={f} onClick={()=>setFilterDone(f)} style={{background:filterDone===f?col:"#F5F0E8",color:filterDone===f?"white":"#888",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:filterDone===f?700:400,whiteSpace:"nowrap"}}>{f==="完了"?"✓ ":""}{f}</button>
          ))}
          {/* しおりモードのみ: 日時ソートトグル */}
          {isItinerary&&(
            <>
              <div style={{width:1,height:16,background:"#EDE8E0",flexShrink:0,margin:"0 3px"}}/>
              <button onClick={()=>setSortByDate(p=>!p)} style={{background:sortByDate?"#1A1A2E":"#F5F0E8",color:sortByDate?"white":"#888",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:sortByDate?700:400,whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:3}}>
                🗓 {sortByDate?"日時順":"追加順"}
              </button>
            </>
          )}
        </div>

        {/* 投稿リスト */}
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
          {!activeChannel?(
            <div style={{textAlign:"center",padding:"80px 20px",color:"#CCC"}}>
              <div style={{fontSize:56,marginBottom:12}}>🗺</div>
              <div style={{fontWeight:700,fontSize:16,marginBottom:6,color:"#AAA"}}>チャネルを作ってはじめよう</div>
              <div style={{fontSize:12,marginBottom:20}}>左のメニューから「＋ 新しいチャネル」をタップ</div>
              <button onClick={()=>{setShowSidebar(true);setShowNewCh(true);}} style={{background:"#6C63FF",color:"white",border:"none",borderRadius:14,padding:"12px 24px",cursor:"pointer",fontWeight:700,fontSize:13,boxShadow:"0 4px 16px #6C63FF44"}}>＋ 最初のチャネルを作る</button>
            </div>
          ) : filtered.length===0?(
            <div style={{textAlign:"center",padding:"60px 20px",color:"#CCC"}}>
              <div style={{fontSize:48,marginBottom:10}}>{isItinerary?"🗓":"💬"}</div>
              <div style={{fontWeight:700,fontSize:14,marginBottom:4,color:"#AAA"}}>まだ投稿がありません</div>
              <div style={{fontSize:12}}>「＋ 追加」から{isItinerary?"予定":"行きたい場所"}を追加しよう！</div>
            </div>
          ) : grouped ? (
            // しおりモード: 日付グループ表示
            Object.entries(grouped).map(([dateKey,groupPosts])=>(
              <div key={dateKey}>
                <DateGroupHeader dateStr={dateKey==="__nodate__"?null:dateKey} posts={groupPosts}/>
                {dateKey==="__nodate__"&&(
                  <div style={{fontSize:11,color:"#AAA",marginBottom:8,paddingLeft:2}}>📌 日付未設定</div>
                )}
                {groupPosts.map((post,idx)=>renderCard(post,idx))}
              </div>
            ))
          ) : (
            filtered.map((post,idx)=>renderCard(post,idx))
          )}        </div>
      </div>

      {/* ── 新規投稿モーダル ── */}
      {showNewPost&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}}>
          <div style={{background:"white",borderRadius:20,padding:22,width:"100%",maxWidth:380,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}}>
            <div style={{fontWeight:900,fontSize:16,marginBottom:16,color:"#1A1A2E"}}>
              {isItinerary?"🗓 予定を追加":"💬 場所を追加"}
            </div>
            <div style={{marginBottom:12}}>
              <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:5}}>場所・お店名</div>
              <input value={newPost.title} onChange={e=>setNewPost(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&!e.nativeEvent.isComposing&&addPost()}
                placeholder="例: 猿田彦珈琲 渋谷店" autoFocus style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"9px 12px",fontSize:13,outline:"none"}}/>
            </div>
            <div style={{marginBottom:isItinerary?10:16}}>
              <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:6}}>カテゴリ</div>
              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                {CATEGORIES.filter(c=>c!=="すべて").map(cat=>(
                  <button key={cat} onClick={()=>setNewPost(p=>({...p,category:cat}))} style={{background:newPost.category===cat?"#1A1A2E":"#F5F0E8",color:newPost.category===cat?"white":"#888",border:"none",borderRadius:20,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:newPost.category===cat?700:400}}>{CAT_EMOJI[cat]} {cat}</button>
                ))}
              </div>
            </div>

            {/* しおりモードのみ: 日付・時刻入力 */}
            {isItinerary&&(
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:6}}>日程・時刻（任意）</div>
                <div style={{display:"flex",gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:"#BBB",marginBottom:3}}>📅 日付</div>
                    <input type="date" value={newPost.planDate} onChange={e=>setNewPost(p=>({...p,planDate:e.target.value}))}
                      style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:9,color:"#BBB",marginBottom:3}}>🕐 時刻</div>
                    <input type="time" value={newPost.planTime} onChange={e=>setNewPost(p=>({...p,planTime:e.target.value}))}
                      style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"7px 10px",fontSize:12,outline:"none"}}/>
                  </div>
                </div>
              </div>
            )}

            <div style={{display:"flex",gap:8,marginBottom:14}}>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:5}}>🕐 営業時間（任意）</div>
                <input value={newPost.hours} onChange={e=>setNewPost(p=>({...p,hours:e.target.value}))}
                  placeholder="例: 10:00〜22:00" style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"8px 10px",fontSize:12,outline:"none"}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:10,color:"#AAA",fontWeight:600,marginBottom:5}}>🚫 定休日（任意）</div>
                <input value={newPost.closed} onChange={e=>setNewPost(p=>({...p,closed:e.target.value}))}
                  placeholder="例: 水曜定休" style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:10,padding:"8px 10px",fontSize:12,outline:"none"}}/>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowNewPost(false)} style={{flex:1,background:"#F5F0E8",color:"#888",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontWeight:600}}>キャンセル</button>
              <button onClick={addPost} style={{flex:2,background:"#6C63FF",color:"white",border:"none",borderRadius:10,padding:"10px",cursor:"pointer",fontWeight:700,fontSize:12,boxShadow:"0 4px 12px #6C63FF44"}}>追加する</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 招待モーダル ── */}
      {showInvite&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:20}} onClick={()=>setShowInvite(false)}>
          <div style={{background:"white",borderRadius:24,width:"100%",maxWidth:400,boxShadow:"0 24px 60px rgba(0,0,0,0.25)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
            <div style={{padding:"22px 22px 0"}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:18}}>
                <div style={{width:36,height:36,borderRadius:12,background:"linear-gradient(135deg,#6C63FF,#F4A261)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🔗</div>
                <div style={{flex:1}}>
                  <div style={{fontWeight:900,fontSize:16,color:"#1A1A2E"}}>招待リンク</div>
                  <div style={{fontSize:11,color:"#AAA"}}>{ch?.name}</div>
                </div>
                <button onClick={()=>setShowInvite(false)} style={{background:"none",border:"none",cursor:"pointer",color:"#CCC",fontSize:22,lineHeight:1}}>×</button>
              </div>
            </div>
            <div style={{padding:"0 22px 24px"}}>
              <div style={{fontSize:12,color:"#555",lineHeight:1.7,marginBottom:16}}>
                このリンクを友だちに送ると、相手のTabikuraに「<strong>{ch?.name}</strong>」が追加されます。
              </div>

              {/* リンク表示 */}
              <div style={{background:"#F7F3EE",borderRadius:14,padding:"12px 14px",marginBottom:10}}>
                <div style={{fontSize:10,color:"#AAA",fontWeight:700,marginBottom:6,letterSpacing:1}}>招待リンク</div>
                <div style={{fontSize:11,color:"#555",wordBreak:"break-all",lineHeight:1.5,marginBottom:10}}>
                  {activeChannel?getInviteUrl(activeChannel):""}
                </div>
                <button onClick={()=>{
                  const url=getInviteUrl(activeChannel);
                  if(navigator.share){
                    navigator.share({title:`Tabikura: ${ch?.name}`,text:`「${ch?.name}」に招待されました！`,url});
                  } else {
                    navigator.clipboard?.writeText(url).then(()=>{setCopiedLink(true);setTimeout(()=>setCopiedLink(false),2000);});
                  }
                }} style={{width:"100%",background:copiedLink?"#2A9D8F":"#6C63FF",color:"white",border:"none",borderRadius:10,padding:"12px",cursor:"pointer",fontWeight:700,fontSize:13,transition:"background 0.2s"}}>
                  {copiedLink?"✓ コピーしました！":navigator.share?"📤 シェアする":"📋 リンクをコピー"}
                </button>
              </div>

              {/* メンバー一覧 */}
              <div style={{marginTop:16}}>
                <div style={{fontSize:10,color:"#AAA",fontWeight:700,marginBottom:8,letterSpacing:1}}>参加中 {ch?.members.length}人</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                  {ch?.members.map((m,i)=>(
                    <div key={m} style={{display:"flex",alignItems:"center",gap:6,background:"#F7F3EE",borderRadius:20,padding:"5px 10px 5px 5px"}}>
                      <div style={{width:24,height:24,borderRadius:"50%",background:MEMBER_COLORS[i%MEMBER_COLORS.length],display:"flex",alignItems:"center",justifyContent:"center",color:"white",fontSize:10,fontWeight:800}}>{m[0].toUpperCase()}</div>
                      <div style={{fontSize:11,fontWeight:700,color:"#1A1A2E"}}>{m}{m===ME&&<span style={{fontSize:9,color:"#6C63FF",marginLeft:3}}>あなた</span>}</div>
                      {m!==ME&&<button onClick={()=>removeMember(m)} style={{background:"none",border:"none",cursor:"pointer",color:"#CCC",fontSize:12,padding:"0 2px",lineHeight:1}}>×</button>}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{fontSize:10,color:"#BBB",marginTop:12,lineHeight:1.6}}>⚠️ このリンクを知っている人は誰でも参加できます。</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 招待参加モーダル ── */}
      {joinInvite&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:20}}>
          <div style={{background:"white",borderRadius:24,width:"100%",maxWidth:360,padding:28,boxShadow:"0 24px 60px rgba(0,0,0,0.3)",textAlign:"center"}}>
            <div style={{width:64,height:64,borderRadius:20,background:"linear-gradient(135deg,#6C63FF,#F4A261)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:30,margin:"0 auto 16px"}}>🗺</div>
            <div style={{fontWeight:900,fontSize:18,color:"#1A1A2E",marginBottom:8}}>チャネルへの招待</div>
            <div style={{fontSize:13,color:"#666",lineHeight:1.7,marginBottom:6}}>以下のチャネルに招待されました</div>
            <div style={{background:"#F7F3EE",borderRadius:14,padding:"12px 16px",marginBottom:20,display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:10,height:10,borderRadius:"50%",background:joinInvite.color,flexShrink:0}}/>
              <div style={{fontWeight:900,fontSize:15,color:"#1A1A2E"}}>{joinInvite.name}</div>
              <span style={{background:joinInvite.type==="itinerary"?"#6C63FF12":"#F4A26120",color:joinInvite.type==="itinerary"?"#6C63FF":"#F4A261",borderRadius:20,padding:"2px 8px",fontSize:10,fontWeight:700,marginLeft:"auto"}}>
                {CH_TYPES[joinInvite.type||"memo"].icon} {CH_TYPES[joinInvite.type||"memo"].label}
              </span>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setJoinInvite(null)} style={{flex:1,background:"#F0EEE8",border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontWeight:700,fontSize:13,color:"#888"}}>キャンセル</button>
              <button onClick={acceptJoinInvite} style={{flex:2,background:"linear-gradient(135deg,#6C63FF,#7C73FF)",border:"none",borderRadius:14,padding:"13px",cursor:"pointer",fontWeight:900,fontSize:14,color:"white",boxShadow:"0 4px 20px #6C63FF44"}}>参加する！</button>
            </div>
          </div>
        </div>
      )}

      {/* ── チャネル設定モーダル ── */}
      {showChSettings&&(()=>{
        const targetCh=channels.find(c=>c.id===showChSettings);
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2000,padding:20}} onClick={()=>setShowChSettings(null)}>
            <div style={{background:"white",borderRadius:24,width:"100%",maxWidth:380,boxShadow:"0 24px 60px rgba(0,0,0,0.25)",overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
              <div style={{padding:"20px 22px 18px",borderBottom:"1px solid #F0EEE8",display:"flex",alignItems:"center",gap:10}}>
                <div style={{width:36,height:36,borderRadius:12,background:editCh.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>⚙️</div>
                <div>
                  <div style={{fontWeight:900,fontSize:16,color:"#1A1A2E"}}>チャネル設定</div>
                  <div style={{fontSize:11,color:"#AAA"}}>{targetCh?.name}</div>
                </div>
                <button onClick={()=>setShowChSettings(null)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"#CCC",fontSize:22,lineHeight:1}}>×</button>
              </div>
              {!showDeleteConfirm?(
                <div style={{padding:"18px 22px 22px"}}>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:"#555",fontWeight:700,marginBottom:6}}>チャネル名</div>
                    <input value={editCh.name} onChange={e=>setEditCh(p=>({...p,name:e.target.value}))}
                      style={{width:"100%",border:"1.5px solid #E8E0D5",borderRadius:12,padding:"10px 14px",fontSize:13,outline:"none"}}/>
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,color:"#555",fontWeight:700,marginBottom:8}}>チャネルの目的</div>
                    <div style={{display:"flex",gap:8}}>
                      {Object.entries(CH_TYPES).map(([key,val])=>(
                        <button key={key} onClick={()=>setEditCh(p=>({...p,type:key}))} style={{flex:1,background:editCh.type===key?"#1A1A2E":"#F7F3EE",color:editCh.type===key?"white":"#888",border:`2px solid ${editCh.type===key?"#1A1A2E":"transparent"}`,borderRadius:12,padding:"10px 8px",cursor:"pointer",textAlign:"center"}}>
                          <div style={{fontSize:20,marginBottom:4}}>{val.icon}</div>
                          <div style={{fontSize:11,fontWeight:700}}>{val.label}</div>
                          <div style={{fontSize:9,marginTop:3,opacity:0.7,lineHeight:1.4}}>{val.desc}</div>
                        </button>
                      ))}
                    </div>
                    {editCh.type!==(targetCh?.type||"memo")&&(
                      <div style={{marginTop:8,background:"#FFF8EE",borderRadius:8,padding:"7px 10px",fontSize:11,color:"#F4A261",fontWeight:600}}>
                        ⚠️ タイプを変えても投稿データはそのまま残ります
                      </div>
                    )}
                  </div>
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:11,color:"#555",fontWeight:700,marginBottom:8}}>カラー</div>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {["#E8A87C","#7CB9E8","#7CE8B0","#E87CB9","#C8E87C","#F4A261","#6C63FF","#2A9D8F","#E84040","#F4D261"].map(col=>(
                        <button key={col} onClick={()=>setEditCh(p=>({...p,color:col}))} style={{width:28,height:28,borderRadius:"50%",background:col,border:editCh.color===col?"3px solid #1A1A2E":"3px solid transparent",cursor:"pointer",transform:editCh.color===col?"scale(1.2)":"scale(1)"}}/>
                      ))}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    <button onClick={()=>setShowChSettings(null)} style={{flex:1,background:"#F5F0E8",color:"#888",border:"none",borderRadius:12,padding:"11px",cursor:"pointer",fontWeight:600,fontSize:13}}>キャンセル</button>
                    <button onClick={saveChSettings} style={{flex:2,background:"#6C63FF",color:"white",border:"none",borderRadius:12,padding:"11px",cursor:"pointer",fontWeight:700,fontSize:13,boxShadow:"0 4px 12px #6C63FF33"}}>保存する ✓</button>
                  </div>
                  <button onClick={()=>setShowDeleteConfirm(true)} style={{width:"100%",background:"none",border:"1.5px solid #FFD0D0",borderRadius:12,padding:"10px",cursor:"pointer",fontWeight:700,fontSize:12,color:"#E05"}}>
                    🗑 このチャネルを削除する
                  </button>
                </div>
              ):(
                <div style={{padding:"22px 22px 22px",textAlign:"center"}}>
                  <div style={{fontSize:48,marginBottom:12}}>🗑</div>
                  <div style={{fontWeight:900,fontSize:16,color:"#1A1A2E",marginBottom:8}}>本当に削除しますか？</div>
                  <div style={{fontSize:13,color:"#888",marginBottom:6,lineHeight:1.7}}>
                    「{targetCh?.name}」を削除すると<br/>
                    <strong style={{color:"#E05"}}>{(posts[showChSettings]||[]).length}件の投稿</strong>もすべて削除されます。<br/>
                    この操作は取り消せません。
                  </div>
                  <div style={{display:"flex",gap:8,marginTop:18}}>
                    <button onClick={()=>setShowDeleteConfirm(false)} style={{flex:1,background:"#F5F0E8",color:"#888",border:"none",borderRadius:12,padding:"12px",cursor:"pointer",fontWeight:700,fontSize:13}}>やめる</button>
                    <button onClick={deleteChannel} style={{flex:1,background:"#E05",color:"white",border:"none",borderRadius:12,padding:"12px",cursor:"pointer",fontWeight:700,fontSize:13}}>削除する</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
