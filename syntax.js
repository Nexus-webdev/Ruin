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

let $ = {
 fixSyntax(code) {
  "Replace special keywords with js syntax";
  let fixedCode = code.replace(/def /g, 'this.')
                  .replaceAll(' err ', ' throw ')
                  .replaceAll('wait for\`', 'await for_ \`')
                  .replaceAll('wait for \`', 'await for_ \`')
                  .replaceAll('import\`', '= module.import_\`')
                  .replaceAll('import \`', '= module.import_ \`')
                  .replaceAll('## ', 'await foxx.run(`')
                  .replaceAll('!;', '`);');
  
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
 
 setup_phase: false,
 ruin(encodedText = ``, $args = { nothin: null }) {
  const [txt, key = ''] = encodedText.split('¿');
  function fix(code) {
   code = $.fixSyntax(decode(code));
   if (!code.startsWith('"Exclude \'with\' statement.";')) code = `with(this) {\n${code}\n}`;
   
   return code;
  }
  
  function decode(txt) {
   let code = $.shift(txt, -$.TxtToNum(repair(key)));
   return code;
  }
  
  function repair(key) {
   const repairedKey = $.shift(key, -Math.ceil(key.length /2));
   return repairedKey;
  }
  
  return new Promise(async resolve => {
   const result = await(new Function(`
    return(async() => {
 ${fix(txt)}
    })();
   `)).call({ ...$args, $args, ...$ });
   
   resolve(result);
   $.setup_phase = true;
  })
 },
 
 _: undefined,
 RUIN: new Proxy({}, {
  get(_, property) {
   return $[property];
  },
  
  set(_, property, value) {
   return $[property] = value;
  },
 }),
 
 struct(name, { relationships = [], destinationObject = this, _this, overrideModule, ...prototype } = {}) {
  if (_this)
  {
   overrideModule = true;
   destinationObject = _this;
  }
  
  const ruinContext = { ...this };
  const Obj = this.module && !overrideModule ? this.module.exports : destinationObject;
  const obj = $.setup_phase == true ? $ : Obj;
  const staticValues = {};
  const arg = prep(0);
  
  function prep(i, lw = false, str = name) {
   const result = str.split(':')[i]?.trim();
   if (lw == true) return result?.toLowerCase();
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
     if (typeof name == 'string' && $.$) $.$.opt(type.trim().toLowerCase(), options)(this, name, object, structs);
     
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
      instance[arg.toLowerCase()] = t;
      
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
  
   for (let member of relationships) $.$.opt(prep(1, true, member), options)(prep(0, false, member), obj, structs);
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
   _this, prep, obj,
   
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
  
  if (name == '⌁' || name == '$^$') return constructor;
  if (obj[prep(0)]) return;
  
  $.$.opt(prep(1, true), {
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
  const item = pool[Math.floor (Math.random () * pool.length)];
  return [
   item [0],
   item [1],
   pool,
  ];
 },

 shift(txt, shift, ignore = ['$']) {
  const regex = new RegExp(`[a-zA-Z](?![${ignore.map(symbol => `\\${symbol}`).join('|')}])`, 'g');

  return txt.replace(regex, c => {
   const base = c < 'a' ? 65 : 97;
   return String.fromCharCode(((c.charCodeAt(0) -base +((shift %26) +26) %26) %26) +base);
  });
 },

 console: undefined,
 Math: undefined,
 
 math: new Proxy({
  pi: Math.PI,
  fade(t) {
   return t *t *t *(t *(t *6 -15) +10);
  },
  
  lerp(a, b, scale = .2) {
   return a +(b -a) *scale;
  },
  
  sigmoid(x) {
   return 1 /(1 +Math.exp(-x));
  },
  
  stableSigmoid(x) {
   if (x >= 0)
   {
    const z = Math.exp(-x);
    return 1 /(1 +z);
   }
   
   const z = Math.exp(x);
   return z /(1 +z);
  },
  
  pointAtAngle(origin, angle, magnitude = 1) {
   return {
    x: origin.x +Math.cos(angle) *magnitude,
    y: origin.y +Math.sin(angle) *magnitude,
   };
  },

  getIntersection(a, b, c, d) {
   const tTop = (d.x -c.x) *(a.y -c.y) -(d.y -c.y) *(a.x -c.x);
   const uTop = (c.y -a.y) *(a.x -b.x) -(c.x -a.x) *(a.y -b.y);
   const bottom = (d.y -c.y) *(b.x -a.x) -(d.x -c.x) *(b.y -a.y);
 
   if (bottom != 0)
   {
    const t = tTop /bottom;
    const u = uTop /bottom;
  
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return {
     x: this.lerp(a.x, b.x, t),
     y: this.lerp(a.y, b.y, t),
     offset: t,
    };
   }
 
   return;
  },

  polysIntersect(a, b) {
   for (let i = 0; i < a.length; i ++)
   {
    for (let j = 0; j < b.length; j ++)
    {
     const touch = this.getIntersection(a[i], a[(i +1) % a.length], b[j], b[(j +1) % b.length]);
     if (touch) return true;
    }
   }
 
   return false;
  },
  
  getRectLines(rect) {
   return [
    {
     start: { x: rect.x, y: rect.y },
     end: { x: rect.x +rect.width, y: rect.y },
    },
    
    {
     start: { x: rect.x +rect.width, y: rect.y },
     end: { x: rect.x +rect.width, y: rect.y +rect.height },
    },
    
    {
     start: { x: rect.x +rect.width, y: rect.y +rect.height },
     end: { x: rect.x, y: rect.y +rect.height },
    },
    
    {
     start: { x: rect.x, y: rect.y +rect.height },
     end: { x: rect.x, y: rect.y },
    },
   ];
  },
  
  direction(p1, p2, p3) {
   return (p3.y -p1.y) *(p2.x -p1.x) -(p3.x -p1.x) *(p2.y -p1.y);
  },
  
  lineRectCollision(rect, start, end) {
   const lines = this.getRectLines(rect);
   return lines.some(line => this.lineLineCollision(start, end, line.start, line.end));
  },
  
  lineLineCollision(p1, p2, p3, p4) {
   const d1 = this.direction(p3, p4, p1);
   const d2 = this.direction(p3, p4, p2);
   const d3 = this.direction(p1, p2, p3);
   const d4 = this.direction(p1, p2, p4);
   
   return (d1 !== d2 && d3 !== d4) || 
          (d1 === 0 && this.point.onSegment(p1, p3, p4)) || 
          (d2 === 0 && this.point.onSegment(p2, p3, p4)) || 
          (d3 === 0 && this.point.onSegment(p3, p1, p2)) || 
          (d4 === 0 && this.point.onSegment(p4, p1, p2));
  },
  
  within(num, num2, range) {
   return Math.abs(num -num2) <= range;
  },

  dist(num, num2) {
   return Math.abs(num - num2);
  },

  collision(rect1, rect2) {
   const { x: x1, y: y1, width: width1, height: height1 } = rect1;
   const { x: x2, y: y2, width: width2, height: height2 } = rect2;

   return (x1 < x2 +width2 &&
       x1 +width1 > x2 &&
       y1 < y2 +height2 &&
       y1 +height1 > y2);
  },

  absolute(num) {
   return Math.abs(num);
  },

  bitwise: {
   xor(args) {
    return args.reduce((accumulator, current) => accumulator ^ current);
   },

   and(args) {
    return args.reduce((accumulator, current) => accumulator & current);
   },

   or(args) {
    return args.reduce((accumulator, current) => accumulator | current);
   },
  },

  binary(num, revert = false) {
   if (revert) return parseInt(num, 2);
   return num.toString(2);
  },

  ran(min, max) {
   return Math.floor(Math.random() *(max -min +1)) +min;
  },

  rand(min, max) {
   return Math.random() *(max -min +1) +min;
  },

  percent(num, per) {
   return (num /100) *per;
  },

  percentOf(part, total) {
   if (total == 0) return 'Undefined (total cannot be zero)';
   return (part /total) *100;
  },

  remainder(num, num2) {
   return (num -(Math.floor(num /num2) *num2));
  },
 }, {
  get(target, property) {
   return target[property] ?? Math[property];
  },
 }),
 
 terminal: console,
 def: {},
 dp: {},
 
 service(callback) {
  self.onmessage = e => callback(e);
 },
 
 for_([string]) {
  let unitOfTime = '';
  let number = '';
  
  const units = {
   ms: 1,
   s: 1000,
   mins: 60000,
   hrs: 3600000,
   
   default: 1,
  }
  
  string.split('').map(char => {
   if (char == '.' || char == ',' || char == '0' || Number(char)) number += char;
   else if (char != '-') unitOfTime += char;
  })
  
  const time = Number(number) *$.$.opt(unitOfTime, units);
  return new Promise(resolve => {
   setTimeout(x => resolve(time), time);
  });
 },

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
 
 ROBJ: class {
  constructor(id, content) {
   $.rdnFiles.hire(id, (e, post) => {
    const data = (new Function(`with(this) return ${e.data[0] ? e.data[0].key : 'this'}`)).call(e.data[1]);
    post(data);
   }, $.assess(content.trim().replace(/#/g, '//')));
  }
 },

 configure({ application, description, title, projects = [] } = {}) {
  $.enable.auto.reload();
  if (typeof application === 'object') $.App = {
   ...$.App,
   ...application,
  };

  $.projects.push(...projects);
  document.title = title ?? document.title ?? $.App.name;
  if ($.App.data) $.foxx.run(`app -i ('${$.App.data}');`);
  
  if (description)
  {
   const metaDescription = document.querySelector(`meta[name="description"]`);
   metaDescription.setAttribute('content', description);
  }
 },

 $: new Proxy({
  inModule: false,
  stringify: {
   ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
   },
   
   ToHex(r, g, b, a) {
    const toHex = value => {
     const hex = Math.round(value).toString(16);
     return hex.padStart(2, '0');
    };
    
    const rHex = toHex(r);
    const gHex = toHex(g);
    const bHex = toHex(b);
    const aHex = toHex(a *255);
    
    return `#${rHex}${gHex}${bHex}${aHex}`;
   },
   
   ToBinary(str) { 
    return str.split('').map(char => char.charCodeAt(0).toString(2).padStart(8, '0')).join('.');
   },
   
   fn(fn) {
    return fn.toString();
   },
   
   obj(obj, options = {}) {
    return JSON.stringify(obj, (key, value) => {
     return $.$.opt(typeof value, {
      ...options,
      'function': value?.toString()?.replace('function ', ' '),
      default: value,
     });
    })
   },
  },

  parse: {
   base64(base64) {
    return decodeURIComponent(escape(atob(base64)));
   },
   
   hex(hex) {
    hex = hex.slice(1, 8);
    let r, g, b, a = 1;
    
    r = parseInt(hex.slice(0, 2), 16);
    g = parseInt(hex.slice(2, 4), 16);
    b = parseInt(hex.slice(4, 6), 16);
    a = parseInt(hex.slice(6), 16) /255;
   
    return `rgba(${r}, ${g}, ${b}, ${a})`;
   },
   
   binary(str) {
    if (str.split('').map(char => (char == '.' || char == '1' || char == '0')).includes(false)) return str;
    return str.split('.').map(bin => String.fromCharCode(parseInt(bin, 2))).join('');
   },
   
   fn(string) {
    return $.assess(string);
   },
   
   obj(str, fn) {
    const obj = JSON.parse(str, fn ? fn : (key, value) => {
     if (value?.includes?.('(') || value?.includes?.('=>')) return $.$.parse.fn(value);
     if (value?.includes?.('{')) return $.$.parse.obj(value, fn);
     
     return value;
    })

    return obj;
   },
  },

  pkg: [],
  otherFiles: {},
  modChildren: {},

  rdn(id) {
   let resolve;
   const promise = new Promise(_resolve => {
    resolve = _resolve;
   })

   $.rdnFiles.handle(id, (e, post) => {
    resolve({
     ...e.data,
     parse(key) {
      const arr = key.split('.');
      this[arr[arr.length -1]] = $.$.parse.fn((new Function('data', `return data?${key}`))(this).replace(arr[arr.length -1], 'function'));
     },
    });
   });

   $.rdnFiles.post(id);
   return promise;
  },

  worker(id, data) {
   return new Promise(resolve => {
    $.rdnFiles.handle(id.trim(), x => resolve(x.data));
    $.rdnFiles.post(id.trim(), data);
   })
  },

  opt(value, options = {}) {
   return options[value] ?? options.default;
  },

  async delModules(names = ['main']) {
   for (let name of names) await del(`Module - ${name}`);
  },

  self: new Proxy({}, {
   set(target, property, value) {
    $[property] = value;
   },

   get(target, property) {
    return $[property];
   },
  }),
 }, { 
  set(target, property, value) {
   target[property] = value;
  },
 
  get(target, property) {
   return target[property];
  }
 }),
 
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
};

$.struct('GitHub: static', {
 construct() {
  this.$tokens = {};
  this.$token = '';
  
  this.url = '';
  this.repository = '';
  this.owner = '';
 },
 
 repo(owner, name, subdirectory) {
  const path = subdirectory ? subdirectory +'/' : '';
  this.url = `https://api.github.com/repos/${owner}/${name}/contents/${path}`;
  
  this.repository = name;
  this.owner = owner;
 },
 
 token(token, id) {
  this.$tokens[id] = id ? (this.$token = token) : null;
 },
 
 get(path) {
  return new Promise(async resolve => {
   const response = await fetch(this.url +path, { headers: { Authorization: `Bearer ${this.$token}` } });
   if (!response.ok) throw `Failed to fetch: ${response.status}`;
   const data = await response.json();
 
   resolve(data);
  })
 },
 
 dir(path) {
  return new Promise(async resolve => {
   const config = { headers: { Authorization: `Bearer ${this.$token}` } };
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
   
   resolve({ directories, files });
  })
 },
 
 read(path) {
  return new Promise(async resolve => {
   const url = this.url +path;
   const response = await fetch(url, {
    headers: {
     Authorization: `Bearer ${this.$token}`,
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
 
 write(path, content, create = false) {
  return new Promise(async resolve => {
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
     Authorization: `Bearer ${this.$token}`,
     Accept: 'application/vnd.github.v3+json',
    },
    
    body: JSON.stringify(body),
   });
 
   if (!res.ok) throw `Failed to write: ${res.status}`;
   resolve(await res.json());
  })
 },
 
 delete(path) {
  return new Promise(async resolve => {
   const sha = (await this.get(path)).sha;
   const url = this.url +path;
   const body = {
    message: 'Delete file via API',
    sha,
   };
 
   const res = await fetch(url, {
    method: 'DELETE',
    headers: {
     Authorization: `Bearer ${this.$token}`,
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
  })
 },
})

const data = new Promise(async resolve => {
 const url = 'https://nexus-webdev.github.io/Ruin/syntax.$';
 const response = await fetch(url);
 
 if (!response.ok) throw `Failed to read: ${response.status}`;
 const content = await response.text();
 
 const data = content.trim().startsWith('{') && content.trim().endsWith('}') ? JSON.parse(content) : {
  name: response.name,
  type: response.type,
  url: response.url,
  path: response.path,
  content,
 };
 
 if ($.GitHub.isBase64(data.content)) data.content = decodeURIComponent(escape(atob(data.content)));
 resolve(data);
})

$.ruin(data.content);