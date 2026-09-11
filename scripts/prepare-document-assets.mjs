import {mkdir,copyFile,cp,readdir} from 'node:fs/promises';
const root=new URL('../public/document-assets/',import.meta.url);
await mkdir(root,{recursive:true});
await copyFile(new URL('../node_modules/pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url),new URL('pdf.worker.min.mjs',root));
for(const dir of ['cmaps','standard_fonts','wasm'])await cp(new URL('../node_modules/pdfjs-dist/'+dir,import.meta.url),new URL(dir,root),{recursive:true});
await copyFile(new URL('../node_modules/tesseract.js/dist/worker.min.js',import.meta.url),new URL('worker.min.js',root));
await mkdir(new URL('core/',root),{recursive:true});
for(const file of await readdir(new URL('../node_modules/tesseract.js-core/',import.meta.url))){if(file.endsWith('.wasm.js')||file.endsWith('.wasm'))await copyFile(new URL('../node_modules/tesseract.js-core/'+file,import.meta.url),new URL('core/'+file,root))}
await mkdir(new URL('lang/',root),{recursive:true});
for(const lang of ['tur','eng'])await copyFile(new URL('../node_modules/@tesseract.js-data/'+lang+'/4.0.0_best_int/'+lang+'.traineddata.gz',import.meta.url),new URL('lang/'+lang+'.traineddata.gz',root));
for(const [name,path] of [['pdfjs','pdfjs-dist/LICENSE'],['tesseract','tesseract.js/LICENSE.md'],['core','tesseract.js-core/LICENSE']]){try{await copyFile(new URL('../node_modules/'+path,import.meta.url),new URL(name+'-LICENSE.txt',root))}catch{}}
console.log('Document reader assets ready.');
