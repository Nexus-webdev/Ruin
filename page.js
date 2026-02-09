window.githubProgram = location.href.includes('.github.io');
const mods = {
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

 listeners(elem, type) {
  if (!elem) return [];
  if (!elem.listeners) elem.listeners = {};

  if (type) return elem.listeners[type] ?? [];
  return elem.listeners;
 },
 
 session: sessionStorage,
};

for (let key in mods)
{
 if (typeof mods[key] == 'function')
 $[key] = mods[key].bind($);
 else $[key] = mods[key];
}

$.struct('Event', {
 __destination__: $,
 __init__(self, id, { details = {}, defaultElement = document, options = {} } = {}) {
  this.id = id;
  this.defaultElement = defaultElement;
  this.details = details;
  this.options = options;
 },
 
 dispatch(self, elem, details = {}) {
  const element = elem ?? this.defaultElement;
  const detail = { ...this.details, ...details };
  
  const event = new CustomEvent(this.id +(details.type ?? ''), { detail, ...this.options });
  element.dispatchEvent(event);
 }
})

$.struct('xml: static', {
 __destination__: $,
 parser: new DOMParser(),
 serializer: new XMLSerializer(),
 
 $add_methods(self, doc) {
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
 
 to_array(self, doc) {
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
 
 parse(self, str) {
  "Evaluates to an xml doc based on the string provided";
  return new Promise(async resolve => {
   const doc = await this.parser.parseFromString(str, 'application/xml');
   this.$add_methods(doc);
   
   resolve(doc);
  })
 },
 
 stringify(self, doc) {
  "Serializes an xml doc to string form";
  return this.serializer.serializeToString(doc);
 },
 
 build(self, name, nodes = [], elem) {
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
 __destination__: $,
 __init__(self, { width = 400, height = 300, backgroundColor = '#000', textColor = '#0f0', interpreter = x => x, header } = {}) {
  this.interpreter = interpreter;
  this.path = '';
  
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
    this.print(`${this.path}> ${statement}`);
    this.input.value = '';
    
    const result = await this.interpreter(statement);
    if (result) this.print(result);
   }
  });
 },

 print(self, value) {
  if (typeof value == 'object')
  value = JSON.stringify(value);
  
  this.output.textContent += value +'\n';
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
script('https://nexus-webdev.github.io/Ruin/syntax.js').then(_ => {
 bootstrapper.then(_ => {
  script('https://nexus-webdev.github.io/Ruin/page.js')
 })
})

// DATA - END;`;
   content = `<!DOCTYPE html>${A}${B}${C}`;
  }
 
  const directory = await window.showDirectoryPicker();
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
  const src_url = this.hasAttribute('as') ? this.getAttribute('as') : undefined;
  const is_module = this.hasAttribute('module');
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
   await ext(code, is_module, src_url);
  };
  
  const content = this.textContent.trim();
  if (content) await f(content, false, src_url);
 }
}

customElements.define('r-script', RuinScript);
if (window.__file__) (async _ => {
 const type = window.__file__.handle.name.split('.').pop();
 $.meta.htmlTarget = document.body;
 
 const ext = $.meta.supported_exts[ensure_file_type_is_valid(type)];
 return await ext(window.__file__.code, false, 'main');
})().then(x => (window.result = x));

