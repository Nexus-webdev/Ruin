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

const $ = ({
 _TYPES_: [],
 scramble(txt, key) {
  if (!key || typeof key != 'number') return txt;

  return [...txt].map((char, i) => {
   const code = txt.charCodeAt(i);
   return String.fromCharCode(code +key);
  }).join('');
 },
 
 fixSyntax(code) {
  "Replace special keywords with js syntax";
  let fixedCode = code.replace(/def /g, 'this.')
                  .replaceAll(' err ', ' throw ')
                  .replaceAll('wait for\`', 'await for_ \`')
                  .replaceAll('wait for \`', 'await for_ \`')
                  .replaceAll('import\`', '= module.import_\`')
                  .replaceAll('import \`', '= module.import_ \`')
                  .replaceAll('## ', 'await foxx.run(`\n')
                  .replaceAll('!;', '\n`);');
  
  for (let type of $._TYPES_)
  fixedCode = fixedCode.replaceAll(`$${type}`, `this._VAR_TYPE_CONTROL_.${type}.`);
  
  return fixedCode;
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
 
 setup_phase: true,
 ruin(encodedText = ``, $args = { nothin: null }) {
  return new Promise(async resolve => {
   const i = encodedText.lastIndexOf('¿');
   let [txt, key] = [encodedText.slice(0, i), encodedText.slice(i +1)];
   if (i == -1)
   {
    txt = encodedText;
    key = null;
   }
   
   const result = await (new Function(`return(async() => {\n${fix(txt)}\n})()`)).call({
    ...$args,
    $args,
    ...$,
   });
   
   function fix(code) {
    code = $.fixSyntax(key ? decode(code) : code);
    if (!code.startsWith('"Exclude \'with\' statement.";')) code = `with(this) {\n${code}\n}`;
    
    return code;
   }
   
   function decode(txt) {
    const { repairedKey, scrambled } = repair(key);
    const shift = -$.TxtToNum(repairedKey);
    let code = $.shift(txt, shift);
    
    return scrambled ? $.scramble(code, shift) : code;
   }
   
   function repair(key) {
    let scrambled = false;
    if (key.endsWith('*')) ([key, scrambled] = [key.slice(-1), true]);
    
    const repairedKey = $.shift(key, -Math.ceil(key.length /2));
    return { repairedKey, scrambled };
   }
   
   resolve(result);
   $.setup_phase = false;
  })
 },
 
 _: undefined,
 RUIN: new Proxy(this, {
  get(_, property) {
   return $[property];
  },
  
  set(_, property, value) {
   _[property] = value;
   return $[property] = value;
  },
 }),
 
 struct(name, { relationships = [], destinationObject = $.RUIN, _this, overrideModule, ...prototype } = {}) {
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
  const arg = data(0);
  
  function data(i, str = name) {
   const result = str.split(':')[i]?.trim();
   return result;
  }

  function CONSTRUCTOR(...args) {
   const t = this;
   const types = {};
   const SYMBOL = Symbol('SYMBOLIDENTIFICATION - ' +Date.now());
   
   this[SYMBOL] = true;
   this.set = (obj, override = true) => {
    for (let key in obj)
    if (override || !this[key])
    this[key] = obj[key];
   };

   this.set(prototype);
   this.set({
    $relationships: relationships,
    $constructor: constructor,
    priv: x => x(),
    $args: args,
    
    $extension(type) {
     const _struct = types[type];
     this.parent = _struct;
     
     this.$uper = (...args) => {
      delete this.$uper;
      return _struct.construct.bind(this)(...args);
     };
     
     t.set(_struct, false);
     delete this.$extension;
    },
    
    $addRelationship({ name, object = obj, type = 'parent' } = {}) {
     const structs = {};
     if (typeof name == 'string') opt(type?.trim()?.toLowerCase(), options)(this, name, object, structs);
     
     this.set(structs);
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
      
      const construct = instance.construct;
      if (typeof construct == 'function') construct(...args);
      
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
  
   for (let member of relationships) opt(data(1, member)?.toLowerCase(), options)(data(0, member), obj, structs);
   this.set(structs);
   this.name = arg;
   
   if (args[0] != '⌀' && this.construct)
   this.construct(...args);
   
   return new Proxy(this, {
    get(target, prop, receiver) {
     if (typeof prop == 'string' && prop.startsWith('$'))
     return receiver[SYMBOL] == true ? target[prop] : undefined;
     
     return target[prop];
    },
    
    set(target, prop, value, receiver) {
     if (typeof prop == 'string' && prop.startsWith('$'))
     {
      if (receiver[SYMBOL] == true)
      target[prop] = value;
      return true;
     };
     
     return target[prop] = value;
    }
   });
  };
  
  const constructor = (new Function(`with(this) return ${CONSTRUCTOR.toString().replace('CONSTRUCTOR', arg)}`)).call({
   relationships, arg,
   destinationObject,
   _this, data, obj,
   
   overrideModule,
   ruinContext,
   prototype,
  })

  constructor._name = arg;
  if (prototype.static)
  {
   constructor.static = prototype.static;
   for (let key in prototype.static) constructor[key] = prototype.static[key];
  }
  
  if (name == '⌁' || name == '$.meta') return constructor;
  if (obj[data(0)]) return;
  
  opt(data(1)?.toLowerCase(), {
   default: x => {
    obj[arg] = constructor;
   },
   
   static() {
    obj[arg] = new constructor();
   },
  })();
 },

 uniqueString(base = 36, range = [2, 10]) {
  return Date.now().toString(base);
 },

 weigh(weights) {
  const pool = [];
  for (let [value, weight] of weights)
  for (let i = 0; i < weight; i++)
  pool.push([value, weight]);
  
  const item = pool[Math.floor (Math.random () *pool.length)];
  return {
   value: item[0],
   weight: item[1],
   pool,
  };
 },

 shift(txt, shift, ignore = ['$']) {
  const regex = new RegExp(`[a-zA-Z](?![${ignore.map(symbol => `\\${symbol}`).join('|')}])`, 'g');

  return txt.replace(regex, c => {
   const base = c < 'a' ? 65 : 97;
   return String.fromCharCode(((c.charCodeAt(0) -base +((shift %26) +26) %26) %26) +base);
  });
 },

 console: undefined,
 terminal: console,
 def: {},
 dp: {},

 enable: {
  auto: {
   reload() {
    $.autoReload = true;
    return $.enable.auto;
   },
  },
 },

 App: {
  name: 'MyApp',
  as: '_blank',
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
 construct() {
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

self.bootstrapper = new Promise(async resolve => {
 const url = 'https://nexus-webdev.github.io/Ruin/bootstrapper.$';
 const response = await fetch(url);
 
 if (!response.ok) throw `Failed to read: ${response.status}`;
 let code = await response.text();
 
 if ($.GitHub.isBase64(code))
 code = decodeURIComponent(escape(atob(code)));
 
 const result = await $.ruin(code);
 resolve(result);
})