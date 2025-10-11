window.githubProgram = location.href.includes('.github.io');
function urlData() {
 const Params = new URLSearchParams(window.location.search).entries();
 const data = {};
 
 for (let param of Params)
 data[param[0]] = param[1];
 return data;
}

function modify(string) {
 let modifiedStr = string.replace(/`/g, '\\`');
 modifiedStr = modifiedStr.replace(/\$\{(.*?)\}/g, '\\${$1}\\ ');
 return modifiedStr;
};

function log({ value, to = document }) {
 const echo = new CustomEvent('echo', { detail: { value, type: typeof value } });
 to.dispatchEvent(echo);
}

const mods = {
 Img: Image,
 js(code, type = 'text/javascript') {
  const script = document.createElement('script');
  script.type = type;
  script.text = code;
  
  $.$.htmlTarget.appendChild(script);
 },
 
 html(code) {
  if (typeof code != 'string') throw `Html code must be of type 'string'`;
  
  const range = document.createRange();
  const fragment = range.createContextualFragment(code);
  $.$.htmlTarget.appendChild(fragment);
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
  return $.$.opt(type, {
   search: x => `${searchEngine}${encodeURIComponent(query)}`,
   url: x => encodeURIComponent(query),
   params: x => { 
    const params = {};
    
    const urlSearchParams = new URLSearchParams(win.location.search);
    for (let [key, value] of urlSearchParams.entries())
     params[key] = value;
    
    return params;
   },

   default: x => $.$.htmlTarget.querySelector(query),
  })();
 },
 
 audio: new Proxy({
  assign(id, src) { 
   const elem = document.createElement('audio');
   elem.id = id;
   elem.src = src;
   $.$.htmlTarget.appendChild(elem);
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
  log({ value, to });
 },
 
 onecho(callback = x => x) {
  $.listener('echo', ({ detail: echo }) => callback(echo), window);
 },
 
 session: sessionStorage,
 cache: localStorage,
 parent: window.parent,
};

for (let key in mods)
{
 if (typeof mods[key] == 'function')
 $.RUIN[key] = mods[key].bind($.RUIN);
 else $.RUIN[key] = mods[key];
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
    $.$.opt(this.autosave.trim().toLowerCase(), {
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

const { findBlock, foxx } = $;
foxx.scopes[0].session = sessionStorage;
foxx.scopes[0].cache = localStorage;

const foxxModifications = {
 doc: {
  createElement(statement) {
   return new Promise(async resolve => {
    const { name, ...proto } = await foxx.get(statement);
    $.log({ name, proto, statement });
    
    customElements.define(name, class extends HTMLElement {
     connectedCallback() {
      for (let key in proto)
      this[key] = args => {
       foxx.scope().element = this;
       const params = proto[key].params;
       for (let param of params)
       {
        const id = param.identifier;
        foxx.scope()[id] = args[param.index] ?? param.default;
       }
       
       proto[key]().then(_ => {
        delete foxx.scope().element;
        
        for (let param of params)
        delete foxx.scope()[param.identifier];
       })
      };
      
      if (typeof this.construct == 'function')
      this.construct();
     }
    });
   })
  },
  
  icon(x) {
   return new Promise(async resolve => {
    const t = $.$.htmlTarget;
    const data = await foxx.get(x);
    $.$.htmlTarget = document.head;
    
    $.html(`<link rel='icon' ${data}>`);
    $.$.htmlTarget = t;
    
    resolve(1);
   })
  },
  
  write(x) {
   return new Promise(async resolve => {
    const content = x.trim().startsWith('<') ? x : await foxx.get(x);
    $.html(content);
    
    resolve(1);
   })
  },
 
  listener(x) {
   return new Promise(async resolve => {
    const query = $.Q(x.slice(0, x.indexOf(':')).trim()) ?? (await foxx.get(x.slice(0, x.indexOf(':')).trim()));
    const event = findBlock(x.replace('>', '^'), '<', '^');
    const code = findBlock(x);
    
    const saved = foxx.scope();
    $.listener(event, async e => {
     const og = foxx.scope();
     foxx.setScope(saved);
     foxx.scope().e = e;
     
     await foxx.run(code);
     delete foxx.scope().e;
     foxx.setScope(og);
    }, query);
    
    resolve(1);
   })
  },
   
  query(statement, { returns }) {
   return new Promise(async resolve => {
    let i = statement.indexOf(' ? ');
    i = i == -1 ? statement.length : i;
    
    const options = i == statement.length ? '{}' : await foxx.get(statement.slice(i +3));
    let searchResult = await $.Q(await foxx.get(statement.slice(0, i)), options);
    
    returns(searchResult);
    resolve(1);
   })
  },
 },
 
 app(statement) {
  const type = statement.split(' ')[0].trim().replace('-', '_');
  const content = findBlock(statement, '(', ')').trim();

  opt(type, {
   async _i() {
    if (!($.Q('', { type: 'params' }).open))
    {
     const url = window.location.href;
     const x = url.includes('?') ? '&' : '?';
     const win = window.open(`${url}${x}open=true`, $.App.as, await foxx.get(content));
     if (win) window.close();
    }
   },

   close() {
    window.close();
   },
  })();
 },
 
 async echo(statement) {
  const value = await foxx.get(statement); 
  const destination = value?.destinationElement ?? window;
  
  log({ value, to: destination });
 },
 
 prompt(statement, { returns }) { 
  return new Promise(async resolve => {
   const [str, default_ = ''] = statement.split('?');
   const answer = await prompt(await foxx.get(str), await foxx.get(default_));
   returns(answer);
   
   resolve(1);
  })
 },

 popup: {
  show(statement) {
   return new Promise(async resolve => {
    const message = await foxx.get(statement);
    document.getElementById('popup').style.display = 'block';
    if (message) document.getElementById('popup-message').innerText = message;
    
    resolve(1);
   })
  },
  
  close() {
   document.getElementById('popup').style.display = 'none';
  },
 },
 
 async cache(statement) {
  const [identifier, value] = statement.replace('=', '#=').split('#=');
  
  const evaluated = await foxx.get(value);
  localStorage[identifier.trim()] = evaluated;
 },
 
 async sesh(statement) {
  const [identifier, value] = statement.replace('=', '#=').split('#=');
  
  const evaluated = await foxx.get(value);
  sessionStorage[identifier.trim()] = evaluated;
 },
 
 onecho(statement) {
  $.listener('echo', async({ detail: echo }) => {
   foxx.scope().echo = echo;
   await foxx.run(findBlock(statement +' '));
   delete foxx.scope().echo;
  });
 },

 '-install': statement => {
  return new Promise(async resolve => {
   const [str, entries] = statement.split('?');
   const [library, namespace] = str.split(':');
   
   const entryArray = entries.split(',').map(str => {
    const [name, file] = str.split(':');
    
    return {
     name: name.trim(),
     file: file ? file.trim() : undefined,
    };
   })
   
   const value = await $.$.mod([library.trim(), ...entryArray], { namespace, dir: await get(library) });
   foxx.scope()[namespace ? namespace.trim() : library.trim()] = value;
   
   for (let scope of foxx.scopes)
   scope[namespace ? namespace.trim() : library.trim()] = value;
   resolve(1);
  })
 },
};

$.foxx.syntax['-git-']['install'] = statement => {
 return new Promise(async resolve => {
  const [name, path] = statement.split(':');
  const [owner, repo, ...file] = path.split('/');
  const entry = {
   name: name.trim(),
   file: file.length == 0 ? '' : file.join('/').trim(),
  };
  
  $.GitHub.repo(owner.trim(), repo.trim());
  const value = await createModule([entry], { useGit: true });
  foxx.scope()[name] = value;
  
  for (let scope of foxx.scopes)
  scope[name] = value;
  resolve(1);
 })
}

for (let key in foxxModifications)
$.foxx.syntax[key] = foxxModifications[key];

window.module = {};
async function createModule([id, ...entries] = ['main', { name: 'Sprout', file: 'Sprout - Game Engine' }], { namespace = '', extensions = {}, userMessage = 'Please press any key or click the mousepad to proceed.', order = [], dir, useGit } = { }) {
 const specified = typeof namespace == 'string';
 const _files = {};
 let Module = {};
 
 const handleID = `Module - ${id.name || id}`;
 const c = {};
 
 const event = new CustomEvent('Module Loaded', {
  detail: {
   message: `Module/Library '${id.name || id}' has loaded.`,
   libraryId: id.name || id,
   namespace,
   
   Module,
  },
 });
 
 c.status = 0;
 const UserMessage = document.createElement('p');
 UserMessage.textContent = userMessage;
 UserMessage.style['font-family'] = 'Courier New';
 
 if ($.$.inModule == false && userMessage != 'none')
 $.$.htmlTarget.appendChild(UserMessage);
 
 const progresser = 100 /(entries.length +1);
 const loadingBar = document.createElement('input');
 loadingBar.type = 'range';
 loadingBar.value = 0;
 
 loadingBar.style.width = `${window.innerWidth -20}px`;
 loadingBar.style.left = '5px';
 
 async function execute() {
  if (c.status != 0) return;
  
  if (userMessage != 'none') UserMessage.remove();
  if ($.$.inModule == false) $.$.htmlTarget.appendChild(loadingBar);
  c.status = 1;

  $.listener('keydown', async e => {
   if (e.ctrlKey && e.altKey && e.key == 'a') tryAbort('Are you sure you want to abort?');
  }, window);

  let i = 0;
  let directory = dir && typeof dir == 'object' ? dir : await get(handleID);
  if (!directory)
  {
   try {
    directory = await window.showDirectoryPicker();
   } catch(e) {
    tryAbort('We have encountered an issue in trying to access a Directory. Restart?');
   }
   
   await set(handleID, directory);
  }

  const [files, directories] = await getEntriesFrom(directory, 'We have encountered an issue with the directory handle. Restart?', 0, id);
  Module[id] = await createComponent(files, { name: id });
  loadingBar.value += progresser;
  
  for await (let entry of entries)
  {
   try {
    const filename = typeof entry.file == 'string' ? entry.file : entry.name;
    Module[entry.name] = await createComponent(directories[filename], entry, 1);
    $.$.pkg.push(entry.name);
    i ++;
   } catch(error) {
    tryAbort(`We have encountered an issue while evaluating the '${entry.name.trim()}' component. Restart?`, 1); 
   }
  }
  
  document.dispatchEvent(event);
 };
 
 async function git_execute() {
  if (c.status != 0) return;
  
  if (userMessage != 'none') UserMessage.remove();
  if ($.$.inModule == false) $.$.htmlTarget.appendChild(loadingBar);
  c.status = 1;

  $.listener('keydown', async e => {
   if (e.ctrlKey && e.altKey && e.key == 'a') tryAbort('Are you sure you want to abort?');
  }, window);

  let i = 0;
  const { files, directories } = await $.GitHub.dir(id.file);
  Module = await createComponent(files, { name: id.name }, 1);
  loadingBar.value += progresser;
  
  for (let key in directories)
  {
   const { files, directories } = directories[key];
   Module[key] = await createComponent(files, { name: key }, 1);
  }
  
  document.dispatchEvent(event);
 };
 
 function createComponent(files = {}, entry = {}, addProgress) {
  if (!specified) namespace = entry.name;
  
  return new Promise(async(resolve) => {
   const dp = { componentName: entry.name };
   const config = files['config.rdn'] || files['configure.rdn'] || files['configuration.rdn'];
   
   if (config)
   {
    (new $.ROBJ(entry.name +' - configuration', config));
    const configObject = await $.$.rdn(entry.name +' - configuration');
    if (configObject.order) order = configObject.order;
    
    const ext = configObject.extensions;
    if (ext) extensions = { ...ext, ...extensions };

    $.configure(configObject);
    dp[configObject.namespace ?? 'configuration'] = { ...configObject };
   }
   
   for (let key in files)
    if (!order.includes(key) && !order.includes('!' +key))
     order.push(key);
   
   const length = order.filter(key => !key.startsWith('!')).length
   const progressAddition = length > 0 ? progresser /length : 0;
   for await (let key of order)
   {
    await evaluateFile(files[key], { ...entry, key, dp });
    if (addProgress) loadingBar.value = Number(loadingBar.value) +progressAddition;
   }
   
   resolve(dp);
  });
 }
 
 function evaluateFile(file, { name, key, dp }) {
  if (key.startsWith('!')) return;
  const [namespace, extension] = key.split('.');
  
  const _ = { namespace, dpName: name, dp };
  _files[key] = { content: file, extension };
  
  const evaulationObject = {
   async $(x) {
    const module = newModuleHandle(_);
    $.module = module;

    await $.ruin(x, {
     x: new Proxy({}, {
      get(t, prop) {
       return module.exports[prop];
      },

      set(t, prop, value) {
       module.exports[prop] = value;
       return true;
      },
     }),
    });
    
    let name = $.module.name || $.module.namespace || namespace;
    const keys = Object.keys($.module.exports);
    
    if (keys.length == 1 && keys[0] == name) dp[name] = $.module.exports[name];
    else dp[name] = $.module.exports;
    delete $.module;
   },
   
   debug(x) {
    const [_try, catch_] = x.split('|||');
    dp[namespace] = async(args = {}) => {
     const module = newModuleHandle(_);
     try {
      await $.ruin(_try.trim(), {
       module, ...args,
      });
     } catch(error)
     {
      const _catch_ = await $.ruin(catch_.trim(), { module });
      if (typeof _catch_ == 'function') _catch_({ error, dp, files: _files, Module });
     }
    };
   },

   mthd(x, { dp }) {
    function callback(args) {
     $.module = newModuleHandle(_);
     const result = $.ruin(x, args);

     delete $.module;
     return result;
    };

    dp[namespace] = callback;
   },

   async rdn(x) {
    if (namespace.includes('config')) return;
    (new $.ROBJ(name+ namespace, x));
    const rdn = await $.$.rdn(name +namespace);

    dp[rdn.namespace ?? namespace] = { ...rdn };
   },

   fx(x) {
    return $.foxx.run(x);
   },

   exec(x) {
    const exec = $.foxx.executeable(x.split('*').map(num => Number(num)));
    exec.file = namespace +'.exec'
    
    dp[$.foxx.scope().namespace ?? namespace] = exec;
    return $.foxx.exec(exec);
   },

   css: async x => await $.css(x),
   js: async x => $.js(x),
   default: x => x,
  }
  
  return $.$.opt(extension, evaulationObject)(file, { name, key, extension, filename: namespace, dp, Module });
 }
 
 function newModuleHandle({ dpName, namespace, dp } = {}) {
  return new Proxy({
   namespace,
   exports: {},
   import(dependency = dpName, file) {
    const dep = module[dependency] ?? dp;
    return file ? dep[file]: dep;
   },
   
   import_([dependency]) {
    const dep = $.assess(dependency, [module, { lib: dp, library: dp }]);
    return dep;
   },

   export(data) {
    if (typeof this.exports != 'object') throw `To use the export function of a ModuleHandle, the exports propert must be of type: 'object';`;
    if (typeof data != 'object') throw `To use the export function of a ModuleHandle, the argument passed must be of type: 'object';`;
    
    for (let key in data)
    this.exports[key] = data[key];
   },

   become(key) {
    const prop = key ?? this.name ?? this.namespace;
    this.exports = this.exports[prop];
    this.name = prop;
   },
  }, {
   set(target, property, value) {
    target[property] = value;
    return true;
   },
  });
 }
 
 async function getEntriesFrom(handle, abortMessage, nested, name) {
  try {
   const data = {};
   const directories = {};
   
   $.$.modChildren[name ?? handle.name] = handle;
   for await (const entry of handle.values())
   {
    if (entry.kind == 'file') {
     const file = await entry.getFile();
     const contents = await file.text();
     data[file.name] = contents;
    }
    else if (entry.kind == 'directory')
    {
     [directories[entry.name]] = await getEntriesFrom(entry, 0, 1);
     $.$.modChildren[`${nested ? handle.name +' - ' : ''}${entry.name}`] = entry;
    }
   }
   
   return [data, directories];
  } catch(error) {
   if (abortMessage) tryAbort(abortMessage);
   else throw error.message;
  }
 }
 
 async function tryAbort(message, showError = false) {
  if (!confirm(message)) 
  {
   if (showError) throw message;
   return false;
  }
  
  await $.$.delModules([id]);
  location.reload();
 }
 
 if (useGit) git_execute();
 else if ($.$.inModule == false)
 {
  document.addEventListener('mousedown', execute);
  document.addEventListener('keydown', e => {
   if (!e.ctrlKey) execute();
  });
 } else execute();
 
 return new Promise(resolve => {
  $.listener('Module Loaded', e => {
   $.log('No immediate issues detected. <css> color:lightgreen; font-family: Courier New'); 
   loadingBar.remove();
   
   const result = entries.length || useGit ? Module : Object.values(Module)[0];
   if (useGit) module[id.name] = Module;
   else for (let key in Module)
   module[key] = Module[key];
   
   resolve(result);
  })
 })
}

$.$.mod = createModule;
foxx.syntax.doc.createElement(`{
 let name = 'ruin-c';
 function construct() {
  let shadow = element.attachShadow({ mode: 'open' });
  if !element.textContent.startsWith('^') ? {
   -execute element.textContent;
   element.textContent = '^' +element.textContent;
  } else {
   element.textContent = element.textContent.slice(1);
  };
 };
 
 function attributeChangedCallback(attr, oldVal, newVal) {
  print [attr, oldVal, newVal];
 };
}`);

const program = urlData();
const watch = [program.name];
const prev = {};

function checkForChange() {
 for (let key of watch)
 {
  if (!prev[key]) prev[key] = localStorage[key];
  else if (localStorage[key] != prev[key] && $.autoReload) location.reload();
 }
}

setInterval(() => checkForChange(), 30); 
const code = localStorage[program.name] ?? sessionStorage[program.name];
document.addEventListener('keydown', async e => {
 if (e.ctrlKey && e.key == 's')
 {
  e.preventDefault();
  
  let content = document.documentElement.innerHTML;
  content = `<!DOCTYPE html>
<html lang='en'>
 <head>
  <meta charset='UTF-8' content-type='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <script>
   sessionStorage['${urlData().name}'] = (\`${modify(code)}\`);
   location.href = 'https://nexus-webdev.github.io/Ruin/Output.html?name=${urlData().name}';
  <\/script>
 </head>
</html>`;
 
  const directory = foxx.directory() ?? await window.showDirectoryPicker();
  const page = await directory.getFileHandle(document.title +'.html', { create: true });
  const pageBlob = new Blob([content], { type: 'text/html' });
  
  const pageStream = await page.createWritable();
  await pageStream.write(pageBlob);
  await pageStream.close();
 }
})

$.$.htmlTarget = document.body;
$.html(`<ruin-c>${code}<\/ruin-c>`);
