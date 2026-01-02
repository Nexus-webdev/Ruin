window.githubProgram = location.href.includes('.github.io');
const mods = {
 Img: Image,
 js(code, type = 'text/javascript') {
  const script = document.createElement('script');
  script.type = type;
  script.text = code;
  
  $.meta.htmlTarget.appendChild(script);
 },
 
 html(code, target) {
  if (typeof code != 'string') throw `Html code must be of type 'string'`;
  
  const range = document.createRange();
  const fragment = range.createContextualFragment(code);
  (target ?? $.meta.htmlTarget).appendChild(fragment);
 },

 css(code) {
  const elem = document.createElement('style');
  elem.textContent = code;
  
  document.head.appendChild(elem);
 },
 
 win(...args) {
  for (let arg of args)
  window[arg.name] = arg;
 },

 Q(query, { type = '', searchEngine = 'https://duckduckgo.com/?q=', win = window } = {}) {
  return $.meta.opt(type, {
   search: x => `${searchEngine}${encodeURIComponent(query)}`,
   url: x => encodeURIComponent(query),
   params: x => { 
    const params = {};
    
    const urlSearchParams = new URLSearchParams(win.location.search);
    for (let [key, value] of urlSearchParams.entries())
     params[key] = value;
    
    return params;
   },

   default: x => $.meta.htmlTarget.querySelector(query),
  })();
 },
 
 audio: new Proxy({
  assign(id, src) { 
   const elem = document.createElement('audio');
   elem.id = id;
   elem.src = src;
   $.meta.htmlTarget.appendChild(elem);
  },

  play(id) {
   const elem = document.getElementById(id);
   if (!elem) throw `Audio element '${id}' not found`;
   elem.play();
  },
 }, {
  get(target, property) {
   return target[property];
  }
 }),
 
 listener(event, callback, element, opt = {}) {
  const e = (element ?? document);
  if (!e.listeners) e.listeners = {};
  e.addEventListener(event, callback, opt);

  if (!e.listeners[event]) e.listeners[event] = [];
  e.listeners[event].push(callback);
 },
 
 removeListener(event, callback, element, opt = {}) {
  const e = (element ?? document);
  if (!e.listeners) e.listeners = {};
  e.removeEventListener(event, callback, opt);

  if (!e.listeners[event]) e.listeners[event] = [];
  const arr = e.listeners[event];
  
  const i = arr.indexOf(callback);
  e.listeners[event] = [...arr.slice(0, i), ...arr.slice(i +1)];
 },

 list(elem, type) {
  if (!elem) return [];
  if (!elem.listeners) elem.listeners = {};

  if (type) return elem.listeners[type] ?? [];
  return elem.listeners;
 },
 
 echo(value, to = document) {
  const echo = new CustomEvent('echo', { detail: { value, type: typeof value } });
  to.dispatchEvent(echo);
 },
 
 onecho(callback = x => x) {
  $.listener('echo', ({ detail: echo }) => callback(echo), window);
 },
 
 session: sessionStorage,
 cache: new Proxy(localStorage, {
  set(target, prop, value) {
   target[prop] = value;
   current[prop] = value;
  },
 }),
 
 liveReload: {
  push(...names) {
   watch.push(...names);
  },
  
  remove(...names) {
   const w = [...watch];
   watch.length = 0;
   
   watch.push(...w.filter(name => !names.includes(name)));
  },
 },
};

const program = urlData();
const watch = [program.name];
const current = { ...localStorage };
for (let key in mods)
{
 if (typeof mods[key] == 'function')
 $[key] = mods[key].bind($);
 else $[key] = mods[key];
}

$.struct('Event', {
 construct(id, { details = {}, defaultElement = document, options = {} } = {}) {
  this.id = id;
  this.defaultElement = defaultElement;
  this.details = details;
  this.options = options;
 },
 
 dispatch(elem, details = {}) {
  const element = elem ?? this.defaultElement;
  const detail = { ...this.details, ...details };
  
  const event = new CustomEvent(this.id +(details.type ?? ''), { detail, ...this.options });
  element.dispatchEvent(event);
 }
})

window.Images = {};
function getImq(src, resolve, forceload) {
 if (!$.foxx) throw 'Please import the foxx dependency.';
 if (window.Images[src] && !forceload)
 return resolve(window.Images[src]);
 
 const id = Date.now();
 $.onecho(({ value: e }) => {
  if (e.responsetype == 'Imq-get' && e.id == id)
  resolve(e.data);
 })
 
 $.foxx.run(`
 let data = -read #${src};
 echo { responsetype: 'Imq-get', data, id: '${id}' };
 `);
};

function setImq(src, data, resolve) {
 if (!$.foxx) throw 'Please import the foxx dependency.';
 const id = Date.now();
 
 $.onecho(({ value: e }) => {
  if (e.responsetype == 'Imq-set' && e.id == id)
  resolve(e.data);
 })
 
 $.foxx.run(`
 -write #${src} >> \`${data}\`;
 echo { responsetype: 'Imq-set', data: 'Saved Image: ${src}', id: '${id}' };
 `);
};

$.struct('xml: static', {
 parser: new DOMParser(),
 serializer: new XMLSerializer(),
 $add_methods(doc) {
  "Make sure xml documents can stringify or convert themselves into arrays independently";
  doc.stringify = _ => this.stringify(doc);
  doc.to_array = _ => this.to_array(doc);
  
  "Make map and filter methods for elements";
  doc.map = f => {
   f = f && typeof f == 'function' ? f : (_ => _);
   const root = doc.documentElement;
   const children = [];
   
   for (let child of root.children) children.push(f(child));
   return children;
  };
  
  doc.filter = f => {
   f = f && typeof f == 'function' ? f : (_ => _);
   const root = doc.documentElement;
   const children = [];
   
   for (let child of root.children)
   if (f(child)) children.push(child);
   return children;
  };
 },
 
 to_array(doc) {
  "Converts xml doc into an array of { tag, text }";
  const root = doc.documentElement;
  const array = [];
  
  for (let node of root.children)
  {
   array.push({
    tag: node.tagName,
    txt: node.textContent,
   });
  }

  return array;
 },
 
 parse(str) {
  "Evaluates to an xml doc based on the string provided";
  return new Promise(async resolve => {
   const doc = await this.parser.parseFromString(str, 'application/xml');
   this.$add_methods(doc);
   
   resolve(doc);
  })
 },
 
 stringify(doc) {
  "Serializes an xml doc to string form";
  return this.serializer.serializeToString(doc);
 },
 
 build(name, nodes = [], elem) {
  "Builds an xml doc from an array of { tag, text }";
  const doc = elem || document.implementation.createDocument('', '', null);
  const root = doc.createElement(name);
  
  nodes.forEach(node => {
   const child = doc.createElement(node.tag);
   if (node.txt) child.textContent = node.txt;
   
   root.appendChild(child);
  });
  
  doc.appendChild(root);
  this.$add_methods(doc);
  return doc;
 },
})

$.struct('Terminal', {
 __init__({ width = 400, height = 300, backgroundColor = '#000', textColor = '#0f0', interpreter = x => x, header } = {}) {
  this.interpreter = interpreter;
  
  this.el = document.createElement('div');
  this.el.className = 'terminal';
  this.el.style.width = width + 'px';
  this.el.style.height = height + 'px';
  this.el.style.backgroundColor = backgroundColor;
  this.el.style.color = textColor;
  
  this.header = document.createElement('div');
  this.header.className = 'terminal-header';
  this.header.textContent = header ?? 'Custom Terminal';
  this.el.appendChild(this.header);
  
  this.output = document.createElement('div');
  this.output.className = 'terminal-output';
  this.el.appendChild(this.output);
  
  this.input = document.createElement('textarea');
  this.input.className = 'terminal-input';
  this.input.style.backgroundColor = backgroundColor;
  this.input.style.color = textColor;
  this.el.appendChild(this.input);

  document.body.appendChild(this.el);
  $.listener('keydown', async e => {
   if (!e.shiftKey && e.key == 'Enter')
   {
    const statement = this.input.value.trim();
    const result = await this.interpreter(statement);
    this.print('> ' +statement);
    this.input.value = '';
    
    if (result) this.print(result);
   }
  });
 },

 print(text) {
  this.output.textContent += text + '\n';
  this.output.scrollTop = this.output.scrollHeight;
 },

 makeDraggable() {
  let offsetX, offsetY, dragging = false;
  $.listener('mousedown', e => {
   dragging = true;
   offsetX = e.clientX -this.el.offsetLeft;
   offsetY = e.clientY -this.el.offsetTop;
  }, this.header);

  $.listener('mousemove', e => {
   if (!dragging) return;
   
   this.el.style.left = e.clientX -offsetX +'px';
   this.el.style.top = e.clientY -offsetY +'px';
  });

  $.listener('mouseup', _ => (dragging = false));
 },
 
 makeResizable() {
  const resizeObserver = new ResizeObserver(() => {
   const totalHeight = this.header.offsetHeight +this.output.offsetHeight +this.input.offsetHeight;
   
   this.el.style.height = totalHeight +'px';
   this.el.style.width = this.input.offsetWidth +'px';
  });
  
  resizeObserver.observe(this.input);
 },
})

$.struct('Image', {
 onload: x => x,
 construct(src, { forceload, chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', getImq: get = getImq, setImq: set = setImq, saveInterval = 1000 } = {}) {
  this.img = document.createElement('canvas');
  this.src = src.trim() +(src.trim().endsWith('.imq') ? '' : '.imq');
  this.chars = chars;
  this.get = get;
  this.set = set;
  
  this.autosave = 'no';
  if (src.trim() == '') this.onload(this.img, '');
  else get(this.src, result => {
   try {
    this.decode(result);
   } catch (e) {
    console.warn('Failed to parse image file:', e);
   }
   
   this.onload(this.img, result);
   this.saveInterval = setInterval(x => {
    $.meta.opt(this.autosave.trim().toLowerCase(), {
     default: x => x,
     'never': x => clearInterval(this.saveInterval),
     'yes': x => this.save(),
    })();
   }, saveInterval);
  }, forceload)
 },
 
 draw(ctx, x = 0, y = 0, ...args) {
  if (ctx.canvas instanceof HTMLCanvasElement) ctx.drawImage(this.img, x, y, ...args);
  else console.warn('Image must be drawn onto a canvas Element');
 },
 
 clear() {
  this.img.getContext('2d').clearRect(0, 0, this.img.width, this.img.height);
 },
 
 backgroundUrl(type) {
  return `url(${this.img.toDataURL(type)})`;
 },
 
 edit(code) {
  return (new Function(`with(this) { ${code} }`)).call(this.img);
 },
 
 url(type = 'image/png') {
  return this.img.toDataURL(type);
 },
 
 getContext(type = '2d') {
  return this.img.getContext(type);
 },
 
 appendTo(element) {
  element.appendChild(this.img);
 },
 
 save() {
  return new Promise(resolve => {
   const encoded = this.encode();
   this.set(this.src, encoded, resolve);
  })
 },
 
 paste(source, x = 0, y = 0, { full = false, forceload } = {}) {
  const { width, height } = this.img;
  const ctx = this.img.getContext('2d');
  const dimensions = [full ? width : undefined, full ? height : undefined];
  
  if (source instanceof HTMLImageElement || source instanceof HTMLCanvasElement) ctx.drawImage(source, x, y, ...dimensions);
  else if (source instanceof HTMLVideoElement) ctx.drawImage(source, x, y, ...dimensions);
  else if (source instanceof ImageData) ctx.putImageData(source, x, y);
  
  else if (source instanceof Uint8ClampedArray)
  {
   const imageData = new ImageData(source, ...dimensions);
   ctx.putImageData(imageData, x, y);
  } else if (typeof source == 'string')
  {
   try {
    source = source.trim() +(source.trim().endsWith('.imq') ? '' : '.imq');
    this.get(source, result => this.decode(result, x, y), forceload);
   } catch (e) {
    console.warn('Failed to parse (assumed encoded) image data:', e);
   }
  } else console.warn('Unsupported source type for paste method.');
 },

 encodeBase62(num) {
  let str = '';
  do {
   str = this.chars[num %62] +str;
   num = Math.floor(num /62);
  } while (num > 0);
  
  return str;
 },

 decodeBase62(str) {
  return [...str].reduce((acc, char) => acc *62 +this.chars.indexOf(char), 0);
 },

 encode() {
  const ctx = this.img.getContext('2d');
  const { width, height } = this.img;
  
  const data = ctx.getImageData(0, 0, width, height).data;
  let encoded = width +'_' +height +'|';
  
  for (let i = 0; i < data.length; i ++)
  encoded += this.encodeBase62(data[i]) +'.';
  return this.compressRLE(encoded.slice(0, -1)); 
 },

 decode(encoded, x = 0, y = 0) {
  if (!encoded.trim().length || !encoded.includes('_') || !encoded.includes('|')) return;
  const [size, pixelData] = this.decompressRLE(encoded).split('|');
  const [wStr, hStr] = size.split('_');
  
  const width = Number(wStr.replace('# ', ''));
  const height = Number(hStr);
  const pixelArray = pixelData.split('.').map(this.decodeBase62.bind(this));
  
  this.img.width = width;
  this.img.height = height;
  const ctx = this.img.getContext('2d');

  const imageData = ctx.createImageData(width, height);
  for (let i = 0; i < pixelArray.length; i ++)
  imageData.data[i] = pixelArray[i];
  
  ctx.putImageData(imageData, x, y);
 },
 
 compressRLE(string) {
  const [size, px] = string.split('|');
  const data = px.split('.');
  let compressed = '', count = 1;

  for (let i = 1; i < data.length; i ++) {
   if (data[i] == data[i -1]) count ++;
   else {
    compressed += `${data[i -1]}~${count}.`;
    count = 1;
   }
  }

  compressed += `${data[data.length -1]}~${count}`;
  return `${size}|${compressed}`;
 },
 
 decompressRLE(string) {
  const [size, compressedData] = string.split('|');
  const tokens = compressedData.split('.');
  const decompressed = [];

  for (let token of tokens) {
   const [val, count] = token.split('~');
   for (let i = 0; i < Number(count); i ++)
   decompressed.push(val);
  }

  return `${size}|${decompressed.join('.')}`;
 },
})

$.listener('keydown', async e => {
 if (e.ctrlKey && e.key == 's')
 {
  e.preventDefault();
  
  let content = window.page_content;
  if ($.meta.redirect_to_output_page == true)
  {
   content = `<!DOCTYPE html>
<html lang='en'>
 <head>
  <meta charset='UTF-8' content-type='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <script>
   sessionStorage.__PROGRAM__ = (\`${modify(code)}\`);
   location.href = 'https://nexus-webdev.github.io/Ruin/Output.html?name=${urlData().name}';
  <\/script>
 </head>
</html>`;
  } else {
   const A = content.slice(0, content.indexOf('// DATA - START;'));
   const C = content.slice(content.indexOf('// DATA - END;') +14);
   
   const B = `// DATA - START;
sessionStorage.__PROGRAM__ = (\`${modify(code)}\`);
const link = document.createElement('link');

link.rel = 'manifest';
link.href = 'program_data_folder/manifest.json';
document.head.appendChild(link);

script('https://nexus-webdev.github.io/Ruin/syntax.js').then(_ => {
 bootstrapper.then(_ => {
  script('https://nexus-webdev.github.io/Ruin/page.js').then(_ => {
   if ('serviceWorker' in navigator && location.href.includes('https') && $.meta.use_service_worker == true)
   navigator.serviceWorker.register('./program_data_folder/service_worker.js')
    .then(_ => $.log('Service Worker loaded <css> color:lightgreen'))
    .catch(e => console.error('Service Worker failed to load', e));
  })
 })
})

// DATA - END;`;
   content = `<!DOCTYPE html>${A}${B}${C}`;
  }
  
  const manifest = {
   name: document.title,
   short_name: document.title,
   
   start_url: '/index.html',
   display: 'standalone',
   background_color: '#ffffff',
   theme_color: '#000000',
   
   icons: [
    {
     src: 'https://nexus-webdev.github.io/Ruin/icons/manager.png',
     sizes: '192x192',
     type: 'image/png',
    }
   ],
   
   ...($.meta.manifest ?? {}),
  }
 
  const directory = await window.showDirectoryPicker();
  const program_data_folder = await directory.getDirectoryHandle('program_data_folder', { create: true });
  const create = file_creator(program_data_folder);
  
  await create('service_worker.js', service_worker(manifest.name));
  await create('manifest.json', JSON.stringify(manifest));
  await file_creator(directory)('index.html', content);
 }
})

function file_creator(directory) {
 return async(name, content) => {
  const file = await directory.getFileHandle(name, { create: true });
  const blob = new Blob([content]);
  
  const stream = await file.createWritable();
  await stream.write(blob);
  await stream.close();
 }
}

function service_worker(name) {
 return `"Service Worker: ${name}";
const prechache = 'precache-v1';
const runtime = 'runtime-v1';

"Predefined paths and URLs to precache";
const prechache_urls = [
 './',
 './index.html',
];

"Install: precache critical files";
self.addEventListener('install', e => {
 e.waitUntil(caches.open(prechache).then(cache => cache.addAll(prechache_urls)));
});

"Activate: cleanup old caches";
self.addEventListener('activate', e => {
 const cacheWhitelist = [prechache, runtime];
 e.waitUntil(caches.keys().then(keys =>
  Promise.all(keys.map(key => {
   if (cacheWhitelist.includes(key)) return;
   return caches.delete(key);
  }))
 ));
});

"Fetch: serve from cache, else fetch and cache dynamically";
self.addEventListener('fetch', e => {
 e.respondWith(caches.match(e.request).then(cachedResponse => {
  if (cachedResponse) return cachedResponse;
 
  "Otherwise, fetch from network and cache it";
  return caches.open(runtime).then(cache => {
   return fetch(e.request).then(response => {
    "Only cache valid responses (status 200, type basic)";
    if (response && response.status == 200 && response.type == 'basic')
    cache.put(e.request, response.clone());
    
    return response;
   }).catch(() => {
    "Optional: fallback for offline errors";
    if (e.request.destination == 'document')
    return caches.match('./index.html');
   })
  });
 }));
});`;
}

function ensure_file_type_is_valid(type) {
 type = type.trim();
 type = Object.keys($.meta.supported_exts).includes(type) ? type : '$';
 
 type = $.meta.opt(type, {
  default: type,
  flux: 'fl',
  
  viscript: 'vs',
  javascript: 'js',
 })
 
 return type;
};

class RuinScript extends HTMLElement {
 async connectedCallback() {
  const exts = $.meta.supported_exts;
  let code, type = '$';
  
  if (this.hasAttribute('type'))
  type = ensure_file_type_is_valid(this.getAttribute('type'));
  const f = exts[ensure_file_type_is_valid(type)];
  
  if (this.hasAttribute('src'))
  {
   const src = this.getAttribute('src');
   try {
    const res = await $.fetch(src);
    code = await res.text();
   } catch(e) {
    if ($.FileSystem.origin) code = await $.FileSystem.read(src);
    else throw new Error('FileSystem origin must be a directory');
   }
   
   const ext = exts[ensure_file_type_is_valid(url.split('.').pop())];
   await ext(code);
  };
  
  const content = this.textContent.trim();
  if (content) await f(content);
 }
}

customElements.define('r-script', RuinScript);
window.addEventListener('storage', _ => {
 for (let key of watch)
 if (localStorage[key] != current[key] && $.meta.autoReload)
 location.reload();
});

(async _ => {
 const code = sessionStorage['__PROGRAM__'] ?? sessionStorage[program.name] ?? localStorage[program.name];
 const useFile = sessionStorage['file-mode'] == 'true';
 $.meta.htmlTarget = document.body;
 
 if (useFile)
 {
  const ext = $.meta.supported_exts[ensure_file_type_is_valid(program.name.split('.').pop())];
  const script_files = new $.Database('ScriptFiles');
  const handle = await script_files.get(program.name);
  
  if (handle)
  {
   const file = await handle.getFile();
   return ext(await file.text());
  }
 }
 
 return $.ruin(code);
})().then(result => {
 window.result = result;
});

