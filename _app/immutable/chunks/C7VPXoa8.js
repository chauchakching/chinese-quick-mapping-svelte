import{p as H,q as A,t as D,u as M,v as P,w as I,x as b,k as Y,g as j,i as q,y as T,s as g,j as O,z as B,c as v,A as $,B as z,C as F,D as G,F as J,G as K,f as W,a as Q,h as E,I as U,J as X,K as Z}from"./CQwz6dL6.js";import{r as x}from"./6lntSeGW.js";import{b as rr}from"./DtHbw4g-.js";const ar=["touchstart","touchmove"];function er(r){return ar.includes(r)}const k=new Set,S=new Set;function ir(r){for(var a=0;a<r.length;a++)k.add(r[a]);for(var t of S)t(r)}function m(r){var R;var a=this,t=a.ownerDocument,c=r.type,i=((R=r.composedPath)==null?void 0:R.call(r))||[],e=i[0]||r.target,d=0,_=r.__root;if(_){var u=i.indexOf(_);if(u!==-1&&(a===document||a===window)){r.__root=a;return}var h=i.indexOf(a);if(h===-1)return;u<=h&&(d=u)}if(e=i[d]||r.target,e!==a){H(r,"currentTarget",{configurable:!0,get(){return e||t}});var w=P,o=I;A(null),D(null);try{for(var s,n=[];e!==null;){var f=e.assignedSlot||e.parentNode||e.host||null;try{var l=e["__"+c];if(l!=null&&(!e.disabled||r.target===e))if(M(l)){var[V,...C]=l;V.apply(e,[r,...C])}else l.call(e,r)}catch(y){s?n.push(y):s=y}if(r.cancelBubble||f===a||f===null)break;e=f}if(s){for(let y of n)queueMicrotask(()=>{throw y});throw s}}finally{r.__root=a,delete r.currentTarget,A(w),D(o)}}}function fr(r,a){var t=a==null?"":typeof a=="object"?a+"":a;t!==(r.__t??(r.__t=r.nodeValue))&&(r.__t=t,r.nodeValue=t+"")}function tr(r,a){return L(r,a)}function dr(r,a){b(),a.intro=a.intro??!1;const t=a.target,c=E,i=v;try{for(var e=Y(t);e&&(e.nodeType!==8||e.data!==j);)e=q(e);if(!e)throw T;g(!0),O(e),B();const d=L(r,{...a,anchor:e});if(v===null||v.nodeType!==8||v.data!==$)throw z(),T;return g(!1),d}catch(d){if(d===T)return a.recover===!1&&F(),b(),G(t),g(!1),tr(r,a);throw d}finally{g(c),O(i),x()}}const p=new Map;function L(r,{target:a,anchor:t,props:c={},events:i,context:e,intro:d=!0}){b();var _=new Set,u=o=>{for(var s=0;s<o.length;s++){var n=o[s];if(!_.has(n)){_.add(n);var f=er(n);a.addEventListener(n,m,{passive:f});var l=p.get(n);l===void 0?(document.addEventListener(n,m,{passive:f}),p.set(n,1)):p.set(n,l+1)}}};u(J(k)),S.add(u);var h=void 0,w=K(()=>{var o=t??a.appendChild(W());return Q(()=>{if(e){U({});var s=X;s.c=e}i&&(c.$$events=i),E&&rr(o,null),h=r(o,c)||{},E&&(I.nodes_end=v),e&&Z()}),()=>{var f;for(var s of _){a.removeEventListener(s,m);var n=p.get(s);--n===0?(document.removeEventListener(s,m),p.delete(s)):p.set(s,n)}S.delete(u),o!==t&&((f=o.parentNode)==null||f.removeChild(o))}});return N.set(h,w),h}let N=new WeakMap;function ur(r,a){const t=N.get(r);return t?(N.delete(r),t(a)):Promise.resolve()}export{ir as d,dr as h,tr as m,fr as s,ur as u};
