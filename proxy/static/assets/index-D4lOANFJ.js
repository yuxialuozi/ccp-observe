(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const a of document.querySelectorAll('link[rel="modulepreload"]'))s(a);new MutationObserver(a=>{for(const o of a)if(o.type==="childList")for(const c of o.addedNodes)c.tagName==="LINK"&&c.rel==="modulepreload"&&s(c)}).observe(document,{childList:!0,subtree:!0});function n(a){const o={};return a.integrity&&(o.integrity=a.integrity),a.referrerPolicy&&(o.referrerPolicy=a.referrerPolicy),a.crossOrigin==="use-credentials"?o.credentials="include":a.crossOrigin==="anonymous"?o.credentials="omit":o.credentials="same-origin",o}function s(a){if(a.ep)return;a.ep=!0;const o=n(a);fetch(a.href,o)}})();const Qo="/_ccp/api";async function ee(t,e={}){const n=await fetch(Qo+t,{headers:{"Content-Type":"application/json"},cache:"no-store",...e}),s=await n.text();let a=null;try{a=s?JSON.parse(s):null}catch{a={raw:s}}if(!n.ok&&!(a&&a.ok===!1)){const o=new Error(a&&(a.error||a.message)||`HTTP ${n.status}`);throw o.status=n.status,o.data=a,o}return a}const ie={stats:()=>ee("/stats"),recent:(t,e=100)=>ee(`/recent?limit=${e}${t?`&model=${encodeURIComponent(t)}`:""}`),errors:(t=100)=>ee(`/errors?limit=${t}`),truncations:(t,e=60)=>ee(`/truncations?limit=${e}${t?`&model=${encodeURIComponent(t)}`:""}`),context:t=>ee(`/context?model=${encodeURIComponent(t)}`),buckets:(t,e)=>ee(`/buckets?model=${encodeURIComponent(t||"")}&granularity=${e}`),usage:(t=30)=>ee(`/usage?days=${t}`),getConfig:()=>ee("/config"),saveConfig:t=>ee("/config",{method:"POST",body:JSON.stringify(t)}),testUpstream:t=>ee("/test",{method:"POST",body:JSON.stringify(t)}),selftest:()=>ee("/selftest"),route:(t,e="anthropic")=>ee(`/route?model=${encodeURIComponent(t||"")}&protocol=${e}`),validateRoute:t=>ee("/routes/validate",{method:"POST",body:JSON.stringify(t)}),captures:({model:t,limit:e=60,truncatedOnly:n=!1}={})=>{const s=new URLSearchParams({limit:String(e)});return t&&s.set("model",t),n&&s.set("truncated","1"),ee(`/capture?${s.toString()}`)},capture:t=>ee(`/capture/${encodeURIComponent(t)}`)},Yt=(t,e="")=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${e}>${t}</svg>`,ct={gear:Yt('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),refresh:Yt('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/>'),copy:Yt('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>'),check:Yt('<path d="M20 6 9 17l-5-5"/>'),chevron:Yt('<path d="m9 18 6-6-6-6"/>'),activity:Yt('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'),alert:Yt('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),info:Yt('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),plug:Yt('<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v3a6 6 0 0 1-12 0V8z"/>'),terminal:Yt('<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>'),book:Yt('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),close:Yt('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),checkCircle:Yt('<circle cx="12" cy="12" r="9"/><path d="m8.5 12.5 2.5 2.5 4.5-5"/>'),xCircle:Yt('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>'),clock:Yt('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),cpu:Yt('<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v2M15 2v2M9 20v2M15 20v2M2 9h2M2 15h2M20 9h2M20 15h2"/>')},Xo=`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <rect width="32" height="32" rx="7" fill="currentColor"/>
  <rect x="7" y="16" width="4" height="9" rx="1.5" fill="white" opacity=".55"/>
  <rect x="14" y="10" width="4" height="15" rx="1.5" fill="white" opacity=".8"/>
  <rect x="21" y="6" width="4" height="19" rx="1.5" fill="white"/>
</svg>`;Object.assign(ct,{dashboard:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',layers:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',network:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4"/><path d="m12 11.5-5.6 5.4"/><path d="m12 11.5 5.6 5.4"/></svg>',braces:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H6a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h2"/><path d="M16 3h2a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-2"/></svg>',server:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01"/></svg>',plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',arrowRight:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'});const tr=!0,Rt="u-",er="uplot",sr=Rt+"hz",nr=Rt+"vt",lr=Rt+"title",ar=Rt+"wrap",ir=Rt+"under",or=Rt+"over",rr=Rt+"axis",ms=Rt+"off",cr=Rt+"select",ur=Rt+"cursor-x",dr=Rt+"cursor-y",fr=Rt+"cursor-pt",pr=Rt+"legend",hr=Rt+"live",mr=Rt+"inline",vr=Rt+"series",gr=Rt+"marker",Aa=Rt+"label",br=Rt+"value",un="width",dn="height",rn="top",Ca="bottom",Vs="left",ml="right",Dl="#000",Ea=Dl+"0",vl="mousemove",Pa="mousedown",gl="mouseup",La="mouseenter",Da="mouseleave",Na="dblclick",$r="resize",wr="scroll",Oa="change",Dn="dppxchange",Nl="--",Ks=typeof window<"u",_l=Ks?document:null,js=Ks?window:null,yr=Ks?navigator:null;let rt,Cn;function xl(){let t=devicePixelRatio;rt!=t&&(rt=t,Cn&&Ml(Oa,Cn,xl),Cn=matchMedia(`(min-resolution: ${rt-.001}dppx) and (max-resolution: ${rt+.001}dppx)`),vs(Oa,Cn,xl),js.dispatchEvent(new CustomEvent(Dn)))}function pe(t,e){if(e!=null){let n=t.classList;!n.contains(e)&&n.add(e)}}function Sl(t,e){let n=t.classList;n.contains(e)&&n.remove(e)}function wt(t,e,n){t.style[e]=n+"px"}function Ce(t,e,n,s){let a=_l.createElement(t);return e!=null&&pe(a,e),n?.insertBefore(a,s),a}function ke(t,e){return Ce("div",t,e)}const Ra=new WeakMap;function Ie(t,e,n,s,a){let o="translate("+e+"px,"+n+"px)",c=Ra.get(t);o!=c&&(t.style.transform=o,Ra.set(t,o),e<0||n<0||e>s||n>a?pe(t,ms):Sl(t,ms))}const Ha=new WeakMap;function za(t,e,n){let s=e+n,a=Ha.get(t);s!=a&&(Ha.set(t,s),t.style.background=e,t.style.borderColor=n)}const Ia=new WeakMap;function Fa(t,e,n,s){let a=e+""+n,o=Ia.get(t);a!=o&&(Ia.set(t,a),t.style.height=n+"px",t.style.width=e+"px",t.style.marginLeft=s?-e/2+"px":0,t.style.marginTop=s?-n/2+"px":0)}const Ol={passive:!0},kr={...Ol,capture:!0};function vs(t,e,n,s){e.addEventListener(t,n,s?kr:Ol)}function Ml(t,e,n,s){e.removeEventListener(t,n,Ol)}Ks&&xl();function Ee(t,e,n,s){let a;n=n||0,s=s||e.length-1;let o=s<=2147483647;for(;s-n>1;)a=o?n+s>>1:he((n+s)/2),e[a]<t?n=a:s=a;return t-e[n]<=e[s]-t?n:s}function wi(t){return(n,s,a)=>{let o=-1,c=-1;for(let f=s;f<=a;f++)if(t(n[f])){o=f;break}for(let f=a;f>=s;f--)if(t(n[f])){c=f;break}return[o,c]}}const yi=t=>t!=null,ki=t=>t!=null&&t>0,Hn=wi(yi),_r=wi(ki);function xr(t,e,n,s=0,a=!1){let o=a?_r:Hn,c=a?ki:yi;[e,n]=o(t,e,n);let f=t[e],d=t[e];if(e>-1)if(s==1)f=t[e],d=t[n];else if(s==-1)f=t[n],d=t[e];else for(let p=e;p<=n;p++){let b=t[p];c(b)&&(b<f?f=b:b>d&&(d=b))}return[f??ht,d??-ht]}function zn(t,e,n,s){let a=ja(t),o=ja(e);t==e&&(a==-1?(t*=n,e/=n):(t/=n,e*=n));let c=n==10?Ue:_i,f=a==1?he:_e,d=o==1?_e:he,p=f(c(Ot(t))),b=d(c(Ot(e))),g=qs(n,p),w=qs(n,b);return n==10&&(p<0&&(g=mt(g,-p)),b<0&&(w=mt(w,-b))),s||n==2?(t=g*a,e=w*o):(t=Ti(t,g),e=In(e,w)),[t,e]}function Rl(t,e,n,s){let a=zn(t,e,n,s);return t==0&&(a[0]=0),e==0&&(a[1]=0),a}const Hl=.1,Va={mode:3,pad:Hl},pn={pad:0,soft:null,mode:0},Sr={min:pn,max:pn};function Nn(t,e,n,s){return Fn(n)?Ba(t,e,n):(pn.pad=n,pn.soft=s?0:null,pn.mode=s?3:0,Ba(t,e,Sr))}function it(t,e){return t??e}function Mr(t,e,n){for(e=it(e,0),n=it(n,t.length-1);e<=n;){if(t[e]!=null)return!0;e++}return!1}function Ba(t,e,n){let s=n.min,a=n.max,o=it(s.pad,0),c=it(a.pad,0),f=it(s.hard,-ht),d=it(a.hard,ht),p=it(s.soft,ht),b=it(a.soft,-ht),g=it(s.mode,0),w=it(a.mode,0),P=e-t,D=Ue(P),I=se(Ot(t),Ot(e)),B=Ue(I),q=Ot(B-D);(P<1e-24||q>10)&&(P=0,(t==0||e==0)&&(P=1e-24,g==2&&p!=ht&&(o=0),w==2&&b!=-ht&&(c=0)));let x=P||I||1e3,F=Ue(x),S=qs(10,he(F)),Z=x*(P==0?t==0?.1:1:o),L=mt(Ti(t-Z,S/10),24),Q=t>=p&&(g==1||g==3&&L<=p||g==2&&L>=p)?p:ht,Y=se(f,L<Q&&t>=Q?Q:Pe(Q,L)),et=x*(P==0?e==0?.1:1:c),G=mt(In(e+et,S/10),24),M=e<=b&&(w==1||w==3&&G>=b||w==2&&G<=b)?b:-ht,J=Pe(d,G>M&&e<=M?M:se(M,G));return Y==J&&Y==0&&(J=100),[Y,J]}const Tr=new Intl.NumberFormat(Ks?yr.language:"en-US"),zl=t=>Tr.format(t),me=Math,Ln=me.PI,Ot=me.abs,he=me.floor,Nt=me.round,_e=me.ceil,Pe=me.min,se=me.max,qs=me.pow,ja=me.sign,Ue=me.log10,_i=me.log2,Ar=(t,e=1)=>me.sinh(t)*e,bl=(t,e=1)=>me.asinh(t/e),ht=1/0;function qa(t){return(Ue((t^t>>31)-(t>>31))|0)+1}function Tl(t,e,n){return Pe(se(t,e),n)}function xi(t){return typeof t=="function"}function st(t){return xi(t)?t:()=>t}const Cr=()=>{},Si=t=>t,Mi=(t,e)=>e,Er=t=>null,Wa=t=>!0,Ua=(t,e)=>t==e,Pr=/\.\d*?(?=9{6,}|0{6,})/gm,bs=t=>{if(Ci(t)||ss.has(t))return t;const e=`${t}`,n=e.match(Pr);if(n==null)return t;let s=n[0].length-1;if(e.indexOf("e-")!=-1){let[a,o]=e.split("e");return+`${bs(a)}e${o}`}return mt(t,s)};function ps(t,e){return bs(mt(bs(t/e))*e)}function In(t,e){return bs(_e(bs(t/e))*e)}function Ti(t,e){return bs(he(bs(t/e))*e)}function mt(t,e=0){if(Ci(t))return t;let n=10**e,s=t*n*(1+Number.EPSILON);return Nt(s)/n}const ss=new Map;function Ai(t){return((""+t).split(".")[1]||"").length}function vn(t,e,n,s){let a=[],o=s.map(Ai);for(let c=e;c<n;c++){let f=Ot(c),d=mt(qs(t,c),f);for(let p=0;p<s.length;p++){let b=t==10?+`${s[p]}e${c}`:s[p]*d,g=(c>=0?0:f)+(c>=o[p]?0:o[p]),w=t==10?b:mt(b,g);a.push(w),ss.set(w,g)}}return a}const hn={},Il=[],Ws=[null,null],es=Array.isArray,Ci=Number.isInteger,Lr=t=>t===void 0;function Ga(t){return typeof t=="string"}function Fn(t){let e=!1;if(t!=null){let n=t.constructor;e=n==null||n==Object}return e}function Dr(t){return t!=null&&typeof t=="object"}const Nr=Object.getPrototypeOf(Uint8Array),Ei="__proto__";function Us(t,e=Fn){let n;if(es(t)){let s=t.find(a=>a!=null);if(es(s)||e(s)){n=Array(t.length);for(let a=0;a<t.length;a++)n[a]=Us(t[a],e)}else n=t.slice()}else if(t instanceof Nr)n=t.slice();else if(e(t)){n={};for(let s in t)s!=Ei&&(n[s]=Us(t[s],e))}else n=t;return n}function Ct(t){let e=arguments;for(let n=1;n<e.length;n++){let s=e[n];for(let a in s)a!=Ei&&(Fn(t[a])?Ct(t[a],Us(s[a])):t[a]=Us(s[a]))}return t}const Or=0,Rr=1,Hr=2;function zr(t,e,n){for(let s=0,a,o=-1;s<e.length;s++){let c=e[s];if(c>o){for(a=c-1;a>=0&&t[a]==null;)t[a--]=null;for(a=c+1;a<n&&t[a]==null;)t[o=a++]=null}}}function Ir(t,e){if(Br(t)){let c=t[0].slice();for(let f=1;f<t.length;f++)c.push(...t[f].slice(1));return jr(c[0])||(c=Vr(c)),c}let n=new Set;for(let c=0;c<t.length;c++){let d=t[c][0],p=d.length;for(let b=0;b<p;b++)n.add(d[b])}let s=[Array.from(n).sort((c,f)=>c-f)],a=s[0].length,o=new Map;for(let c=0;c<a;c++)o.set(s[0][c],c);for(let c=0;c<t.length;c++){let f=t[c],d=f[0];for(let p=1;p<f.length;p++){let b=f[p],g=Array(a).fill(void 0),w=e?e[c][p]:Rr,P=[];for(let D=0;D<b.length;D++){let I=b[D],B=o.get(d[D]);I===null?w!=Or&&(g[B]=I,w==Hr&&P.push(B)):g[B]=I}zr(g,P,a),s.push(g)}}return s}const Fr=typeof queueMicrotask>"u"?t=>Promise.resolve().then(t):queueMicrotask;function Vr(t){let e=t[0],n=e.length,s=Array(n);for(let o=0;o<s.length;o++)s[o]=o;s.sort((o,c)=>e[o]-e[c]);let a=[];for(let o=0;o<t.length;o++){let c=t[o],f=Array(n);for(let d=0;d<n;d++)f[d]=c[s[d]];a.push(f)}return a}function Br(t){let e=t[0][0],n=e.length;for(let s=1;s<t.length;s++){let a=t[s][0];if(a.length!=n)return!1;if(a!=e){for(let o=0;o<n;o++)if(a[o]!=e[o])return!1}}return!0}function jr(t,e=100){const n=t.length;if(n<=1)return!0;let s=0,a=n-1;for(;s<=a&&t[s]==null;)s++;for(;a>=s&&t[a]==null;)a--;if(a<=s)return!0;const o=se(1,he((a-s+1)/e));for(let c=t[s],f=s+o;f<=a;f+=o){const d=t[f];if(d!=null){if(d<=c)return!1;c=d}}return!0}const Pi=["January","February","March","April","May","June","July","August","September","October","November","December"],Li=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];function Di(t){return t.slice(0,3)}const qr=Li.map(Di),Wr=Pi.map(Di),Ur={MMMM:Pi,MMM:Wr,WWWW:Li,WWW:qr};function cn(t){return(t<10?"0":"")+t}function Gr(t){return(t<10?"00":t<100?"0":"")+t}const Yr={YYYY:t=>t.getFullYear(),YY:t=>(t.getFullYear()+"").slice(2),MMMM:(t,e)=>e.MMMM[t.getMonth()],MMM:(t,e)=>e.MMM[t.getMonth()],MM:t=>cn(t.getMonth()+1),M:t=>t.getMonth()+1,DD:t=>cn(t.getDate()),D:t=>t.getDate(),WWWW:(t,e)=>e.WWWW[t.getDay()],WWW:(t,e)=>e.WWW[t.getDay()],HH:t=>cn(t.getHours()),H:t=>t.getHours(),h:t=>{let e=t.getHours();return e==0?12:e>12?e-12:e},AA:t=>t.getHours()>=12?"PM":"AM",aa:t=>t.getHours()>=12?"pm":"am",a:t=>t.getHours()>=12?"p":"a",mm:t=>cn(t.getMinutes()),m:t=>t.getMinutes(),ss:t=>cn(t.getSeconds()),s:t=>t.getSeconds(),fff:t=>Gr(t.getMilliseconds())};function Fl(t,e){e=e||Ur;let n=[],s=/\{([a-z]+)\}|[^{]+/gi,a;for(;a=s.exec(t);)n.push(a[0][0]=="{"?Yr[a[1]]:a[0]);return o=>{let c="";for(let f=0;f<n.length;f++)c+=typeof n[f]=="string"?n[f]:n[f](o,e);return c}}const Kr=new Intl.DateTimeFormat().resolvedOptions().timeZone;function Jr(t,e){let n;return e=="UTC"||e=="Etc/UTC"?n=new Date(+t+t.getTimezoneOffset()*6e4):e==Kr?n=t:(n=new Date(t.toLocaleString("en-US",{timeZone:e})),n.setMilliseconds(t.getMilliseconds())),n}const Ni=t=>t%1==0,On=[1,2,2.5,5],Zr=vn(10,-32,0,On),Oi=vn(10,0,32,On),Qr=Oi.filter(Ni),hs=Zr.concat(Oi),Vl=`
`,Ri="{YYYY}",Ya=Vl+Ri,Hi="{M}/{D}",fn=Vl+Hi,En=fn+"/{YY}",zi="{aa}",Xr="{h}:{mm}",Bs=Xr+zi,Ka=Vl+Bs,Ja=":{ss}",dt=null;function Ii(t){let e=t*1e3,n=e*60,s=n*60,a=s*24,o=a*30,c=a*365,d=(t==1?vn(10,0,3,On).filter(Ni):vn(10,-3,0,On)).concat([e,e*5,e*10,e*15,e*30,n,n*5,n*10,n*15,n*30,s,s*2,s*3,s*4,s*6,s*8,s*12,a,a*2,a*3,a*4,a*5,a*6,a*7,a*8,a*9,a*10,a*15,o,o*2,o*3,o*4,o*6,c,c*2,c*5,c*10,c*25,c*50,c*100]);const p=[[c,Ri,dt,dt,dt,dt,dt,dt,1],[a*28,"{MMM}",Ya,dt,dt,dt,dt,dt,1],[a,Hi,Ya,dt,dt,dt,dt,dt,1],[s,"{h}"+zi,En,dt,fn,dt,dt,dt,1],[n,Bs,En,dt,fn,dt,dt,dt,1],[e,Ja,En+" "+Bs,dt,fn+" "+Bs,dt,Ka,dt,1],[t,Ja+".{fff}",En+" "+Bs,dt,fn+" "+Bs,dt,Ka,dt,1]];function b(g){return(w,P,D,I,B,q)=>{let x=[],F=B>=c,S=B>=o&&B<c,Z=g(D),L=mt(Z*t,3),Q=$l(Z.getFullYear(),F?0:Z.getMonth(),S||F?1:Z.getDate()),Y=mt(Q*t,3);if(S||F){let et=S?B/o:0,G=F?B/c:0,M=L==Y?L:mt($l(Q.getFullYear()+G,Q.getMonth()+et,1)*t,3),J=new Date(Nt(M/t)),N=J.getFullYear(),W=J.getMonth();for(let z=0;M<=I;z++){let nt=$l(N+G*z,W+et*z,1),H=nt-g(mt(nt*t,3));M=mt((+nt+H)*t,3),M<=I&&x.push(M)}}else{let et=B>=a?a:B,G=he(D)-he(L),M=Y+G+In(L-Y,et);x.push(M);let J=g(M),N=J.getHours()+J.getMinutes()/n+J.getSeconds()/s,W=B/s,z=w.axes[P]._space,nt=q/z;for(;M=mt(M+B,t==1?0:3),!(M>I);)if(W>1){let H=he(mt(N+W,6))%24,lt=g(M).getHours()-H;lt>1&&(lt=-1),M-=lt*s,N=(N+W)%24;let ft=x[x.length-1];mt((M-ft)/B,3)*nt>=.7&&x.push(M)}else x.push(M)}return x}}return[d,p,b]}const[tc,ec,sc]=Ii(1),[nc,lc,ac]=Ii(.001);vn(2,-53,53,[1]);function Za(t,e){return t.map(n=>n.map((s,a)=>a==0||a==8||s==null?s:e(a==1||n[8]==0?s:n[1]+s)))}function Qa(t,e){return(n,s,a,o,c)=>{let f=e.find(D=>c>=D[0])||e[e.length-1],d,p,b,g,w,P;return s.map(D=>{let I=t(D),B=I.getFullYear(),q=I.getMonth(),x=I.getDate(),F=I.getHours(),S=I.getMinutes(),Z=I.getSeconds(),L=B!=d&&f[2]||q!=p&&f[3]||x!=b&&f[4]||F!=g&&f[5]||S!=w&&f[6]||Z!=P&&f[7]||f[1];return d=B,p=q,b=x,g=F,w=S,P=Z,L(I)})}}function ic(t,e){let n=Fl(e);return(s,a,o,c,f)=>a.map(d=>n(t(d)))}function $l(t,e,n){return new Date(t,e,n)}function Xa(t,e){return e(t)}const oc="{YYYY}-{MM}-{DD} {h}:{mm}{aa}";function ti(t,e){return(n,s,a,o)=>o==null?Nl:e(t(s))}function rc(t,e){let n=t.series[e];return n.width?n.stroke(t,e):n.points.width?n.points.stroke(t,e):null}function cc(t,e){return t.series[e].fill(t,e)}const uc={show:!0,live:!0,isolate:!1,mount:Cr,markers:{show:!0,width:2,stroke:rc,fill:cc,dash:"solid"},idx:null,idxs:null,values:[]};function dc(t,e){let n=t.cursor.points,s=ke(),a=n.size(t,e);wt(s,un,a),wt(s,dn,a);let o=a/-2;wt(s,"marginLeft",o),wt(s,"marginTop",o);let c=n.width(t,e,a);return c&&wt(s,"borderWidth",c),s}function fc(t,e){let n=t.series[e].points;return n._fill||n._stroke}function pc(t,e){let n=t.series[e].points;return n._stroke||n._fill}function hc(t,e){return t.series[e].points.size}const wl=[0,0];function mc(t,e,n){return wl[0]=e,wl[1]=n,wl}function Pn(t,e,n,s=!0){return a=>{a.button==0&&(!s||a.target==e)&&n(a)}}function yl(t,e,n,s=!0){return a=>{(!s||a.target==e)&&n(a)}}const vc={show:!0,x:!0,y:!0,lock:!1,move:mc,points:{one:!1,show:dc,size:hc,width:0,stroke:pc,fill:fc},bind:{mousedown:Pn,mouseup:Pn,click:Pn,dblclick:Pn,mousemove:yl,mouseleave:yl,mouseenter:yl},drag:{setScale:!0,x:!0,y:!1,dist:0,uni:null,click:(t,e)=>{e.stopPropagation(),e.stopImmediatePropagation()},_x:!1,_y:!1},focus:{dist:(t,e,n,s,a)=>s-a,prox:-1,bias:0},hover:{skip:[void 0],prox:null,bias:0},left:-10,top:-10,idx:null,dataIdx:null,idxs:null,event:null},Fi={show:!0,stroke:"rgba(0,0,0,0.07)",width:2},Bl=Ct({},Fi,{filter:Mi}),Vi=Ct({},Bl,{size:10}),Bi=Ct({},Fi,{show:!1}),jl='12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',ji="bold "+jl,qi=1.5,ei={show:!0,scale:"x",stroke:Dl,space:50,gap:5,alignTo:1,size:50,labelGap:0,labelSize:30,labelFont:ji,side:2,grid:Bl,ticks:Vi,border:Bi,font:jl,lineGap:qi,rotate:0},gc="Value",bc="Time",si={show:!0,scale:"x",auto:!1,sorted:1,min:ht,max:-ht,idxs:[]};function $c(t,e,n,s,a){return e.map(o=>o==null?"":zl(o))}function wc(t,e,n,s,a,o,c){let f=[],d=ss.get(a)||0;n=c?n:mt(In(n,a),d);for(let p=n;p<=s;p=mt(p+a,d))f.push(Object.is(p,-0)?0:p);return f}function Al(t,e,n,s,a,o,c){const f=[],d=t.scales[t.axes[e].scale].log,p=d==10?Ue:_i,b=he(p(n));a=qs(d,b),d==10&&(a=hs[Ee(a,hs)]);let g=n,w=a*d;d==10&&(w=hs[Ee(w,hs)]);do f.push(g),g=g+a,d==10&&!ss.has(g)&&(g=mt(g,ss.get(a))),g>=w&&(a=g,w=a*d,d==10&&(w=hs[Ee(w,hs)]));while(g<=s);return f}function yc(t,e,n,s,a,o,c){let d=t.scales[t.axes[e].scale].asinh,p=s>d?Al(t,e,se(d,n),s,a):[d],b=s>=0&&n<=0?[0]:[];return(n<-d?Al(t,e,se(d,-s),-n,a):[d]).reverse().map(w=>-w).concat(b,p)}const Wi=/./,kc=/[12357]/,_c=/[125]/,ni=/1/,Cl=(t,e,n,s)=>t.map((a,o)=>e==4&&a==0||o%s==0&&n.test(a.toExponential()[a<0?1:0])?a:null);function xc(t,e,n,s,a){let o=t.axes[n],c=o.scale,f=t.scales[c],d=t.valToPos,p=o._space,b=d(10,c),g=d(9,c)-b>=p?Wi:d(7,c)-b>=p?kc:d(5,c)-b>=p?_c:ni;if(g==ni){let w=Ot(d(1,c)-b);if(w<p)return Cl(e.slice().reverse(),f.distr,g,_e(p/w)).reverse()}return Cl(e,f.distr,g,1)}function Sc(t,e,n,s,a){let o=t.axes[n],c=o.scale,f=o._space,d=t.valToPos,p=Ot(d(1,c)-d(2,c));return p<f?Cl(e.slice().reverse(),3,Wi,_e(f/p)).reverse():e}function Mc(t,e,n,s){return s==null?Nl:e==null?"":zl(e)}const li={show:!0,scale:"y",stroke:Dl,space:30,gap:5,alignTo:1,size:50,labelGap:0,labelSize:30,labelFont:ji,side:3,grid:Bl,ticks:Vi,border:Bi,font:jl,lineGap:qi,rotate:0};function Tc(t,e){let n=3+(t||1)*2;return mt(n*e,3)}function Ac(t,e){let{scale:n,idxs:s}=t.series[0],a=t._data[0],o=t.valToPos(a[s[0]],n,!0),c=t.valToPos(a[s[1]],n,!0),f=Ot(c-o),d=t.series[e],p=f/(d.points.space*rt);return s[1]-s[0]<=p}const ai={scale:null,auto:!0,sorted:0,min:ht,max:-ht},Ui=(t,e,n,s,a)=>a,ii={show:!0,auto:!0,sorted:0,gaps:Ui,alpha:1,facets:[Ct({},ai,{scale:"x"}),Ct({},ai,{scale:"y"})]},oi={scale:"y",auto:!0,sorted:0,show:!0,spanGaps:!1,gaps:Ui,alpha:1,points:{show:Ac,filter:null},values:null,min:ht,max:-ht,idxs:[],path:null,clip:null};function Cc(t,e,n,s,a){return n/10}const Gi={time:tr,auto:!0,distr:1,log:10,asinh:1,min:null,max:null,dir:1,ori:0},Ec=Ct({},Gi,{time:!1,ori:1}),ri={};function Yi(t,e){let n=ri[t];return n||(n={key:t,plots:[],sub(s){n.plots.push(s)},unsub(s){n.plots=n.plots.filter(a=>a!=s)},pub(s,a,o,c,f,d,p){for(let b=0;b<n.plots.length;b++)n.plots[b]!=a&&n.plots[b].pub(s,a,o,c,f,d,p)}},t!=null&&(ri[t]=n)),n}const Gs=1,El=2;function ws(t,e,n){const s=t.mode,a=t.series[e],o=s==2?t._data[e]:t._data,c=t.scales,f=t.bbox;let d=o[0],p=s==2?o[1]:o[e],b=s==2?c[a.facets[0].scale]:c[t.series[0].scale],g=s==2?c[a.facets[1].scale]:c[a.scale],w=f.left,P=f.top,D=f.width,I=f.height,B=t.valToPosH,q=t.valToPosV;return b.ori==0?n(a,d,p,b,g,B,q,w,P,D,I,Bn,Js,qn,Ji,Qi):n(a,d,p,b,g,q,B,P,w,I,D,jn,Zs,Ul,Zi,Xi)}function ql(t,e){let n=0,s=0,a=it(t.bands,Il);for(let o=0;o<a.length;o++){let c=a[o];c.series[0]==e?n=c.dir:c.series[1]==e&&(c.dir==1?s|=1:s|=2)}return[n,s==1?-1:s==2?1:s==3?2:0]}function Pc(t,e,n,s,a){let o=t.mode,c=t.series[e],f=o==2?c.facets[1].scale:c.scale,d=t.scales[f];return a==-1?d.min:a==1?d.max:d.distr==3?d.dir==1?d.min:d.max:0}function Ge(t,e,n,s,a,o){return ws(t,e,(c,f,d,p,b,g,w,P,D,I,B)=>{let q=c.pxRound;const x=p.dir*(p.ori==0?1:-1),F=p.ori==0?Js:Zs;let S,Z;x==1?(S=n,Z=s):(S=s,Z=n);let L=q(g(f[S],p,I,P)),Q=q(w(d[S],b,B,D)),Y=q(g(f[Z],p,I,P)),et=q(w(o==1?b.max:b.min,b,B,D)),G=new Path2D(a);return F(G,Y,et),F(G,L,et),F(G,L,Q),G})}function Vn(t,e,n,s,a,o){let c=null;if(t.length>0){c=new Path2D;const f=e==0?qn:Ul;let d=n;for(let g=0;g<t.length;g++){let w=t[g];if(w[1]>w[0]){let P=w[0]-d;P>0&&f(c,d,s,P,s+o),d=w[1]}}let p=n+a-d,b=10;p>0&&f(c,d,s-b/2,p,s+o+b)}return c}function Lc(t,e,n){let s=t[t.length-1];s&&s[0]==e?s[1]=n:t.push([e,n])}function Wl(t,e,n,s,a,o,c){let f=[],d=t.length;for(let p=a==1?n:s;p>=n&&p<=s;p+=a)if(e[p]===null){let g=p,w=p;if(a==1)for(;++p<=s&&e[p]===null;)w=p;else for(;--p>=n&&e[p]===null;)w=p;let P=o(t[g]),D=w==g?P:o(t[w]),I=g-a;P=c<=0&&I>=0&&I<d?o(t[I]):P;let q=w+a;D=c>=0&&q>=0&&q<d?o(t[q]):D,D>=P&&f.push([P,D])}return f}function ci(t){return t==0?Si:t==1?Nt:e=>ps(e,t)}function Ki(t){let e=t==0?Bn:jn,n=t==0?(a,o,c,f,d,p)=>{a.arcTo(o,c,f,d,p)}:(a,o,c,f,d,p)=>{a.arcTo(c,o,d,f,p)},s=t==0?(a,o,c,f,d)=>{a.rect(o,c,f,d)}:(a,o,c,f,d)=>{a.rect(c,o,d,f)};return(a,o,c,f,d,p=0,b=0)=>{p==0&&b==0?s(a,o,c,f,d):(p=Pe(p,f/2,d/2),b=Pe(b,f/2,d/2),e(a,o+p,c),n(a,o+f,c,o+f,c+d,p),n(a,o+f,c+d,o,c+d,b),n(a,o,c+d,o,c,b),n(a,o,c,o+f,c,p),a.closePath())}}const Bn=(t,e,n)=>{t.moveTo(e,n)},jn=(t,e,n)=>{t.moveTo(n,e)},Js=(t,e,n)=>{t.lineTo(e,n)},Zs=(t,e,n)=>{t.lineTo(n,e)},qn=Ki(0),Ul=Ki(1),Ji=(t,e,n,s,a,o)=>{t.arc(e,n,s,a,o)},Zi=(t,e,n,s,a,o)=>{t.arc(n,e,s,a,o)},Qi=(t,e,n,s,a,o,c)=>{t.bezierCurveTo(e,n,s,a,o,c)},Xi=(t,e,n,s,a,o,c)=>{t.bezierCurveTo(n,e,a,s,c,o)};function to(t){return(e,n,s,a,o)=>ws(e,n,(c,f,d,p,b,g,w,P,D,I,B)=>{let{pxRound:q,points:x}=c,F,S;p.ori==0?(F=Bn,S=Ji):(F=jn,S=Zi);const Z=mt(x.width*rt,3);let L=(x.size-x.width)/2*rt,Q=mt(L*2,3),Y=new Path2D,et=new Path2D,{left:G,top:M,width:J,height:N}=e.bbox;qn(et,G-Q,M-Q,J+Q*2,N+Q*2);const W=z=>{if(d[z]!=null){let nt=q(g(f[z],p,I,P)),H=q(w(d[z],b,B,D));F(Y,nt+L,H),S(Y,nt,H,L,0,Ln*2)}};if(o)o.forEach(W);else for(let z=s;z<=a;z++)W(z);return{stroke:Z>0?Y:null,fill:Y,clip:et,flags:Gs|El}})}function eo(t){return(e,n,s,a,o,c)=>{s!=a&&(o!=s&&c!=s&&t(e,n,s),o!=a&&c!=a&&t(e,n,a),t(e,n,c))}}const Dc=eo(Js),Nc=eo(Zs);function so(t){const e=it(t?.alignGaps,0);return(n,s,a,o)=>ws(n,s,(c,f,d,p,b,g,w,P,D,I,B)=>{[a,o]=Hn(d,a,o);let q=c.pxRound,x=N=>q(g(N,p,I,P)),F=N=>q(w(N,b,B,D)),S,Z;p.ori==0?(S=Js,Z=Dc):(S=Zs,Z=Nc);const L=p.dir*(p.ori==0?1:-1),Q={stroke:new Path2D,fill:null,clip:null,band:null,gaps:null,flags:Gs},Y=Q.stroke;let et=!1;if(o-a>=I*4){let N=O=>n.posToVal(O,p.key,!0),W=null,z=null,nt,H,ne,yt=x(f[L==1?a:o]),lt=x(f[a]),ft=x(f[o]),X=N(L==1?lt+1:ft-1);for(let O=L==1?a:o;O>=a&&O<=o;O+=L){let Lt=f[O],kt=(L==1?Lt<X:Lt>X)?yt:x(Lt),ut=d[O];kt==yt?ut!=null?(H=ut,W==null?(S(Y,kt,F(H)),nt=W=z=H):H<W?W=H:H>z&&(z=H)):ut===null&&(et=!0):(W!=null&&Z(Y,yt,F(W),F(z),F(nt),F(H)),ut!=null?(H=ut,S(Y,kt,F(H)),W=z=nt=H):(W=z=null,ut===null&&(et=!0)),yt=kt,X=N(yt+L))}W!=null&&W!=z&&ne!=yt&&Z(Y,yt,F(W),F(z),F(nt),F(H))}else for(let N=L==1?a:o;N>=a&&N<=o;N+=L){let W=d[N];W===null?et=!0:W!=null&&S(Y,x(f[N]),F(W))}let[M,J]=ql(n,s);if(c.fill!=null||M!=0){let N=Q.fill=new Path2D(Y),W=c.fillTo(n,s,c.min,c.max,M),z=F(W),nt=x(f[a]),H=x(f[o]);L==-1&&([H,nt]=[nt,H]),S(N,H,z),S(N,nt,z)}if(!c.spanGaps){let N=[];et&&N.push(...Wl(f,d,a,o,L,x,e)),Q.gaps=N=c.gaps(n,s,a,o,N),Q.clip=Vn(N,p.ori,P,D,I,B)}return J!=0&&(Q.band=J==2?[Ge(n,s,a,o,Y,-1),Ge(n,s,a,o,Y,1)]:Ge(n,s,a,o,Y,J)),Q})}function Oc(t){const e=it(t.align,1),n=it(t.ascDesc,!1),s=it(t.alignGaps,0),a=it(t.extend,!1);return(o,c,f,d)=>ws(o,c,(p,b,g,w,P,D,I,B,q,x,F)=>{[f,d]=Hn(g,f,d);let S=p.pxRound,{left:Z,width:L}=o.bbox,Q=lt=>S(D(lt,w,x,B)),Y=lt=>S(I(lt,P,F,q)),et=w.ori==0?Js:Zs;const G={stroke:new Path2D,fill:null,clip:null,band:null,gaps:null,flags:Gs},M=G.stroke,J=w.dir*(w.ori==0?1:-1);let N=Y(g[J==1?f:d]),W=Q(b[J==1?f:d]),z=W,nt=W;a&&e==-1&&(nt=Z,et(M,nt,N)),et(M,W,N);for(let lt=J==1?f:d;lt>=f&&lt<=d;lt+=J){let ft=g[lt];if(ft==null)continue;let X=Q(b[lt]),O=Y(ft);e==1?et(M,X,N):et(M,z,O),et(M,X,O),N=O,z=X}let H=z;a&&e==1&&(H=Z+L,et(M,H,N));let[ne,yt]=ql(o,c);if(p.fill!=null||ne!=0){let lt=G.fill=new Path2D(M),ft=p.fillTo(o,c,p.min,p.max,ne),X=Y(ft);et(lt,H,X),et(lt,nt,X)}if(!p.spanGaps){let lt=[];lt.push(...Wl(b,g,f,d,J,Q,s));let ft=p.width*rt/2,X=n||e==1?ft:-ft,O=n||e==-1?-ft:ft;lt.forEach(Lt=>{Lt[0]+=X,Lt[1]+=O}),G.gaps=lt=p.gaps(o,c,f,d,lt),G.clip=Vn(lt,w.ori,B,q,x,F)}return yt!=0&&(G.band=yt==2?[Ge(o,c,f,d,M,-1),Ge(o,c,f,d,M,1)]:Ge(o,c,f,d,M,yt)),G})}function ui(t,e,n,s,a,o,c=ht){if(t.length>1){let f=null;for(let d=0,p=1/0;d<t.length;d++)if(e[d]!==void 0){if(f!=null){let b=Ot(t[d]-t[f]);b<p&&(p=b,c=Ot(n(t[d],s,a,o)-n(t[f],s,a,o)))}f=d}}return c}function Rc(t){t=t||hn;const e=it(t.size,[.6,ht,1]),n=t.align||0,s=t.gap||0;let a=t.radius;a=a==null?[0,0]:typeof a=="number"?[a,0]:a;const o=st(a),c=1-e[0],f=it(e[1],ht),d=it(e[2],1),p=it(t.disp,hn),b=it(t.each,P=>{}),{fill:g,stroke:w}=p;return(P,D,I,B)=>ws(P,D,(q,x,F,S,Z,L,Q,Y,et,G,M)=>{let J=q.pxRound,N=n,W=s*rt,z=f*rt,nt=d*rt,H,ne;S.ori==0?[H,ne]=o(P,D):[ne,H]=o(P,D);const yt=S.dir*(S.ori==0?1:-1);let lt=S.ori==0?qn:Ul,ft=S.ori==0?b:(C,vt,Dt,Ss,as,De,is)=>{b(C,vt,Dt,as,Ss,is,De)},X=it(P.bands,Il).find(C=>C.series[0]==D),O=X!=null?X.dir:0,Lt=q.fillTo(P,D,q.min,q.max,O),Jt=J(Q(Lt,Z,M,et)),kt,ut,xe,re=G,xt=J(q.width*rt),Le=!1,Be=null,ve=null,Ke=null,ks=null;g!=null&&(xt==0||w!=null)&&(Le=!0,Be=g.values(P,D,I,B),ve=new Map,new Set(Be).forEach(C=>{C!=null&&ve.set(C,new Path2D)}),xt>0&&(Ke=w.values(P,D,I,B),ks=new Map,new Set(Ke).forEach(C=>{C!=null&&ks.set(C,new Path2D)})));let{x0:_s,size:Xs}=p;if(_s!=null&&Xs!=null){N=1,x=_s.values(P,D,I,B),_s.unit==2&&(x=x.map(Dt=>P.posToVal(Y+Dt*G,S.key,!0)));let C=Xs.values(P,D,I,B);Xs.unit==2?ut=C[0]*G:ut=L(C[0],S,G,Y)-L(0,S,G,Y),re=ui(x,F,L,S,G,Y,re),xe=re-ut+W}else re=ui(x,F,L,S,G,Y,re),xe=re*c+W,ut=re-xe;xe<1&&(xe=0),xt>=ut/2&&(xt=0),xe<5&&(J=Si);let $n=xe>0,ns=re-xe-($n?xt:0);ut=J(Tl(ns,nt,z)),kt=(N==0?ut/2:N==yt?0:ut)-N*yt*((N==0?W/2:0)+($n?xt/2:0));const Zt={stroke:null,fill:null,clip:null,band:null,gaps:null,flags:0},xs=Le?null:new Path2D;let je=null;if(X!=null)je=P.data[X.series[1]];else{let{y0:C,y1:vt}=p;C!=null&&vt!=null&&(F=vt.values(P,D,I,B),je=C.values(P,D,I,B))}let ls=H*ut,K=ne*ut;for(let C=yt==1?I:B;C>=I&&C<=B;C+=yt){let vt=F[C];if(vt==null)continue;if(je!=null){let le=je[C]??0;if(vt-le==0)continue;Jt=Q(le,Z,M,et)}let Dt=S.distr!=2||p!=null?x[C]:C,Ss=L(Dt,S,G,Y),as=Q(it(vt,Lt),Z,M,et),De=J(Ss-kt),is=J(se(as,Jt)),ce=J(Pe(as,Jt)),ge=is-ce;if(vt!=null){let le=vt<0?K:ls,Se=vt<0?ls:K;Le?(xt>0&&Ke[C]!=null&&lt(ks.get(Ke[C]),De,ce+he(xt/2),ut,se(0,ge-xt),le,Se),Be[C]!=null&&lt(ve.get(Be[C]),De,ce+he(xt/2),ut,se(0,ge-xt),le,Se)):lt(xs,De,ce+he(xt/2),ut,se(0,ge-xt),le,Se),ft(P,D,C,De-xt/2,ce,ut+xt,ge)}}return xt>0?Zt.stroke=Le?ks:xs:Le||(Zt._fill=q.width==0?q._fill:q._stroke??q._fill,Zt.width=0),Zt.fill=Le?ve:xs,Zt})}function Hc(t,e){const n=it(e?.alignGaps,0);return(s,a,o,c)=>ws(s,a,(f,d,p,b,g,w,P,D,I,B,q)=>{[o,c]=Hn(p,o,c);let x=f.pxRound,F=H=>x(w(H,b,B,D)),S=H=>x(P(H,g,q,I)),Z,L,Q;b.ori==0?(Z=Bn,Q=Js,L=Qi):(Z=jn,Q=Zs,L=Xi);const Y=b.dir*(b.ori==0?1:-1);let et=F(d[Y==1?o:c]),G=et,M=[],J=[];for(let H=Y==1?o:c;H>=o&&H<=c;H+=Y)if(p[H]!=null){let yt=d[H],lt=F(yt);M.push(G=lt),J.push(S(p[H]))}const N={stroke:t(M,J,Z,Q,L,x),fill:null,clip:null,band:null,gaps:null,flags:Gs},W=N.stroke;let[z,nt]=ql(s,a);if(f.fill!=null||z!=0){let H=N.fill=new Path2D(W),ne=f.fillTo(s,a,f.min,f.max,z),yt=S(ne);Q(H,G,yt),Q(H,et,yt)}if(!f.spanGaps){let H=[];H.push(...Wl(d,p,o,c,Y,F,n)),N.gaps=H=f.gaps(s,a,o,c,H),N.clip=Vn(H,b.ori,D,I,B,q)}return nt!=0&&(N.band=nt==2?[Ge(s,a,o,c,W,-1),Ge(s,a,o,c,W,1)]:Ge(s,a,o,c,W,nt)),N})}function zc(t){return Hc(Ic,t)}function Ic(t,e,n,s,a,o){const c=t.length;if(c<2)return null;const f=new Path2D;if(n(f,t[0],e[0]),c==2)s(f,t[1],e[1]);else{let d=Array(c),p=Array(c-1),b=Array(c-1),g=Array(c-1);for(let w=0;w<c-1;w++)b[w]=e[w+1]-e[w],g[w]=t[w+1]-t[w],p[w]=b[w]/g[w];d[0]=p[0];for(let w=1;w<c-1;w++)p[w]===0||p[w-1]===0||p[w-1]>0!=p[w]>0?d[w]=0:(d[w]=3*(g[w-1]+g[w])/((2*g[w]+g[w-1])/p[w-1]+(g[w]+2*g[w-1])/p[w]),isFinite(d[w])||(d[w]=0));d[c-1]=p[c-2];for(let w=0;w<c-1;w++)a(f,t[w]+g[w]/3,e[w]+d[w]*g[w]/3,t[w+1]-g[w]/3,e[w+1]-d[w+1]*g[w]/3,t[w+1],e[w+1])}return f}const Pl=new Set;function di(){for(let t of Pl)t.syncRect(!0)}Ks&&(vs($r,js,di),vs(wr,js,di,!0),vs(Dn,js,()=>{jt.pxRatio=rt}));const Fc=so(),Vc=to();function fi(t,e,n,s){return(s?[t[0],t[1]].concat(t.slice(2)):[t[0]].concat(t.slice(1))).map((o,c)=>Ll(o,c,e,n))}function Bc(t,e){return t.map((n,s)=>s==0?{}:Ct({},e,n))}function Ll(t,e,n,s){return Ct({},e==0?n:s,t)}function no(t,e,n){return e==null?Ws:[e,n]}const jc=no;function qc(t,e,n){return e==null?Ws:Nn(e,n,Hl,!0)}function lo(t,e,n,s){return e==null?Ws:zn(e,n,t.scales[s].log,!1)}const Wc=lo;function ao(t,e,n,s){return e==null?Ws:Rl(e,n,t.scales[s].log,!1)}const Uc=ao;function Gc(t,e,n,s,a){let o=se(qa(t),qa(e)),c=e-t,f=Ee(a/s*c,n);do{let d=n[f],p=s*d/c;if(p>=a&&o+(d<5?ss.get(d):0)<=17)return[d,p]}while(++f<n.length);return[0,0]}function pi(t){let e,n;return t=t.replace(/(\d+)px/,(s,a)=>(e=Nt((n=+a)*rt))+"px"),[t,e,n]}function Yc(t){t.show&&[t.font,t.labelFont].forEach(e=>{let n=mt(e[2]*rt,1);e[0]=e[0].replace(/[0-9.]+px/,n+"px"),e[1]=n})}function jt(t,e,n){const s={mode:it(t.mode,1)},a=s.mode;function o(l,i,r,u){let h=i.valToPct(l);return u+r*(i.dir==-1?1-h:h)}function c(l,i,r,u){let h=i.valToPct(l);return u+r*(i.dir==-1?h:1-h)}function f(l,i,r,u){return i.ori==0?o(l,i,r,u):c(l,i,r,u)}s.valToPosH=o,s.valToPosV=c;let d=!1;s.status=0;const p=s.root=ke(er);if(t.id!=null&&(p.id=t.id),pe(p,t.class),t.title){let l=ke(lr,p);l.textContent=t.title}const b=Ce("canvas"),g=s.ctx=b.getContext("2d"),w=ke(ar,p);vs("click",w,l=>{l.target===D&&(gt!=Rs||_t!=Hs)&&Ut.click(s,l)},!0);const P=s.under=ke(ir,w);w.appendChild(b);const D=s.over=ke(or,w);t=Us(t);const I=+it(t.pxAlign,1),B=ci(I);(t.plugins||[]).forEach(l=>{l.opts&&(t=l.opts(s,t)||t)});const q=t.ms||.001,x=s.series=a==1?fi(t.series||[],si,oi,!1):Bc(t.series||[null],ii),F=s.axes=fi(t.axes||[],ei,li,!0),S=s.scales={},Z=s.bands=t.bands||[];Z.forEach(l=>{l.fill=st(l.fill||null),l.dir=it(l.dir,-1)});const L=a==2?x[1].facets[0].scale:x[0].scale,Q={axes:Ho,series:Lo},Y=(t.drawOrder||["axes","series"]).map(l=>Q[l]);function et(l){const i=l.distr==3?r=>Ue(r>0?r:l.clamp(s,r,l.min,l.max,l.key)):l.distr==4?r=>bl(r,l.asinh):l.distr==100?r=>l.fwd(r):r=>r;return r=>{let u=i(r),{_min:h,_max:m}=l,y=m-h;return(u-h)/y}}function G(l){let i=S[l];if(i==null){let r=(t.scales||hn)[l]||hn;if(r.from!=null){G(r.from);let u=Ct({},S[r.from],r,{key:l});u.valToPct=et(u),S[l]=u}else{i=S[l]=Ct({},l==L?Gi:Ec,r),i.key=l;let u=i.time,h=i.range,m=es(h);if((l!=L||a==2&&!u)&&(m&&(h[0]==null||h[1]==null)&&(h={min:h[0]==null?Va:{mode:1,hard:h[0],soft:h[0]},max:h[1]==null?Va:{mode:1,hard:h[1],soft:h[1]}},m=!1),!m&&Fn(h))){let y=h;h=(k,_,T)=>_==null?Ws:Nn(_,T,y)}i.range=st(h||(u?jc:l==L?i.distr==3?Wc:i.distr==4?Uc:no:i.distr==3?lo:i.distr==4?ao:qc)),i.auto=st(m?!1:i.auto),i.clamp=st(i.clamp||Cc),i._min=i._max=null,i.valToPct=et(i)}}}G("x"),G("y"),a==1&&x.forEach(l=>{G(l.scale)}),F.forEach(l=>{G(l.scale)});for(let l in t.scales)G(l);const M=S[L],J=M.distr;let N,W;M.ori==0?(pe(p,sr),N=o,W=c):(pe(p,nr),N=c,W=o);const z={};for(let l in S){let i=S[l];(i.min!=null||i.max!=null)&&(z[l]={min:i.min,max:i.max},i.min=i.max=null)}const nt=t.tzDate||(l=>new Date(Nt(l/q))),H=t.fmtDate||Fl,ne=q==1?sc(nt):ac(nt),yt=Qa(nt,Za(q==1?ec:lc,H)),lt=ti(nt,Xa(oc,H)),ft=[],X=s.legend=Ct({},uc,t.legend),O=s.cursor=Ct({},vc,{drag:{y:a==2}},t.cursor),Lt=X.show,Jt=O.show,kt=X.markers;X.idxs=ft,kt.width=st(kt.width),kt.dash=st(kt.dash),kt.stroke=st(kt.stroke),kt.fill=st(kt.fill);let ut,xe,re,xt=[],Le=[],Be,ve=!1,Ke={};if(X.live){const l=x[1]?x[1].values:null;ve=l!=null,Be=ve?l(s,1,0):{_:0};for(let i in Be)Ke[i]=Nl}if(Lt)if(ut=Ce("table",pr,p),re=Ce("tbody",null,ut),X.mount(s,ut),ve){xe=Ce("thead",null,ut,re);let l=Ce("tr",null,xe);Ce("th",null,l);for(var ks in Be)Ce("th",Aa,l).textContent=ks}else pe(ut,mr),X.live&&pe(ut,hr);const _s={show:!0},Xs={show:!1};function $n(l,i){if(i==0&&(ve||!X.live||a==2))return Ws;let r=[],u=Ce("tr",vr,re,re.childNodes[i]);pe(u,l.class),l.show||pe(u,ms);let h=Ce("th",null,u);if(kt.show){let k=ke(gr,h);if(i>0){let _=kt.width(s,i);_&&(k.style.border=_+"px "+kt.dash(s,i)+" "+kt.stroke(s,i)),k.style.background=kt.fill(s,i)}}let m=ke(Aa,h);l.label instanceof HTMLElement?m.appendChild(l.label):m.textContent=l.label,i>0&&(kt.show||(m.style.color=l.width>0?kt.stroke(s,i):kt.fill(s,i)),Zt("click",h,k=>{if(O._lock)return;rs(k);let _=x.indexOf(l);if((k.ctrlKey||k.metaKey)!=X.isolate){let T=x.some((A,E)=>E>0&&E!=_&&A.show);x.forEach((A,E)=>{E>0&&Oe(E,T?E==_?_s:Xs:_s,!0,At.setSeries)})}else Oe(_,{show:!l.show},!0,At.setSeries)},!1),Ts&&Zt(La,h,k=>{O._lock||(rs(k),Oe(x.indexOf(l),Is,!0,At.setSeries))},!1));for(var y in Be){let k=Ce("td",br,u);k.textContent="--",r.push(k)}return[u,r]}const ns=new Map;function Zt(l,i,r,u=!0){const h=ns.get(i)||{},m=O.bind[l](s,i,r,u);m&&(vs(l,i,h[l]=m),ns.set(i,h))}function xs(l,i,r){const u=ns.get(i)||{};for(let h in u)(l==null||h==l)&&(Ml(h,i,u[h]),delete u[h]);l==null&&ns.delete(i)}let je=0,ls=0,K=0,C=0,vt=0,Dt=0,Ss=vt,as=Dt,De=K,is=C,ce=0,ge=0,le=0,Se=0;s.bbox={};let Un=!1,wn=!1,Ms=!1,os=!1,yn=!1,be=!1;function Gn(l,i,r){(r||l!=s.width||i!=s.height)&&Ql(l,i),Ls(!1),Ms=!0,wn=!0,Ds()}function Ql(l,i){s.width=je=K=l,s.height=ls=C=i,vt=Dt=0,So(),Mo();let r=s.bbox;ce=r.left=ps(vt*rt,.5),ge=r.top=ps(Dt*rt,.5),le=r.width=ps(K*rt,.5),Se=r.height=ps(C*rt,.5)}const ko=3;function _o(){let l=!1,i=0;for(;!l;){i++;let r=Oo(i),u=Ro(i);l=i==ko||r&&u,l||(Ql(s.width,s.height),wn=!0)}}function xo({width:l,height:i}){Gn(l,i)}s.setSize=xo;function So(){let l=!1,i=!1,r=!1,u=!1;F.forEach((h,m)=>{if(h.show&&h._show){let{side:y,_size:k}=h,_=y%2,T=h.label!=null?h.labelSize:0,A=k+T;A>0&&(_?(K-=A,y==3?(vt+=A,u=!0):r=!0):(C-=A,y==0?(Dt+=A,l=!0):i=!0))}}),cs[0]=l,cs[1]=r,cs[2]=i,cs[3]=u,K-=Je[1]+Je[3],vt+=Je[3],C-=Je[2]+Je[0],Dt+=Je[0]}function Mo(){let l=vt+K,i=Dt+C,r=vt,u=Dt;function h(m,y){switch(m){case 1:return l+=y,l-y;case 2:return i+=y,i-y;case 3:return r-=y,r+y;case 0:return u-=y,u+y}}F.forEach((m,y)=>{if(m.show&&m._show){let k=m.side;m._pos=h(k,m._size),m.label!=null&&(m._lpos=h(k,m.labelSize))}})}if(O.dataIdx==null){let l=O.hover,i=l.skip=new Set(l.skip??[]);i.add(void 0);let r=l.prox=st(l.prox),u=l.bias??(l.bias=0);O.dataIdx=(h,m,y,k)=>{if(m==0)return y;let _=y,T=r(h,m,y,k)??ht,A=T>=0&&T<ht,E=M.ori==0?K:C,U=O.left,ot=e[0],at=e[m];if(i.has(at[y])){_=null;let tt=null,j=null,R;if(u==0||u==-1)for(R=y;tt==null&&R-- >0;)i.has(at[R])||(tt=R);if(u==0||u==1)for(R=y;j==null&&R++<at.length;)i.has(at[R])||(j=R);if(tt!=null||j!=null)if(A){let $t=tt==null?-1/0:N(ot[tt],M,E,0),St=j==null?1/0:N(ot[j],M,E,0),Bt=U-$t,pt=St-U;Bt<=pt?Bt<=T&&(_=tt):pt<=T&&(_=j)}else _=j==null?tt:tt==null?j:y-tt<=j-y?tt:j}else A&&Ot(U-N(ot[y],M,E,0))>T&&(_=null);return _}}const rs=l=>{O.event=l};O.idxs=ft,O._lock=!1;let Gt=O.points;Gt.show=st(Gt.show),Gt.size=st(Gt.size),Gt.stroke=st(Gt.stroke),Gt.width=st(Gt.width),Gt.fill=st(Gt.fill);const Ne=s.focus=Ct({},t.focus||{alpha:.3},O.focus),Ts=Ne.prox>=0,As=Ts&&Gt.one;let $e=[],Cs=[],Es=[];function Xl(l,i){let r=Gt.show(s,i);if(r instanceof HTMLElement)return pe(r,fr),pe(r,l.class),Ie(r,-10,-10,K,C),D.insertBefore(r,$e[i]),r}function ta(l,i){if(a==1||i>0){let r=a==1&&S[l.scale].time,u=l.value;l.value=r?Ga(u)?ti(nt,Xa(u,H)):u||lt:u||Mc,l.label=l.label||(r?bc:gc)}if(As||i>0){l.width=l.width==null?1:l.width,l.paths=l.paths||Fc||Er,l.fillTo=st(l.fillTo||Pc),l.pxAlign=+it(l.pxAlign,I),l.pxRound=ci(l.pxAlign),l.stroke=st(l.stroke||null),l.fill=st(l.fill||null),l._stroke=l._fill=l._paths=l._focus=null;let r=Tc(se(1,l.width),1),u=l.points=Ct({},{size:r,width:se(1,r*.2),stroke:l.stroke,space:r*2,paths:Vc,_stroke:null,_fill:null},l.points);u.show=st(u.show),u.filter=st(u.filter),u.fill=st(u.fill),u.stroke=st(u.stroke),u.paths=st(u.paths),u.pxAlign=l.pxAlign}if(Lt){let r=$n(l,i);xt.splice(i,0,r[0]),Le.splice(i,0,r[1]),X.values.push(null)}if(Jt){ft.splice(i,0,null);let r=null;As?i==0&&(r=Xl(l,i)):i>0&&(r=Xl(l,i)),$e.splice(i,0,r),Cs.splice(i,0,0),Es.splice(i,0,0)}Vt("addSeries",i)}function To(l,i){i=i??x.length,l=a==1?Ll(l,i,si,oi):Ll(l,i,{},ii),x.splice(i,0,l),ta(x[i],i)}s.addSeries=To;function Ao(l){if(x.splice(l,1),Lt){X.values.splice(l,1),Le.splice(l,1);let i=xt.splice(l,1)[0];xs(null,i.firstChild),i.remove()}Jt&&(ft.splice(l,1),$e.splice(l,1)[0].remove(),Cs.splice(l,1),Es.splice(l,1)),Vt("delSeries",l)}s.delSeries=Ao;const cs=[!1,!1,!1,!1];function Co(l,i){if(l._show=l.show,l.show){let r=l.side%2,u=S[l.scale];u==null&&(l.scale=r?x[1].scale:L,u=S[l.scale]);let h=u.time;l.size=st(l.size),l.space=st(l.space),l.rotate=st(l.rotate),es(l.incrs)&&l.incrs.forEach(y=>{!ss.has(y)&&ss.set(y,Ai(y))}),l.incrs=st(l.incrs||(u.distr==2?Qr:h?q==1?tc:nc:hs)),l.splits=st(l.splits||(h&&u.distr==1?ne:u.distr==3?Al:u.distr==4?yc:wc)),l.stroke=st(l.stroke),l.grid.stroke=st(l.grid.stroke),l.ticks.stroke=st(l.ticks.stroke),l.border.stroke=st(l.border.stroke);let m=l.values;l.values=es(m)&&!es(m[0])?st(m):h?es(m)?Qa(nt,Za(m,H)):Ga(m)?ic(nt,m):m||yt:m||$c,l.filter=st(l.filter||(u.distr>=3&&u.log==10?xc:u.distr==3&&u.log==2?Sc:Mi)),l.font=pi(l.font),l.labelFont=pi(l.labelFont),l._size=l.size(s,null,i,0),l._space=l._rotate=l._incrs=l._found=l._splits=l._values=null,l._size>0&&(cs[i]=!0,l._el=ke(rr,w))}}function tn(l,i,r,u){let[h,m,y,k]=r,_=i%2,T=0;return _==0&&(k||m)&&(T=i==0&&!h||i==2&&!y?Nt(ei.size/3):0),_==1&&(h||y)&&(T=i==1&&!m||i==3&&!k?Nt(li.size/2):0),T}const ea=s.padding=(t.padding||[tn,tn,tn,tn]).map(l=>st(it(l,tn))),Je=s._padding=ea.map((l,i)=>l(s,i,cs,0));let Wt,Ht=null,zt=null;const kn=a==1?x[0].idxs:null;let Me=null,en=!1;function sa(l,i){if(e=l??[],s.data=s._data=e,a==2){Wt=0;for(let r=1;r<x.length;r++)Wt+=e[r][0].length}else{e.length==0&&(s.data=s._data=e=[[]]),Me=e[0],Wt=Me.length;let r=e;if(J==2){r=e.slice();let u=r[0]=Array(Wt);for(let h=0;h<Wt;h++)u[h]=h}s._data=e=r}if(Ls(!0),Vt("setData"),J==2&&(Ms=!0),i!==!1){let r=M;r.auto(s,en)?Yn():Qe(L,r.min,r.max),os=os||O.left>=0,be=!0,Ds()}}s.setData=sa;function Yn(){en=!0;let l,i;a==1&&(Wt>0?(Ht=kn[0]=0,zt=kn[1]=Wt-1,l=e[0][Ht],i=e[0][zt],J==2?(l=Ht,i=zt):l==i&&(J==3?[l,i]=zn(l,l,M.log,!1):J==4?[l,i]=Rl(l,l,M.log,!1):M.time?i=l+Nt(86400/q):[l,i]=Nn(l,i,Hl,!0))):(Ht=kn[0]=l=null,zt=kn[1]=i=null)),Qe(L,l,i)}let _n,Ps,Kn,Jn,Zn,Qn,Xn,tl,el,ae;function na(l,i,r,u,h,m){l??(l=Ea),r??(r=Il),u??(u="butt"),h??(h=Ea),m??(m="round"),l!=_n&&(g.strokeStyle=_n=l),h!=Ps&&(g.fillStyle=Ps=h),i!=Kn&&(g.lineWidth=Kn=i),m!=Zn&&(g.lineJoin=Zn=m),u!=Qn&&(g.lineCap=Qn=u),r!=Jn&&g.setLineDash(Jn=r)}function la(l,i,r,u){i!=Ps&&(g.fillStyle=Ps=i),l!=Xn&&(g.font=Xn=l),r!=tl&&(g.textAlign=tl=r),u!=el&&(g.textBaseline=el=u)}function sl(l,i,r,u,h=0){if(u.length>0&&l.auto(s,en)&&(i==null||i.min==null)){let m=it(Ht,0),y=it(zt,u.length-1),k=r.min==null?xr(u,m,y,h,l.distr==3):[r.min,r.max];l.min=Pe(l.min,r.min=k[0]),l.max=se(l.max,r.max=k[1])}}const aa={min:null,max:null};function Eo(){for(let u in S){let h=S[u];z[u]==null&&(h.min==null||z[L]!=null&&h.auto(s,en))&&(z[u]=aa)}for(let u in S){let h=S[u];z[u]==null&&h.from!=null&&z[h.from]!=null&&(z[u]=aa)}z[L]!=null&&Ls(!0);let l={};for(let u in z){let h=z[u];if(h!=null){let m=l[u]=Us(S[u],Dr);if(h.min!=null)Ct(m,h);else if(u!=L||a==2)if(Wt==0&&m.from==null){let y=m.range(s,null,null,u);m.min=y[0],m.max=y[1]}else m.min=ht,m.max=-ht}}if(Wt>0){x.forEach((u,h)=>{if(a==1){let m=u.scale,y=z[m];if(y==null)return;let k=l[m];if(h==0){let _=k.range(s,k.min,k.max,m);k.min=_[0],k.max=_[1],Ht=Ee(k.min,e[0]),zt=Ee(k.max,e[0]),zt-Ht>1&&(e[0][Ht]<k.min&&Ht++,e[0][zt]>k.max&&zt--),u.min=Me[Ht],u.max=Me[zt]}else u.show&&u.auto&&sl(k,y,u,e[h],u.sorted);u.idxs[0]=Ht,u.idxs[1]=zt}else if(h>0&&u.show&&u.auto){let[m,y]=u.facets,k=m.scale,_=y.scale,[T,A]=e[h],E=l[k],U=l[_];E!=null&&sl(E,z[k],m,T,m.sorted),U!=null&&sl(U,z[_],y,A,y.sorted),u.min=y.min,u.max=y.max}});for(let u in l){let h=l[u],m=z[u];if(h.from==null&&(m==null||m.min==null)){let y=h.range(s,h.min==ht?null:h.min,h.max==-ht?null:h.max,u);h.min=y[0],h.max=y[1]}}}for(let u in l){let h=l[u];if(h.from!=null){let m=l[h.from];if(m.min==null)h.min=h.max=null;else{let y=h.range(s,m.min,m.max,u);h.min=y[0],h.max=y[1]}}}let i={},r=!1;for(let u in l){let h=l[u],m=S[u];if(m.min!=h.min||m.max!=h.max){m.min=h.min,m.max=h.max;let y=m.distr;m._min=y==3?Ue(m.min):y==4?bl(m.min,m.asinh):y==100?m.fwd(m.min):m.min,m._max=y==3?Ue(m.max):y==4?bl(m.max,m.asinh):y==100?m.fwd(m.max):m.max,i[u]=r=!0}}if(r){x.forEach((u,h)=>{a==2?h>0&&i.y&&(u._paths=null):i[u.scale]&&(u._paths=null)});for(let u in i)Ms=!0,Vt("setScale",u);Jt&&O.left>=0&&(os=be=!0)}for(let u in z)z[u]=null}function Po(l){let i=Tl(Ht-1,0,Wt-1),r=Tl(zt+1,0,Wt-1);for(;l[i]==null&&i>0;)i--;for(;l[r]==null&&r<Wt-1;)r++;return[i,r]}function Lo(){if(Wt>0){let l=x.some(i=>i._focus)&&ae!=Ne.alpha;l&&(g.globalAlpha=ae=Ne.alpha),x.forEach((i,r)=>{if(r>0&&i.show&&(ia(r,!1),ia(r,!0),i._paths==null)){let u=ae;ae!=i.alpha&&(g.globalAlpha=ae=i.alpha);let h=a==2?[0,e[r][0].length-1]:Po(e[r]);i._paths=i.paths(s,r,h[0],h[1]),ae!=u&&(g.globalAlpha=ae=u)}}),x.forEach((i,r)=>{if(r>0&&i.show){let u=ae;ae!=i.alpha&&(g.globalAlpha=ae=i.alpha),i._paths!=null&&oa(r,!1);{let h=i._paths!=null?i._paths.gaps:null,m=i.points.show(s,r,Ht,zt,h),y=i.points.filter(s,r,m,h);(m||y)&&(i.points._paths=i.points.paths(s,r,Ht,zt,y),oa(r,!0))}ae!=u&&(g.globalAlpha=ae=u),Vt("drawSeries",r)}}),l&&(g.globalAlpha=ae=1)}}function ia(l,i){let r=i?x[l].points:x[l];r._stroke=r.stroke(s,l),r._fill=r.fill(s,l)}function oa(l,i){let r=i?x[l].points:x[l],{stroke:u,fill:h,clip:m,flags:y,_stroke:k=r._stroke,_fill:_=r._fill,_width:T=r.width}=r._paths;T=mt(T*rt,3);let A=null,E=T%2/2;i&&_==null&&(_=T>0?"#fff":k);let U=r.pxAlign==1&&E>0;if(U&&g.translate(E,E),!i){let ot=ce-T/2,at=ge-T/2,tt=le+T,j=Se+T;A=new Path2D,A.rect(ot,at,tt,j)}i?nl(k,T,r.dash,r.cap,_,u,h,y,m):Do(l,k,T,r.dash,r.cap,_,u,h,y,A,m),U&&g.translate(-E,-E)}function Do(l,i,r,u,h,m,y,k,_,T,A){let E=!1;_!=0&&Z.forEach((U,ot)=>{if(U.series[0]==l){let at=x[U.series[1]],tt=e[U.series[1]],j=(at._paths||hn).band;es(j)&&(j=U.dir==1?j[0]:j[1]);let R,$t=null;at.show&&j&&Mr(tt,Ht,zt)?($t=U.fill(s,ot)||m,R=at._paths.clip):j=null,nl(i,r,u,h,$t,y,k,_,T,A,R,j),E=!0}}),E||nl(i,r,u,h,m,y,k,_,T,A)}const ra=Gs|El;function nl(l,i,r,u,h,m,y,k,_,T,A,E){na(l,i,r,u,h),(_||T||E)&&(g.save(),_&&g.clip(_),T&&g.clip(T)),E?(k&ra)==ra?(g.clip(E),A&&g.clip(A),Sn(h,y),xn(l,m,i)):k&El?(Sn(h,y),g.clip(E),xn(l,m,i)):k&Gs&&(g.save(),g.clip(E),A&&g.clip(A),Sn(h,y),g.restore(),xn(l,m,i)):(Sn(h,y),xn(l,m,i)),(_||T||E)&&g.restore()}function xn(l,i,r){r>0&&(i instanceof Map?i.forEach((u,h)=>{g.strokeStyle=_n=h,g.stroke(u)}):i!=null&&l&&g.stroke(i))}function Sn(l,i){i instanceof Map?i.forEach((r,u)=>{g.fillStyle=Ps=u,g.fill(r)}):i!=null&&l&&g.fill(i)}function No(l,i,r,u){let h=F[l],m;if(u<=0)m=[0,0];else{let y=h._space=h.space(s,l,i,r,u),k=h._incrs=h.incrs(s,l,i,r,u,y);m=Gc(i,r,k,u,y)}return h._found=m}function ll(l,i,r,u,h,m,y,k,_,T){let A=y%2/2;I==1&&g.translate(A,A),na(k,y,_,T,k),g.beginPath();let E,U,ot,at,tt=h+(u==0||u==3?-m:m);r==0?(U=h,at=tt):(E=h,ot=tt);for(let j=0;j<l.length;j++)i[j]!=null&&(r==0?E=ot=l[j]:U=at=l[j],g.moveTo(E,U),g.lineTo(ot,at));g.stroke(),I==1&&g.translate(-A,-A)}function Oo(l){let i=!0;return F.forEach((r,u)=>{if(!r.show)return;let h=S[r.scale];if(h.min==null){r._show&&(i=!1,r._show=!1,Ls(!1));return}else r._show||(i=!1,r._show=!0,Ls(!1));let m=r.side,y=m%2,{min:k,max:_}=h,[T,A]=No(u,k,_,y==0?K:C);if(A==0)return;let E=h.distr==2,U=r._splits=r.splits(s,u,k,_,T,A,E),ot=h.distr==2?U.map(R=>Me[R]):U,at=h.distr==2?Me[U[1]]-Me[U[0]]:T,tt=r._values=r.values(s,r.filter(s,ot,u,A,at),u,A,at);r._rotate=m==2?r.rotate(s,tt,u,A):0;let j=r._size;r._size=_e(r.size(s,tt,u,l)),j!=null&&r._size!=j&&(i=!1)}),i}function Ro(l){let i=!0;return ea.forEach((r,u)=>{let h=r(s,u,cs,l);h!=Je[u]&&(i=!1),Je[u]=h}),i}function Ho(){for(let l=0;l<F.length;l++){let i=F[l];if(!i.show||!i._show)continue;let r=i.side,u=r%2,h,m,y=i.stroke(s,l),k=r==0||r==3?-1:1,[_,T]=i._found;if(i.label!=null){let Xt=i.labelGap*k,fe=Nt((i._lpos+Xt)*rt);la(i.labelFont[0],y,"center",r==2?rn:Ca),g.save(),u==1?(h=m=0,g.translate(fe,Nt(ge+Se/2)),g.rotate((r==3?-Ln:Ln)/2)):(h=Nt(ce+le/2),m=fe);let fs=xi(i.label)?i.label(s,l,_,T):i.label;g.fillText(fs,h,m),g.restore()}if(T==0)continue;let A=S[i.scale],E=u==0?le:Se,U=u==0?ce:ge,ot=i._splits,at=A.distr==2?ot.map(Xt=>Me[Xt]):ot,tt=A.distr==2?Me[ot[1]]-Me[ot[0]]:_,j=i.ticks,R=i.border,$t=j.show?j.size:0,St=Nt($t*rt),Bt=Nt((i.alignTo==2?i._size-$t-i.gap:i.gap)*rt),pt=i._rotate*-Ln/180,Mt=B(i._pos*rt),ue=(St+Bt)*k,Qt=Mt+ue;m=u==0?Qt:0,h=u==1?Qt:0;let we=i.font[0],Te=i.align==1?Vs:i.align==2?ml:pt>0?Vs:pt<0?ml:u==0?"center":r==3?ml:Vs,He=pt||u==1?"middle":r==2?rn:Ca;la(we,y,Te,He);let de=i.font[1]*i.lineGap,ye=ot.map(Xt=>B(f(Xt,A,E,U))),Ae=i._values;for(let Xt=0;Xt<Ae.length;Xt++){let fe=Ae[Xt];if(fe!=null){u==0?h=ye[Xt]:m=ye[Xt],fe=""+fe;let fs=fe.indexOf(`
`)==-1?[fe]:fe.split(/\n/gm);for(let te=0;te<fs.length;te++){let Ta=fs[te];pt?(g.save(),g.translate(h,m+te*de),g.rotate(pt),g.fillText(Ta,0,0),g.restore()):g.fillText(Ta,h,m+te*de)}}}j.show&&ll(ye,j.filter(s,at,l,T,tt),u,r,Mt,St,mt(j.width*rt,3),j.stroke(s,l),j.dash,j.cap);let ze=i.grid;ze.show&&ll(ye,ze.filter(s,at,l,T,tt),u,u==0?2:1,u==0?ge:ce,u==0?Se:le,mt(ze.width*rt,3),ze.stroke(s,l),ze.dash,ze.cap),R.show&&ll([Mt],[1],u==0?1:0,u==0?1:2,u==1?ge:ce,u==1?Se:le,mt(R.width*rt,3),R.stroke(s,l),R.dash,R.cap)}Vt("drawAxes")}function Ls(l){x.forEach((i,r)=>{r>0&&(i._paths=null,l&&(a==1?(i.min=null,i.max=null):i.facets.forEach(u=>{u.min=null,u.max=null})))})}let Mn=!1,al=!1,sn=[];function zo(){al=!1;for(let l=0;l<sn.length;l++)Vt(...sn[l]);sn.length=0}function Ds(){Mn||(Fr(ca),Mn=!0)}function Io(l,i=!1){Mn=!0,al=i,l(s),ca(),i&&sn.length>0&&queueMicrotask(zo)}s.batch=Io;function ca(){if(Un&&(Eo(),Un=!1),Ms&&(_o(),Ms=!1),wn){if(wt(P,Vs,vt),wt(P,rn,Dt),wt(P,un,K),wt(P,dn,C),wt(D,Vs,vt),wt(D,rn,Dt),wt(D,un,K),wt(D,dn,C),wt(w,un,je),wt(w,dn,ls),b.width=Nt(je*rt),b.height=Nt(ls*rt),F.forEach(({_el:l,_show:i,_size:r,_pos:u,side:h})=>{if(l!=null)if(i){let m=h===3||h===0?r:0,y=h%2==1;wt(l,y?"left":"top",u-m),wt(l,y?"width":"height",r),wt(l,y?"top":"left",y?Dt:vt),wt(l,y?"height":"width",y?C:K),Sl(l,ms)}else pe(l,ms)}),_n=Ps=Kn=Zn=Qn=Xn=tl=el=Jn=null,ae=1,an(!0),vt!=Ss||Dt!=as||K!=De||C!=is){Ls(!1);let l=K/De,i=C/is;if(Jt&&!os&&O.left>=0){O.left*=l,O.top*=i,Ns&&Ie(Ns,Nt(O.left),0,K,C),Os&&Ie(Os,0,Nt(O.top),K,C);for(let r=0;r<$e.length;r++){let u=$e[r];u!=null&&(Cs[r]*=l,Es[r]*=i,Ie(u,_e(Cs[r]),_e(Es[r]),K,C))}}if(bt.show&&!yn&&bt.left>=0&&bt.width>0){bt.left*=l,bt.width*=l,bt.top*=i,bt.height*=i;for(let r in dl)wt(zs,r,bt[r])}Ss=vt,as=Dt,De=K,is=C}Vt("setSize"),wn=!1}je>0&&ls>0&&(g.clearRect(0,0,b.width,b.height),Vt("drawClear"),Y.forEach(l=>l()),Vt("draw")),bt.show&&yn&&(Tn(bt),yn=!1),Jt&&os&&(ds(null,!0,!1),os=!1),X.show&&X.live&&be&&(cl(),be=!1),d||(d=!0,s.status=1,Vt("ready")),en=!1,Mn=!1}s.redraw=(l,i)=>{Ms=i||!1,l!==!1?Qe(L,M.min,M.max):Ds()};function il(l,i){let r=S[l];if(r.from==null){if(Wt==0){let u=r.range(s,i.min,i.max,l);i.min=u[0],i.max=u[1]}if(i.min>i.max){let u=i.min;i.min=i.max,i.max=u}if(Wt>1&&i.min!=null&&i.max!=null&&i.max-i.min<1e-16)return;l==L&&r.distr==2&&Wt>0&&(i.min=Ee(i.min,e[0]),i.max=Ee(i.max,e[0]),i.min==i.max&&i.max++),z[l]=i,Un=!0,Ds()}}s.setScale=il;let ol,rl,Ns,Os,ua,da,Rs,Hs,fa,pa,gt,_t,Ze=!1;const Ut=O.drag;let It=Ut.x,Ft=Ut.y;Jt&&(O.x&&(ol=ke(ur,D)),O.y&&(rl=ke(dr,D)),M.ori==0?(Ns=ol,Os=rl):(Ns=rl,Os=ol),gt=O.left,_t=O.top);const bt=s.select=Ct({show:!0,over:!0,left:0,width:0,top:0,height:0},t.select),zs=bt.show?ke(cr,bt.over?D:P):null;function Tn(l,i){if(bt.show){for(let r in l)bt[r]=l[r],r in dl&&wt(zs,r,l[r]);i!==!1&&Vt("setSelect")}}s.setSelect=Tn;function Fo(l){if(x[l].show)Lt&&Sl(xt[l],ms);else if(Lt&&pe(xt[l],ms),Jt){let r=As?$e[0]:$e[l];r!=null&&Ie(r,-10,-10,K,C)}}function Qe(l,i,r){il(l,{min:i,max:r})}function Oe(l,i,r,u){i.focus!=null&&Wo(l),i.show!=null&&x.forEach((h,m)=>{m>0&&(l==m||l==null)&&(h.show=i.show,Fo(m),a==2?(Qe(h.facets[0].scale,null,null),Qe(h.facets[1].scale,null,null)):Qe(h.scale,null,null),Ds())}),r!==!1&&Vt("setSeries",l,i),u&&on("setSeries",s,l,i)}s.setSeries=Oe;function Vo(l,i){Ct(Z[l],i)}function Bo(l,i){l.fill=st(l.fill||null),l.dir=it(l.dir,-1),i=i??Z.length,Z.splice(i,0,l)}function jo(l){l==null?Z.length=0:Z.splice(l,1)}s.addBand=Bo,s.setBand=Vo,s.delBand=jo;function qo(l,i){x[l].alpha=i,Jt&&$e[l]!=null&&($e[l].style.opacity=i),Lt&&xt[l]&&(xt[l].style.opacity=i)}let qe,Xe,us;const Is={focus:!0};function Wo(l){if(l!=us){let i=l==null,r=Ne.alpha!=1;x.forEach((u,h)=>{if(a==1||h>0){let m=i||h==0||h==l;u._focus=i?null:m,r&&qo(h,m?1:Ne.alpha)}}),us=l,r&&Ds()}}Lt&&Ts&&Zt(Da,ut,l=>{O._lock||(rs(l),us!=null&&Oe(null,Is,!0,At.setSeries))});function Re(l,i,r){let u=S[i];r&&(l=l/rt-(u.ori==1?Dt:vt));let h=K;u.ori==1&&(h=C,l=h-l),u.dir==-1&&(l=h-l);let m=u._min,y=u._max,k=l/h,_=m+(y-m)*k,T=u.distr;return T==3?qs(10,_):T==4?Ar(_,u.asinh):T==100?u.bwd(_):_}function Uo(l,i){let r=Re(l,L,i);return Ee(r,e[0],Ht,zt)}s.valToIdx=l=>Ee(l,e[0]),s.posToIdx=Uo,s.posToVal=Re,s.valToPos=(l,i,r)=>S[i].ori==0?o(l,S[i],r?le:K,r?ce:0):c(l,S[i],r?Se:C,r?ge:0),s.setCursor=(l,i,r)=>{gt=l.left,_t=l.top,ds(null,i,r)};function ha(l,i){wt(zs,Vs,bt.left=l),wt(zs,un,bt.width=i)}function ma(l,i){wt(zs,rn,bt.top=l),wt(zs,dn,bt.height=i)}let nn=M.ori==0?ha:ma,ln=M.ori==1?ha:ma;function Go(){if(Lt&&X.live)for(let l=a==2?1:0;l<x.length;l++){if(l==0&&ve)continue;let i=X.values[l],r=0;for(let u in i)Le[l][r++].firstChild.nodeValue=i[u]}}function cl(l,i){if(l!=null&&(l.idxs?l.idxs.forEach((r,u)=>{ft[u]=r}):Lr(l.idx)||ft.fill(l.idx),X.idx=ft[0]),Lt&&X.live){for(let r=0;r<x.length;r++)(r>0||a==1&&!ve)&&Yo(r,ft[r]);Go()}be=!1,i!==!1&&Vt("setLegend")}s.setLegend=cl;function Yo(l,i){let r=x[l],u=l==0&&J==2?Me:e[l],h;ve?h=r.values(s,l,i)??Ke:(h=r.value(s,i==null?null:u[i],l,i),h=h==null?Ke:{_:h}),X.values[l]=h}function ds(l,i,r){fa=gt,pa=_t,[gt,_t]=O.move(s,gt,_t),O.left=gt,O.top=_t,Jt&&(Ns&&Ie(Ns,Nt(gt),0,K,C),Os&&Ie(Os,0,Nt(_t),K,C));let u,h=Ht>zt;qe=ht,Xe=null;let m=M.ori==0?K:C,y=M.ori==1?K:C;if(gt<0||Wt==0||h){u=O.idx=null;for(let k=0;k<x.length;k++){let _=$e[k];_!=null&&Ie(_,-10,-10,K,C)}Ts&&Oe(null,Is,!0,l==null&&At.setSeries),X.live&&(ft.fill(u),be=!0)}else{let k,_,T;a==1&&(k=M.ori==0?gt:_t,_=Re(k,L),u=O.idx=Ee(_,e[0],Ht,zt),T=N(e[0][u],M,m,0));let A=-10,E=-10,U=0,ot=0,at=!0,tt="",j="";for(let R=a==2?1:0;R<x.length;R++){let $t=x[R],St=ft[R],Bt=St==null?null:a==1?e[R][St]:e[R][1][St],pt=O.dataIdx(s,R,u,_),Mt=pt==null?null:a==1?e[R][pt]:e[R][1][pt];if(be=be||Mt!=Bt||pt!=St,ft[R]=pt,R>0&&$t.show){let ue=pt==null?-10:pt==u?T:N(a==1?e[0][pt]:e[R][0][pt],M,m,0),Qt=Mt==null?-10:W(Mt,a==1?S[$t.scale]:S[$t.facets[1].scale],y,0);if(Ts&&Mt!=null){let we=M.ori==1?gt:_t,Te=Ot(Ne.dist(s,R,pt,Qt,we));if(Te<qe){let He=Ne.bias;if(He!=0){let de=Re(we,$t.scale),ye=Mt>=0?1:-1,Ae=de>=0?1:-1;Ae==ye&&(Ae==1?He==1?Mt>=de:Mt<=de:He==1?Mt<=de:Mt>=de)&&(qe=Te,Xe=R)}else qe=Te,Xe=R}}if(be||As){let we,Te;M.ori==0?(we=ue,Te=Qt):(we=Qt,Te=ue);let He,de,ye,Ae,ze,Xt,fe=!0,fs=Gt.bbox;if(fs!=null){fe=!1;let te=fs(s,R);ye=te.left,Ae=te.top,He=te.width,de=te.height}else ye=we,Ae=Te,He=de=Gt.size(s,R);if(Xt=Gt.fill(s,R),ze=Gt.stroke(s,R),As)R==Xe&&qe<=Ne.prox&&(A=ye,E=Ae,U=He,ot=de,at=fe,tt=Xt,j=ze);else{let te=$e[R];te!=null&&(Cs[R]=ye,Es[R]=Ae,Fa(te,He,de,fe),za(te,Xt,ze),Ie(te,_e(ye),_e(Ae),K,C))}}}}if(As){let R=Ne.prox,$t=us==null?qe<=R:qe>R||Xe!=us;if(be||$t){let St=$e[0];St!=null&&(Cs[0]=A,Es[0]=E,Fa(St,U,ot,at),za(St,tt,j),Ie(St,_e(A),_e(E),K,C))}}}if(bt.show&&Ze)if(l!=null){let[k,_]=At.scales,[T,A]=At.match,[E,U]=l.cursor.sync.scales,ot=l.cursor.drag;if(It=ot._x,Ft=ot._y,It||Ft){let{left:at,top:tt,width:j,height:R}=l.select,$t=l.scales[E].ori,St=l.posToVal,Bt,pt,Mt,ue,Qt,we=k!=null&&T(k,E),Te=_!=null&&A(_,U);we&&It?($t==0?(Bt=at,pt=j):(Bt=tt,pt=R),Mt=S[k],ue=N(St(Bt,E),Mt,m,0),Qt=N(St(Bt+pt,E),Mt,m,0),nn(Pe(ue,Qt),Ot(Qt-ue))):nn(0,m),Te&&Ft?($t==1?(Bt=at,pt=j):(Bt=tt,pt=R),Mt=S[_],ue=W(St(Bt,U),Mt,y,0),Qt=W(St(Bt+pt,U),Mt,y,0),ln(Pe(ue,Qt),Ot(Qt-ue))):ln(0,y)}else fl()}else{let k=Ot(fa-ua),_=Ot(pa-da);if(M.ori==1){let U=k;k=_,_=U}It=Ut.x&&k>=Ut.dist,Ft=Ut.y&&_>=Ut.dist;let T=Ut.uni;T!=null?It&&Ft&&(It=k>=T,Ft=_>=T,!It&&!Ft&&(_>k?Ft=!0:It=!0)):Ut.x&&Ut.y&&(It||Ft)&&(It=Ft=!0);let A,E;It&&(M.ori==0?(A=Rs,E=gt):(A=Hs,E=_t),nn(Pe(A,E),Ot(E-A)),Ft||ln(0,y)),Ft&&(M.ori==1?(A=Rs,E=gt):(A=Hs,E=_t),ln(Pe(A,E),Ot(E-A)),It||nn(0,m)),!It&&!Ft&&(nn(0,0),ln(0,0))}if(Ut._x=It,Ut._y=Ft,l==null){if(r){if(Ma!=null){let[k,_]=At.scales;At.values[0]=k!=null?Re(M.ori==0?gt:_t,k):null,At.values[1]=_!=null?Re(M.ori==1?gt:_t,_):null}on(vl,s,gt,_t,K,C,u)}if(Ts){let k=r&&At.setSeries,_=Ne.prox;us==null?qe<=_&&Oe(Xe,Is,!0,k):qe>_?Oe(null,Is,!0,k):Xe!=us&&Oe(Xe,Is,!0,k)}}be&&(X.idx=u,cl()),i!==!1&&Vt("setCursor")}let ts=null;Object.defineProperty(s,"rect",{get(){return ts==null&&an(!1),ts}});function an(l=!1){l?ts=null:(ts=D.getBoundingClientRect(),Vt("syncRect",ts))}function va(l,i,r,u,h,m,y){O._lock||Ze&&l!=null&&l.movementX==0&&l.movementY==0||(ul(l,i,r,u,h,m,y,!1,l!=null),l!=null?ds(null,!0,!0):ds(i,!0,!1))}function ul(l,i,r,u,h,m,y,k,_){if(ts==null&&an(!1),rs(l),l!=null)r=l.clientX-ts.left,u=l.clientY-ts.top;else{if(r<0||u<0){gt=-10,_t=-10;return}let[T,A]=At.scales,E=i.cursor.sync,[U,ot]=E.values,[at,tt]=E.scales,[j,R]=At.match,$t=i.axes[0].side%2==1,St=M.ori==0?K:C,Bt=M.ori==1?K:C,pt=$t?m:h,Mt=$t?h:m,ue=$t?u:r,Qt=$t?r:u;if(at!=null?r=j(T,at)?f(U,S[T],St,0):-10:r=St*(ue/pt),tt!=null?u=R(A,tt)?f(ot,S[A],Bt,0):-10:u=Bt*(Qt/Mt),M.ori==1){let we=r;r=u,u=we}}_&&(i==null||i.cursor.event.type==vl)&&((r<=1||r>=K-1)&&(r=ps(r,K)),(u<=1||u>=C-1)&&(u=ps(u,C))),k?(ua=r,da=u,[Rs,Hs]=O.move(s,r,u)):(gt=r,_t=u)}const dl={width:0,height:0,left:0,top:0};function fl(){Tn(dl,!1)}let ga,ba,$a,wa;function ya(l,i,r,u,h,m,y){Ze=!0,It=Ft=Ut._x=Ut._y=!1,ul(l,i,r,u,h,m,y,!0,!1),l!=null&&(Zt(gl,_l,ka,!1),on(Pa,s,Rs,Hs,K,C,null));let{left:k,top:_,width:T,height:A}=bt;ga=k,ba=_,$a=T,wa=A}function ka(l,i,r,u,h,m,y){Ze=Ut._x=Ut._y=!1,ul(l,i,r,u,h,m,y,!1,!0);let{left:k,top:_,width:T,height:A}=bt,E=T>0||A>0,U=ga!=k||ba!=_||$a!=T||wa!=A;if(E&&U&&Tn(bt),Ut.setScale&&E&&U){let ot=k,at=T,tt=_,j=A;if(M.ori==1&&(ot=_,at=A,tt=k,j=T),It&&Qe(L,Re(ot,L),Re(ot+at,L)),Ft)for(let R in S){let $t=S[R];R!=L&&$t.from==null&&$t.min!=ht&&Qe(R,Re(tt+j,R),Re(tt,R))}fl()}else O.lock&&(O._lock=!O._lock,ds(i,!0,l!=null));l!=null&&(xs(gl,_l),on(gl,s,gt,_t,K,C,null))}function Ko(l,i,r,u,h,m,y){if(O._lock)return;rs(l);let k=Ze;if(Ze){let _=!0,T=!0,A=10,E,U;M.ori==0?(E=It,U=Ft):(E=Ft,U=It),E&&U&&(_=gt<=A||gt>=K-A,T=_t<=A||_t>=C-A),E&&_&&(gt=gt<Rs?0:K),U&&T&&(_t=_t<Hs?0:C),ds(null,!0,!0),Ze=!1}gt=-10,_t=-10,ft.fill(null),ds(null,!0,!0),k&&(Ze=k)}function _a(l,i,r,u,h,m,y){O._lock||(rs(l),Yn(),fl(),l!=null&&on(Na,s,gt,_t,K,C,null))}function xa(){F.forEach(Yc),Gn(s.width,s.height,!0)}vs(Dn,js,xa);const Fs={};Fs.mousedown=ya,Fs.mousemove=va,Fs.mouseup=ka,Fs.dblclick=_a,Fs.setSeries=(l,i,r,u)=>{let h=At.match[2];r=h(s,i,r),r!=-1&&Oe(r,u,!0,!1)},Jt&&(Zt(Pa,D,ya),Zt(vl,D,va),Zt(La,D,l=>{rs(l),an(!1)}),Zt(Da,D,Ko),Zt(Na,D,_a),Pl.add(s),s.syncRect=an);const An=s.hooks=t.hooks||{};function Vt(l,i,r){al?sn.push([l,i,r]):l in An&&An[l].forEach(u=>{u.call(null,s,i,r)})}(t.plugins||[]).forEach(l=>{for(let i in l.hooks)An[i]=(An[i]||[]).concat(l.hooks[i])});const Sa=(l,i,r)=>r,At=Ct({key:null,setSeries:!1,filters:{pub:Wa,sub:Wa},scales:[L,x[1]?x[1].scale:null],match:[Ua,Ua,Sa],values:[null,null]},O.sync);At.match.length==2&&At.match.push(Sa),O.sync=At;const Ma=At.key,pl=Yi(Ma);function on(l,i,r,u,h,m,y){At.filters.pub(l,i,r,u,h,m,y)&&pl.pub(l,i,r,u,h,m,y)}pl.sub(s);function Jo(l,i,r,u,h,m,y){At.filters.sub(l,i,r,u,h,m,y)&&Fs[l](null,i,r,u,h,m,y)}s.pub=Jo;function Zo(){pl.unsub(s),Pl.delete(s),ns.clear(),Ml(Dn,js,xa),p.remove(),ut?.remove(),Vt("destroy")}s.destroy=Zo;function hl(){Vt("init",t,e),sa(e||t.data,!1),z[L]?il(L,z[L]):Yn(),yn=bt.show&&(bt.width>0||bt.height>0),os=be=!0,Gn(t.width,t.height)}return x.forEach(ta),F.forEach(Co),n?n instanceof HTMLElement?(n.appendChild(p),hl()):n(s,hl):hl(),s}jt.assign=Ct;jt.fmtNum=zl;jt.rangeNum=Nn;jt.rangeLog=zn;jt.rangeAsinh=Rl;jt.orient=ws;jt.pxRatio=rt;jt.join=Ir;jt.fmtDate=Fl,jt.tzDate=Jr;jt.sync=Yi;{jt.addGap=Lc,jt.clipGaps=Vn;let t=jt.paths={points:to};t.linear=so,t.stepped=Oc,t.bars=Rc,t.spline=zc}const io=new Intl.NumberFormat("zh-CN");function V(t){return t==null||t===""?"—":io.format(Math.round(Number(t)))}function Tt(t){const e=Number(t);return Number.isFinite(e)?Math.abs(e)>=1e9?(e/1e9).toFixed(1).replace(/\.0$/,"")+"B":Math.abs(e)>=1e6?(e/1e6).toFixed(1).replace(/\.0$/,"")+"M":Math.abs(e)>=1e4?(e/1e3).toFixed(1).replace(/\.0$/,"")+"k":io.format(Math.round(e)):"—"}function Et(t,e=1){if(t==null)return"—";const n=Number(t);return Number.isFinite(n)?`${n.toFixed(e).replace(/\.0$/,"")}%`:"—"}function oe(t){const e=Number(t);return!Number.isFinite(e)||e<=0?"—":e>=1e3?`${(e/1e3).toFixed(e>=1e4?0:2)}s`:`${Math.round(e)}ms`}function Qs(t){if(!t)return"—";const e=new Date(t);return Number.isNaN(e.getTime())?"—":e.toLocaleTimeString("zh-CN",{hour12:!1})}function oo(t,e=Date.now()){if(!t)return"—";const n=typeof t=="number"?t:new Date(t).getTime();if(!Number.isFinite(n))return"—";const s=Math.max(0,e-n);return s<5e3?"刚刚":s<6e4?`${Math.floor(s/1e3)} 秒前`:s<36e5?`${Math.floor(s/6e4)} 分钟前`:s<864e5?`${Math.floor(s/36e5)} 小时前`:`${Math.floor(s/864e5)} 天前`}function $(t){return String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}const mn='11px -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif';class Kc{constructor(e,n){this.el=e,this.tip=n,this.u=null,this.points=[],this.ro=new ResizeObserver(()=>this.resize()),this.ro.observe(e)}destroy(){this.ro.disconnect(),this.u&&this.u.destroy(),this.u=null}resize(){if(!this.u)return;const e=this.el.clientWidth;e>0&&Math.abs(e-this.u.width)>1&&this.u.setSize({width:e,height:this.height()})}height(){return 190}setData(e){this.points=e||[];const n=this.el.clientWidth||640;if(!this.points.length){this.u&&(this.u.destroy(),this.u=null);return}const s=[],a=[],o=[];for(const d of this.points)s.push(Math.round(Number(d.ts)/1e3)),a.push(Number(d.input)||0),o.push((Number(d.input)||0)+(Number(d.cache_read)||0));const c=[s,a,o];if(this.u){this.u.setData(c);return}this.el.querySelectorAll(".uplot").forEach(d=>d.remove());const f={width:n,height:this.height(),padding:[10,12,0,0],legend:{show:!1},cursor:{show:!0,x:!0,y:!1,points:{show:!1},drag:{x:!1,y:!1}},scales:{x:{time:!0},y:{range:(d,p,b)=>[0,b<=0?100:b*1.12]}},axes:[{stroke:"#9aa1ab",font:mn,grid:{stroke:"#eef0f3",width:1},ticks:{stroke:"#eef0f3",width:1,size:4},values:(d,p)=>p.map(b=>Qc(b))},{stroke:"#9aa1ab",font:mn,size:52,grid:{stroke:"#eef0f3",width:1},ticks:{show:!1},values:(d,p)=>p.map(b=>Tt(b))}],series:[{},{label:"input",stroke:"#7ea6f2",width:1.2,points:{show:!1},fill:"rgba(37,99,235,0.06)"},{label:"context",stroke:"#2563eb",width:1.6,points:{show:!1}}],bands:[{series:[1,2],fill:"rgba(37,99,235,0.16)"}],hooks:{draw:[d=>{const p=d.ctx;p.save(),this.points.forEach((b,g)=>{if(!b.truncated)return;const w=d.valToPos(d.data[0][g],"x",!0),P=d.valToPos(d.data[1][g],"y",!0);p.beginPath(),p.fillStyle="#d97706",p.arc(w,P,3.2,0,Math.PI*2),p.fill(),p.strokeStyle="rgba(217,119,6,0.45)",p.lineWidth=1,p.beginPath(),p.arc(w,P,5.6,0,Math.PI*2),p.stroke()}),p.restore()}],setCursor:[d=>this.hover(d)]}};this.u=new jt(f,c,this.el)}hover(e){const n=e.cursor.idx;if(n==null||!this.tip){this.tip&&this.tip.classList.remove("show");return}const s=this.points[n];if(!s)return;const a=e.cursor.left,o=e.valToPos(e.data[2][n],"y",!0);this.tip.innerHTML=`<b>${Qs(s.time)}</b><br/>input ${V(s.input)} · cache ${V(s.cache_read)}<br/>context ${V(s.context)}`+(s.truncated?'<br/><span style="color:#fbbf24">⚠ 该请求发生截断</span>':""),this.tip.style.left=`${Math.max(60,a)}px`,this.tip.style.top=`${Math.max(46,o-8)}px`,this.tip.classList.add("show")}setVisible(e){this.u&&this.u.setSize({width:this.el.clientWidth,height:e?this.height():this.height()})}}class Jc{constructor(e,n){this.el=e,this.tip=n,this.u=null,this.rows=[],this.ro=new ResizeObserver(()=>this.resize()),this.ro.observe(e)}destroy(){this.ro.disconnect(),this.u&&this.u.destroy(),this.u=null}height(){return 210}resize(){if(!this.u)return;const e=this.el.clientWidth;e>0&&Math.abs(e-this.u.width)>1&&this.u.setSize({width:e,height:this.height()})}setData(e){this.rows=e||[];const n=this.el.clientWidth||640;if(!this.rows.length){this.u&&(this.u.destroy(),this.u=null);return}const s=[],a=[],o=[];for(const d of this.rows)s.push(Math.round(Date.parse(`${d.date}T00:00:00`)/1e3)),a.push(Number(d.requests)||0),o.push(Number(d.truncation_rate)||0);const c=[s,a,o];if(this.u){this.u.setData(c);return}this.el.querySelectorAll(".uplot").forEach(d=>d.remove());const f={width:n,height:this.height(),padding:[10,12,0,0],legend:{show:!1},cursor:{show:!0,x:!0,y:!1,points:{show:!1},drag:{x:!1,y:!1}},scales:{x:{time:!0},y:{range:(d,p,b)=>[0,b<=0?4:b*1.15]},cut:{range:[0,100]}},axes:[{stroke:"#9aa1ab",font:mn,grid:{stroke:"#eef0f3",width:1},ticks:{stroke:"#eef0f3",width:1,size:4},values:(d,p)=>p.map(b=>Zc(b))},{stroke:"#9aa1ab",font:mn,size:44,grid:{stroke:"#eef0f3",width:1},ticks:{show:!1},values:(d,p)=>p.map(b=>Tt(b))},{scale:"cut",side:1,stroke:"#c98a2e",font:mn,size:40,grid:{show:!1},ticks:{show:!1},values:(d,p)=>p.map(b=>b===Math.round(b)?`${b}%`:"")}],series:[{},{label:"请求",stroke:"#2563eb",fill:"rgba(37,99,235,0.18)",width:1,points:{show:!1},paths:jt.paths.bars({size:[.62,12]})},{label:"截断率",scale:"cut",stroke:"#d97706",width:1.6,points:{show:!0,size:4,fill:"#d97706"}}],hooks:{setCursor:[d=>this.hover(d)]}};this.u=new jt(f,c,this.el)}hover(e){const n=e.cursor.idx;if(n==null||!this.tip){this.tip&&this.tip.classList.remove("show");return}const s=this.rows[n];if(!s)return;const a=e.cursor.left,o=e.valToPos(e.data[1][n],"y",!0);this.tip.innerHTML=`<b>${$(s.date)}</b><br/>${V(s.requests)} 次请求 · ${V(s.success)} 成功<br/>截断 ${V(s.truncated)}（${Number(s.truncation_rate||0).toFixed(1)}%）<br/>输入 ${Tt(s.input_tokens)} / 输出 ${Tt(s.output_tokens)}`,this.tip.style.left=`${Math.max(60,a)}px`,this.tip.style.top=`${Math.max(46,o-8)}px`,this.tip.classList.add("show")}}function Zc(t){const e=new Date(t*1e3);return`${e.getMonth()+1}/${e.getDate()}`}function Qc(t){const e=new Date(t*1e3),n=String(e.getHours()).padStart(2,"0"),s=String(e.getMinutes()).padStart(2,"0");return n==="00"&&s==="00"?`${e.getMonth()+1}/${e.getDate()}`:`${n}:${s}`}const v={page:"overview",stats:null,config:null,offline:!1,lastSync:null,selectedModel:null,detail:{recent:[],truncations:[],context:[],buckets:[]},gran:"day",captures:[],captureStats:null,captureId:null,captureDetail:null,captureModel:"",captureTruncated:!1,usage:null,usageDays:30,usageChart:null,routeModel:"",routeProtocol:"anthropic",routePreview:null,notice:null,busy:""},Xc=new Set;function ro(){for(const t of Xc)try{t(v)}catch(e){console.error(e)}}function Gl(t){v.page!==t&&(v.page=t,v.notice=null,location.hash=`#/${t}`,ro())}function Fe(t,e="ok"){v.notice=t?{text:t,kind:e,at:Date.now()}:null,ro()}function Wn(){const t=v.stats?.models||[];if(!t.length)return"";const e=v.selectedModel||v.stats.active_model;return t.some(n=>n.model===e)?e:t[0].model}async function co(){try{v.config=await ie.getConfig()}catch{v.config=null}}async function uo(){try{return v.stats=await ie.stats(),v.offline=!1,v.lastSync=Date.now(),!0}catch(t){return v.offline=!0,v.lastError=t.message||String(t),!1}}async function Yl(){const t=Wn();if(!t){v.detail={recent:[],truncations:[],context:[],buckets:[]};return}try{const[e,n,s,a]=await Promise.all([ie.recent(t,80),ie.truncations(t,60),ie.context(t),ie.buckets(t,v.gran)]);v.detail={recent:e.items||[],truncations:n.items||[],context:s.items||[],buckets:a.items||[]}}catch{}}async function Ys(){try{const t=await ie.captures({model:v.captureModel||void 0,limit:60,truncatedOnly:v.captureTruncated});v.captures=t.items||[],v.captureStats=t.stats||null}catch{v.captures=[]}}async function tu(t){v.captureId=t;try{v.captureDetail=await ie.capture(t)}catch{v.captureDetail=null}}async function fo(){try{v.routePreview=await ie.route(v.routeModel,v.routeProtocol)}catch(t){v.routePreview={error:t.message}}}async function Kl(){try{v.usage=await ie.usage(v.usageDays||30)}catch{v.usage=null}}async function Ye(t,e="已保存"){const n=await ie.saveConfig(t);return v.config=n.config,Fe(e,"ok"),n.config}const $s={model:"模型侧",gateway:"网关侧",local:"本地链路"},Rn=t=>t>=40?"error":t>0?"warn":"ok";function Ve(t,e,n=""){return`
  <header class="page-head">
    <div>
      <h1>${$(t)}</h1>
      ${e?`<p>${e}</p>`:""}
    </div>
    <div class="page-actions">${n}</div>
  </header>`}function Pt(t,e="",n="",s="",a=""){return`
  <section class="card ${a}">
    <div class="card-head">
      <div class="card-title">
        <h2>${$(t)}</h2>
        ${e?`<span class="card-sub">${e}</span>`:""}
      </div>
      <div class="card-actions">${s}</div>
    </div>
    <div class="card-body">${n}</div>
  </section>`}function ys(t,e,n,s=""){return`
  <div class="empty">
    <div class="empty-icon">${t}</div>
    <h3>${$(e)}</h3>
    <p>${n}</p>
    ${s?`<div class="empty-actions">${s}</div>`:""}
  </div>`}function gs(t,e,n){return`<div class="note ${t}">${e}<div>${n}</div></div>`}function Jl(t){return t?`<span class="owner-tag ${$(t)}">${$s[t]||$(t)}</span>`:""}function eu(t,e,n=""){return`<div class="stat ${n}"><span class="stat-k">${$(t)}</span><span class="stat-v">${e}</span></div>`}function po(t){return`<div class="metric-grid">${t.map(([e,n,s])=>eu(e,n,s)).join("")}</div>`}const su={model:"cpu",gateway:"plug",local:"terminal"};function ho(){const t=v.stats;if(!t)return nu();const e=t.overall||{},n=t.models||[],s=t.diagnosis||{};return`
  ${Ve("总览","连上之后到底哪里出了问题 —— 截断率、归因与模型健康",`<button class="btn" data-act="refresh">${ct.refresh}<span>刷新</span></button>`)}

  <div class="headline-grid">
    <section class="headline ${Rn(e.truncation_rate||0)}">
      <div class="hl-label">全局截断率</div>
      <div class="hl-value">${Et(e.truncation_rate)}</div>
      <div class="hl-sub">${V(e.truncated)} / ${V(e.requests)} 次请求 · ${t.last_truncation_at?`最近 ${oo(t.last_truncation_at)}`:"暂无截断"}</div>
      <div class="hl-bar"><i style="width:${Math.min(100,Number(e.truncation_rate)||0)}%"></i></div>
      ${po([["成功率",Et(e.success_rate)],["重试后成功",V(e.retried_ok)],["平均延迟",oe(e.avg_latency_ms)],["P95 延迟",oe(e.p95_latency_ms)],["输入 token",Tt(e.input_tokens)],["输出 token",Tt(e.output_tokens)]])}
    </section>
    ${lu(s,e)}
  </div>

  ${Pt("模型健康",`共 ${n.length} 个模型 · 全部来自实际流量`,n.length?`<div class="model-grid">${n.map(au).join("")}</div>`:ys(ct.activity,"还没有模型流量","把客户端指向本代理后，这里会自动出现模型卡片。",'<button class="btn primary" data-act="goto-guide">查看接入指引</button>'))}

  ${iu(e)}
  ${ou()}`}function nu(){return`
  ${Ve("总览","无法连接本地代理")}
  ${Pt("代理未连接","",ys(ct.xCircle,"无法连接本地代理",`请确认代理已启动。<br/><span class="dim">${$(v.lastError||"")}</span>`,`<button class="btn primary" data-act="refresh">重试</button>
       <button class="btn" data-act="goto-guide">查看启动方式</button>`),"","warn-card")}`}function lu(t,e){const n=t.owner;if(!n)return`
    <section class="diagnosis ok">
      <div class="diag-icon">${ct.checkCircle}</div>
      <div>
        <h2>${$(t.headline||"暂无截断")}</h2>
        <p>${$(t.detail||"流式响应都完整收尾，tool_use JSON 没有残缺。")}</p>
      </div>
    </section>`;const s=n==="model"?"warn":n==="local"?"info":"error",a=e.truncation_reasons||[];return`
  <section class="diagnosis ${s}">
    <div class="diag-icon">${ct[su[n]]||ct.alert}</div>
    <div class="diag-main">
      <div class="diag-title">
        <h2>${$(t.headline)}</h2>
        <span class="chip ${s}">${$s[n]||n}</span>
      </div>
      <p>${$(t.detail)}</p>
      ${a.length?`
      <div class="reason-list">
        ${a.slice(0,4).map(o=>`
          <div class="reason-row">
            <span class="rr-owner ${o.owner}">${$s[o.owner]||o.owner}</span>
            <span class="rr-label">${$(o.label)}</span>
            <span class="rr-bar"><i class="${o.owner}" style="width:${Math.max(3,o.ratio)}%"></i></span>
            <span class="rr-count mono">${V(o.count)} · ${Et(o.ratio)}</span>
          </div>`).join("")}
      </div>`:""}
    </div>
  </section>`}function au(t){const e=t.health||{level:"ok",hint:""},n=Number(t.truncation_rate||0),s=Rn(n);return`
  <button class="model-card" data-model="${$(t.model)}">
    <div class="mc-head">
      <span class="dot ${$(e.level)}"></span>
      <span class="mc-name" title="${$(t.model)}">${$(t.model)}</span>
      <span class="mc-req mono">${V(t.requests)} 次</span>
    </div>
    <div class="mc-rate ${s}">
      <span class="mcr-value">${Et(n)}</span>
      <span class="mcr-label">截断率 ${V(t.truncated)}/${V(t.requests)}</span>
    </div>
    <div class="meter"><i class="${s}" style="width:${Math.max(4,Math.min(100,n))}%"></i></div>
    <div class="mc-foot">
      <span>${Et(t.success_rate)} 成功</span>
      <span>${oe(t.avg_latency_ms)}</span>
    </div>
    ${e.hint?`<div class="mc-hint">${$(e.hint)}</div>`:'<div class="mc-hint dim">暂无截断</div>'}
  </button>`}function iu(t){const e=t.truncation_reasons||[];if(!e.length)return Pt("截断原因","按责任侧归类",ys(ct.checkCircle,"没有截断记录","所有流式响应都完整收尾。一旦出现 could not be parsed as JSON，这里会说明是谁的问题。"));const n=t.truncation_owners||{},s=Object.values(n).reduce((a,o)=>a+o,0)||1;return Pt("截断原因","按责任侧归类",`
    <div class="owner-split">
      ${["model","gateway","local"].map(a=>`
        <div class="owner-slice ${a}">
          <span class="os-label">${$s[a]}</span>
          <span class="os-count mono">${V(n[a]||0)}</span>
          <span class="os-pct">${Et((n[a]||0)*100/s)}</span>
        </div>`).join("")}
    </div>
    <div class="owner-track">
      ${["model","gateway","local"].map(a=>`
        <i class="${a}" style="width:${(n[a]||0)*100/s}%"></i>`).join("")}
    </div>
    <table class="table">
      <thead><tr><th>原因</th><th>责任侧</th><th class="num">次数</th><th class="num">占比</th></tr></thead>
      <tbody>
        ${e.map(a=>`
          <tr>
            <td>${$(a.label)}</td>
            <td>${Jl(a.owner)}</td>
            <td class="num mono">${V(a.count)}</td>
            <td class="num mono">${Et(a.ratio)}</td>
          </tr>`).join("")}
      </tbody>
    </table>`)}function ou(){const t=v.stats?.recent_truncations||[];return t.length?Pt("最近截断","点「抓包」可看完整请求/响应",`<table class="table">
      <thead><tr><th>时间</th><th>模型</th><th>责任侧</th><th>原因</th><th></th></tr></thead>
      <tbody>${t.map(e=>`
        <tr>
          <td class="mono dim">${Qs(e.time)}</td>
          <td>${$(e.model||"—")}</td>
          <td>${Jl(e.owner)}</td>
          <td>${$(e.reason_label||e.reason||"")}</td>
          <td class="num"><button class="link-btn" data-capture="${$(e.id)}">查看抓包</button></td>
        </tr>`).join("")}</tbody>
    </table>`):""}function ru(){const e=v.stats?.models||[];if(!e.length)return`${Ve("模型","按模型看截断率、延迟与上下文增长")}
      ${Pt("模型","",ys(ct.cpu,"还没有模型流量","模型卡片完全由流量中的 model 字段聚合，任何上游的任何模型都会自动出现。",'<button class="btn primary" data-act="goto-guide">查看接入指引</button>'))}`;const n=Wn(),s=e.find(p=>p.model===n)||e[0],a=s.health||{},o=Number(s.truncation_rate||0),c=Rn(o),f=cu(s.truncation_owners||{}),d=s.truncation_reasons||[];return`
  ${Ve("模型","左侧选择模型，右侧是该模型的完整证据链")}
  <div class="split">
    <aside class="split-rail">
      ${e.map(p=>{const b=Number(p.truncation_rate||0);return`
        <button class="rail-item${p.model===s.model?" active":""}" data-model="${$(p.model)}">
          <span class="dot ${$((p.health||{}).level||"ok")}"></span>
          <span class="ri-name" title="${$(p.model)}">${$(p.model)}</span>
          <span class="ri-rate ${Rn(b)}">${Et(b)}</span>
        </button>`}).join("")}
    </aside>
    <div class="split-main">
      <section class="card model-detail">
        <div class="card-head">
          <div class="card-title">
            <h2 title="${$(s.model)}">${$(s.model)}</h2>
            <span class="chip ${a.level==="ok"?"ok":a.level==="warn"?"warn":"error"}">${a.level==="ok"?"健康":a.level==="warn"?"需关注":"异常"}</span>
          </div>
          <div class="card-actions mono dim">健康度 ${a.score??"—"} · ${V(s.requests)} 次请求</div>
        </div>
        <div class="card-body">
          <div class="model-hero ${c}">
            <div class="mh-rate">
              <span class="mh-value">${Et(o)}</span>
              <span class="mh-label">截断率</span>
              <span class="mh-sub">${V(s.truncated)} / ${V(s.requests)} 次</span>
            </div>
            ${po([["成功率",Et(s.success_rate)],["重试成功",Et(s.retry_success_rate)],["平均延迟",oe(s.avg_latency_ms)],["P95 延迟",oe(s.p95_latency_ms)],["输入 token",Tt(s.input_tokens)],["输出 token",Tt(s.output_tokens)]])}
          </div>
          ${a.hint?`<div class="verdict ${c}">${$(a.hint)}</div>`:""}
        </div>
      </section>

      ${d.length?`
      <section class="card">
        <div class="card-head"><div class="card-title"><h2>归因</h2>
          <span class="card-sub">${$s[f]||"—"}为主 · ${V(s.truncated)} 次截断</span></div></div>
        <div class="card-body">
          <div class="reason-list">
            ${d.map(p=>`
              <div class="reason-row">
                <span class="rr-owner ${p.owner}">${$s[p.owner]||p.owner}</span>
                <span class="rr-label">${$(p.label)}</span>
                <span class="rr-bar"><i class="${p.owner}" style="width:${Math.max(3,p.ratio)}%"></i></span>
                <span class="rr-count mono">${V(p.count)} · ${Et(p.ratio)}</span>
              </div>`).join("")}
          </div>
          <div class="advice">${$(uu(f))}</div>
        </div>
      </section>`:""}

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>上下文增长</h2><span class="card-sub">input + cache tokens</span></div>
          <div class="card-actions">
            <span class="legend"><i></i>input</span>
            <span class="legend cache"><i></i>cache</span>
            <span class="legend cut"><i></i>截断</span>
          </div>
        </div>
        <div class="card-body"><div class="chart-host" id="chart-host"><div class="chart-tip" id="chart-tip"></div></div></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>截断事件</h2><span class="card-sub">展开可见残缺 tool_use JSON</span></div>
          <div class="card-actions"><span class="chip">${V(s.truncated)} 次</span></div>
        </div>
        <div class="card-body"><div class="trunc-list" id="trunc-list"></div></div>
      </section>

      <section class="card">
        <div class="card-head">
          <div class="card-title"><h2>用量统计</h2></div>
          <div class="card-actions">
            <div class="seg" id="gran-seg">
              ${["day","week","month"].map(p=>`<button data-gran="${p}" class="${v.gran===p?"active":""}">${{day:"日",week:"周",month:"月"}[p]}</button>`).join("")}
            </div>
          </div>
        </div>
        <div class="card-body tight"><div id="buckets-wrap"></div></div>
      </section>

      <section class="card">
        <div class="card-head"><div class="card-title"><h2>最近请求</h2></div>
          <div class="card-actions"><span class="chip" id="recent-count">—</span></div></div>
        <div class="card-body tight"><div id="recent-wrap"></div></div>
      </section>
    </div>
  </div>`}function cu(t){return["model","gateway","local"].reduce((e,n)=>t[n]>(t[e]||0)?n:e,"model")}function uu(t){return{model:"模型在输出工具调用时被截断或生成了非法 JSON。先提高 max_tokens，再考虑降低温度、缩小工具 schema，或换一个模型对比同一批请求。",gateway:"截断发生在流结束前，请求没有正常收尾。优先检查上游/网关的流式支持、空闲超时与 5xx；换直连对比可以快速定位。",local:"客户端或本地链路主动断开。检查代理超时、编辑器/IDE 卡顿，以及本机网络是否在长流式响应中途中断。"}[t]||""}function du(t){if(!t)return;const e=v.detail.truncations||[];if(!e.length){t.innerHTML='<div class="empty-inline">该模型暂无 tool_use 截断记录</div>';return}const n=v.expanded||(v.expanded=new Set);t.innerHTML=e.map(s=>{const a=n.has(s.id),o=s.truncation?.tool_calls||[],c=o.map(d=>`#${d.index} ${d.name||"(未命名工具)"} ${d.id||""}
${d.fragment||"(空片段)"}`).join(`

`),f=s.owner||"gateway";return`
    <div class="trunc-item${a?" open":""}" data-tid="${$(s.id)}">
      <button class="trunc-row">
        <span class="mono dim">${Qs(s.time)}</span>
        <span class="owner-tag ${f}">${$s[f]||f}</span>
        <span class="tn">${$(o.map(d=>d.name).filter(Boolean).join(", ")||"tool_use")}</span>
        <span class="tr">${$(s.reason_label||s.reason||"")}</span>
        <span class="caret">${ct.chevron}</span>
      </button>
      <div class="trunc-detail">
        <pre class="frag">${$(c||"(无片段)")}</pre>
        <div class="frag-meta">
          <span>${$(s.model||"")}</span>
          <span>${$(s.path||"")}</span>
          <span>${$(s.session||"无 session")}</span>
          <span>HTTP ${$(String(s.status??"—"))}</span>
          <span class="mono dim">${$(s.reason||"")}</span>
          <button class="link-btn" data-capture="${$(s.id)}">看完整抓包</button>
        </div>
      </div>
    </div>`}).join("")}function mo(t){if(!t)return;const e=v.detail.buckets||[];if(!e.length){t.innerHTML='<div class="empty-inline">暂无数据</div>';return}const n=e.filter(c=>(c.requests||0)>0).reverse();if(!n.length){t.innerHTML='<div class="empty-inline">这段时间还没有流量</div>';return}const s=fu(v.gran),a=n.reduce((c,f)=>{for(const d of["requests","success","failed","truncated","input_tokens","output_tokens"])c[d]+=Number(f[d]||0);return c.duration_ms+=Number(f.avg_latency_ms||0)*Number(f.requests||0),c},{requests:0,success:0,failed:0,truncated:0,input_tokens:0,output_tokens:0,duration_ms:0}),o=a.requests?a.duration_ms/a.requests:0;t.innerHTML=`
    <div class="table-wrap">
    <table class="table">
      <thead><tr>
        <th>${v.gran==="day"?"日期":v.gran==="week"?"起始周":"月份"}</th>
        <th class="num">请求</th><th class="num">成功</th><th class="num">失败</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th><th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${n.map(c=>`
        <tr${c.label===s?' class="today"':""}>
          <td class="mono">${$(c.label)}${c.label===s?'<span class="today-tag">今天</span>':""}</td>
          <td class="num">${V(c.requests)}</td>
          <td class="num">${V(c.success)}</td>
          <td class="num ${c.failed?"bad":"dim"}">${c.failed?V(c.failed):"—"}</td>
          <td class="num ${c.truncated?"warn-c":"dim"}">${c.truncated?V(c.truncated):"—"}</td>
          <td class="num">${Tt(c.input_tokens)}</td>
          <td class="num">${Tt(c.output_tokens)}</td>
          <td class="num">${oe(c.avg_latency_ms)}</td>
        </tr>`).join("")}
      </tbody>
      <tfoot><tr class="total-row">
        <td class="mono">合计 · ${n.length} ${v.gran==="day"?"天":v.gran==="week"?"周":"月"}</td>
        <td class="num">${V(a.requests)}</td>
        <td class="num">${V(a.success)}</td>
        <td class="num ${a.failed?"bad":"dim"}">${a.failed?V(a.failed):"—"}</td>
        <td class="num ${a.truncated?"warn-c":"dim"}">${a.truncated?V(a.truncated):"—"}</td>
        <td class="num">${Tt(a.input_tokens)}</td>
        <td class="num">${Tt(a.output_tokens)}</td>
        <td class="num">${oe(o)}</td>
      </tr></tfoot>
    </table>
    </div>`}function fu(t){const e=new Date;if(t==="month")return`${e.getFullYear()}-${String(e.getMonth()+1).padStart(2,"0")}`;const n=s=>`${String(s.getMonth()+1).padStart(2,"0")}-${String(s.getDate()).padStart(2,"0")}`;return t==="week"?`${n(new Date(e.getFullYear(),e.getMonth(),e.getDate()-(e.getDay()+6)%7))} 周`:n(e)}function pu(t){if(!t)return;const e=v.detail.recent||[],n=document.getElementById("recent-count");if(n&&(n.textContent=`${e.length} 条`),!e.length){t.innerHTML='<div class="empty-inline">暂无请求</div>';return}t.innerHTML=`
    <table class="table">
      <thead><tr>
        <th>时间</th><th>状态</th><th class="num">尝试</th><th class="num">耗时</th>
        <th class="num">输入</th><th class="num">输出</th><th>协议</th><th>截断</th><th></th>
      </tr></thead>
      <tbody>${e.map(s=>{const a=s.truncated?["warn","截断"]:s.ok?s.retried_ok?["warn","重试成功"]:["ok",String(s.status||200)]:["error",String(s.status||"失败")];return`
        <tr>
          <td class="mono dim">${Qs(s.time)}</td>
          <td><span class="tag ${a[0]}">${$(a[1])}</span></td>
          <td class="num">${V(s.attempts)}</td>
          <td class="num">${oe(s.duration_ms)}</td>
          <td class="num">${V(s.input_tokens)}</td>
          <td class="num">${V(s.output_tokens)}</td>
          <td><span class="proto">${$(s.protocol||"—")}</span></td>
          <td>${s.truncated?'<span class="tag warn">截断</span>':'<span class="dim">—</span>'}</td>
          <td class="num"><button class="link-btn" data-capture="${$(s.id)}">抓包</button></td>
        </tr>`}).join("")}</tbody>
    </table>`}const hu=[["auto","自动（跟随客户端）"],["anthropic","Anthropic Messages"],["openai","OpenAI Chat Completions"]];function hi(){return{id:"",name:"",protocol:"auto",base_url:"",auth_header:"",models:[],enabled:!0,note:""}}function mu(){const t=v.config||{},e=t.providers||[],n=v.editingProvider,s=e.length?"provider":t.upstream?"legacy":"none";return`
  ${Ve("供应商","上游地址、协议与鉴权都在这里管理，支持任意供应商",`<button class="btn primary" data-act="provider-new">${ct.plus}<span>新增供应商</span></button>`)}
  ${s==="legacy"?gs("warn",ct.alert,"当前仍在用旧版单上游配置（设置页里的「上游地址」）。新增供应商并设为默认后，旧配置会自动退居兜底。"):""}
  ${s==="none"?gs("warn",ct.alert,"还没有任何上游。新增一个供应商后，把客户端指向本代理即可开始观测。"):""}

  ${n?gu(n):""}

  ${e.length?`
  <div class="provider-grid">
    ${e.map(a=>vu(a,t.default_provider===a.id)).join("")}
  </div>`:n?"":Pt("供应商","",ys(ct.server,"还没有供应商","ccp-observe 不绑定任何供应商：每家一个卡片，写上基址和鉴权头即可。",'<button class="btn primary" data-act="provider-new">新增供应商</button>'))}
  `}function vu(t,e){const n=t.models||[],s={auto:"自动",anthropic:"Anthropic",openai:"OpenAI"}[t.protocol]||t.protocol;return`
  <section class="card provider-card${t.enabled?"":" disabled"}">
    <div class="card-head">
      <div class="card-title">
        <span class="dot ${t.enabled?"ok":"muted"}"></span>
        <h2 title="${$(t.name)}">${$(t.name)}</h2>
        ${e?'<span class="chip ok">默认</span>':""}
        ${t.enabled?"":'<span class="chip">已停用</span>'}
      </div>
      <div class="card-actions">
        <button class="icon-btn" data-act="provider-test" data-id="${$(t.id)}" title="测试连通性">${ct.plug}</button>
        <button class="icon-btn" data-act="provider-edit" data-id="${$(t.id)}" title="编辑">${ct.gear}</button>
        <button class="icon-btn danger" data-act="provider-del" data-id="${$(t.id)}" title="删除">${ct.trash}</button>
      </div>
    </div>
    <div class="card-body">
      <div class="kv"><span class="k">基址</span><span class="v mono" title="${$(t.base_url)}">${$(t.base_url||"—")}</span></div>
      <div class="kv"><span class="k">协议</span><span class="v">${s}${t.protocol!=="auto"?"":' <span class="dim">（跟随客户端）</span>'}</span></div>
      <div class="kv"><span class="k">鉴权</span><span class="v mono dim">${t.auth_header?"已配置（不回显）":"透传客户端"}</span></div>
      ${n.length?`<div class="kv"><span class="k">模型</span><span class="v">${n.map(a=>`<span class="chip mono">${$(a)}</span>`).join(" ")}</span></div>`:'<div class="kv"><span class="k">模型</span><span class="v dim">由路由规则决定</span></div>'}
      ${t.note?`<div class="kv"><span class="k">备注</span><span class="v dim">${$(t.note)}</span></div>`:""}
      <div class="provider-foot">
        ${e?'<span class="dim">所有未命中路由的请求走这里</span>':`<button class="link-btn" data-act="provider-default" data-id="${$(t.id)}">设为默认</button>`}
        <span class="spacer"></span>
        <button class="link-btn" data-act="provider-toggle" data-id="${$(t.id)}">${t.enabled?"停用":"启用"}</button>
      </div>
      <div class="probe-slot" id="probe-${$(t.id)}"></div>
    </div>
  </section>`}function gu(t){return`
  <section class="card editor">
    <div class="card-head">
      <div class="card-title"><h2>${!t.id?"新增供应商":"编辑供应商"}</h2>
        <span class="card-sub">鉴权头格式：<code>Authorization: Bearer 你的 key</code></span></div>
      <div class="card-actions">
        <button class="btn sm ghost" data-act="provider-cancel">取消</button>
      </div>
    </div>
    <div class="card-body">
      <div class="form-grid">
        <label class="field">
          <span>名称</span>
          <input type="text" data-field="name" value="${$(t.name)}" placeholder="例如 我的网关 A" />
          <em>面板与路由里显示的名字，可随时改。</em>
        </label>
        <label class="field">
          <span>协议</span>
          <select data-field="protocol">
            ${hu.map(([n,s])=>`<option value="${n}" ${t.protocol===n?"selected":""}>${s}</option>`).join("")}
          </select>
          <em>「自动」表示上游说客户端同一种协议；选具体协议时，若与客户端不同会自动做格式转换。</em>
        </label>
      </div>
      <label class="field">
        <span>基址</span>
        <input type="text" data-field="base_url" value="${$(t.base_url)}" placeholder="https://example.internal/v1" />
        <em>填写到 <code>/v1</code> 为止（也可只写域名）。示例值仅作占位，不含任何真实内网地址。</em>
      </label>
      <label class="field">
        <span>鉴权头</span>
        <input type="text" data-field="auth_header" value="" placeholder="${t.auth_header?"已配置，留空则保持不变":"Authorization: Bearer sk-xxxx"}" />
        <em>格式 <code>头名: 值</code>。配置后代理用它覆盖客户端的同名头，避免把客户端 key 透传给第三方。</em>
      </label>
      <label class="field">
        <span>模型列表 <span class="dim">（可选）</span></span>
        <input type="text" data-field="models" value="${$((t.models||[]).join(", "))}" placeholder="model-a, model-b, vendor/*" />
        <em>填写后，请求体里的 model 命中这一项就自动路由到这里；留空则只按路由规则匹配。</em>
      </label>
      <label class="field">
        <span>备注</span>
        <input type="text" data-field="note" value="${$(t.note||"")}" placeholder="可选" maxlength="200" />
      </label>
      <div class="form-foot">
        <label class="check"><input type="checkbox" data-field="enabled" ${t.enabled?"checked":""}/> 启用</label>
        <span class="spacer"></span>
        <button class="btn" data-act="provider-probe-new">测试连通性</button>
        <button class="btn primary" data-act="provider-save" data-id="${$(t.id)}">保存</button>
      </div>
      <div class="probe-slot" id="probe-editor"></div>
    </div>
  </section>`}function bu(t,e,n){const s=e.dataset.id,o=(v.config||{}).providers||[];if(t==="provider-new")return v.editingProvider=hi(),n(),!0;if(t==="provider-edit"){const c=o.find(f=>f.id===s);return v.editingProvider=c?{...c,auth_header:""}:hi(),n(),!0}if(t==="provider-cancel")return v.editingProvider=null,n(),!0;if(t==="provider-save")return $u(e,n),!0;if(t==="provider-del"){const c=o.find(f=>f.id===s);return!c||!confirm(`删除供应商「${c.name}」？指向它的路由规则也会一并移除。`)||Ye({providers:o.filter(f=>f.id!==s)},"已删除").then(n),!0}if(t==="provider-default")return Ye({default_provider:s},"已设为默认供应商").then(n),!0;if(t==="provider-toggle"){const c=o.map(f=>f.id===s?{...f,enabled:!f.enabled}:f);return Ye({providers:c},"已更新").then(n),!0}return t==="provider-test"||t==="provider-probe-new"?(wu(e,s),!0):!1}function $u(t,e){const n=t.closest(".card"),s=b=>{const g=n.querySelector(`[data-field="${b}"]`);return g?g.type==="checkbox"?g.checked:g.value:""},a=t.dataset.id||"",c=((v.config||{}).providers||[]).map(b=>({...b})),f=String(s("models")||"").split(/[,\s]+/).map(b=>b.trim()).filter(Boolean),d={id:a||void 0,name:String(s("name")||"").trim(),protocol:String(s("protocol")||"auto"),base_url:String(s("base_url")||"").trim(),auth_header:String(s("auth_header")||"").trim(),models:f,enabled:!!s("enabled"),note:String(s("note")||"").trim()};if(!d.name){Fe("请填写供应商名称","error");return}if(!d.base_url){Fe("请填写基址","error");return}let p;a?p=c.map(b=>b.id!==a?b:{...b,...d,id:b.id,auth_header:d.auth_header||b.auth_header}):p=[...c,d],Ye({providers:p},"已保存供应商").then(b=>{v.editingProvider=null;const g=(b.providers||[]).map(w=>w.id);!b.default_provider&&g.length?Ye({default_provider:g[g.length-1]},"已设为默认供应商").then(e):e()})}async function wu(t,e,n){const s=t.closest(".card"),a=s.querySelector(".probe-slot"),o=b=>s.querySelector(`[data-field="${b}"]`),f=((v.config||{}).providers||[]).find(b=>b.id===e),d=o("base_url"),p=d?{upstream:String(d.value||"").trim(),auth_header:String((o("auth_header")||{}).value||"").trim(),protocol:String((o("protocol")||{}).value||"auto")}:{provider:e,protocol:f?.protocol||"auto"};p.protocol==="auto"&&(p.protocol="openai"),a.innerHTML='<div class="probe pending">正在探测…</div>';try{const b=await ie.testUpstream(p);a.innerHTML=`<div class="probe ${b.ok?"ok":"error"}">
      ${b.ok?"✓ 连通":"✕ 失败"} · HTTP ${$(String(b.status??"—"))} · ${$(String(b.latency_ms??"—"))}ms
      <span class="dim mono">${$(b.url||"")}</span>
      ${b.error?`<span class="dim">${$(b.error)}</span>`:""}
    </div>`}catch(b){a.innerHTML=`<div class="probe error">✕ ${$(b.message)}</div>`}}const yu={rule:"路由规则命中",models:"供应商模型列表命中",default:"默认供应商",legacy:"旧版单上游配置",none:"没有可用上游"};function ku(){const t=v.config||{},e=t.providers||[],n=t.routes||[],s=v.routePreview,a=o=>(e.find(c=>c.id===o)||{}).name||o||"—";return`
  ${Ve("路由","按模型名或路径把请求分到不同供应商，规则自上而下匹配",'<button class="btn" data-act="route-export">导出规则</button>')}

  ${e.length?"":gs("warn",ct.alert,"还没有供应商。先到「供应商」页添加至少一个上游，否则请求无处可去。")}

  <div class="split wide-left">
    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>规则</h2><span class="card-sub">改完即时生效</span></div>
        <div class="card-actions"><span class="chip">${n.length} 条</span></div>
      </div>
      <div class="card-body tight">
        ${n.length?`
        <table class="table">
          <thead><tr><th style="width:34px">#</th><th>匹配</th><th>目标供应商</th><th style="width:88px"></th></tr></thead>
          <tbody>
            ${n.map((o,c)=>`
              <tr>
                <td class="dim mono">${c+1}</td>
                <td class="mono">${$(o.match)}
                  <span class="dim">${o.match.startsWith("/")?"路径":"模型"}</span></td>
                <td>${$(a(o.provider))}</td>
                <td class="num nowrap">
                  <button class="icon-btn sm" data-act="route-up" data-idx="${c}" title="上移">↑</button>
                  <button class="icon-btn sm" data-act="route-down" data-idx="${c}" title="下移">↓</button>
                  <button class="icon-btn sm danger" data-act="route-del" data-idx="${c}" title="删除">${ct.trash}</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>`:'<div class="empty-inline">还没有规则，所有请求会走默认供应商。</div>'}
        <div class="route-add">
          <input type="text" id="route-match" placeholder="模型通配（如 vendor/*）或路径（/v1/messages）" />
          <select id="route-provider">
            <option value="">选择供应商…</option>
            ${e.map(o=>`<option value="${$(o.id)}">${$(o.name)}</option>`).join("")}
          </select>
          <button class="btn primary" data-act="route-add">${ct.plus}<span>添加</span></button>
        </div>
        <div class="hint-line">匹配规则：<code>*</code> 任意字符，<code>vendor/*</code> 前缀匹配；以 <code>/</code> 开头则按请求路径匹配。</div>
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>命中预演</h2><span class="card-sub">按真实决策逻辑跑一遍</span></div>
      </div>
      <div class="card-body">
        <div class="preview-form">
          <label class="field"><span>模型名</span>
            <input type="text" id="route-model" value="${$(v.routeModel||"")}" placeholder="例如 vendor/model-x" />
          </label>
          <label class="field"><span>客户端协议</span>
            <select id="route-protocol">
              <option value="anthropic" ${v.routeProtocol==="anthropic"?"selected":""}>Anthropic</option>
              <option value="openai" ${v.routeProtocol==="openai"?"selected":""}>OpenAI</option>
            </select>
          </label>
          <button class="btn primary" data-act="route-preview">预演</button>
        </div>
        ${_u(s,a)}
        <div class="kv-list">
          <div class="kv"><span class="k">默认供应商</span><span class="v">${t.default_provider?$(a(t.default_provider)):'<span class="dim">未设置</span>'}</span></div>
          <div class="kv"><span class="k">协议转换</span><span class="v">${t.translate?"开启 · 上游协议与客户端不同时自动转换":"关闭 · 只做透传"}</span></div>
        </div>
      </div>
    </section>
  </div>

  ${Pt("匹配顺序","",`
    <ol class="order-list">
      <li><b>路由规则</b> 自上而下，第一条命中的生效。</li>
      <li><b>供应商模型列表</b> 请求里的 model 精确命中某个供应商的列表。</li>
      <li><b>默认供应商</b> 以上都没命中时兜底。</li>
      <li><b>旧版单上游</b> 没有任何供应商时的兼容路径。</li>
    </ol>`)}
  `}function _u(t,e){return t?t.error?`<div class="preview-box error">${$(t.error)}</div>`:`
  <div class="preview-box ${t.source==="none"?"error":"ok"}">
    <div class="pv-row"><span class="pv-k">决策</span><span class="pv-v">
      <b>${$(yu[t.source]||t.source||"—")}</b>
      ${t.matched?`<span class="dim mono">· ${$(t.matched)}</span>`:""}</span></div>
    <div class="pv-row"><span class="pv-k">供应商</span><span class="pv-v">${t.provider_id?$(e(t.provider_id)):'<span class="dim">无（旧版上游或无上游）</span>'}</span></div>
    <div class="pv-row"><span class="pv-k">上游地址</span><span class="pv-v mono">${$(t.base_url||"—")}</span></div>
    <div class="pv-row"><span class="pv-k">上游协议</span><span class="pv-v mono">${$(t.upstream_protocol||"—")}</span></div>
    <div class="pv-row"><span class="pv-k">格式转换</span><span class="pv-v">${t.translate?"是 · 请求与响应都会转换":"否 · 原样透传"}</span></div>
  </div>`:'<div class="empty-inline">输入模型名后点「预演」，可以看到请求会落到哪个供应商、是否需要改写协议。</div>'}function xu(t,e,n){const a=((v.config||{}).routes||[]).map(c=>({...c})),o=e.dataset.idx!==void 0?Number(e.dataset.idx):-1;if(t==="route-add"){const c=(document.getElementById("route-match")?.value||"").trim(),f=document.getElementById("route-provider")?.value||"";return c?f?(a.push({match:c,provider:f}),Ye({routes:a},"已添加规则").then(n),!0):(Fe("请选择目标供应商","error"),!0):(Fe("请填写匹配模式","error"),!0)}if(t==="route-del"&&o>=0)return a.splice(o,1),Ye({routes:a},"已删除规则").then(n),!0;if((t==="route-up"||t==="route-down")&&o>=0){const c=t==="route-up"?o-1:o+1;if(c<0||c>=a.length)return!0;const[f]=a.splice(o,1);return a.splice(c,0,f),Ye({routes:a},"已调整顺序").then(n),!0}if(t==="route-preview")return v.routeModel=document.getElementById("route-model")?.value||"",v.routeProtocol=document.getElementById("route-protocol")?.value||"anthropic",fo().then(n),!0;if(t==="route-export"){const c=a.map(f=>`${f.match}=${f.provider}`).join(`
`);return navigator.clipboard?.writeText(c).then(()=>Fe("规则已复制到剪贴板","ok"),()=>Fe("复制失败","error")),!0}return!1}function Su(){const t=v.captures||[],e=v.captureStats||{},n=v.captureDetail,s=v.stats?.models||[];return`
  ${Ve("抓包",`保留最近 ${V(e.limit||0)} 次完整请求与响应，鉴权头已脱敏`,`<button class="btn" data-act="capture-refresh">${ct.refresh}<span>刷新</span></button>`)}
  <div class="split wide-left">
    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>请求流</h2>
          <span class="card-sub">${V(t.length)} 条 · 上限 ${V(e.captured||0)}/${V(e.limit||0)}</span></div>
        <div class="card-actions">
          <select id="cap-model" class="select-sm">
            <option value="">全部模型</option>
            ${s.map(a=>`<option value="${$(a.model)}" ${v.captureModel===a.model?"selected":""}>${$(a.model)}</option>`).join("")}
          </select>
          <label class="check sm"><input type="checkbox" id="cap-trunc" ${v.captureTruncated?"checked":""}/> 仅截断</label>
        </div>
      </div>
      <div class="card-body tight">
        ${t.length?`
        <table class="table capture-table">
          <thead><tr>
            <th>时间</th><th>模型</th><th>供应商</th><th class="num">状态</th>
            <th class="num">耗时</th><th>协议</th><th>截断</th>
          </tr></thead>
          <tbody>
            ${t.map(a=>`
              <tr class="cap-row${v.captureId===a.id?" active":""}" data-capture="${$(a.id)}">
                <td class="mono dim">${Qs(a.time)}</td>
                <td title="${$(a.model||"")}">${$(Mu(a.model))}</td>
                <td class="dim" title="${$(a.provider_name||"")}">${$(a.provider_name||"旧版上游")}</td>
                <td class="num"><span class="tag ${a.ok?"ok":"error"}">${$(String(a.status??"—"))}</span></td>
                <td class="num">${oe(a.duration_ms)}</td>
                <td>
                  <span class="proto">${$(a.protocol||"—")}</span>
                  ${a.translated?`<span class="chip xs" title="代理做了协议转换">⇄ ${$(a.upstream_protocol||"")}</span>`:""}
                </td>
                <td>${a.truncated?`<span class="tag warn">${$(a.reason||"截断")}</span>`:'<span class="dim">—</span>'}</td>
              </tr>`).join("")}
          </tbody>
        </table>`:ys(ct.braces,"还没有抓包记录","任何经过代理的请求都会记下完整请求/响应，包括残缺的 tool_use JSON。发一条请求即可看到。")}
      </div>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title"><h2>请求详情</h2>
          <span class="card-sub">${n?$(n.id):"从左侧选择一条记录"}</span></div>
      </div>
      <div class="card-body">${n?Tu(n):'<div class="empty-inline">选择左侧任意一条请求查看完整报文。</div>'}</div>
    </section>
  </div>`}function Mu(t){const e=String(t||"—");return e.length>22?`${e.slice(0,14)}…${e.slice(-6)}`:e}function Tu(t){const e=t.request||{},n=t.response||{},s=t.truncated&&t.reason?Au(t):[];return`
  <div class="cap-meta">
    <div class="kv"><span class="k">时间</span><span class="v mono">${Qs(t.time)}</span></div>
    <div class="kv"><span class="k">模型</span><span class="v">${$(t.model||"—")}</span></div>
    <div class="kv"><span class="k">供应商</span><span class="v">${$(t.provider_name||"旧版上游")}</span></div>
    <div class="kv"><span class="k">路径</span><span class="v mono">${$(t.path||"")}</span></div>
    <div class="kv"><span class="k">状态</span><span class="v"><span class="tag ${t.ok?"ok":"error"}">${$(String(t.status??"—"))}</span>
      ${V(t.attempts)} 次尝试 · ${oe(t.duration_ms)}</span></div>
    <div class="kv"><span class="k">协议</span><span class="v mono">${$(t.protocol||"")}${t.translated?` → ${$(t.upstream_protocol||"")}（已转换）`:""}</span></div>
    ${t.truncated?`<div class="kv"><span class="k">截断</span><span class="v">${Jl(t.owner)}
      <span class="dim">${$(t.reason||"")}</span></span></div>`:""}
    ${t.error?`<div class="kv"><span class="k">错误</span><span class="v bad">${$(t.error)}</span></div>`:""}
  </div>

  ${s.length?`
  <div class="cap-section">
    <div class="cap-section-head">残缺的 tool_use 片段</div>
    ${s.map(a=>`
      <pre class="frag">#${a.index} ${$(a.name||"(未命名工具)")} ${$(a.id||"")}
${$(a.fragment||"(空片段)")}</pre>`).join("")}
  </div>`:""}

  <div class="cap-section">
    <div class="cap-section-head">
      请求 <span class="dim">${V(e.bytes||0)} B${e.truncated?" · 已截断显示":""}</span>
      <span class="spacer"></span>
      <button class="link-btn" data-action="copy-capture" data-copy="${$(t.id)}-req">复制</button>
    </div>
    <pre class="code" id="cap-req">${$(e.text||"(空请求体)")}</pre>
    <details class="cap-headers"><summary>请求头</summary>
      <pre class="code sm">${$(mi(e.headers))}</pre></details>
  </div>

  <div class="cap-section">
    <div class="cap-section-head">
      响应 <span class="dim">${V(n.bytes||0)} B${n.truncated?" · 已截断显示":""}</span>
    </div>
    <pre class="code" id="cap-resp">${$(n.text||"(空响应体)")}</pre>
    <details class="cap-headers"><summary>响应头</summary>
      <pre class="code sm">${$(mi(n.headers))}</pre></details>
  </div>`}function mi(t){return Object.entries(t||{}).map(([e,n])=>`${e}: ${n}`).join(`
`)||"(无)"}function Au(t){return(v.detail.truncations||[]).find(n=>n.id===t.id)?.truncation?.tool_calls||[]}function vo(t,e,n){if(t==="capture-refresh")return Ys().then(n),!0;if(t==="copy-capture"){const a=(e.dataset.copy||"").endsWith("-req")?"cap-req":"cap-resp",o=document.getElementById(a);return o&&navigator.clipboard?.writeText(o.textContent).then(()=>Fe("已复制","ok"),()=>Fe("复制失败","error")),!0}return!1}async function Cu(t,e){await tu(t),e()}function Eu(){const t=location.origin,e=v.stats?.protocol_mix,n=v.config||{},s=n.providers||[],a=!!n.upstream||s.some(d=>d.enabled&&d.base_url),o=`export ANTHROPIC_BASE_URL=${t}
export ANTHROPIC_AUTH_TOKEN=your-key-if-any
# 上游鉴权在「供应商」页配置，客户端这里只放占位值`,c=`# ~/.codex/config.toml（或直接跑 ccp codex，不用改这个文件）
model_provider = "ccp"
web_search = "disabled"

[model_providers.ccp]
name = "ccp-observe"
base_url = "${t}/v1"
env_key = "OPENAI_API_KEY"
wire_api = "responses"`,f=`curl ${t}/v1/messages \\
  -H "content-type: application/json" \\
  -d '{"model":"your-model","max_tokens":32,"messages":[{"role":"user","content":"hi"}]}'`;return`
  ${Ve("接入","把客户端指向本代理，其余保持不变",e?`<span class="chip">Anthropic ${Et(e.anthropic_ratio)} · OpenAI ${Et(e.openai_ratio)}</span>`:"")}

  ${a?"":gs("warn",ct.alert,"还没有配置上游。先到「供应商」页添加一个上游，否则请求会被代理拒掉并给出提示。")}

  ${Pt("先读这一条","",`
    ${gs("info",ct.info,"代理按请求路径自动分流：<code>/v1/messages</code> 走 Anthropic Messages，<code>/v1/chat/completions</code> 走 OpenAI Chat Completions，<code>/v1/responses</code> 走 OpenAI Responses（Codex 用这条）。请求经过代理即自动记录截断检测与统计，无需任何额外配置。")}
    ${gs("alert",ct.alert,"<b>看到 <code>could not be parsed as JSON</code>？</b> 先回「总览」看截断率和归因卡片：只有一个模型脏 → 模型侧；多个模型同时脏 → 网关或本地链路；客户端主动断开 → 本地。再点「抓包」看那一刻的残缺 tool_use JSON。")}`)}

  <div class="guide-grid">
    ${kl("Claude Code","Anthropic Messages","code-claude",o,["在终端执行，或写入 <code>~/.zshrc</code> / 系统环境变量。","保持 <code>ANTHROPIC_MODEL</code> 与实际使用的模型一致；面板按响应里的模型名归类。","客户端自己的 key 不会被透传到第三方：在「供应商 → 鉴权头」里统一配置。","启动 <code>claude</code>，在「抓包」里看到 <code>/v1/messages</code> 即接入成功。"])}
    ${kl("Codex","OpenAI Responses","code-codex",c,["最省事：装好后直接跑 <code>ccp codex</code>，它会用 <code>-c</code> 覆盖上面这些配置，不改你的 <code>config.toml</code>。",'Codex 只认 <code>wire_api = "responses"</code>，所以必须路由到 <b>protocol 为 openai</b> 的供应商；anthropic 供应商无法转换。','<code>web_search = "disabled"</code>：多数兼容网关不接受 web_search 工具，开着会 400。',"发一条带工具调用的消息，「抓包」里能看到 <code>/v1/responses</code> 的完整请求与响应。"])}
    ${kl("通用 HTTP 客户端","curl","code-curl",f,[`任意 HTTP 客户端都可以接入，把 base URL 指向 <code>${$(t)}</code>。`,"HTTP 与 SSE 流式都支持；流式响应中的 tool_use 片段会被逐段解析用于截断检测。","数据只在本机内存与状态目录，不上传任何地方。"])}
  </div>

  ${Pt("常见问题","",`
    <div class="faq">
      <div class="faq-item"><h4>统计为空？</h4>
        <p>请求必须经过本代理端口。检查 <code>ANTHROPIC_BASE_URL</code> / <code>OPENAI_BASE_URL</code> 是否指向 <code>${$(t)}</code>。
        「设置 → 监听」页显示的是实际端口（被占用时代理会自动顺延）。</p></div>
      <div class="faq-item"><h4>面板显示「无法连接本地代理」？</h4>
        <p>代理没在跑。桌面端会在启动时自动拉起；命令行方式运行 <code>python proxy/proxy.py</code> 即可。</p></div>
      <div class="faq-item"><h4>怎么区分不同客户端的流量？</h4>
        <p>看「抓包」里的协议列，或「设置 → 协议转换」中按路径统计的比例。</p></div>
      <div class="faq-item"><h4>截断率一直很高，先改什么？</h4>
        <p>按归因走：模型侧先提高 <code>max_tokens</code>；网关侧先查流式支持与超时；本地链路先查 IDE 卡顿与本机网络。</p></div>
    </div>`)}
  `}function kl(t,e,n,s,a){return`
  <section class="card guide-card">
    <div class="card-head">
      <div class="card-title"><span class="dot ok"></span><h2>${$(t)}</h2>
        <span class="card-sub">${$(e)}</span></div>
      <div class="card-actions">
        <button class="btn sm" data-action="copy-block" data-copy="${n}">${ct.copy}<span>复制</span></button>
      </div>
    </div>
    <div class="card-body">
      <pre class="code" id="${n}">${$(s)}</pre>
      <ol class="steps">${a.map(o=>`<li>${o}</li>`).join("")}</ol>
    </div>
  </section>`}function Pu(){const t=v.config||{},e=v.stats?.protocol_mix,n=t.listen||"—";return`
  ${Ve("设置","监听地址与面板信息")}

  ${Pt("监听","来自启动参数，不能用面板修改",`
    <div class="kv-list">
      <div class="kv"><span class="k">面板地址</span><span class="v mono">${$(location.origin)}/_ccp/</span></div>
      <div class="kv"><span class="k">监听</span><span class="v mono">${$(n)}</span></div>
      <div class="kv"><span class="k">客户端入口</span><span class="v mono">ANTHROPIC_BASE_URL=${$(location.origin)}<br/>OPENAI_BASE_URL=${$(location.origin)}/v1</span></div>
      <div class="kv"><span class="k">版本</span><span class="v mono">v${$(t.version||"—")}</span></div>
    </div>
    ${gs("info",ct.info,"端口被占用时代理会自动顺延，请以本页显示的实际监听地址为准。桌面端会跟随该地址，不需要手动改配置。")}`)}

  ${Pt("行为","保存后立即热更新",`
    <div class="form-grid">
      <label class="field"><span>重试次数</span>
        <input type="number" id="set-retries" min="0" max="20" value="${Number(t.retries??3)}" />
        <em>仅对 429 / 5xx / 连接错误重试。</em>
      </label>
      <label class="field"><span>重试退避（毫秒）</span>
        <input type="number" id="set-backoff" min="0" max="60000" value="${Number(t.retry_backoff_ms??600)}" />
        <em>线性退避基数，第 n 次重试等待 n × 该值。</em>
      </label>
      <label class="field"><span>历史保留条数</span>
        <input type="number" id="set-history" min="50" max="20000" value="${Number(t.history_limit??500)}" />
        <em>内存中保留的请求条数上限。</em>
      </label>
      <label class="field"><span>抓包保留条数</span>
        <input type="number" id="set-captures" min="1" max="2000" value="${Number(t.capture_limit??200)}" />
        <em>完整请求/响应保留的条数。</em>
      </label>
    </div>
    <label class="check"><input type="checkbox" id="set-capture" ${t.capture_enabled!==!1?"checked":""}/> 开启抓包</label>
    <div class="form-foot">
      <span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button>
    </div>`)}

  ${Pt("协议转换","",`
    <label class="check"><input type="checkbox" id="set-translate" ${t.translate!==!1?"checked":""}/>
      自动转换协议格式</label>
    <p class="muted">开启后，如果某个供应商声明的协议与客户端不同（例如 Claude Code 走 OpenAI 兼容上游），
    代理会转换请求与流式响应；关闭则只做透传，由上游自行处理。</p>
    <div class="mix">
      <div class="mix-bar">
        <i class="a" style="width:${e?e.anthropic_ratio:0}%"></i>
        <i class="o" style="width:${e?e.openai_ratio:0}%"></i>
      </div>
      <div class="mix-labels">
        <span><i class="a"></i>Anthropic ${e?Et(e.anthropic_ratio):"—"}</span>
        <span><i class="o"></i>OpenAI ${e?Et(e.openai_ratio):"—"}</span>
      </div>
      <p class="muted">按请求路径自动识别协议，无需手工切换。</p>
    </div>
    <div class="form-foot"><span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button></div>`)}

  ${Pt("模型名映射","仅影响面板展示与统计，不改写请求",`
    <label class="field">
      <textarea id="set-modelmap" rows="5" placeholder="vendor-a/model-x=model-x&#10;团队别名=规范名">${$(Object.entries(t.model_map||{}).map(([s,a])=>`${s}=${a}`).join(`
`))}</textarea>
      <em>每行一条 <code>源=目标</code>。常用于把同一模型的不同写法合并成一张卡片。</em>
    </label>
    <div class="form-foot"><span class="spacer"></span>
      <button class="btn primary" data-act="settings-save">保存</button></div>`)}

  ${Pt("诊断","",`
    <div class="form-foot">
      <button class="btn" data-act="settings-selftest">运行自检</button>
      <span class="spacer"></span>
      <span class="dim">配置保存在状态目录的 config.json，不含任何硬编码地址。</span>
    </div>
    <div id="selftest-out"></div>`)}
  `}function Lu(t,e,n){if(t==="settings-save"){const s={};for(const a of String(document.getElementById("set-modelmap")?.value||"").split(`
`)){const o=a.trim();if(!o||o.startsWith("#"))continue;const c=o.indexOf("=");if(c>0){const f=o.slice(0,c).trim(),d=o.slice(c+1).trim();f&&d&&(s[f]=d)}}return Ye({retries:Number(document.getElementById("set-retries")?.value||0),retry_backoff_ms:Number(document.getElementById("set-backoff")?.value||0),history_limit:Number(document.getElementById("set-history")?.value||500),capture_limit:Number(document.getElementById("set-captures")?.value||200),capture_enabled:!!document.getElementById("set-capture")?.checked,translate:!!document.getElementById("set-translate")?.checked,model_map:s},"设置已保存").then(n),!0}if(t==="settings-selftest"){const s=document.getElementById("selftest-out");return s&&(s.innerHTML='<div class="probe pending">自检中…</div>'),ie.selftest().then(a=>{s&&(s.innerHTML=`<table class="table compact">
        <thead><tr><th>项目</th><th>结果</th><th>详情</th></tr></thead>
        <tbody>${(a.checks||[]).map(o=>`
          <tr><td>${$(o.name)}</td>
            <td><span class="tag ${o.ok?"ok":"error"}">${o.ok?"通过":"失败"}</span></td>
            <td class="dim mono">${$(o.detail||"")}</td></tr>`).join("")}</tbody></table>`)}).catch(a=>{s&&(s.innerHTML=`<div class="probe error">${$(a.message)}</div>`)}),!0}return!1}const Du=[[7,"近 7 天"],[30,"近 30 天"],[90,"近 90 天"]];function Nu(){const t=v.usage,e=v.usageDays||30;return`
  ${Ve("用量","按天累计、跨重启保留 —— 昨天和上周的数字不会因为重启而消失",`<div class="seg">${Du.map(([n,s])=>`
      <button class="${n===e?"active":""}" data-act="usage-range" data-days="${n}">${s}</button>`).join("")}</div>`)}

  ${t?`
    ${Ou(t,e)}
    ${Ru()}
    ${Hu(t)}
    ${zu(t)}
  `:Pt("用量","",ys(ct.activity,"正在读取用量台账…","若长时间没有数据，说明代理未就绪。"))}`}function Ou(t,e){const n=t.summary||{},s=n.today||{},a=n.active_days?Math.round((n.requests||0)/n.active_days):0;return Pt(`近 ${e} 天`,`有流量的 ${V(n.active_days)} 天 · 日均 ${V(a)} 次请求`,`
    <div class="metric-grid wide">
      ${[["请求",V(n.requests)],["成功",V(n.success)],["失败",V(n.failed)],["截断",Et(n.truncation_rate)],["输入 token",Tt(n.input_tokens)],["输出 token",Tt(n.output_tokens)],["缓存读",Tt(n.cache_read_tokens)],["平均延迟",oe(n.avg_latency_ms)]].map(([o,c])=>`<div class="stat"><span class="stat-k">${$(o)}</span>
          <span class="stat-v">${c}</span></div>`).join("")}
    </div>
    <div class="usage-today">
      <span class="ut-label">今天</span>
      <span>${V(s.requests)} 次请求</span>
      <span class="dim">·</span>
      <span>输入 ${Tt(s.input_tokens)} / 输出 ${Tt(s.output_tokens)}</span>
      <span class="dim">·</span>
      <span>截断 ${V(s.truncated)}</span>
      <span class="dim">·</span>
      <span>平均 ${oe(s.avg_latency_ms)}</span>
    </div>
    ${t.persisted===!1?'<p class="muted">台账尚未落盘（首次写入发生在下一次请求结束后）。</p>':""}
  `)}function Ru(t){return`
  <section class="card">
    <div class="card-head">
      <div class="card-title"><h2>每日用量</h2>
        <span class="card-sub">柱状为请求数，折线为截断率</span></div>
      <div class="card-actions">
        <span class="legend"><i class="req"></i>请求</span>
        <span class="legend"><i class="cut"></i>截断率</span>
      </div>
    </div>
    <div class="card-body"><div class="chart-host tall" id="usage-chart">
      <div class="chart-tip" id="usage-tip"></div></div></div>
  </section>`}function Hu(t){const e=t.models||[];return e.length?Pt("按模型","同一段时间内的累计用量",`
    <table class="table">
      <thead><tr>
        <th>模型</th><th class="num">请求</th><th class="num">成功</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th>
        <th class="num">缓存读</th><th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${e.map(n=>`
        <tr>
          <td class="mono">${$(n.model)}</td>
          <td class="num">${V(n.requests)}</td>
          <td class="num">${Et(n.success_rate)}</td>
          <td class="num ${n.truncated?"warn-c":""}">${V(n.truncated)}</td>
          <td class="num">${Tt(n.input_tokens)}</td>
          <td class="num">${Tt(n.output_tokens)}</td>
          <td class="num">${Tt(n.cache_read_tokens)}</td>
          <td class="num">${oe(n.avg_latency_ms)}</td>
        </tr>`).join("")}</tbody>
    </table>`):Pt("按模型","",'<div class="empty-inline">这段时间还没有模型流量</div>')}function zu(t){const e=t.providers||[];return e.length?Pt("按供应商","哪一条上游在承担流量",`
    <table class="table">
      <thead><tr>
        <th>供应商</th><th class="num">请求</th><th class="num">失败</th>
        <th class="num">截断</th><th class="num">输入</th><th class="num">输出</th>
        <th class="num">平均延迟</th>
      </tr></thead>
      <tbody>${e.map(n=>`
        <tr>
          <td>${$(n.provider)}</td>
          <td class="num">${V(n.requests)}</td>
          <td class="num ${n.failed?"bad":""}">${V(n.failed)}</td>
          <td class="num ${n.truncated?"warn-c":""}">${V(n.truncated)}</td>
          <td class="num">${Tt(n.input_tokens)}</td>
          <td class="num">${Tt(n.output_tokens)}</td>
          <td class="num">${oe(n.avg_latency_ms)}</td>
        </tr>`).join("")}</tbody>
    </table>`):""}function vi(){const t=document.getElementById("usage-chart");if(!t){v.usageChart&&(v.usageChart.destroy(),v.usageChart=null);return}const e=document.getElementById("usage-tip");(!v.usageChart||v.usageChart.el!==t)&&(v.usageChart&&v.usageChart.destroy(),v.usageChart=new Jc(t,e));const n=v.usage?.days||[];v.usageChart.rows!==n&&v.usageChart.setData(n)}async function Iu(t,e){return t!=="usage-range"?!1:(v.usageDays=Number(e.dataset.days)||30,await Kl(),v.forcePaint=!0,Fe(null),!0)}const Fu=2500,Vu=[{id:"overview",label:"总览",icon:"dashboard",hint:"截断率与归因"},{id:"models",label:"模型",icon:"cpu",hint:"单模型全链路"},{id:"usage",label:"用量",icon:"activity",hint:"按天累计用量"},{id:"capture",label:"抓包",icon:"braces",hint:"完整请求响应"},{id:"routes",label:"路由",icon:"network",hint:"按模型分流"},{id:"providers",label:"供应商",icon:"server",hint:"上游与鉴权"},{id:"guide",label:"接入",icon:"book",hint:"客户端配置"},{id:"settings",label:"设置",icon:"gear",hint:"行为与诊断"}],go={overview:ho,models:ru,usage:Nu,capture:Su,routes:ku,providers:mu,guide:Eu,settings:Pu},qt=(t,e=document)=>e.querySelector(t),bo=(t,e=document)=>[...e.querySelectorAll(t)];let Kt=null,gn=null,gi=null;function Bu(){return`
  <div class="app">
    <aside class="rail">
      <div class="rail-brand">
        <span class="mark">${Xo.replace('width="32" height="32"','width="18" height="18"')}</span>
        <div>
          <div class="rn">ccp-observe</div>
          <div class="rs">截断检测 · 模型健康</div>
        </div>
      </div>
      <nav class="rail-nav" id="rail-nav">
        ${Vu.map(t=>`
          <button class="rail-btn" data-page="${t.id}" title="${$(t.hint)}">
            ${ct[t.icon]||""}<span>${t.label}</span>
          </button>`).join("")}
      </nav>
      <div class="rail-foot">
        <div class="rail-status" id="rail-status"></div>
        <div class="rail-ver" id="rail-ver"></div>
      </div>
    </aside>
    <div class="workspace">
      <header class="topstrip">
        <div class="strip-left" id="strip-left"></div>
        <div class="strip-right">
          <span class="strip-metric" id="strip-sync"></span>
          <button class="icon-btn" id="btn-refresh" title="立即刷新">${ct.refresh}</button>
        </div>
      </header>
      <main class="page" id="page"></main>
      <div class="notice" id="notice" hidden></div>
    </div>
  </div>
  <div id="overlay-root"></div>`}async function ju(){v.page=$o(),qt("#app").innerHTML=Bu(),Gu(),await co(),await uo(),await Promise.all([Yl(),Ys()]),bn(),location.hash&&await wo(),gn=setInterval(()=>{document.visibilityState==="visible"&&Zl()},Fu)}function $o(){const t=/#\/([a-z]+)/.exec(location.hash||""),e=t?t[1]:"";return go[e]?e:"overview"}async function Zl(t=!1){const e=qt("#btn-refresh");e&&t&&e.classList.add("spin");try{await uo()&&((v.page==="models"||v.page==="overview")&&await Yl(),v.page==="capture"&&await Ys(),v.page==="usage"&&await qu()),bn()}finally{e&&t&&e.classList.remove("spin")}}async function qu(){const t=bi();await Kl(),bi()!==t&&(v.forcePaint=!0)}function bi(){const t=v.usage?.days||[],e=t[t.length-1]||{};return JSON.stringify([t.length,e.date,e.requests,(v.usage?.summary||{}).requests,(v.usage?.models||[]).length,(v.usage?.providers||[]).length])}async function wo(){v.page==="capture"&&await Ys(),v.page==="usage"&&await Kl(),v.page==="routes"&&!v.routePreview&&await fo(),(v.page==="providers"||v.page==="routes")&&await co(),bn()}function bn(){Wu(),Uu(),yo();const t=qt("#page");if(!t)return;const e=gi!==v.page||v.forcePaint;v.forcePaint=!1,e?(t.innerHTML=(go[v.page]||ho)(),t.dataset.page=v.page,gi=v.page,Yu(),v.page==="models"&&$i(),v.page==="usage"?vi():v.usageChart&&(v.usageChart.destroy(),v.usageChart=null),t.scrollTop=0):v.page==="models"?$i():v.page==="usage"&&vi()}function We(){v.forcePaint=!0,bn()}function Wu(){bo("#rail-nav .rail-btn").forEach(a=>{const o=a.dataset.page===v.page;a.classList.toggle("active",o),o?a.setAttribute("aria-current","page"):a.removeAttribute("aria-current")});const t=!v.offline&&v.stats,e=v.stats?.models||[],n=Number(v.stats?.overall?.truncation_rate||0);qt("#rail-status").innerHTML=`
    <span class="dot ${t?n>=40?"error":n>0?"warn":"ok":"error"}"></span>
    <span>${t?"代理在线":"代理离线"}</span>`;const s=qt("#rail-ver");s&&(s.textContent=v.config?.version?`v${v.config.version} · ${e.length} 个模型`:"")}function Uu(){const t=v.stats,e=qt("#strip-left"),n=qt("#strip-sync");if(!t){e.innerHTML='<span class="chip error">代理离线</span>',n.textContent="";return}const s=t.overall||{},a=t.diagnosis||{},o=Number(s.truncation_rate||0),c=o>=40?"error":o>0?"warn":"ok",f=a.owner?`<span class="ts-owner">${$({model:"模型侧",gateway:"网关侧",local:"本地链路"}[a.owner]||a.owner)}</span>`:"";e.innerHTML=`
    <div class="strip-rate ${c}" title="${$(a.detail||"")}">
      <span class="sr-label">截断率</span><span class="sr-val">${Et(o)}</span>${f}
    </div>
    <span class="strip-sep"></span>
    <span class="strip-item">总请求 <b>${s.requests??0}</b></span>
    <span class="strip-item">成功率 <b>${Et(s.success_rate)}</b></span>
    <span class="strip-item">活跃 <b>${$(t.active_model||"—")}</b></span>`,n.textContent=v.lastSync?`同步于 ${oo(new Date(v.lastSync).toISOString())}`:""}function yo(){const t=qt("#notice"),e=v.notice;if(!e){t.hidden=!0;return}t.hidden=!1,t.className=`notice ${e.kind||"ok"}`,t.innerHTML=`<span>${$(e.text)}</span>
    <button class="icon-btn xs" data-dismiss-notice>${ct.close}</button>`}function Gu(){qt("#rail-nav").addEventListener("click",t=>{const e=t.target.closest("[data-page]");e&&Gl(e.dataset.page)}),qt("#btn-refresh").addEventListener("click",()=>Zl(!0)),document.addEventListener("click",t=>{t.target.closest("[data-dismiss-notice]")&&(v.notice=null,yo())}),window.addEventListener("hashchange",async()=>{v.page=$o(),await wo()})}function Yu(){const t=qt("#page");t.addEventListener("click",Ku),t.addEventListener("change",Ju),window.addEventListener("beforeunload",()=>{gn&&clearInterval(gn),Kt&&Kt.destroy()})}async function Ku(t){const e=t.target.closest("[data-model]");if(e){v.selectedModel=e.dataset.model,v.forcePaint=!0,v.page==="models"&&await Yl(),bn();return}const n=t.target.closest("[data-act],[data-action]");if(n){await Zu(n.dataset.act||n.dataset.action,n);return}const s=t.target.closest("[data-copy]");if(s){vo("copy-capture",s,We);return}const a=t.target.closest("[data-capture]");if(a){await Cu(a.dataset.capture,We),v.page!=="capture"&&Gl("capture");return}const o=t.target.closest(".trunc-row");if(o){const f=o.closest(".trunc-item"),d=f.dataset.tid;v.expanded=v.expanded||new Set,v.expanded.has(d)?v.expanded.delete(d):v.expanded.add(d),f.classList.toggle("open");return}const c=t.target.closest("[data-gran]");if(c){v.gran=c.dataset.gran,bo("#gran-seg button").forEach(d=>d.classList.toggle("active",d===c));const f=Wn();try{const d=await ie.buckets(f,v.gran);v.detail.buckets=d.items||[],mo(qt("#buckets-wrap"))}catch{}return}}function Ju(t){t.target.id==="cap-model"&&(v.captureModel=t.target.value,Ys().then(We)),t.target.id==="cap-trunc"&&(v.captureTruncated=t.target.checked,Ys().then(We))}async function Zu(t,e){if(t==="refresh"){await Zl(!0);return}if(t==="goto-guide"){Gl("guide");return}bu(t,e,We)||xu(t,e,We)||vo(t,e,We)||Lu(t,e,We)||await Iu(t,e)&&We()}function $i(){Wn(),v.detail.truncations,du(qt("#trunc-list")),mo(qt("#buckets-wrap")),pu(qt("#recent-wrap")),Qu()}function Qu(){const t=qt("#chart-host");if(!t){Kt&&(Kt.destroy(),Kt=null);return}const e=qt("#chart-tip");(!Kt||Kt.el!==t)&&(Kt&&Kt.destroy(),Kt=new Kc(t,e));const n=v.detail.context||[];if(!n.length){Kt.u&&(Kt.u.destroy(),Kt.u=null),t.querySelector(".chart-empty")||t.insertAdjacentHTML("beforeend",'<div class="chart-empty">该模型还没有 token 用量数据<br/><span>发起一次流式请求后即可上图</span></div>');return}t.querySelector(".chart-empty")?.remove(),Kt.setData(n)}window.addEventListener("beforeunload",()=>{gn&&clearInterval(gn),Kt&&Kt.destroy()});ju().catch(t=>{qt("#app").innerHTML=`<div class="boot"><div class="boot-mark">ccp</div>
    <div class="boot-text">${$(t.message||String(t))}</div></div>`});
