// Logic tra cứu đang chạy ở V3.1.0, chuyển thành module cho V4.
export function createSearchEngine(records, { norm, endpoint, isWhole, aliases = {} }) {
  const streets = [...new Set(records.map(r => r.street).filter(Boolean))].sort((a,b) => a.localeCompare(b,'vi'));
  const exactKey = s => String(s || '').normalize('NFC').toLowerCase().trim()
    .replace(/^(đường|duong)\s+/, '').replace(/\s+/g, ' ');
  const byStreet = new Map(), looseNames = new Map();
  for (const row of records) {
    const key = exactKey(row.street);
    if (!byStreet.has(key)) byStreet.set(key, []);
    byStreet.get(key).push(row);
    const loose = norm(row.street);
    if (!looseNames.has(loose)) looseNames.set(loose, new Set());
    looseNames.get(loose).add(key);
  }
  function parseAddress(raw){let s=String(raw||'').trim().replace(/^[,.;\s]+|[,.;\s]+$/g,'').replace(/^(số|so)\s+/i,'');let only=s.match(/^(?:(hẻm|hem|kiệt|kiet|lô|lo)\s+)?([0-9]+(?:\/[0-9A-Za-z]+)*[A-Za-z]?)$/i);if(only)return {house:only[2].toUpperCase(),street:'',prefix:only[1]||'',isLot:/^(lô|lo)$/i.test(only[1]||''),streetOnly:false,houseOnly:true};let m=s.match(/^(?:(hẻm|hem|kiệt|kiet|lô|lo)\s+)?([0-9]+(?:\/[0-9A-Za-z]+)*[A-Za-z]?)\s*(?:[,;]|\s-\s)?\s+(.+)$/i);if(m)return {house:m[2].toUpperCase(),street:cleanStreetName(m[3]),prefix:m[1]||'',isLot:/^(lô|lo)$/i.test(m[1]||''),streetOnly:false,houseOnly:false};return {house:'',street:cleanStreetName(s),prefix:'',isLot:false,streetOnly:true,houseOnly:false}}
  function cleanStreetName(s){return String(s||'').trim().replace(/^[,.;\-\s]+|[,.;\-\s]+$/g,'').replace(/^(đường|duong)\s+/i,'').trim()}
function stripLotToken(s){return String(s||'').replace(/^\s*(?:lô|lo)\s+/i,'').trim()}
function tokenIsLot(s){return /^\s*(?:lô|lo)\s+/i.test(String(s||''))}
function matchToken(house,token){let h=endpoint(house),clean=stripLotToken(token);if(h.num==null)return false;let ends=clean.split(/[–—−-]/).map(x=>x.trim());if(ends.length===1){let e=endpoint(ends[0]);return e.prefix===h.prefix&&e.num===h.num&&(!e.suffix||!h.suffix||e.suffix===h.suffix)}let a=endpoint(ends[0]),b=endpoint(ends.slice(1).join('-'));if(a.num==null||b.num==null||a.prefix!==b.prefix||h.prefix!==a.prefix)return false;if((a.num%2)!==(b.num%2)||(h.num%2)!==(a.num%2)||h.num<a.num||h.num>b.num)return false;if(h.num===a.num&&a.suffix&&h.suffix&&h.suffix<a.suffix)return false;if(h.num===b.num&&b.suffix&&h.suffix&&h.suffix>b.suffix)return false;return true}
function houseMatchesRecord(house,r,lotMode){let parts=String(r.range||'').split(/[,;]/).map(x=>x.trim()).filter(Boolean);for(let token of parts){let nt=norm(token);if(['x','toan bo'].includes(nt))continue;let lot=tokenIsLot(token);if(lotMode==='onlyLot'&&!lot)continue;if(lotMode==='excludeLot'&&lot)continue;if(matchToken(house,token))return true}return false}
function houseCandidates(h){let parts=String(h||'').split('/').filter(Boolean),out=[];while(parts.length){out.push(parts.join('/'));parts.pop()}return out}
function uniqueRowsV310(rows){let seen=new Set;return rows.filter(r=>{let k=[r.tdp,norm(r.street),norm(r.parity),norm(r.range),r.newKp].join('|');if(seen.has(k))return false;seen.add(k);return true})}
function searchAddress(q){let p=parseAddress(q);if(p.houseOnly)return {p,rows:[],streetRows:[],mode:'houseOnly',usedHouse:'',fallbackDepth:0};let exact=exactKey(p.street), key=byStreet.has(exact)?exact:null; if(!key){const alias=aliases[norm(p.street)];if(alias)key=exactKey(alias)}if(!key){const options=looseNames.get(norm(p.street));if(options?.size===1)key=[...options][0];else if(options?.size>1)return {p,rows:[],streetRows:[],mode:'ambiguousStreet',usedHouse:'',fallbackDepth:0}}let streetRows=byStreet.get(key)||[];if(!streetRows.length)return {p,rows:[],streetRows:[],mode:'notFound',usedHouse:'',fallbackDepth:0};p.street=streetRows[0].street;if(p.streetOnly){let whole=streetRows.filter(isWhole);return {p,rows:uniqueRowsV310(whole.length?whole:streetRows),streetRows,mode:whole.length?'whole':'reference',usedHouse:'',fallbackDepth:0}}let candidates=houseCandidates(p.house);for(let i=0;i<candidates.length;i++){let c=candidates[i],rows=[];if(p.isLot){rows=streetRows.filter(r=>houseMatchesRecord(c,r,'onlyLot'));if(!rows.length)rows=streetRows.filter(r=>houseMatchesRecord(c,r,'excludeLot'))}else rows=streetRows.filter(r=>houseMatchesRecord(c,r,'any'));if(rows.length)return {p,rows:uniqueRowsV310(rows),streetRows,mode:i?'fallback':'exact',usedHouse:c,fallbackDepth:i}}let whole=streetRows.filter(isWhole);if(whole.length)return {p,rows:uniqueRowsV310(whole),streetRows,mode:'whole',usedHouse:p.house,fallbackDepth:0};return {p,rows:uniqueRowsV310(streetRows),streetRows,mode:'reference',usedHouse:p.house,fallbackDepth:0}}
function levenshtein(a,b){a=norm(a);b=norm(b);let prev=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){let cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(cur[j-1]+1,prev[j]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}return prev[b.length]}
function streetSuggestions(q){q=norm(q);if(!q)return [];let words=q.split(/\s+/);return streets.map(x=>{let n=norm(x),score=99;if(n.startsWith(q))score=0;else if(n.includes(q))score=1;else if(words.every(w=>n.split(/\s+/).some(t=>t.startsWith(w))))score=2;else{let d=levenshtein(q,n);if(d<=Math.max(2,Math.floor(q.length*.28)))score=3+d}return {x,score}}).filter(o=>o.score<99).sort((a,b)=>a.score-b.score||a.x.localeCompare(b.x,'vi')).slice(0,7).map(o=>o.x)}
function groupRowsByTdp(rows){let map=new Map;rows.forEach(r=>{if(!map.has(r.tdp))map.set(r.tdp,[]);map.get(r.tdp).push(r)});return [...map.entries()].sort((a,b)=>+a[0].replace(/\D/g,'')-+b[0].replace(/\D/g,'')).map(([tdp,rs])=>({tdp,rows:uniqueRowsV310(rs)}))}
  function preciseSearch(q) {
    const result = searchAddress(q);
    const house = result.p.house;
    if (result.mode === 'reference' && /^\d+$/.test(house)) {
      const parity = Number(house) % 2 ? 'Lẻ' : 'Chẵn';
      if (result.streetRows.length && result.streetRows.every(r => r.parity !== parity)) {
        return { ...result, rows: [], mode: 'noParity' };
      }
    }
    // Số có hậu tố được chốt riêng (58A/58B) thắng khoảng số gốc.
    if (house && /[A-Z]$/i.test(house) && result.rows.length) {
      const exact = result.rows.filter(r =>
        String(r.range || '').split(/[,;]/).some(token => norm(token) === norm(house)));
      if (exact.length) return { ...result, rows: uniqueRowsV310(exact) };
    }
    return result;
  }
  return { parseAddress, searchAddress: preciseSearch, streetSuggestions, groupRowsByTdp, streets };
}
