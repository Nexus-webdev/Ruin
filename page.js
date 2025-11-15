window.githubProgram = location.href.includes('.github.io');
const mods = {
 Img: Image,
 js(code, type = 'text/javascript') {
  const script = document.createElement('script');
  script.type = type;
  script.text = code;
  
  $.meta.htmlTarget.appendChild(script);
 },
 
 html(code) {
  if (typeof code != 'string') throw `Html code must be of type 'string'`;
  
  const range = document.createRange();
  const fragment = range.createContextualFragment(code);
  $.meta.htmlTarget.appendChild(fragment);
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
 cache: localStorage,
 parent: window.parent,
};

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
 
  const directory = $?.foxx?.directory?.() ?? await window.showDirectoryPicker();
  const page = await directory.getFileHandle(document.title +'.html', { create: true });
  const pageBlob = new Blob([content], { type: 'text/html' });
  
  const pageStream = await page.createWritable();
  await pageStream.write(pageBlob);
  await pageStream.close();
 }
})

$.meta.htmlTarget = document.body;
$.ruin(code);
