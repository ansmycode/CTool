import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { prepareWolfGameDictionary } from './translationDictionary.js';

// This is CTool's own storage name, never a criterion for identifying an
// external translation. Only successfully loaded, validated mappings are saved.
const location = gamePath => path.join(path.dirname(gamePath),'.ctool-cache','wolf-translation','dictionary.json');
async function identity(gamePath) {
  const file=path.join(path.dirname(gamePath),'Data','BasicData','Game.dat');
  if((await fs.stat(file)).size>32*1024*1024)throw new Error('游戏配置文件过大，无法确认译文绑定');
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}
export function createWolfTranslationPersistence() {
  const operations = {
    async read(gamePath) {
      const file=location(gamePath);let stat;
      try {stat=await fs.stat(file);}catch(error){if(error.code==='ENOENT')return null;throw error;}
      if(stat.size>32*1024*1024)throw new Error('保存的译文超过 32 MiB');
      const saved=JSON.parse(await fs.readFile(file,'utf8'));
      if(saved?.version!==1||saved.gameIdentity!==await identity(gamePath))
        throw new Error('游戏数据或保存的译文绑定已变化，请重新选择译文');
      return prepareWolfGameDictionary(saved.dictionary,gamePath);
    },
    async save(gamePath,dictionary) {
      // Revalidate the data, not a renderer-provided filename or cached chunks.
      await prepareWolfGameDictionary(dictionary.sourceData,gamePath);
      const content=JSON.stringify({version:1,gameIdentity:await identity(gamePath),dictionary:dictionary.sourceData});
      if(Buffer.byteLength(content)>32*1024*1024)throw new Error('保存的译文超过 32 MiB');
      const file=location(gamePath),temporary=file+'.'+randomUUID()+'.tmp';
      await fs.mkdir(path.dirname(file),{recursive:true});
      try {await fs.writeFile(temporary,content,'utf8');await fs.rename(temporary,file);}
      finally {await fs.unlink(temporary).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    },
    async remove(gamePath) {
      await fs.unlink(location(gamePath)).catch(error=>{if(error.code!=='ENOENT')throw error;});
    },
  };
  // Serialize disk operations across session changes as well as UI actions.
  // A late save from a closing session cannot overtake a new import/unload.
  const pending=new Map();
  return Object.fromEntries(Object.entries(operations).map(([name,operation])=>[name,(gamePath,...args)=>{
    const key=path.resolve(location(gamePath)).toLowerCase();
    const previous=pending.get(key)||Promise.resolve();
    const next=previous.catch(()=>{}).then(()=>operation(gamePath,...args));
    pending.set(key,next);
    void next.finally(()=>{if(pending.get(key)===next)pending.delete(key);}).catch(()=>{});
    return next;
  }]));
}
