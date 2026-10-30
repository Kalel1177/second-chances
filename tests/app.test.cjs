// Run with: node --test tests/app.test.cjs
// Executes the page's real JavaScript with an in-memory DOM and Supabase double.
// No network requests, live users, or live inventory are used.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const source = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(match => !/\bsrc\s*=/i.test(match[1])).map(match => match[2]).join('\n');
const clone = value => JSON.parse(JSON.stringify(value));
const originalItem = () => ({id:'existing-item', name:'Radio', category:'Radios & Audio', condition:'Good', description:'Working radio', qty:1, price:250, image:'data:image/jpeg;base64,bGVnYWN5', images:[], status:'available', sold_at:null});

class Element {
  constructor(id){
    this.id=id; this._value=''; this.textContent=''; this.innerHTML=''; this.hidden=false;
    this.disabled=false; this.open=false; this.dataset={}; this.classes=new Set();
    this.classList={add:name=>this.classes.add(name),remove:name=>this.classes.delete(name),toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};
  }
  set value(value){ this._value=String(value); }
  get value(){ return this._value; }
  showModal(){ this.open=true; }
  close(){ this.open=false; }
  scrollIntoView(){}
  closest(){ return this; }
}

function backend(seed=[]){
  const state={items:clone(seed),settings:{id:1,name:'Original contact',email:'original@example.test'},uploads:[],writes:[],saveError:null,uploadFailAt:0,contactError:null,zeroRows:false,writeThenFail:false,throwOnWrite:false};
  function from(table){
    const query={table,operation:'select',row:null,id:null,one:false,limitCount:null};
    const chain={
      select(){return chain;}, order(){return chain;}, eq(key,value){query.id=value;return chain;},
      limit(value){query.limitCount=value;return chain;},
      single(){query.one=true;return chain;},maybeSingle(){query.one=true;return chain;},
      upsert(row){query.operation='upsert';query.row=clone(row);return chain;},
      update(row){query.operation='update';query.row=clone(row);return chain;},
      delete(){query.operation='delete';return chain;},
      then(resolve,reject){return Promise.resolve().then(execute).then(resolve,reject);}
    };
    function execute(){
      if(query.operation==='select'){
        if(query.limitCount===0) return {data:[],error:state.schemaError?{message:state.schemaError}:null};
        return {data:clone(table==='items'?state.items:state.settings),error:null};
      }
      state.writes.push(clone(query));
      if(state.throwOnWrite) throw new Error('Network disconnected');
      if(table==='settings'){
        if(state.contactError) return {data:null,error:{message:state.contactError}};
        state.settings=clone(query.row);return {data:clone(state.settings),error:null};
      }
      if(state.saveError) return {data:null,error:{message:state.saveError}};
      if(state.zeroRows) return {data:null,error:{message:'No row was returned'}};
      let saved;
      if(query.operation==='delete'){
        saved=state.items.find(item=>item.id===query.id);
        state.items=state.items.filter(item=>item.id!==query.id);
      }else{
        const id=query.id||query.row.id;
        const index=state.items.findIndex(item=>item.id===id);
        if(query.operation==='update' && index<0) return {data:null,error:{message:'No row was returned'}};
        saved={...(state.items[index]||{created_at:'2026-10-28T10:00:00Z'}),...query.row,id};
        if(index<0) state.items.unshift(saved);else state.items[index]=saved;
      }
      if(state.writeThenFail){state.writeThenFail=false;return {data:null,error:{message:'Response lost after commit'}};}
      return {data:clone(saved),error:null};
    }
    return chain;
  }
  const client={from,auth:{getSession:async()=>({data:{session:{}},error:null}),signInWithPassword:async()=>({data:{session:{}},error:null}),signOut:async()=>({error:null})},storage:{from:()=>({
    upload:async(path,blob,options)=>{
      state.uploads.push({path,blob,options});
      if(state.uploadFailAt===state.uploads.length) return {data:null,error:{message:'Upload denied'}};
      return {data:{path},error:null};
    },getPublicUrl:path=>({data:{publicUrl:'https://photos.example.test/'+path}})
  })}};
  return {client,state};
}

async function app({seed=[],local=false,missingLibrary=false}={}){
  const elements=new Map([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>[match[1],new Element(match[1])]));
  const el=id=>elements.get(id);
  Object.entries({iCat:'Gadgets & Devices',iCond:'Good',iQty:'1',iStatus:'available',sort:'new'}).forEach(([id,value])=>el(id).value=value);
  const fake=backend(seed), storage=new Map();
  const store={getItem:key=>storage.get(key)||null,setItem:(key,value)=>{if(store.fail)throw new Error('Storage quota exceeded');storage.set(key,value);}};
  const context=vm.createContext({console,crypto:webcrypto,URL,Blob,Image:class{},document:{
    getElementById:el,
    querySelectorAll:selector=>selector.includes('#tItem')?[...elements.values()].filter(e=>/^i[A-Z]/.test(e.id)||['saveItem','clearItem'].includes(e.id)):
      selector.includes('#tContact')?[...elements.values()].filter(e=>/^c[A-Z]/.test(e.id)||e.id==='saveContact'):[],
  },localStorage:store,window:{},location:{},confirm:()=>true,setTimeout:()=>0,clearTimeout:()=>{}});
  if(!local&&!missingLibrary){context.supabase={createClient:()=>fake.client};context.window.supabase=context.supabase;}
  const script=local?source.replace(/SUPABASE_URL:\s*"[^"]*"/,'SUPABASE_URL:""').replace(/SUPABASE_ANON_KEY:\s*"[^"]*"/,'SUPABASE_ANON_KEY:""'):source;
  vm.runInContext(script,context);
  await new Promise(resolve=>setImmediate(resolve));
  const run=code=>vm.runInContext(code,context);
  const read=code=>clone(run(code));
  function fill(values={}){
    Object.entries({iName:'Test camera',iPrice:'100',iQty:'2',iStatus:'available',...values}).forEach(([id,value])=>el(id).value=value);
  }
  function photos(count=2){run(`draftPhotos = Array.from({length:${count}}, (_,index)=>({src:'data:image/jpeg;base64,photo'+index,blob:new Blob(['photo']),url:null}));`);}
  async function edit(id='existing-item'){
    const button=new Element('edit');button.dataset.e=id;await el('grid').onclick({target:button});
  }
  return {el,run,read,fill,photos,edit,store,storage,...fake};
}

test('database failure keeps inputs/photos and never announces success',async()=>{
  const a=await app();a.fill();a.photos();a.state.saveError='Permission denied';
  await a.el('saveItem').onclick();
  assert.equal(a.el('iName').value,'Test camera');assert.equal(a.read('draftPhotos.length'),2);
  assert.match(a.el('itemFeedback').textContent,/Save not confirmed.*Permission denied/);
  assert.notEqual(a.el('toast').textContent,'Item saved');assert.equal(a.el('saveItem').disabled,false);
  assert.equal(a.read('items.length'),0);
});
test('partial upload failure preserves all selections; retry reuses completed uploads',async()=>{
  const a=await app();a.fill();a.photos();a.state.uploadFailAt=2;
  await a.el('saveItem').onclick();assert.equal(a.state.writes.length,0);assert.equal(a.read('draftPhotos.length'),2);
  a.state.uploadFailAt=0;await a.el('saveItem').onclick();
  assert.equal(a.state.uploads.length,3);assert.equal(a.state.items.length,1);assert.equal(a.state.items[0].images.length,2);
  assert.equal(a.state.items[0].image,a.state.items[0].images[0]);assert.equal(a.el('iName').value,'');
  assert.equal(a.el('itemFeedback').textContent,'Item saved');
});
test('response lost after commit can be retried without creating a duplicate item',async()=>{
  const a=await app();a.fill();a.photos();a.state.writeThenFail=true;
  await a.el('saveItem').onclick();assert.equal(a.state.items.length,1);
  const id=a.state.items[0].id;
  await a.el('saveItem').onclick();assert.equal(a.state.items.length,1);assert.equal(a.state.items[0].id,id);
  assert.equal(a.state.uploads.length,2);assert.equal(a.el('itemFeedback').textContent,'Item saved');
});
test('rapid repeated clicks submit once and lock the item form',async()=>{
  const a=await app();a.fill();
  const first=a.el('saveItem').onclick();assert.equal(a.el('saveItem').disabled,true);
  const second=a.el('saveItem').onclick();await Promise.all([first,second]);assert.equal(a.state.writes.length,1);
});
test('an earlier success notification cannot linger over a later failed save',async()=>{
  const a=await app();a.fill();await a.el('saveItem').onclick();assert.equal(a.el('toast').textContent,'Item saved');
  a.fill({iName:'Second item'});a.state.saveError='Write rejected';await a.el('saveItem').onclick();
  assert.equal(a.el('toast').textContent,'');assert.equal(a.el('toast').hidden,true);assert.equal(a.el('iName').value,'Second item');
});
test('legacy image survives editing and adding a second photo',async()=>{
  const a=await app({seed:[originalItem()]});await a.edit();
  assert.equal(a.read('draftPhotos[0].url'),originalItem().image);
  a.run("draftPhotos.push({src:'data:image/jpeg;base64,new',blob:new Blob(['new']),url:null})");
  await a.el('saveItem').onclick();assert.equal(a.state.items[0].images.length,2);
  assert.equal(a.state.items[0].image,originalItem().image);assert.equal(a.state.uploads.length,1);
});
test('changing cover and removing a photo affects only the confirmed listing',async()=>{
  const item={...originalItem(),images:['https://photos.example.test/one.jpg','https://photos.example.test/two.jpg']};
  const a=await app({seed:[item]});await a.edit();
  const button=new Element('cover');button.dataset.cover='1';a.el('photoList').onclick({target:button});
  assert.equal(a.state.items[0].images[0],item.images[0]);
  delete button.dataset.cover;button.dataset.remove='1';a.el('photoList').onclick({target:button});
  await a.el('saveItem').onclick();assert.deepEqual(a.state.items[0].images,[item.images[1]]);assert.equal(a.state.items[0].image,item.images[1]);
});
test('sold sets quantity zero and timestamp; editing preserves date; relisting clears it',async()=>{
  const a=await app({seed:[originalItem()]});await a.edit();a.el('iStatus').value='sold';
  await a.el('saveItem').onclick();const soldAt=a.state.items[0].sold_at;
  assert.ok(soldAt);assert.equal(a.state.items[0].qty,0);assert.equal(a.state.items[0].status,'sold');
  await a.edit();a.el('iDesc').value='Updated description';await a.el('saveItem').onclick();assert.equal(a.state.items[0].sold_at,soldAt);
  await a.edit();a.el('iStatus').value='available';a.el('iQty').value='1';await a.el('saveItem').onclick();
  assert.equal(a.state.items[0].sold_at,null);assert.equal(a.state.items[0].status,'available');assert.equal(a.state.items[0].qty,1);
});
test('zero quantity is sold even when status selector says available',async()=>{
  const a=await app();a.fill({iQty:'0'});await a.el('saveItem').onclick();assert.equal(a.state.items[0].status,'sold');assert.ok(a.state.items[0].sold_at);
});
test('zero-row update is a failure and preserves the edit',async()=>{
  const a=await app({seed:[originalItem()]});await a.edit();a.state.zeroRows=true;
  await a.el('saveItem').onclick();assert.equal(a.el('iName').value,'Radio');assert.match(a.el('itemFeedback').textContent,/No row was returned/);
});
test('network exceptions preserve entries and restore buttons',async()=>{
  const a=await app();a.fill();a.state.throwOnWrite=true;await a.el('saveItem').onclick();
  assert.equal(a.el('iName').value,'Test camera');assert.equal(a.el('saveItem').disabled,false);assert.match(a.el('itemFeedback').textContent,/Network disconnected/);
});
test('missing schema stops before uploading or writing',async()=>{
  const a=await app();a.fill();a.photos();a.state.schemaError='Column images does not exist';await a.el('saveItem').onclick();
  assert.equal(a.state.uploads.length,0);assert.equal(a.state.writes.length,0);assert.equal(a.read('draftPhotos.length'),2);
});
test('failed contact save preserves previous public contact and edited inputs',async()=>{
  const a=await app();a.el('cName').value='New contact';a.state.contactError='Write rejected';await a.el('saveContact').onclick();
  assert.equal(a.read('contact.name'),'Original contact');assert.equal(a.el('cName').value,'New contact');assert.match(a.el('foot').innerHTML,/Original contact/);
  assert.match(a.el('contactFeedback').textContent,/Save not confirmed/);
});
test('confirmed contact save updates the public contact',async()=>{
  const a=await app();a.el('cName').value='New contact';await a.el('saveContact').onclick();
  assert.equal(a.read('contact.name'),'New contact');assert.match(a.el('foot').innerHTML,/New contact/);
});
test('local quota failure does not change inventory or clear the form',async()=>{
  const a=await app({local:true});a.run('setAdmin(true)');a.fill();a.photos();const before=a.read('items');a.store.fail=true;
  await a.el('saveItem').onclick();assert.deepEqual(a.read('items'),before);assert.equal(a.el('iName').value,'Test camera');assert.match(a.el('itemFeedback').textContent,/quota/);
});
test('local demo saves multiple photos and sale status',async()=>{
  const a=await app({local:true});a.run('setAdmin(true)');a.fill({iStatus:'sold'});a.photos();await a.el('saveItem').onclick();
  const saved=JSON.parse(a.storage.get('sc_items'))[0];assert.equal(saved.images.length,2);assert.equal(saved.status,'sold');assert.ok(saved.sold_at);
});
test('missing online library cannot fall back to demo or accept its PIN',async()=>{
  const a=await app({missingLibrary:true});assert.match(a.el('loadFeedback').textContent,/online connection/);
  a.el('lPass').value='1234';await a.el('lGo').onclick();assert.equal(a.read('isAdmin'),false);assert.equal(a.read('items.length'),0);
});
test('invalid prices and quantities never submit',async()=>{
  for(const values of [{iPrice:'-1'},{iPrice:''},{iPrice:'Infinity'},{iQty:'-1'},{iQty:'1.5'},{iQty:''}]){
    const a=await app();a.fill(values);await a.el('saveItem').onclick();assert.equal(a.state.writes.length,0);assert.equal(a.el('iName').value,'Test camera');
  }
});
test('oversized, unsupported, excessive and unreadable photos preserve previous choices',async()=>{
  for(const files of [[{name:'large.jpg',type:'image/jpeg',size:11*1024*1024}],[{name:'bad.svg',type:'image/svg+xml',size:10}],Array(7).fill({name:'small.jpg',type:'image/jpeg',size:10})]){
    const a=await app();a.photos(1);await a.el('iImg').onchange({target:{files}});assert.equal(a.read('draftPhotos.length'),1);assert.equal(a.el('saveItem').disabled,false);
  }
  const a=await app();a.photos(1);a.run('preparePhoto = async () => { throw new Error("Unreadable photo"); }');
  await a.el('iImg').onchange({target:{files:[{name:'bad.jpg',type:'image/jpeg',size:10}]}});assert.equal(a.read('draftPhotos.length'),1);assert.match(a.el('itemFeedback').textContent,/Unreadable/);
});
test('gallery navigates photos and sold items cannot open an order',async()=>{
  const item={...originalItem(),status:'sold',images:['https://photos.example.test/a.jpg','https://photos.example.test/b.jpg']};
  const a=await app({seed:[item]});a.run('showGallery(items[0])');assert.equal(a.el('galleryCount').textContent,'1 of 2');
  a.el('galleryNext').onclick();assert.equal(a.el('galleryImage').src,item.images[1]);a.el('galleryNext').onclick();assert.equal(a.el('galleryCount').textContent,'1 of 2');
  const button=new Element('order');button.dataset.o=item.id;await a.el('grid').onclick({target:button});assert.equal(a.el('ordDlg').open,false);
});
test('removing the final legacy photo saves empty images and null cover',async()=>{
  const a=await app({seed:[originalItem()]});await a.edit();const button=new Element('remove');button.dataset.remove='0';a.el('photoList').onclick({target:button});
  await a.el('saveItem').onclick();assert.deepEqual(a.state.items[0].images,[]);assert.equal(a.state.items[0].image,null);
});
