import base64
import html as html_lib

import streamlit as st

from ai_providers import _provider_configs
from app_pages import agent, chat, images, memory, settings, tasks, video, workspace
from app_settings import APP_DIR, cloud_memory_enabled, secret
from memory_store import db_init

st.set_page_config(page_title="Medhat AI | المساعد الشخصي", page_icon=str(APP_DIR / "assets" / "medhat_ai_logo.svg"), layout="wide", initial_sidebar_state="collapsed", menu_items={"About": "Medhat AI — مساعدك الذكي الشخصي"})

st.markdown("""
<style>
:root{color-scheme:dark}
html,body,[data-testid="stAppViewContainer"]{direction:rtl}
[data-testid="stMain"]{background:radial-gradient(ellipse at 78% -10%,rgba(61,105,230,.16),transparent 45%),#0a0d16}
[data-testid="stMain"] *,[data-testid="stSidebar"] *{writing-mode:horizontal-tb!important;word-break:normal!important}
[data-testid="stMarkdownContainer"]{direction:rtl!important;text-align:right!important;width:100%;min-width:0;white-space:normal!important;overflow-wrap:anywhere!important}
.block-container{width:100%;max-width:1080px;min-width:0;padding:1.15rem max(1rem,env(safe-area-inset-left)) 7rem max(1rem,env(safe-area-inset-right))}
.brand-header{display:flex;align-items:center;gap:.9rem;width:100%;box-sizing:border-box;padding:.65rem 0 1.05rem;border-bottom:1px solid rgba(126,157,237,.17);margin-bottom:1.1rem}
.brand-header img{width:54px;height:54px;object-fit:contain;flex:0 0 54px;border-radius:18px;filter:drop-shadow(0 8px 22px rgba(66,119,255,.22))}
.brand-title{font-size:clamp(1.45rem,4.8vw,2rem);font-weight:850;letter-spacing:-.04em;line-height:1.2}
.brand-title span{background:linear-gradient(105deg,#5ce7ff,#7c83ff 55%,#c69aff);-webkit-background-clip:text;background-clip:text;color:transparent}
.brand-subtitle{font-size:clamp(.82rem,2.8vw,.96rem);color:#9ba8c4;margin-top:.32rem;line-height:1.55}
.hero{display:block;width:100%;min-width:0;box-sizing:border-box;padding:clamp(1.15rem,4vw,1.85rem);border:1px solid rgba(123,154,232,.18);border-radius:26px;margin-bottom:1.1rem;background:linear-gradient(130deg,rgba(32,48,85,.78),rgba(19,24,42,.82));box-shadow:0 18px 60px rgba(0,0,0,.12)}
.status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.7rem;margin:.2rem 0 1rem}
.status-card{min-width:0;padding:.85rem 1rem;border:1px solid rgba(126,153,220,.2);border-radius:17px;background:linear-gradient(145deg,rgba(25,33,55,.86),rgba(15,20,34,.9));box-shadow:0 8px 26px rgba(0,0,0,.08)}
.status-label{font-size:.78rem;color:#a9b6d2;margin-bottom:.35rem}
.status-value{font-size:1.02rem;font-weight:800;overflow-wrap:anywhere}
.status-detail{font-size:.76rem;color:#8998b8;margin-top:.25rem;overflow-wrap:anywhere}
.feature-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.7rem;margin:.8rem 0 1.1rem}
.feature-card{padding:1rem;border:1px solid rgba(126,153,220,.18);border-radius:18px;background:rgba(20,27,45,.68);min-width:0}
.feature-card strong{display:block;font-size:1rem;margin-bottom:.25rem}
.feature-card span{display:block;font-size:.84rem;color:#9ba8c4;line-height:1.6}

.hero h1{font-size:clamp(1.45rem,5vw,2.25rem)!important;margin-bottom:.4rem}
.welcome-panel{text-align:center;padding:clamp(1.3rem,5vw,2.6rem) .8rem 1.2rem}
.welcome-orb{display:flex;align-items:center;justify-content:center;width:58px;height:58px;margin:0 auto 1rem;border-radius:21px;font-size:1.8rem;color:#d6f8ff;background:linear-gradient(145deg,rgba(65,207,239,.2),rgba(116,104,255,.2));border:1px solid rgba(107,205,255,.35);box-shadow:0 0 45px rgba(69,132,255,.14)}
.welcome-panel h1{font-size:clamp(1.55rem,5vw,2.25rem)!important;margin-bottom:.5rem}
.welcome-panel p{max-width:560px;margin:0 auto;color:#a6b2cc;font-size:.98rem}
.prompt-hint{color:#8291b2;font-size:.82rem;margin:.8rem 0 .45rem}
[data-testid="stChatMessage"]{border:0!important;border-radius:8px!important;padding:.8rem .15rem!important;background:transparent!important;margin:.45rem 0!important}
[data-testid="stChatMessage"]:has([data-testid="chatAvatarIcon-user"]){background:rgba(41,51,77,.42)!important;border:1px solid rgba(137,155,205,.1)!important;border-radius:18px!important;padding:.85rem 1rem!important}
[data-testid="stChatMessage"] [data-testid="stMarkdownContainer"]{line-height:1.8}
[data-testid="stChatInput"]{position:sticky;bottom:.4rem;box-shadow:0 10px 40px rgba(0,0,0,.22)}

h1,h2,h3{letter-spacing:-.025em;line-height:1.35!important}
p,li,label,.stCaption{line-height:1.7!important}
[data-testid="stChatMessage"]{width:100%;min-width:0;border:1px solid rgba(137,155,205,.12);border-radius:20px;padding:.85rem 1rem;background:rgba(21,27,44,.66);margin:.65rem 0}
[data-testid="stChatInput"]{border-radius:24px!important;border:1px solid rgba(120,149,225,.3)!important;background:#151a29!important}
[data-testid="stChatInput"] textarea{font-size:16px!important;line-height:1.6!important}
input,textarea,[role="combobox"]{font-size:16px!important}
.stButton>button,.stDownloadButton>button,[data-testid="stFormSubmitButton"]>button{min-height:48px;border-radius:15px;font-size:1rem;font-weight:700;padding:.65rem 1rem;width:100%;border:1px solid rgba(125,153,225,.24);transition:transform .12s ease,border-color .12s ease}
.stButton>button:active{transform:scale(.985)}
[data-testid="stMetric"]{border:1px solid rgba(128,150,190,.18);border-radius:18px;padding:.85rem;background:rgba(21,27,44,.52)}
[data-testid="stAlert"]{border-radius:16px}
[data-testid="stExpander"]{border:1px solid rgba(125,153,225,.17);border-radius:15px;overflow:hidden}
[data-testid="stRadio"] label{cursor:pointer}
@media(min-width:701px){[data-testid="stRadio"]>div[role="radiogroup"]{display:flex;gap:.35rem;padding:.35rem;border:1px solid rgba(126,153,220,.18);border-radius:18px;background:rgba(19,24,40,.88);width:100%;overflow-x:auto}[data-testid="stRadio"]>div[role="radiogroup"] label{border-radius:12px;padding:.5rem .7rem;white-space:nowrap}[data-testid="stRadio"]>div[role="radiogroup"] label:has(input:checked){background:rgba(95,113,222,.23)}}
@media(max-width:700px){
.block-container{padding:.55rem .8rem 6.7rem!important}
.brand-header img{width:48px;height:48px;flex-basis:48px}
[data-testid="stHorizontalBlock"]{flex-wrap:wrap!important;gap:.55rem!important}
[data-testid="column"]{min-width:100%!important;width:100%!important;flex:1 1 100%!important}
[data-testid="stRadio"]>div[role="radiogroup"]{position:fixed;z-index:999;bottom:0;left:0;right:0;box-sizing:border-box;padding:.42rem .35rem max(.55rem,env(safe-area-inset-bottom));background:rgba(10,14,25,.97);border-top:1px solid rgba(120,150,220,.25);backdrop-filter:blur(20px);display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;justify-content:flex-start;gap:.25rem;width:100%;overflow-x:auto;scrollbar-width:none}
[data-testid="stRadio"]>div[role="radiogroup"]::-webkit-scrollbar{display:none}
[data-testid="stRadio"]>div[role="radiogroup"] label{flex:0 0 auto;min-width:68px;justify-content:center;border-radius:12px;padding:.5rem .6rem;font-size:.77rem;white-space:nowrap;background:rgba(35,42,64,.48)}
[data-testid="stRadio"]>div[role="radiogroup"] label p{font-size:.77rem!important}
[data-testid="stRadio"]>label{display:none}
[data-testid="stMetric"]{padding:.65rem}
.stButton>button,.stDownloadButton>button{min-height:50px}
[data-testid="stChatMessage"]{padding:.7rem .8rem;border-radius:17px}
}

/* Medhat AI complete product-wide visual system */
:root{--ma-bg:#090d18;--ma-surface:#111827;--ma-surface2:#151f32;--ma-border:rgba(151,170,218,.17);--ma-text:#eef3ff;--ma-muted:#9baac7;--ma-accent:#8b9cff;--ma-cyan:#61e5ed}
html,body,[data-testid="stAppViewContainer"],[data-testid="stApp"]{background:var(--ma-bg)!important;color:var(--ma-text)!important}
[data-testid="stHeader"]{background:rgba(9,13,24,.86)!important;backdrop-filter:blur(18px)}
[data-testid="stMain"]{background:radial-gradient(ellipse at 80% -12%,rgba(82,106,245,.17),transparent 40%),radial-gradient(ellipse at 4% 35%,rgba(42,188,204,.055),transparent 35%),var(--ma-bg)!important}
.block-container{max-width:1160px!important}
[data-testid="stVerticalBlockBorderWrapper"]{border-color:var(--ma-border)!important;border-radius:20px!important;background:linear-gradient(145deg,rgba(20,29,47,.82),rgba(13,19,32,.86))!important}
[data-testid="stTabs"] [role="tablist"]{gap:7px;border-bottom:1px solid var(--ma-border);padding:5px 2px;overflow-x:auto}
[data-testid="stTabs"] button[role="tab"]{border:1px solid transparent;border-radius:13px;padding:.55rem .9rem;color:var(--ma-muted);font-weight:700;white-space:nowrap}
[data-testid="stTabs"] button[role="tab"][aria-selected="true"]{background:linear-gradient(135deg,rgba(110,128,255,.2),rgba(66,205,219,.09));border-color:rgba(129,151,255,.3);color:#f4f7ff}
[data-testid="stTextInput"] input,[data-testid="stTextArea"] textarea,[data-testid="stNumberInput"] input,[data-testid="stDateInput"] input,[data-testid="stTimeInput"] input,[data-testid="stSelectbox"]>div>div,[data-testid="stMultiSelect"]>div>div{border-radius:13px!important;background:#101827!important;border-color:var(--ma-border)!important;color:var(--ma-text)!important}
[data-testid="stFileUploader"]{border:1px dashed rgba(133,157,230,.4);border-radius:18px;background:rgba(17,26,44,.5);padding:.35rem}
[data-testid="stFileUploader"] section{border:0!important}
[data-testid="stDataFrame"],[data-testid="stTable"]{border:1px solid var(--ma-border);border-radius:16px;overflow:hidden}
[data-testid="stMetric"]{background:linear-gradient(145deg,rgba(23,33,55,.94),rgba(14,21,36,.94))!important;border-color:var(--ma-border)!important;box-shadow:0 8px 24px rgba(0,0,0,.1)}
[data-testid="stProgress"]>div>div{background:linear-gradient(90deg,#6478ff,#54d8e4)!important;border-radius:999px}
[data-testid="stAlert"]{border-radius:16px!important;border:1px solid var(--ma-border)!important}
[data-testid="stExpander"]{background:rgba(16,24,40,.68)!important;border-color:var(--ma-border)!important}
[data-testid="stCode"],pre,code{border-radius:13px!important}
hr{border-color:var(--ma-border)!important}
.stButton>button,.stDownloadButton>button,[data-testid="stFormSubmitButton"]>button{background:linear-gradient(135deg,rgba(105,122,255,.16),rgba(70,203,219,.07));border:1px solid rgba(139,158,255,.27);color:#f2f5ff;box-shadow:0 5px 18px rgba(0,0,0,.08)}
.stButton>button:hover,.stDownloadButton>button:hover{border-color:rgba(106,222,232,.7);background:linear-gradient(135deg,rgba(105,122,255,.26),rgba(70,203,219,.14));transform:translateY(-1px)}
[data-testid="stRadio"] label,[data-testid="stCheckbox"] label{color:#dce5fa}
.brand-header{position:relative}
.brand-header:after{content:"PERSONAL AI WORKSPACE";position:absolute;left:0;bottom:1.25rem;font-size:.59rem;letter-spacing:.14em;color:#667695;direction:ltr}
[data-testid="stSidebar"]{background:#0b1120!important;border-left:1px solid var(--ma-border)}
[data-testid="stSidebar"] [data-testid="stMarkdownContainer"]{color:#dce5fa}
[data-testid="stChatInput"]{border-radius:22px!important;border:1px solid rgba(139,158,255,.35)!important;background:linear-gradient(145deg,#141d30,#101725)!important;box-shadow:0 12px 38px rgba(0,0,0,.26)!important}
[data-testid="stChatInput"] textarea{color:#f4f7ff!important}
[data-testid="stChatMessage"] [data-testid="stMarkdownContainer"] p{line-height:1.85!important}
[data-testid="stStatusWidget"]{border-radius:12px}
@media(max-width:700px){
 .block-container{padding:.5rem .72rem 7.5rem!important}
 .brand-header{gap:.7rem;padding:.55rem 0 .85rem}
 .brand-header:after{display:none}
 h1{font-size:1.55rem!important} h2{font-size:1.28rem!important} h3{font-size:1.08rem!important}
 [data-testid="stTabs"] [role="tablist"]{padding-bottom:.4rem}
 [data-testid="stTabs"] button[role="tab"]{padding:.55rem .72rem;font-size:.85rem}
 [data-testid="stVerticalBlockBorderWrapper"]{border-radius:17px!important}
 [data-testid="stDataFrame"]{max-width:100%;overflow-x:auto}
 [data-testid="stFileUploader"]{padding:.15rem}
}

</style>
""", unsafe_allow_html=True)


db_init()

# Keep navigation in the main page instead of the sidebar. On narrow mobile
# viewports the sidebar's responsive layout was collapsing its text into a thin column.
logo_svg = (APP_DIR / "assets" / "medhat_ai_logo.svg").read_text(encoding="utf-8")
logo_data = base64.b64encode(logo_svg.encode("utf-8")).decode("ascii")
st.markdown(f"""
<div class="brand-header">
  <img src="data:image/svg+xml;base64,{logo_data}" alt="Medhat AI logo">
  <div><div class="brand-title">Medhat <span>AI</span></div><div class="brand-subtitle">مساعدك الذكي • برمجة وتكاملات وإنجاز مهام</div></div>
</div>
""", unsafe_allow_html=True)
pages = ["المحادثة", "الوكيل", "المهام", "مساحة العمل", "توليد الصور", "توليد الفيديو", "الذاكرة", "الإعدادات"]
page_keys = {
    "chat": "المحادثة", "agent": "الوكيل", "tasks": "المهام",
    "workspace": "مساحة العمل", "images": "توليد الصور", "video": "توليد الفيديو",
    "memory": "الذاكرة", "settings": "الإعدادات",
}
try:
    requested_page = page_keys.get(str(st.query_params.get("page", "chat")), "المحادثة")
    page_index = pages.index(requested_page)
except Exception:
    page_index = 0
page = st.radio(
    "القائمة", pages, index=page_index, horizontal=True,
    label_visibility="collapsed", key="main_navigation",
)
configured_providers = _provider_configs()
provider_status = "متصل" if configured_providers else "يحتاج إعداد"
provider_icon = "●" if configured_providers else "○"
provider_mode = html_lib.escape(str(secret("AI_PROVIDER", "auto")))
last_provider = html_lib.escape(str(st.session_state.get("last_ai_provider", "لم يُستخدم بعد")))
provider_status = html_lib.escape(provider_status)
memory_status = "ذاكرة دائمة" if cloud_memory_enabled() else "ذاكرة مؤقتة"
if page != "المحادثة":
    st.markdown(f"""
    <div class="status-grid">
      <div class="status-card"><div class="status-label">حالة الذكاء الاصطناعي</div><div class="status-value">{provider_icon} {provider_status}</div><div class="status-detail">الوضع: {provider_mode}</div></div>
      <div class="status-card"><div class="status-label">الذاكرة</div><div class="status-value">{memory_status}</div><div class="status-detail">{"متصلة بقاعدة بيانات دائمة" if cloud_memory_enabled() else "قد تُمسح عند إعادة تشغيل الاستضافة"}</div></div>
      <div class="status-card"><div class="status-label">آخر مزوّد ناجح</div><div class="status-value">{last_provider}</div><div class="status-detail">اختيار تلقائي للمزوّدين المُعدّين</div></div>
    </div>
    """, unsafe_allow_html=True)
    st.divider()

# ---- page dispatch (each page renders from its own module) ----
if page == "المحادثة":
    chat.render()
elif page == "مساحة العمل":
    workspace.render()
elif page == "الوكيل":
    agent.render()
elif page == "المهام":
    tasks.render()
elif page == "توليد الصور":
    images.render()
elif page == "توليد الفيديو":
    video.render()
elif page == "الذاكرة":
    memory.render()
else:
    settings.render()
