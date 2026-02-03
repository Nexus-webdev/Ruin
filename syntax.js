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

function tokenizeInitializer(code, startIndex) {
 let i = startIndex;
 let stack = [];
 let value = '';
 let inString = null;

 while (i < code.length)
 {
  const ch = code[i];
  const prev = code[i - 1];
 
  if (!inString && (ch == '"' || ch == "'" || ch == '`'))
  {
   "Handle string start/end";
   
   inString = ch;
   stack.push(ch);
   
   value += ch;
  } else if (inString)
  {
   value += ch;
   if (ch == inString && prev != '\\')
   {
    stack.pop();
    inString = null;
   }
  } else if (ch == '{' || ch == '[' || ch == '(')
  {
   "Handle braces/brackets/parentheses";
   
   stack.push(ch);
   value += ch;
  } else if (ch == '}' || ch == ']' || ch == ')')
  {
   stack.pop();
   value += ch;
  } else if (ch == ';' && !stack.length) break;
  else value += ch;
 
  i ++;
 }

 return { value, endIndex: i };
}

function __MaskFunctions__(obj) {
 return new Proxy(obj, {
  get(target, prop, receiver) {
   const value = Reflect.get(target, prop, receiver);
   
   if (typeof value == 'function')
   {
    return new Proxy(value, {
     get(target, key) {
      if (key == 'toString' || key == 'toJSON' || key == Symbol.toPrimitive) return() => '[Native Code]';
      return Reflect.get(target, key);
     },
     
     apply(target, thisArg, args) {
      return Reflect.apply(target, thisArg, args);
     },
    });
   }
   
   if (value && typeof value == 'object')
   {
    return new Proxy(value, {
      get(target, objProp, objReceiver) {
       const v = Reflect.get(target, objProp, objReceiver);
       if (typeof v == 'function') {
         return new Proxy(v, {
           get(target, fnProp) {
             if (fnProp == 'toString' || fnProp == 'toJSON' || fnProp == Symbol.toPrimitive) {
               return () => '[Native Code]';
             }
             return Reflect.get(target, fnProp);
           },
           apply(target, thisArg, args) {
             return Reflect.apply(target, thisArg, args);
           }
         });
       }
       
       return v;
      }
    });
   }
   
   return value;
  },
 })
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

function transfer_params(str_1, str_2) {
 "Extract parameter list from str_1 by scanning characters";
 
 let start = str_1.indexOf('(');
 if (start == -1) throw new Error('First function has no parameters');
 
 let depth = 0, end = -1;
 for (let i = start; i < str_1.length; i ++)
 {
  if (str_1[i] == '(') depth ++;
  else if (str_1[i] == ')')
  {
   -- depth;
   
   if (!depth)
   {
    end = i;
    break;
   }
  }
 }
 
 if (end == -1) throw new Error('Unmatched parentheses in first function');
 const params = str_1.slice(start +1, end);
 
 "Replace parameter list in str_2";
 let start_2 = str_2.indexOf('(');
 let depth_2 = 0, end_2 = -1;
 
 for (let i = start_2; i < str_2.length; i ++)
 {
  if (str_2[i] == '(') depth_2 ++;
  else if (str_2[i] == ')')
  {
   -- depth_2;
   
   if (!depth_2)
   {
    end_2 = i;
    break;
   }
  }
 }
 
 if (end_2 == -1) throw new Error('Unmatched parentheses in second function');
 return str_2.slice(0, start_2 +1) +params +str_2.slice(end_2);
}

self.$ = ({
 _currentCtx_: {},
 _TYPES_: {
  any: x => true, 
  default: x => true, 
  
  float: x => x != null && typeof x == 'number' && x.toString().includes('.'),
  int: x => x != null && typeof x == 'number' && !x.toString().includes('.'),
  digit: x => x != null && typeof x == 'number' && x.toString().length == 1,
  number: x => x != null && typeof x == 'number',
  num: x => x != null && typeof x == 'number',
  
  string: x => x != null && typeof x == 'string',
  bool: x => x != null && [true, false].includes(x),
  boolean: x => x != null && [true, false].includes(x),
  
  array: x => x != null && typeof x == 'object' && Array.isArray(x),
  object: x => x != null && typeof x == 'object' && !Array.isArray(x),
  func: x => x != null && typeof x == 'function' && !x.__is_structure__,
  struct: x => x != null && typeof x == 'function' && x.__is_structure__,
 },
 
 __apply_helpers__(f, helpers = []) {
  return function(...args) {
   const processed = args.map((arg, i) => helpers[i] ? helpers[i](arg) : arg);
   return f(...processed);
  };
 },
 
 __replace_within_delimiters__(s, f, f2, closing = { '(': ')', '[': ']', '{': '}' }) {
  const openers = new Set(Object.keys(closing));
  const stack = [];
  
  let out = '';
  s = s.trim();
  
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
     out += ch +s[i ++]; "add '$' and '{'";
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
    if (f && typeof f == 'function') out = f(ch, out);
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
     
     out += ch;
    }
   } else {
    if (f2 && typeof f2 == 'function') out = f2(ch, out);
    else out += ch;
   }
  }
  
  return out;
 },
 
 __typed_declaration_macro__(code) {
  const declPattern = /\b(const|let|def)\s+(\w+)\s*:\s*([a-zA-Z0-9_\{\}\[\]\s,]+)\s*=/g;
  let match, result = '', lastIndex = 0;
 
  declPattern.lastIndex = 0;
  while ((match = declPattern.exec(code)) != null)
  {
   const [full, decl, type, id] = match;
   result += code.slice(lastIndex, match.index); "keep text before match";
   
   "Find initializer safely";
   const { value, endIndex } = tokenizeInitializer(code, declPattern.lastIndex);
   result += `${decl} ${id.trim()} = RUIN.__TypedValue__('${type}', ${value}, '${decl}');`;
   
   lastIndex = endIndex +1; "skip semicolon";
   declPattern.lastIndex = lastIndex;
  }
  
  result += code.slice(lastIndex); "append remainder";
  return result;
 },
 
 type_of(value) {
  const types = Object.keys($._TYPES_).filter(type => !['default', 'any', 'num'].includes(type));
  for (let type of types)
  {
   const is_type = $._TYPES_[type](value);
   if (is_type) return type;
  }
 },
 
 __TypedValue__(type = 'any', value = null, decl = 'let') {
  const target = { type, changes: 0 };
  const proxy = new Proxy(target, {
   get(target, key) {
    if (key == '__v') return target.value;
    if (key == '__type') return target.type;
    if (key == '__changes') return target.changes;
   
    if (key == Symbol.toPrimitive)
    {
     return hint => {
      if (target.value && typeof target.value[Symbol.toPrimitive] == 'function')
      return target.value[Symbol.toPrimitive](hint);
      
      return target.value;
     };
    }
    
    return target.value[key];
   },
   
   set(target, key, new_value) {
    if (key == '__v')
    {
     if (decl == 'const' && target.changes > 0) throw new Error(`Cannot change the value of a constant`);
  
     const f = $._TYPES_[target.type];
     if (!f) throw new ReferenceError(`Undefined Type '${target.type}'`);
     if (!f(new_value)) throw new TypeError(`${new_value} is not of type '${target.type}'`);
  
     target.value = new_value;
     target.changes ++;
     return true;
    }
    
    if (target.value && typeof target.value == 'object')
    {
     target.value[key] = new_value;
     target.changes ++;
     return true;
    }
   
    return false;
   }
  });
  
  proxy.toString = x => String(target.v);
  proxy.valueOf = x => target.v;
  proxy.__v = value;
  
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
  
  if (ignore_spaces)
  {
   pattern = pattern.replace(/\s+/g, '\\s*')
                    .replaceAll('/', 's+');
  }
  
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
  
  // try {
   ruin_script = new Function(code);
  /*} catch (e) {
   const err = new $.RuinError(e, {
    offset: __line_offset__,
    kind: 'evaluation',
    sourceUrl,
   });
   
   console.error(err.represent());
  }*/
  
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
   $.create_macro('#tpiler-passes $1;', num => `// Maximum Transpiler Passes: ${max_passes = Number(num)};`),
   $.create_macro('#tpiler-applymacs $1;', bool => {
    apply_macs = bool.trim().toLowerCase() == 'true';
    return `// Transpiler Applies Macros: ${apply_macs};`;
   }),
  ], 5);
  
  const map = [
   ['structure ( $1 :: {$2', (name, body) => `RUIN.struct('${name}', {${body}`, true],
   ['enum ( $1 :: $2', (name, body) => `RUIN.TYPE('${name}', ${body}`, true],
   
   ['import $1 from $2;', (a, b) => `const ${a} = await meta.mod \`${b}\`;`],
   ['import: $1 from $2;', (a, b) => `const ${a} = module.import_ \`${b}\`;`],
   ['import: $1;', (a, b) => `const ${a} = module.import_ \`library\`;`],
   
   ['export: $1 as $2;', (a, b) => `module.exports[${b}.name] = ${a};`],
   ['export: $1;', a => `module.exports[${a}._name ?? ${a}.name] = ${a};`],
   
   ['pipe $1!', pipe => {
    const steps = pipe.split('>>').map(step => step.trim())
                                  .filter(Boolean);
    pipe = steps.shift();
    
    for (let step of steps)
    pipe = `${step}(${pipe})`;
    
    return pipe;
   }],
  ];
  
  "Create macros";
  const map_fn = args => $.create_macro(...args);
  macros.unshift(...map.filter(multi_line).map(map_fn));
  
  const line_macs = map.filter(m => !multi_line(m)).map(map_fn);
  line_macs.push($.__typed_declaration_macro__);
  
  function multi_line(m) {
   return m[0].includes('{');
  }
  
  const indent = '    ';
  if (apply_macs)
  {
   "Apply multi_line macros";
   code = $.apply_macros(code, macros, max_passes);
   
   "Add indentation and apply single line macros";
   code = code.split('\n')
              .map(ln => indent +$.apply_macros(ln, line_macs, max_passes))
              .join('\n')
              .replaceAll('def ', 'this.');
  } else {
   "Add indentation only";
   code = code.split('\n')
              .map(ln => indent +ln)
              .join('\n');
  }
  
  "Wrap The code in the ruin context";
  code = ` //# sourceURL=${url}.js
 return (async() => {
  // try {
   with(this) {
    RUIN._currentCtx_ = this;
    
    // sof;
${code}
    // eof;
   }
  /*} catch (e) {
   const err = new this.RuinError(e, {
    sourceUrl: '${url}',
    offset: this.__line_offset__,
    kind: 'runtime',
   });
   
   console.error(err.represent());
  }*/
 })();`;
  
  return { code, url };
 },
 
 range(a, b, c) {
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
 
 struct(_name, { __ext_name__, __relations__ = {}, __destination__, ...prototype } = {}) {  
  const ctx = $._currentCtx_;
  const config = { extension_types: {}, parent: null };
  
  const obj = typeof __destination__ == 'object' ? __destination__ : ($.setup_phase == true ? $.RUIN : ctx);
  const [name, _type] = _name.split(':').map(t => t.trim());
  
  const _find = name => ({ ...$.RUIN, ...ctx, ...obj })[name];
  function CONSTRUCTOR(...args) {
   const t = this;
   const secrets = {};
   
   const func = f => (f && typeof f == 'function' ? f : null);
   function apply(objA, objB, key) {
    if (func(objB[key]))
    {
     objA[key] = function(...args) {
      const proxy = new Proxy(t, {
       get(target, key) {
        if (key == 'self') return target;
        if (typeof key == 'string' && key.startsWith('$')) return secrets[key];
        return target[key];
       },
       
       set(target, key, value) {
        if (typeof key == 'string' && key.startsWith('$')) return secrets[key] = value;
        return target[key] = value;
       },
       
       has(target, key) {
        return key in target || key in secrets;
       },
      });
      
      return objB[key].bind(proxy)(proxy, ...args);
     };
     
     objA[key].original = objB[key];
    } else objA[key] = objB[key];
   };
   
   function set(obj, override = true) {
    for (let key in obj)
    {
     if (key.startsWith('$')) apply(secrets, obj, key);
     else apply(t, obj, key);
    }
   };
   
   const struct = config.parent;
   if (struct)
   {
    const instance = new struct('*bypass init*');
    set(instance, false);
    
    set({
     parent: struct,
     $init(...args) {
      const __init__ = (func(instance.__init__ ) ?? func(instance.construct)).original;
      return __init__.bind(this)(...args);
     },
    })
   }

   set(prototype);
   set({
    $relations: __relations__,
    $constructor: constructor,
    $setdata: set,
    $args: args,
    name,
    
    $extend(type) {
     console.log({ type, config });
     const struct = config.extension_types[type];
     const instance = new struct('*bypass init*');
     set(instance, false);
     
     set({
      extension: struct,
      $init(...args) {
       const __init__ = (func(instance.__init__ ) ?? func(instance.construct)).original;
       return __init__.bind(this)(...args);
      },
     })
    },
   });
   
   const __init__ = func(this.__init__) ?? func(this.construct);
   if (args[0] != '*bypass init*' && __init__)
   {
    const result = __init__(...args);
    if (result != undefined) return result;
   }
  };
  
  const constructor = (new Function(`with(this) return ${CONSTRUCTOR.toString().replace('CONSTRUCTOR', name)}`)).call({
   __relations__,
   prototype,
   config,
   name,
  })
  
  constructor.__is_structure__ = true;
  constructor.static_values = {};
  const __prototype__ = {};
  
  const options = {
   parent(struct) {
    if (typeof struct != 'function' || !struct.__is_structure__) throw new Error(`${struct} is not a structure, ergo it cannot be a parent`);
    config.parent = struct;
    
    constructor.prototype = { ...struct.prototype };
    for (let key in struct.static_values)
    {
     constructor.static_values[key] = struct.static_values[key];
     constructor[key] = struct.static_values[key];
    }
   },
   
   extensions(struct, ext_name) {
    if (typeof struct != 'function' || !struct.__is_structure__) throw new Error(`${struct} is not a structure, ergo it cannot be a parent`);
    config.extension_types[ext_name ?? struct.__ext_name__] = struct; console.log({ struct, config });
   },
  };
 
  for (let key in __relations__)
  {
   const f = options[key];
   const relatives = __relations__[key];
   
   if (typeof f == 'function')
   {
    if (Array.isArray(relatives)) for (let relative of relatives) f(relative);
    else if (typeof relatives == 'object') for (let key in relatives) f(relatives[key], key);
    else f(relatives);
   }
  }
  
  constructor.__ext_name__ = __ext_name__ ?? name;
  constructor.__name__ = name;
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
    } else {
     constructor.static_values[key] = property;
     constructor[key] = property;
    }
   }
  }
  
  if (_type?.toLowerCase?.() == 'static') return obj[name] = new constructor();
  if (_type?.toLowerCase?.() == 'return') return constructor;
  return obj[name] = constructor;
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
 __init__(self) {
  self.$tokens = {};
  self.$token = '';
  
  self.url = '';
  self.repository = '';
  self.subdir = '';
  self.owner = '';
 },
 
 repo(self, owner, name, subdirectory) {
  const path = subdirectory ? subdirectory +'/' : '';
  self.url = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
  
  self.subdir = subdirectory;
  self.repository = name;
  self.owner = owner;
 },
 
 token(self, token, id) {
  self.$token = token;
  self.$tokens[id] = id ? token : null;
 },
 
 get(self, path) {
  return new Promise(async resolve => {
   try {
    const response = await fetch(self.url +path, { headers: { Authorization: self.auth() } });
    if (!response.ok) throw `Failed to fetch: ${response.status}`;
    const data = await response.json();
  
    resolve(data);
   } catch(e) {
    throw `Failed to fetch: '${path}'`;
    resolve({});
   }
  })
 },
 
 isBase64(self, str) {
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
  return self.$token ? `Bearer ${self.$token}` : undefined;
 },
 
 dir(self, path) {
  return new Promise(async resolve => {
   try {
    const config = { headers: { Authorization: self.auth() } };
    const directories = {};
    const files = {};
    
    const response = await fetch(self.url +path, config);
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
      } else directories[item.name] = await self.dir(item.path);
     }
    };
    
    resolve({ directories, files, path });
   } catch(e) {
    throw `Failed to fetch: '${path}'`;
    resolve({});
   }
  })
 },
 
 importScript(self, url) {
  return new Promise(async resolve => {
   self.url = url;
   const data = await self.read('');
   const result = await $.ruin(data.content);
   
   self.repo(self.owner, self.repository, self.subdir);
   resolve(result);
  })
 },
 
 read(self, path) {
  return new Promise(async resolve => {
   try {
    const url = self.url +path;
    const response = await fetch(url, {
     headers: {
      Authorization: self.auth(),
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
    
    if (self.isBase64(data.content)) data.content = decodeURIComponent(escape(atob(data.content)));
    resolve(data);
   } catch(e) {
    throw `Failed to read: '${path}'`;
    resolve({});
   }
  })
 },
 
 write(self, path, content, create = false) {
  return new Promise(async resolve => {
   try {
    const sha = create ? null : (await self.get(path)).sha;
    const url = self.url +path;
    const body = {
     message: 'Update file via API',
     content: btoa(unescape(encodeURIComponent(content))),
     ...(sha ? (sha && { sha }) : {}),
    };
  
    const res = await fetch(url, {
     method: 'PUT',
     headers: {
      Authorization: self.auth(),
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
 
 delete(self, path) {
  return new Promise(async resolve => {
   try {
    const sha = (await self.get(path)).sha;
    const url = self.url +path;
    const body = {
     message: 'Delete file via API',
     sha,
    };
  
    const res = await fetch(url, {
     method: 'DELETE',
     headers: {
      Authorization: self.auth(),
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
 __init__(self) {
  self.$enc = new TextEncoder();
  self.$dec = new TextDecoder();
 },
 
 toBase64(self, buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  
  for (let i = 0; i < bytes.length; i ++)
  binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
 },
 
 fromBase64(self, b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i ++)
  bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
 },
 
 async $deriveKey(self, passphrase, salt, iterations = 150_000) {
  const encoded = self.$enc.encode(passphrase);
  const baseKey = await crypto.subtle.importKey('raw', encoded, { name: 'PBKDF2' }, false, ['deriveKey']);

  return crypto.subtle.deriveKey(...[
   { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, baseKey,
   { name: 'AES-GCM', length: 256 }, false,
   ['encrypt', 'decrypt'],
  ]);
 },
 
 async encrypt(self, txt, passphrase, comp = false) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  txt = comp ? txt.compress() : txt;

  const key = await self.$deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, self.$enc.encode(txt));
  
  const s = self.toBase64(salt.buffer);
  const i = self.toBase64(iv.buffer);
  const c = self.toBase64(ciphertext);
  
  const payload = {
   s: comp ? s.compress() : s,
   i: comp ? i.compress() : i,
   c: comp ? c.compress() : c,
   v: 1,
  };

  return JSON.stringify(payload);
 },

 async decrypt(self, payloadJson, passphrase, decomp = false) {
  const payload = JSON.parse(payloadJson);
  if (decomp)
  {
   payload.s = payload.s.decompress();
   payload.i = payload.i.decompress();
   payload.c = payload.c.decompress();
  }
  
  const salt = new Uint8Array(self.fromBase64(payload.s));
  const iv = new Uint8Array(self.fromBase64(payload.i));
  
  const ciphertext = self.fromBase64(payload.c);
  const key = await self.$deriveKey(passphrase, salt);
  
  try {
   const plaintextBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
   const decoded = self.$dec.decode(plaintextBuf);
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