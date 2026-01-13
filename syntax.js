let db;
function getDB() {
 return db || (db = createStore('IndexedDB', 'main'));
}

function createStore(db, store) {
 const request = indexedDB.open(db);
 request.onupgradeneeded = x => request.result.createObjectStore(store);
 
 db = promisifyRequest(request);
 return(mode, callback) => db.then(db => callback(db.transaction(store, mode).objectStore(store)));
}

function promisifyRequest(e) { 
 return new Promise((resolve, reject) => { 
  e.oncomplete = e.onsuccess = x => resolve(e.result);
  e.onabort = e.onerror = x => reject(e.error);
 }) 
}

function get(name, db = getDB()) {
 return db('readonly', store => {
  if (typeof name == 'string') return promisifyRequest(store.get(name));
  return Promise.all(name.map(key => promisifyRequest(store.get(key))));
 });
}

function set(name, value, db = getDB()) {
 return db('readwrite', store => {
  store.put(value, name);
  return promisifyRequest(store.transaction);
 });
}

function setMany(entries, db = getDB()) {
 return db('readwrite', store => {
  entries.forEach(([key, value]) => store.put(value, key));
  return promisifyRequest(store.transaction);
 });
}

function del(name, db = getDB()) {
 return db('readwrite', store => {
  if (typeof name == 'string') store.delete(name);
  else name.forEach(key => store.delete(key));
  
  return promisifyRequest(store.transaction);
 });
}

function update(key, updater, db = getDB()) {
 return db('readwrite', store => {
  return new Promise((resolve, reject) => {
   const request = store.get(key);
   request.onsuccess = x => {
    try {
     store.put(updater(request.result), key);
     resolve(promisifyRequest(store.transaction));
    } catch (e) {
     reject(e);
    }
   };
   
   request.onerror = x => reject(request.error);
  })
 });
}

function clear(db = getDB()) {
 return db('readwrite', store => {
  store.clear();
  return promisifyRequest(store.transaction);
 });
}

function wrap(value) {
 const flags = ['toJSON', 'toString'];
 if (value && typeof value == 'function')
 {
  return new Proxy(value, {
   get(target, prop, receiver) {
    if (flags.includes(prop)) return() => '[Native Code]';
    return target[prop];
   },
  });
 }
 
 if (value && typeof value == 'object')
 {
  return new Proxy(value, {
   get(target, prop, receiver) {
    if (flags.includes(prop)) return() => '[Native Code]';
    const v = Reflect.get(target, prop, receiver);
    
    return wrap(v);
   },
  });
 }
 
 return value;
}

Object.defineProperty(String.prototype, 'compress', {
 value() {
  const input = this.toString();
  if (!input || input == '') return '';
  
  "LZW encode to an array of codes";
  const dictionary = new Map();
  let dictionarySize = 256;
  const codes = [];
  let w = '';
  
  for (let i = 0; i < 256; i ++)
  dictionary.set(String.fromCharCode(i), i);
  
  for (let i = 0; i < input.length; i ++)
  {
   const c = input.charAt(i);
   const wc = w + c;
   if (dictionary.has(wc)) w = wc;
   else {
    codes.push(dictionary.get(w));
    dictionary.set(wc, dictionarySize ++);
    
    w = c;
   }
  }
  
  if (w != '') codes.push(dictionary.get(w));

  "Bit-pack codes into 16-bit chars";
  const maxCode = Math.max(...codes, 0);
  let bits_per_code = 8;
  
  while ((1 << bits_per_code) <= maxCode) bits_per_code ++;
  let bit_buffer = bits_per_code & 0xffff;
  let bit_count = 16;
  
  let out = String.fromCharCode(bit_buffer);
  bit_buffer = 0;
  bit_count = 0;

  for (let code of codes)
  {
   bit_buffer |= code << bit_count;
   bit_count += bits_per_code;

   while (bit_count >= 16)
   {
    out += String.fromCharCode(bit_buffer & 0xffff);
    bit_buffer >>>= 16;
    bit_count -= 16;
   }
  }

  if (bit_count > 0) out += String.fromCharCode(bit_buffer & 0xffff);
  return `${input.length}~${out}`;
 },
 
 configurable: true,
 writable: true,
});

Object.defineProperty(String.prototype, 'decompress', {
 value() {
  let [length, ...compressed] = this.toString().split('~');
  compressed = compressed.join('~');
  length = Number(length);
  
  if (!compressed || compressed == '' || !length) return this.toString();

  let index = 0;
  let bits_per_code = compressed.charCodeAt(index ++);
  if (bits_per_code <= 0 || bits_per_code > 24)
  throw new Error('Invalid compressed data (bits_per_code)');

  let bit_buffer = 0;
  let bit_count = 0;
  const readCode = _ => {
   while (bit_count < bits_per_code)
   {
    if (index >= compressed.length) return null;
    bit_buffer |= compressed.charCodeAt(index ++) << bit_count;
    bit_count += 16;
   }
   
   const code = bit_buffer & ((1 << bits_per_code) -1);
   bit_buffer >>>= bits_per_code;
   bit_count -= bits_per_code;
   
   return code;
  };

  const dictionary = new Map();
  let dictionarySize = 256;
  
  for (let i = 0; i < 256; i ++)
  dictionary.set(i, String.fromCharCode(i));

  let firstCode = readCode();
  if (firstCode == null) return '';

  let w = dictionary.get(firstCode);
  if (w == null) throw new Error('Invalid compressed data (first code)');
  let result = w;

  let code;
  while ((code = readCode()) != null)
  {
   let entry;
   if (dictionary.has(code)) entry = dictionary.get(code);
   else if (code == dictionarySize) entry = w +w.charAt(0);
   else throw new Error('Invalid compressed data (code out of range)');

   result += entry;
   dictionary.set(dictionarySize ++, w +entry.charAt(0));
   w = entry;
  }

  return result.slice(0, length);
 },
 
 configurable: true,
 writable: true,
});

function split_params(string) {
 let current = '', depth = 0, in_string = null, esc = false;
 const parts = [];

 for (let i = 0; i < string.length; i ++)
 {
  const ch = string[i];
  if (in_string)
  {
   current += ch;
   if (esc) esc = false;
   
   else if (ch == '\\') esc = true;
   else if (ch == in_string) in_string = null;
   continue;
  }

  if ('\'"`'.includes(ch)) { in_string = ch; current += ch; continue; }
  if ('([{'.includes(ch)) { depth ++; current += ch; continue; }
  if (')]}'.includes(ch)) { -- depth; current += ch; continue; }

  if (ch == ',' && !depth)
  {
   parts.push(current.trim());
   current = '';
   
   continue;
  }

  current += ch;
 }
 
 if (current.trim()) parts.push(current.trim());
 return parts;
}

self.$ = ({
 _currentCtx_: {},
 _TYPES_: {
  any: x => true, 
  default: x => true, 
  
  float: x => typeof x == 'number' && x.toString().includes('.'),
  int: x => typeof x == 'number' && !x.toString().includes('.'),
  digit: x => typeof x == 'number' && x.toString().length == 1,
  number: x => typeof x == 'number',
  num: x => typeof x == 'number',
  
  string: x => typeof x == 'string',
  bool: x => [true, false].includes(x),
  boolean: x => [true, false].includes(x),
  
  array: x => typeof x == 'object' && Array.isArray(x),
  object: x => typeof x == 'object' && !Array.isArray(x),
 },
 
 __apply_helpers__(f, helpers = []) {
  return function(...args) {
   const processed = args.map((arg, i) => helpers[i] ? helpers[i](arg) : arg);
   return f(...processed);
  };
 },
 
 __replace_within_delimiters__(s, f, closing = { '(': ')', '[': ']', '{': '}' }) {
  s = s.trim();
  const openers = new Set(Object.keys(closing));
  
  const stack = [];
  let out = '';
  
  for (let i = 0; i < s.length; i ++)
  {
   const ch = s[i];
   const top = stack[stack.length -1];
  
   "Handle escapes inside quotes/backticks";
   if (top == "'" || top == '`')
   {
    if (ch == '\\')
    {
     out += ch;
     if (i +1 < s.length) out += s[i ++];
     continue;
    }
    
    "Treat ${...} as nested braces even inside single quotes (DSL-style)";
    if (ch == '$' && s[i +1] == '{')
    {
     stack.push('{');
     out += ch + s[i ++]; "add '$' and '{'";
     continue;
    }
   }
  
   "Opening delimiters";
   if (openers.has(ch))
   {
    stack.push(ch);
    out += ch;
    continue;
   }
  
   "Closing for ${...} inside quotes/backticks";
   if (top == '{' && ch == '}')
   {
    stack.pop();
    out += ch;
    continue;
   }
  
   "Closing delimiters";
   if (top && ch == closing[top])
   {
    stack.pop();
    out += ch;
    continue;
   }
  
   "Replace ONLY when depth > 0 (i.e., inside any delimiter)";
   if (stack.length > 0)
   {
    if (typeof f == 'function') out = f(ch, out);
    else {
     if (ch == ',')
     {
      out += '_comma_';
      continue;
     }
     
     if (ch == ';')
     {
      out += '_semi_colon_';
      continue;
     }
    }
   
    "Top-level: do not replace";
    out += ch;
   }
  }
  
  return out;
 },
 
 typeof(value) {
  const types = Object.keys($._TYPES_).filter(type => !['default', 'any', 'num'].includes(type));
  for (let type of types)
  {
   const is_type = $._TYPES_[type](value);
   if (is_type) return type;
  }
 },
 
 __TypedValue__(type, value) {
  const proxy = new Proxy({ type }, {
   set(target, _, new_value) {
    const f = $._TYPES_[target.type];
    if (!f)
    {
     throw new ReferenceError(`Undefined Type ${target.type}`);
     return false;
    }
    
    const valid = f(new_value);
    if (!valid)
    {
     throw new TypeError(`${new_value?.toString?.() || 'value'} is not of type ${target.type}`);
     return false;
    }
    
    target.value = new_value;
    return true;
   },
   
   get(target, key) {
    return traget[key] ?? target.value;
   },
  })
  
  proxy.value = value;
  return proxy;
 },
 
 scramble(txt, key) {
  if (!key || typeof key != 'number') return txt;

  return [...txt].map((char, i) => {
   const code = txt.charCodeAt(i);
   return String.fromCharCode(code +key);
  }).join('');
 },
 
 __process_nested__(str, f, delimiters = { '(': ')', '[': ']', '{': '}', "'": "'", '"': '"', '`': '`' }) {
  function walk(s, start = 0) {
   let result = '';
   while (start < s.length)
   {
    const ch = s[start];
    if (delimiters[ch])
    {
     "Find matching closing delimiter";
     let depth = 1, i = start +1;
     while (i < s.length && depth > 0)
     {
      if (s[i] == ch && ch != "'" && ch != '"' && ch != "`") depth ++;
      else if (s[i] == delimiters[ch]) -- depth;
      
      i ++;
     }
     
     "Recursively process inner part";
     const inner = s.slice(start +1, i -1);
     const processedInner = f(walk(inner), ch, delimiters[ch]);
  
     result += ch +processedInner +delimiters[ch];
     start = i;
    } else {
     result += ch;
     start ++;
    }
   }
   
   return result;
  }

  return walk(str);
 },
 
 create_macro(pattern, transformer, ignore_spaces) {
  "Convert pattern into regex with capture groups";
  pattern = pattern.replace(/\(/g, '\\(')
                   .replace(/\)/g, '\\)')
                   .replace(/\{/g, '\\{')
                   .replace(/\}/g, '\\}')
                   .replace(/\$([0-9]+)/g, '(.+?)');
                   "$n → capture group";
  
  if (ignore_spaces) pattern = pattern.replace(/\s+/g, '\\s*');
  const regex = new RegExp(pattern, 'gs');
  
  return(code) => {
   return code.replace(regex, (...matches) => {
    const args = [];
    for (let match of matches.slice(1))
    {
     if (typeof match != 'string') break;
     args.push(match);
    }
    
    return transformer(...args);
   });
  };
 },

 apply_macros(code, macros = [], maximum_passes = 5) {
  if (!Number(maximum_passes)) maximum_passes = 5;
  for (let i = 0; i < maximum_passes; i ++)
  {
   let modified_code = code;
   for (let m of macros) modified_code = m(modified_code) ?? modified_code;
   
   if (modified_code == code) return modified_code;
   code = modified_code;
  }
  
  return code;
 },
 
 setup_phase: true,
 RuinError: class {
  constructor(e, { sourceUrl = 'ruin', offset = 0, kind = 'runtime', name } = {}) {
   if (e instanceof SyntaxError)
   {
    this.name = 'RuinSyntaxError';
    this.kind = 'syntax evaluation';
   } else {
    this.name = name ?? e.name ?? 'RuinError';
    this.kind = kind;
   }
   
   "Get the line and column the error occured on";
   const match = e.stack.match(/:(\d+):(\d+)/);
   this.line = match ? parseInt(match[1], 10) : 0;
   this.col = match ? parseInt(match[2], 10) : 0;
   
   "Remap: subtract wrapper offset to get user input line";
   this.offset_line = Math.max(1, this.line -offset);
   this.sourceUrl = sourceUrl;
   
   this.stack = `${this.name}: ${e.message}\n`
                +`  @ ${this.sourceUrl}.$:${this.offset_line}:${this.col} (ln ${this.offset_line -2})\n`
                +`  @ ${this.sourceUrl}.js:${this.line}:${this.col}\n`
                +`  [${this.kind}]`;
  }
  
  toString() {
   return this.stack;
  }

  represent() {        
   return this.stack;
  }
 },
 
 __n__: 0,
 async ruin(source_code = '', context = {}, url) {
  const { code, url: sourceUrl } = await $.__transpile__(source_code, url);
  const prevCtx = $._currentCtx_;
  let ruin_script;
  
  const __line_offset__ = code.split('// sof;')[0].split('\n').length;
  const ctx = {
   __line_offset__,
   ...context,
   context,
   ...$,
  };
  
  try {
   ruin_script = new Function(code);
  } catch (e) {
   const err = new $.RuinError(e, {
    offset: __line_offset__,
    kind: 'evaluation',
    sourceUrl,
   });
   
   console.error(err.represent());
  }
  
  return (ruin_script ?? (x => x)).call(ctx).then(x => {
   $._currentCtx_ = prevCtx;
   $.setup_phase = false;
  })
 },
 
 setup(code, ctx, name) {
  $.setup_phase = true;
  return $.ruin(code, ctx, name);
 },
 
 __extract_typed_params__(string) {
  const parts = split_params(string);
  return parts.map(part => {
   const match = part.match(/^(\w+)\s*:\s*(\w+)(?:\s*=\s*(.+))?$/);
   if (!match) return {
    default: undefined,
    type: 'any',
    name: part,
    match,
   };
   
   const [, type, name, def] = match;
   return {
    type: type.toLowerCase(),
    default: def,
    match,
    name,
   };
  });
 },
 
 __typed_func__(f, data = []) {
  return $.__apply_helpers__(f, data.map(({ type, default: def, match }) => {
   return value => {
    if (!match) return value;
    
    if (value == undefined) return def ? __TypedValue__(type, def) : def;
    return __TypedValue__(type, value);
   };
  }));
 },
 
 async __transpile__(code, url) {
  "Decode from base64 if needed";
  if ($.GitHub.isBase64(code))
  code = decodeURIComponent(escape(atob(code)));
  
  const i = code.lastIndexOf('¿');
  let key = code.slice(i +1), max_passes = 10, apply_macs = true;
  const macros = [];
  
  code = i != -1 ? code.slice(0, i) : code;
  key = i != -1 ? $.shift(key, -(key.length **2)) : null;
  
  const ext = $?.module?.ext;
  code = key ? (await $.Cipher.decrypt(code, key)) : code;
  url = (url ?? $?.module?.namespace ?? 'unknown').split('.')[0];
  url = `${$.__n__ ++}--${url}${ext ? '-' +ext : ''}`;
  
  "Apply macros affecting the transpiler";
  code = $.apply_macros(code, [
   $.create_macro('tpiler-applymacs $1', bool => {
    apply_macs = bool.trim().toLowerCase() == 'true' ? true : false;
    return `// Transpiler Applies Macros: ${apply_macs};`;
   }),
   
   $.create_macro('tpiler-passes $1', num => {
    return `// Maximum Transpiler Passes: ${max_passes = Number(num)};`;
   }),
   
   $.create_macro('tpiler-define $1 >>> $2!;', (pattern, transform) => {
    const f = $.assess(transform);
    if (!f) return '';
    
    macros.push($.create_macro(pattern, (...args) => f(...args)));
    return `// Macro: pattern: ${pattern}, transform: ${transform};`; 
   }, true),
  ], 5);
  
  const map = [
   ['flux {$1}!', body => `RUIN.flux.run(\`${escape(body)}\`)`, true],
   ['flux ($1) : {$2}!', (ctx, body) => `RUIN.flux.run(\`${escape(body)}\`, ${ctx})`, true],
   ['viscript ($1) : {$2}!', (ctx, body) => {
    return `RUIN.viscript.run(\`${escape(body)}\`, ${ctx || '{}'})`;
   }, true],
   
   ['repeat ($1) :', i => `for (let i = 0; i < ${i}; i ++)`, true],
   ['unless ($1) :', condition => `if (!(${condition}))`, true],
   ['for ($1) :', condition => `for (${condition})`, true],
   ['if ($1) :', condition => `if (${condition})`, true],
   
   ['structure ($1) : {$2}!', (name, body) => `RUIN.struct('${name}', {${body}})`, true],
   ['func $1($2) : {$3}!', (name, params, body) => {
    const id = `___param_data_${Date.now()}___`;
    const data = $.__extract_typed_params__(params);
    
    $[id] = data;
    params = data.map(({ name }) => name);
    return `const ${name} = __typed_func__((${params}) => {${body}}, RUIN.${id})`;
   }, true],
   
   ['import $1 from $2;', (a, b) => `const ${a} = module.import_\`${b}\`;`],
   ['import: $1 from $2;', (a, b) => `const ${a} = await meta.mod\`${b}\`;`],
   
   ['delay ($1)', time => `(for_ \`${time}\`)`, true],
   ['print ($1);', output => `console.info(${output});`, true],
   ['out $1!;', output => `return ${output};`, true],
   
   ['range: ($1);', args => {
    return `__range__(${args});`
   }, true],
   
   ['pipe $1!', pipe => {
    const steps = pipe.split(' >> ').filter(Boolean);
    pipe = steps.shift();
    
    for (let step of steps)
    pipe = `${step}(${pipe})`;
    
    return pipe;
   }],
  ];
  
  for (let key of ['let', 'def', 'const'])
  map.push([`${key} $1: $2 = $3!;`, (type, id, value) => {
   return `${key} ${id} = __TypedValue__('${type}', ${value});`;
  }, true]);
  
  "Create macros";
  const map_fn = args => $.create_macro(...args);
  macros.unshift(...map.filter(multi_line).map(map_fn));
  const line_macs = map.filter(m => !multi_line(m)).map(map_fn);
  
  function multi_line(m) {
   return m[0].includes('{');
  }
  
  "Apply multi_line macros";
  code = $.apply_macros(code, macros, max_passes);
  
  "Add indentation and apply single line macros";
  code = code.split('\n')
             .map(ln => '   ' +$.apply_macros(ln, line_macs, max_passes))
             .join('\n')
             .replaceAll('def ', 'this.');
  
  "Wrap The code in the ruin context";
  code = `//# sourceURL=${url}.js
return (async() => {
 try {
  with(this) {
   RUIN._currentCtx_ = this;
   
   // sof;
   ${code}
   // eof;
  }
 } catch (e) {
  const err = new this.RuinError(e, {
   sourceUrl: '${url}',
   offset: this.__line_offset__,
   kind: 'runtime',
  });
  
  console.error(err.represent());
 }
})();`;
  
  return { code, url };
 },
 
 __range__(a, b, c) {
  const array = [];
  const start = b ? a : 0;
  const end = b || a;
  const step = c || 1;
  
  for (let i = start; i < end; i += step) array.push(i);
  return array;
 },

 extract(inputString, pattern) {
  const regex = new RegExp(pattern, 's');
  const match = inputString.match(regex);

  return match;
 },
 
 findBlock(string, open = '{', close = '}', index = 'lastI') {
  string = ` ${string} `;
  const openingBrace = string.indexOf(open) +open.length;
  const closingBrace = (string[`${index}ndexOf`](close) -close.length) +1;
  
  return string.slice(openingBrace, closingBrace);
 },
 
 replace(str = '', target = '', replacement = '', start = 0, end) {
  const chars = str.split('');
 
  for (let i = start; i <= (end || chars.length); i++) {
   if (chars[i] == target)
   {
    chars[i] = replacement;
   }
  }
 
  return chars.join('');
 },
 
 findBraces(str, openingBrace = '{', closingBrace = '}') {
  const result = [];
  const stack = [];
 
  for (let i = 0; i < str.length; i ++) {
   if (str[i] == openingBrace) stack.push(i);
   else if (str[i] == closingBrace) {
    if (stack.length > 0) {
     const o = stack.pop();
     result.push([o, i]);
    }
   }
  }
 
  return result.sort((x, y) => x[0] -y[0]).map(([o, c]) => [o, c, result.some(([O, C]) => o < C && o > O) ? 1 : 0]);
 },

 log(...args) {
  const array = [];
  for (let arg of args)
  {
   if (typeof arg == 'string')
   {
    const [data, styles = 'font-family: Courier New'] = arg.split('<css>');
    console.log(`%c${data.trim()}`, styles);
    array.push({ data, styles });
   } else {
    array.push({ data: arg, styles: null });
    console.log(arg);
   }
  }
  
  return array.length == 1 ? array[0] : array;
 },
 
 logGroup(groupName, messages = [], collapsed = true) {
  if (collapsed) console.groupCollapsed(groupName);
  else console.group(groupName);
  for (let message of messages)
  {
   if (Array.isArray(message)) $.logGroup(message.pop(), message, collapsed);
   else $.log(message);
  }
  
  console.groupEnd();
 },

 assess(txt, objects = [this]) {
  const ctx = Object.assign({}, ...objects);
  const result = new Function(`with(this) { return ${txt} }`).call(ctx);
  return result;
 },
 
 TxtToNum(txt) {
  const map = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%^&?~.,-_+=/* (){}[]<>:;';
  let num = 0;
  let i = 0;
  
  for (let char of txt)
  {
   if (Number(char)) num += Number(char);
   else num += map.indexOf(char) *(i % 3 +1);
   i ++;
  }
  
  return num;
 },
 
 _: undefined,
 False: false,
 True: true,
 nil: null,
 
 RUIN: new Proxy(this, {
  get(_, property) {
   return $[property];
  },
  
  set(_, property, value) {
   _[property] = value;
   return $[property] = value;
  },
 }),
 
 struct(name, { relationships = {}, destinationObject = $.RUIN, _this, overrideModule, override, ...prototype } = {}) {
  if (_this)
  {
   overrideModule = true;
   destinationObject = _this;
  }
  
  function opt(value, options = {}) {
   return options[value] ?? options.default;
  };
  
  const ruinContext = { ...this };
  const Obj = this.module && !overrideModule ? this.module.exports : destinationObject;
  
  const obj = $.setup_phase == true ? $.RUIN : Obj;
  const staticValues = {};
  const [arg, config] = name.split(':').map(t => t.trim());

  function CONSTRUCTOR(...args) {
   const t = this;
   const types = {};
   const secrets = {};
   
   const func = f => (f && typeof f == 'function' ? f : null);
   function apply(objA, objB, key) {
    if (func(objB[key]))
    {
     objA[key] = function(...args) {
      const proxy = new Proxy({}, {
       get(_, prop) {
        if (typeof prop == 'string' && prop.startsWith('$')) return secrets[prop];
        return t[prop];
       },
       
       set(_, prop, value) {
        if (typeof prop == 'string' && prop.startsWith('$')) return secrets[prop] = value;
        return t[prop] = value;
       },
       
       has(_, prop) {
        return prop in t || prop in secrets;
       },
      });
      
      return objB[key].bind(proxy)(...args);
     };
    } else objA[key] = objB[key];
   };
   
   function set(obj, override = true) {
    for (let key in obj)
    {
     if (key.startsWith('$')) apply(secrets, obj, key);
     else apply(t, obj, key);
    }
   };

   set(prototype);
   set({
    $relationships: relationships,
    $constructor: constructor,
    $setdata: set,
    $args: args,
    
    $extension(type) {
     const _struct = types[type];
     this.parent = _struct;
     
     set(_struct);
     delete this.$extension;
     this.$uper = function(...args) {
      delete this.$uper; 
      const __init__ = func(_struct.__init__ ) ?? func(_struct.construct);
      return __init__.bind(this)(...args);
     };
    },
    
    $addRelationship({ name, object = obj, type = 'parent' } = {}) {
     const structs = {};
     if (typeof name == 'string') opt(type?.trim()?.toLowerCase(), options)(this, name, object, structs);
     
     set(structs);
    },
   });
   
   const structs = {};
   const contractExists = this.$contract && this.$contract.length > 0;
   
   const options = {
    default: x => x,
    parent(name, obj, structs) {
     const Obj = obj[name] ? obj : ruinContext;
     if (!Obj[name]) throw `structure '${arg}' cannot receive Inheritance from Non-Existant Parent structure '${name}';`;
     if (typeof structs.parent == 'string') throw `structure '${arg}' attempted to exceed the max amount of Parent structures (1);`

     const _parent = new Obj[name]('⌀');
     structs.parent = _parent;
     this.$uper = (...args) => {
      delete this.$uper;
      return _parent.construct.bind(t)(...args);
     };
     
     const contract = (contractExists ? t.$contract : Object.keys(_parent)).filter(key => !(['construct', 'constructor']).includes(key));
     
     for (let key of contract)
     {
      if (t[key] == undefined || structs[key] == undefined)
      structs[key] = _parent[key];
     }
    },
    
    component(name, obj, structs) {
     const Obj = obj[name] ? obj : ruinContext;
     if (!Obj[name]) throw `structure '${name}' does not exist`;
     if (Obj[name].name != 'CONSTRUCTOR')
     {
      structs[name] = Obj[name];
      delete Obj[name];
      return;
     }
     
     const INSTANCE = Obj[name];
     structs[`_${name}_`] = (...args) => {
      const instance = new INSTANCE('⌀');
      instance[arg?.toLowerCase()] = t;
      
      const construct = instance.__init__ ?? instance.construct ?? instance.constructor;
      if (construct && typeof construct == 'function') construct(...args);
      
      if (t[name] != undefined) return instance;
      t[name] = instance;
     };
    },
    
    extension(name, obj, structs) {
     const Obj = obj[name] ? obj : ruinContext;
     if (!Obj[name]) throw `structure '${arg}' cannot receive Inheritance from Non-Existant Parent structure '${name}';`;
     
     const _struct = new Obj[name]('⌀');
     types[_struct._typename ?? name] = _struct;
    },
    
    static(name, obj, structs) {
     const Obj = obj[name] ? obj : ruinContext;
     if (Obj[name] == undefined) throw `structure '${name}' does not exist`;
     
     CONSTRUCTOR.static[name] = Obj[name];
     CONSTRUCTOR[name] = Obj[name];
    },
   };
  
   for (let member in relationships)
   meta.opt(relationships[member], options)(member, obj, structs);
   
   set(structs);
   const __init__ = func(this.__init__) ?? func(this.construct);
   if (args[0] != '*bypass init*' && __init__)
   {
    const result = __init__(...args);
    if (result != undefined) return result;
   }
  };
  
  const constructor = (new Function(`with(this) return ${CONSTRUCTOR.toString().replace('CONSTRUCTOR', arg)}`)).call({
   relationships, arg,
   destinationObject,
   _this,
   obj,
   
   overrideModule,
   ruinContext,
   prototype,
  })
  
  constructor._name = arg;
  const __prototype__ = {};
  for (let key in prototype)
  {
   if (typeof key == 'string' && key.startsWith('*')) {
    const property = prototype[key];
    delete prototype[key];
    key = key.slice(1);
    
    if (key.startsWith('*'))
    {
     key = key.slice(1);
     constructor.prototype[Symbol[key]] = property;
    } else constructor[key] = property;
   }
  }
  
  if (config?.toLowerCase?.() == 'static') return obj[arg] = new constructor();
  if (config?.toLowerCase?.() == 'return') return constructor;
  return obj[arg] = constructor;
 },

 uniqueString(base = 36, range = [2, 10]) {
  return Date.now().toString(base);
 },

 weigh(weights) {
  const pool = [];
  const values = {};
  
  for (let key in weights)
  {
   const weight = Number(key);
   const id = Date.now();
   
   for (let i = 0; i <= weight; i ++) pool.push(id);
   values[id] = { weight, value: weights[key] };
  }
  
  const id = pool[math.ran(0, pool.length -1)];
  return values[id];
 },

 shift(txt, shift, ignore = ['$']) {
  const regex = new RegExp(`[a-zA-Z](?![${ignore.map(symbol => `\\${symbol}`).join('|')}])`, 'g');

  return txt.replace(regex, c => {
   const base = c < 'a' ? 65 : 97;
   return String.fromCharCode(((c.charCodeAt(0) -base +((shift %26) +26) %26) %26) +base);
  });
 },
 
 make_textarea_interactive(t) {
  if (!t.addEventListener) return;
  t.addEventListener('input', e => {
   paren('"', '";');
   paren("'", "'");
   paren('`', '`');
   paren('(', ')');
   paren('{', '}');
   paren('[', ']');
   
   function paren(left, right) {
    if (e.data?.length != 1 || e.data != left) return;
    const start = t.selectionStart;
    
    t.value = t.value.slice(0, t.selectionStart) +right +t.value.slice(t.selectionStart);  
    t.selectionStart = t.selectionEnd = start;
   };
  })
  
  t.addEventListener('keydown', e => {
   const selecting = t.selectionStart != t.selectionEnd;
   const selectedText = t.value.substring(t.selectionStart, t.selectionEnd);
   
   if (e.altKey && e.key == 'r' && selecting)
   { 
    e.preventDefault();
    if (selectedText)
    {
     const textToFind = prompt('Enter the text to replace:', '');
     const textToReplace = prompt('Enter the new text:', '');
    
     if (textToFind == null || textToReplace == null) return;
     const regex = new RegExp(textToFind, 'g'); 
     const modifiedText = selectedText.replace(regex, textToReplace);
     const newValue = t.value.substring(0, t.selectionStart) +modifiedText +t.value.substring(t.selectionEnd);
    
     t.selectionStart = t.selectionEnd = t.selectionStart +modifiedText.length;
     t.value = newValue;
    }
   }
  
   if (event.key == ' ' && selecting)
   {
    e.preventDefault();
    const start = t.selectionStart;
    
    const lines = t.value.substring(t.selectionStart, t.selectionEnd).split('\n');
    const modifiedText = lines.map(line => ' ' +line).join('\n');
    t.value = t.value.substring(0, t.selectionStart) +modifiedText +t.value.substring(t.selectionEnd);
    
    t.selectionStart = start;
    t.selectionEnd = start +modifiedText.length;
   }
  
   if (e.key == 'Delete')
   {
    if (selecting)
    {
     e.preventDefault();
     const start = t.selectionStart;
     
     const lines = t.value.substring(t.selectionStart, t.selectionEnd).split('\n');
     const modifiedText = lines.map(line => line.replace(/^ /, '')).join('\n');
     t.value = t.value.substring(0, t.selectionStart) +modifiedText +t.value.substring(t.selectionEnd);
     
     t.selectionStart = start;
     t.selectionEnd = start +modifiedText.length;
    }
   }
   
   if (e.key == 'Enter')
   {
    e.preventDefault();
    function InBrackets(a = '{', b = '}') {
     return t.value.lastIndexOf(a, t.selectionStart) == t.selectionStart -1
            && t.value.indexOf(b, t.selectionEnd) == t.selectionEnd;
    };
    
    const previousLine = t.value.substring(0, t.selectionStart).split('\n').pop();
    const indentation = previousLine.match(/^\s*/)[0];
    if (InBrackets() || InBrackets('[', ']'))
    {
     const start = t.selectionStart;
     t.value = `${t.value.substring(0, t.selectionStart)}
${indentation} 
${indentation}${t.value.substring(t.selectionEnd)}`;
     
     t.selectionEnd = t.selectionStart = start +indentation.length +2;
    } else {
     const start = t.selectionStart;
     t.value = `${t.value.substring(0, t.selectionStart)}
${indentation}${t.value.substring(t.selectionEnd)}`;
     
     t.selectionEnd = t.selectionStart = start +indentation.length +1;
    }
   }
  })
 },
 
 when(condition, checkDelay = 100) {
  return new Promise(resolve => {
   check(condition());
   function check(result) {
    if (result)
    {
     resolve(result);
     clearInterval(checkInt);
    }
   }
   
   const checkInt = setInterval(x => check(condition()), checkDelay);
  });
 },
 
 json: JSON,
 idleTasks: [],
 get,
 set,
 del,
});

$.struct('GitHub: static', {
 __init__() {
  this.$tokens = {};
  this.$token = '';
  
  this.url = '';
  this.repository = '';
  this.subdir = '';
  this.owner = '';
 },
 
 repo(owner, name, subdirectory) {
  const path = subdirectory ? subdirectory +'/' : '';
  this.url = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
  
  this.subdir = subdirectory;
  this.repository = name;
  this.owner = owner;
 },
 
 token(token, id) {
  this.$token = token;
  this.$tokens[id] = id ? token : null;
 },
 
 get(path) {
  return new Promise(async resolve => {
   try {
    const response = await fetch(this.url +path, { headers: { Authorization: this.auth() } });
    if (!response.ok) throw `Failed to fetch: ${response.status}`;
    const data = await response.json();
  
    resolve(data);
   } catch(e) {
    throw `Failed to fetch: '${path}'`;
    resolve({});
   }
  })
 },
 
 isBase64(str) {
  if (typeof str !== 'string') return false;
  const notBase64 = /[^A-Z0-9+\/=]/i;
  
  if (!str || str.length % 4 != 0 || notBase64.test(str)) return false;
  try {
   atob(str);
   return true;
  } catch {
   return false;
  }
 },
 
 auth() {
  return this.$token ? `Bearer ${this.$token}` : undefined;
 },
 
 dir(path) {
  return new Promise(async resolve => {
   try {
    const config = { headers: { Authorization: this.auth() } };
    const directories = {};
    const files = {};
    
    const response = await fetch(this.url +path, config);
    if (!response.ok) throw `Failed to fetch: ${response.status}`;
    const data = await response.json();
    
    for (let item of data)
    {
     const exclude = (['.git', '.png', '.jpeg', '.jpg']).find(exclude => item.name.includes(exclude));
     if (!exclude)
     {
      if (item.type == 'file')
      {
       const data = await (await fetch(item.url, config)).json();
       if (data.content) files[item.name] = decodeURIComponent(escape(atob(data.content)));
      } else directories[item.name] = await this.dir(item.path);
     }
    };
    
    resolve({ directories, files, path });
   } catch(e) {
    throw `Failed to fetch: '${path}'`;
    resolve({});
   }
  })
 },
 
 importScript(url) {
  return new Promise(async resolve => {
   this.url = url;
   const data = await this.read('');
   const result = await $.ruin(data.content);
   
   this.repo(this.owner, this.repository, this.subdir);
   resolve(result);
  })
 },
 
 read(path) {
  return new Promise(async resolve => {
   try {
    const url = this.url +path;
    const response = await fetch(url, {
     headers: {
      Authorization: this.auth(),
      Accept: 'application/vnd.github.v3.raw',
     },
    });
    
    if (!response.ok) throw `Failed to read: ${response.status}`;
    const txt = await response.text();
    const data = txt.trim().startsWith('{') && txt.trim().endsWith('}') ? JSON.parse(txt) : {
     name: response.name,
     type: response.type,
     url: response.url,
     path: response.path,
     content: txt,
    };
    
    if (this.isBase64(data.content)) data.content = decodeURIComponent(escape(atob(data.content)));
    resolve(data);
   } catch(e) {
    throw `Failed to read: '${path}'`;
    resolve({});
   }
  })
 },
 
 write(path, content, create = false) {
  return new Promise(async resolve => {
   try {
    const sha = create ? null : (await this.get(path)).sha;
    const url = this.url +path;
    const body = {
     message: 'Update file via API',
     content: btoa(unescape(encodeURIComponent(content))),
     ...(sha ? (sha && { sha }) : {}),
    };
  
    const res = await fetch(url, {
     method: 'PUT',
     headers: {
      Authorization: this.auth(),
      Accept: 'application/vnd.github.v3+json',
     },
     
     body: JSON.stringify(body),
    });
  
    if (!res.ok) throw `Failed to write: ${res.status}`;
    resolve(await res.json());
   } catch(e) {
    throw `Failed to write to: '${path}'`;
    resolve({});
   }
  })
 },
 
 delete(path) {
  return new Promise(async resolve => {
   try {
    const sha = (await this.get(path)).sha;
    const url = this.url +path;
    const body = {
     message: 'Delete file via API',
     sha,
    };
  
    const res = await fetch(url, {
     method: 'DELETE',
     headers: {
      Authorization: this.auth(),
      Accept: 'application/vnd.github.v3+json',
     },
     
     body: JSON.stringify(body),
    });
    
    if (!res.ok)
    {
     const error = await res.json();
     throw `Failed to delete: ${error.message}`;
    }
    
    resolve(await res.json());
   } catch(e) {
    throw `Failed to delete: '${path}'`;
    resolve({});
   }
  })
 },
})

$.struct('Cipher: static', {
 __init__() {
  this.$enc = new TextEncoder();
  this.$dec = new TextDecoder();
 },
 
 toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  
  for (let i = 0; i < bytes.length; i ++)
  binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
 },
 
 fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i ++)
  bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
 },
 
 async $deriveKey(passphrase, salt, iterations = 150_000) {
  const encoded = this.$enc.encode(passphrase);
  const baseKey = await crypto.subtle.importKey('raw', encoded, { name: 'PBKDF2' }, false, ['deriveKey']);

  return crypto.subtle.deriveKey(...[
   { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, baseKey,
   { name: 'AES-GCM', length: 256 }, false,
   ['encrypt', 'decrypt'],
  ]);
 },
 
 async encrypt(txt, passphrase, comp = false) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  txt = comp ? txt.compress() : txt;

  const key = await this.$deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, this.$enc.encode(txt));
  
  const s = this.toBase64(salt.buffer);
  const i = this.toBase64(iv.buffer);
  const c = this.toBase64(ciphertext);
  
  const payload = {
   s: comp ? s.compress() : s,
   i: comp ? i.compress() : i,
   c: comp ? c.compress() : c,
   v: 1,
  };

  return JSON.stringify(payload);
 },

 async decrypt(payloadJson, passphrase, decomp = false) {
  const payload = JSON.parse(payloadJson);
  if (decomp)
  {
   payload.s = payload.s.decompress();
   payload.i = payload.i.decompress();
   payload.c = payload.c.decompress();
  }
  
  const salt = new Uint8Array(this.fromBase64(payload.s));
  const iv = new Uint8Array(this.fromBase64(payload.i));
  
  const ciphertext = this.fromBase64(payload.c);
  const key = await this.$deriveKey(passphrase, salt);
  
  try {
   const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
   const decoded = this.$dec.decode(plaintextBuf);
   return decomp ? decoded.decompress() : decoded;
  } catch(err) {
   throw new Error('Decryption failed: invalid passphrase or corrupted data.');
  }
 },
})

function getFile(name, dir = $.__RUIN_DIR__) {
 return new Promise(async resolve => {
  resolve(await (await dir.getFileHandle(name)).getFile());
 })
}

function getFileText(name, dir = $.__RUIN_DIR__) {
 return new Promise(async resolve => {
  resolve(await (await getFile(name, dir)).text());
 })
}

function getDir(name, dir = $.__RUIN_DIR__) {
 return new Promise(async resolve => {
  resolve(await dir.getDirectoryHandle(name));
 })
}

$.fs = { getFile, getFileText, getDir };
$.__local__ = self.urlData && urlData().local == 'true';

self.bootstrapper = new Promise(async resolve => {
 if (!self.bootstrap) return resolve();
 const urls = [
  'bootstrapper.$',
  'flux.$',
 ];
 
 if ($.__local__)
 {
  let started;
  const id = '__bootstrapper__';
  
  if (await get(id)) load_bootstrapper();
  else {
   document.addEventListener('click', e => load_bootstrapper());
   document.addEventListener('keydown', e => {
    if (e.key == 'Enter') load_bootstrapper();
   });
  }
  
  async function load_bootstrapper() {
   if (started) return;
   started = true;
   
   $.__RUIN_DIR__ = (await get(id)) ?? (await window.showDirectoryPicker());
   for (let url of urls)
   {
    const code = await getFileText(url);
    await $.setup(code);
   }
   
   set(id, $.__RUIN_DIR__);
   resolve($);
  }
  
  return;
 }
 
 for await (let url of urls)
 {
  const response = await fetch(`https://nexus-webdev.github.io/Ruin/${url}`);
  if (!response.ok) throw `Failed to read: ${response.status}`;
  let code = await response.text();
  
  if ($.GitHub.isBase64(code))
  code = decodeURIComponent(escape(atob(code)));
  await $.setup(code, {}, url);
 }
 
 resolve($);
})