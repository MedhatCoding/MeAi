"use client";

import type { Dispatch, SetStateAction } from "react";
import { ImageIcon, WandSparkles } from "lucide-react";

interface ImagesSectionProps {
  setNotice: Dispatch<SetStateAction<string>>;
  imagePrompt: string;
  setImagePrompt: Dispatch<SetStateAction<string>>;
  imageAspect: string;
  setImageAspect: Dispatch<SetStateAction<string>>;
  imageStyle: string;
  setImageStyle: Dispatch<SetStateAction<string>>;
  imageBusy: boolean;
  setImageBusy: Dispatch<SetStateAction<boolean>>;
  generatedImage: string;
  setGeneratedImage: Dispatch<SetStateAction<string>>;
}

export default function ImagesSection({
  setNotice,
  imagePrompt,
  setImagePrompt,
  imageAspect,
  setImageAspect,
  imageStyle,
  setImageStyle,
  imageBusy,
  setImageBusy,
  generatedImage,
  setGeneratedImage,
}: ImagesSectionProps) {
  return (
    <div className="section-page"><div className="page-heading"><div className="page-icon pink"><ImageIcon size={22}/></div><div><div className="eyebrow">من الفكرة إلى الصورة</div><h1>توليد الصور</h1><p>إنشاء صورة عبر Cloudflare Workers AI عند تهيئة الحساب.</p></div></div><div className="creative-layout"><div className="form-card"><label>وصف الصورة</label><textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} maxLength={1800} placeholder="صف المشهد، الأسلوب، الإضاءة، الألوان، والتفاصيل..."/><label>النمط الفني</label><div className="choice-row">{["واقعي","سينمائي","رسومي","أنمي"].map(x=><button key={x} type="button" className={imageStyle===x?"choice selected":"choice"} onClick={()=>setImageStyle(x)}>{x}</button>)}</div><label>نسبة الأبعاد</label><div className="choice-row">{["1:1","16:9","9:16"].map(x=><button key={x} type="button" className={imageAspect===x?"choice selected":"choice"} onClick={()=>setImageAspect(x)}>{x}</button>)}</div><button className="primary-btn full-btn" disabled={imageBusy||imagePrompt.trim().length<4} onClick={async()=>{setImageBusy(true);setNotice("");setGeneratedImage("");try{const r=await fetch("/api/images/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:imagePrompt,aspect:imageAspect,style:imageStyle})});const d=await r.json();if(!r.ok)throw new Error(d.error||"تعذر توليد الصورة.");setGeneratedImage(d.image);setNotice("تم إنشاء الصورة. يمكنك الضغط مطولًا عليها لحفظها.");}catch(e){setNotice(e instanceof Error?e.message:"تعذر توليد الصورة.");}finally{setImageBusy(false);}}}><WandSparkles size={16}/>{imageBusy?"جارٍ إنشاء الصورة…":"إنشاء صورة"}</button></div><div className="preview-placeholder">{generatedImage?<><img src={generatedImage} alt="الصورة التي تم توليدها" style={{width:"100%",height:"auto",borderRadius:16}}/><a href={generatedImage} download="medhat-ai-image.png">حفظ الصورة</a></>:<><div className="preview-glow"><ImageIcon size={36}/></div><b>{imageBusy?"جارٍ التوليد":"معاينة الصورة"}</b><p>{imageBusy?"قد يستغرق التوليد بعض الوقت.":"ستظهر النتيجة هنا بعد اكتمال التوليد."}</p></>}</div></div></div>
  );
}
