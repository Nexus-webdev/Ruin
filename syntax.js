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

 ruin(encodedText = ``, $args = { nothin: null }) {
  const [txt, key = ''] = encodedText.split('¿');
  function fix(code) {
   code = $.fixSyntax(decode(code));
   if (!code.includes('"Exclude \'with\' statement.";')) code = `    with(this) {\n    ${code}\n    }`;
   
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
  
  return (new Function(`
   return(async() => {
${fix(txt)}
   })();
  `)).call({ ...$args, $args, ...$ });
 },
 
 _: undefined,
 struct(name, { relationships = [], destinationObject = this, _this, overrideModule, ...prototype } = {}) {
  if (_this)
  {
   overrideModule = true;
   destinationObject = _this;
  }
  
  const ruinContext = this;
  const obj = this.module && !overrideModule ? this.module.exports : destinationObject;
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
   const privates = new WeakMap();

   const _private = {
    $relationships: relationships,
    $constructor: constructor,
    $args: args,
    
    $extension(type) {
     const _struct = types[type];
     this.parent = _struct;
     
     this.$uper = (...args) => {
      delete this.$uper;
      return _struct.construct.bind(this)(...args);
     };
     
     for (let key of Object.keys(_struct))
     {
      if (this[key] == undefined)
      this[key] = _struct[key];
     }
     
     delete this.$extension;
    },
    
    $addRelationship({ name, object = obj, type = 'parent' } = {}) {
     const structs = {};
     if (typeof name == 'string' && $.$) $.$.opt(type.trim().toLowerCase(), options)(this, name, object, structs);
     
     this.set(structs);
    },
   };
   
   this.set = (obj, override = true) => {
    for (let key in obj)
    if (override || !this[key])
    this[key] = obj[key];
   };

   for (let key in prototype)
   {
    const value = prototype[key];
    const _obj = key.startsWith('$') ? _private : this;
_obj[key] = value;
   }
   
   function privatize(t) {
    for (let key in t)
    {
     if (key.startsWith('$'))
     {
      const value = t[key];
      delete t[key];
      
      _private[key] = value;
     }
    };
   }
   
   this.priv = x => x();
   const structs = {};
   const contractExists = _private.$contract && _private.$contract.length > 0;
   
   const options = {
    default: x => x,
    parent(name, obj, structs) {
     const Obj = obj[name] ? obj : ruinContext;
     if (!Obj[name]) throw `structure '${arg}' cannot receive Inheritance from Non-Existant Parent structure '${name}';`;
     if (typeof structs.parent == 'string') throw `structure '${arg}' attempted to exceed the max amount of Parent structures (1);`

     const _parent = new Obj[name]('⌀');
     structs.parent = _parent;
     _private.$uper = (...args) => {
      delete this.$uper;
      return _parent.construct.bind(t)(...args);
     };
     
     const contract = (contractExists ? _private.$contract : Object.keys(_parent)).filter(key => !(['construct', 'constructor']).includes(key));
     
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

   privates.set(this, _private);
   const proxy = new Proxy(this, {
    get(target, prop, receiver) {
     const p = privates.get(target);
     if (prop in p) return p[prop];
     
     return Reflect.get(target, prop, receiver);
    },
    
    set(target, prop, value, receiver) {
     const p = privates.get(target);
     if (prop in p) { p[prop] = value; return true; };
     
     return Reflect.set(target, prop, value, receiver);
    }
   });

   
   if (args[0] != '⌀' && proxy.construct) proxy.construct(...args);
   return proxy;
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

  obj[arg] = constructor;
  if ($.$) $.$.opt(prep(1, true), {
   default: x => x,
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
   const obj = $?.$?.returns ?? [];
   if (!obj.includes('math')) obj.push('math');
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
  returns: 'returns',
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
  
  returns: [
   'render',
   'session',
   'ruin',
   'cache',
   'foxx',
   'echo',
   'json',
   'math',
   'log',
   'def',
   'get',
   'del',
   'set',
   '$',
  ],
 }, { 
  set(target, property, value) {
   target[property] = value;
  },
 
  get(target, property) {
   return target[property];
  }
 }),
 
 getRGBA(value) {
  const alpha = Math.abs(value);
  const R = value < 0 ? 0 : 255;
  const G = R;
  const B = value > 0 ? 0 : 255;
  
  return `rgba(${R}, ${G}, ${B}, ${alpha})`;
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
};

const { Q, $: { opt, parse } } = $;
$.struct('Interpreter', {
 construct(...args) {
  let callback = args.pop();
  if (typeof callback != 'function')
  callback = (breakOn = ';', syntax = {}) => ({ syntax, breakOn });
  
  const { run, execute, syntax, breakOn, other = {} } = callback(...args, this);
  if (typeof run == 'function')
   this.run = run;
  
  if (typeof execute == 'function')
   this.execute = execute;
  
  if (syntax) this.syntax = syntax;
  if (breakOn) this.breakOn = breakOn.trim();
  for (let key in other)
   if (this[key] == undefined)
    this[key] = other[key];
 },
 
 run(code) {
  const statements = code.split(this.breakOn);
  let i = 0;
  
  for (let _statement of statements)
  {
   const [command, ...characters] = _statement.trim().split(' ');
   const statement = characters.join(' ');
   this.execute(command.trim(), statement, _statement, characters, i);
   i ++;
  }
 },
 
 execute(command, statement, { _statement, chars, line }) {
  const property = this.syntax[command];
  
  if (property)
  {
   if (typeof property == 'function') property(statement, { syntax: this.syntax, chars });
  }
  else if (command != '') throw new Error(`Invalid Keyword: ${command}; @statement: ${_statement}; @line: ${line}`);
 },
})

Object.defineProperty($, '_', { writable: false, configurable: false });
$.ruin.compile = function(code, key = 'twkp') {
 const brokenKey = $.shift(key, Math.ceil(key.length /2));
 const encodedText = $.shift(code, $.TxtToNum(key));
 
 return `${encodedText}¿${brokenKey}`;
};

$.struct('Client', {
 construct(id, port = 800) {
  this.id = `CLIENT-${port}-${id ? id.trim() : $.uniqueString(22, [2, 22]) +'C'}`;
  this.handle = new Peer(this.id, {
   config: {
    iceServers: [
     { url: 'stun:stun.l.google.com:19302' },
     { url: 'stun:stun.l.google.com:5349' },
     { url: 'stun:stun1.l.google.com:3478' },
     { url: 'stun:stun1.l.google.com:5349' },
     { url: 'stun:stun2.l.google.com:19302' },
     { url: 'stun:stun2.l.google.com:5349' },
     { url: 'stun:stun3.l.google.com:3478' },
     { url: 'stun:stun3.l.google.com:5349' },
     { url: 'stun:stun4.l.google.com:19302' },
     { url: 'stun:stun4.l.google.com:5349' },
    ],
   }
  });
  
  this.opened = false;
  this.port = port;
  
  this.servers = {};
  this.handle.on('open', e => this.opened = true);
  this.handle.on('connection', server => {
   server.on('data', packet => {
    this.handle_response(packet, server);
   });
  });
 },
 
 handle_response(packet, server) {
  $.log('Response: ', packet);
 },
 
 req(serverId, packet = {}) {
  serverId = `SERVER-${this.port}-${serverId.trim()}`;
  if (this.servers[serverId])
  {
   const server = this.servers[serverId];
   server.send(packet);
   return;
  }
  
  const server = this.handle.connect(serverId);
  server.on('open', e => {
   server.send(packet);
   server.on('data', packet => {
    this.handle_response(packet, server);
   });
  });
  
  this.servers[serverId] = server;
 },
 
 open() {
  return new Promise(resolve => {
   this.handle.on('open', e => resolve(this.id));
   if (this.opened) resolve(this.id);
  });
 },
 
 close() {
  this.handle.destroy();
  delete this.handle, this.id, this.opened, this.open, this.close, this.on, this.req, this.servers, this.handle_response;
 },
 
 on(event, callback) {
  const prop = `handle_${event.toLowerCase().trim()}`;
  this[prop] = callback.bind(this);
 },
})

$.struct('Server', {
 construct(id, port = 800) {
  this.id = `SERVER-${port}-${id ? id.trim() : $.uniqueString(22, [2, 22]) +'S'}`;
  this.handle = new Peer(this.id, {
   config: {
    iceServers: [
     { url: 'stun:stun.l.google.com:19302' },
     { url: 'stun:stun.l.google.com:5349' },
     { url: 'stun:stun1.l.google.com:3478' },
     { url: 'stun:stun1.l.google.com:5349' },
     { url: 'stun:stun2.l.google.com:19302' },
     { url: 'stun:stun2.l.google.com:5349' },
     { url: 'stun:stun3.l.google.com:3478' },
     { url: 'stun:stun3.l.google.com:5349' },
     { url: 'stun:stun4.l.google.com:19302' },
     { url: 'stun:stun4.l.google.com:5349' },
    ],
   }
  });
  
  this.opened = false;
  this.port = port;
  
  this.handle.on('open', e => this.opened = true);
  this.handle.on('connection', client => {
   client.on('data', packet => {
    this.handle_request(packet, client);
   });
  });
 },
 
 open() {
  return new Promise(resolve => {
   this.handle.on('open', e => resolve(this.id));
   if (this.opened) resolve(this.id);
  });
 },
 
 handle_request(packet, client) {
  const response = { message: `Server received: '${packet.message}'` };
  client.send({ message: `Server received: '${packet.message}'` });
 },
 
 on(event, callback) {
  const prop = `handle_${event.toLowerCase().trim()}`;
  this[prop] = callback.bind(this);
 },
})

$.foxx = new $.Interpreter(e => {
 const { findBlock } = $;
 const scopes = [{ type: 'main', origin: {}, directory: null }];
 let runs = [];
 
 const table = {};
 const config = {
  maxDepth: 5,
  returnTo: null,
  createDirectories: true,
  
  webRTC: {
   config: {
    iceServers: [
     { url: 'stun:stun.l.google.com:19302' },
     { url: 'stun:stun.l.google.com:5349' },
     { url: 'stun:stun1.l.google.com:3478' },
     { url: 'stun:stun1.l.google.com:5349' },
     { url: 'stun:stun2.l.google.com:19302' },
     { url: 'stun:stun2.l.google.com:5349' },
     { url: 'stun:stun3.l.google.com:3478' },
     { url: 'stun:stun3.l.google.com:5349' },
     { url: 'stun:stun4.l.google.com:19302' },
     { url: 'stun:stun4.l.google.com:5349' },
    ],
   }
  },
 };
 
 let directory;
 let scope = scopes[0];
 const instances = {};
 let returns = [];
 
 const syntax = {
  '#': x => x,
  async config(statement) {
   const [identifier, value] = statement.replace('=', '#=').split('#=');
   returns.push(identifier.trim());
   const v = await get(value);
   
   scope._evaluated_ = v;
   (new Function(`with(this) { this.config.${identifier.trim()} = this._evaluated_; }`)).call({ config, ...scope });
   delete scope._evaluated_;
  },
  
  async print(statement) {
   const data = await get(statement);
   if (typeof data == 'string' || typeof data == 'number')
   console.log(`%c${data}`, 'color: orange; font-family: Footlight MT');
   else console.log(data);
  },
  
  async error(statement) {
   throw(await get(statement));
  },
  
  async let(statement) {
   let [identifier, value] = statement.replace('=', '#=').split('#=');
   returns.push(identifier.trim());
   value = await get(value);
   
   scope[identifier.trim()] = null;
   Object.defineProperty(scope, identifier.trim(), { value });
  },
  
  async const(statement, { error }) {
   let [identifier, value] = statement.replace('=', '#=').split('#=');
   returns.push(identifier.trim());
   value = await get(value);
   
   scope[identifier.trim()] = null;
   Object.defineProperty(scope, identifier.trim(), {
    get() {
     return value;
    },
    
    set() {
     error('Attempted to assign a value to a constant');
    },
   });
  },
  
  delete(statement) {
   (new Function(`with(this) { delete this.${statement}; }`)).call(scope);
  },
  
  async return(statement, { stop, current }) {
   const i = statement.lastIndexOf(' ? ');
   let [value, stopParent] = [i == -1 ? statement : statement.slice(0, i).trim(), i == -1 ? 'false' : statement.slice(i +3).trim()];
   stopParent = await get(stopParent);
   value = await get(value);
   (Array.isArray(config.returnTo) ? config.returnTo : returns).push(value);
   
   stop(current);
   if (stopParent && current.parent)
   stop(current.parent);
  },
  
  if(statement) {
   return new Promise(async resolve => {
    const i = statement.indexOf(' ? ');
    let [condition, body] = [statement.slice(0, i).trim(), statement.slice(i +3).trim()];
    
    condition = await get(`[${condition}]`);
    const i2 = body.indexOf('else',);
    const [_if, _else] = [findBlock(body.slice(0, i2) +' '), findBlock(body.slice(i2) +' ')];
    
    if (condition.find(c => !c) != undefined)
    {
     if (_else) await run(_else);
    } else await run(_if);
    resolve(1);
   })
  },
  
  async while(statement) {
   const i = statement.indexOf(' ? ');
   let [condition, body] = [statement.slice(0, i).trim(), statement.slice(i +3).trim()];
   const valid = x => get(condition);
   body = findBlock(body +' ');
   
   while(await valid()) await run(body);
  },
  
  switch(statement) {
   return new Promise(async resolve => {
    const i = statement.indexOf(' ? ');
    let [input, body, resolved] = [statement.slice(0, i).trim(), statement.slice(i +3).trim(), 0];
    input = await get(input);
    body = findBlock(body);
    
    const origin = scope;
    scope = {
     ...origin,
     input,
     origin,
     default: x => x,
     type: 'switch',
     case(statement_) {
      return new Promise(async resolve => {
       const i = statement_.indexOf(' ? ');
       let [condition, body_] = [statement_.slice(0, i).trim(), statement_.slice(i +3).trim()];
       condition = await get(condition);
       body_ = findBlock(body_ +' ');
       
       const useDefault = condition.trim().toLowerCase() == 'default' && !resolved;
       const conditionTrue = (typeof condition == 'boolean' && condition);
       if (!conditionTrue && (input != condition) && !useDefault)
       {
        resolve(1);
        return;
       }
       
       if (body_.trim().startsWith('~'))
       body_ = body_.replace('~', 'return ');
       
       await run(body_);
       resolved ++;
       resolve(1);
      })
     },
    };
    
    await run(body);
    scope = origin;
    resolve(1);
   })
  },
  
  async function(statement) {
   const i = statement.indexOf('(');
   const [name, body] = [statement.slice(0, i), statement.slice(i)];
   const params = findBlock(body, '(', ')', 'i').split(',');
   const block = findBlock(body);
   
   const func = (statement = '', _scope) => {
    return new Promise(async resolve => {
     const origin = scope;
     const args = await get(`[${statement}]`);
     const newScope = { ...origin, type: 'function', name, origin };
     
     for (let i = 0; i < params.length; i ++)
     {
      const [param, _default] = params[i].split('=');
      
      const arg = args[i];
      newScope[param.trim()] = arg != undefined ? arg : _default ? await get(_default, { ...origin, ...newScope, origin }) : undefined;
     }
     
     scopes.push({ ...origin, ...newScope, origin }); 
     scope = newScope;
     await run(block);
     
     scope = origin;
     resolve(1);
    })
   }
   
   func.code = `function ${statement}`;
   if (name) scope[name.trim()] = func;
   else returns.push(func);
  },
  
  help(statement) {
   const commands = statement.toLowerCase().trim().split(',');
   for (let command of commands)
   {
    opt(command, {
     
    })();
   }
  },
  
  convertTo: {
   rdn(name) {
    return new Promise(async resolve => {
     const text = await get(name);
     (new $.ROBJ(name, text));
     
     const rdn = await $.$.rdn(name);
     returns.push(rdn);
     resolve(1);
    });
   },
  },
  
  thread(statement) {
   if (!$.Thread) return(delete this.thread);
   return new Promise(async resolve => {
    const i = statement.indexOf(' ? ');
    let [name, body] = [statement.slice(0, i).trim(), statement.slice(i +3).trim()];
    const exe = executeable(findBlock(body));
    body = exe.stringify(', ');
    
    const thread = scope[name.trim()] = new $.Thread(`x => {
     // ${name.trim()}.fx;
     foxx.syntax.onecho = statement => {
      self.on('message', async e => {
       foxx.scope().echo = { value: e.data[0], type: typeof e.data[0] };
       await foxx.run(findBlock(statement));
       delete foxx.scope().echo;
      })
     };
     
     foxx.syntax.echo = async statement => {
      self.post(await foxx.get(statement));
     };
     
     foxx.syntax.close = async statement => {
      self.close();
     };
     
     foxx.exec([${body}]);
     self.post('ready');
    }`, name.trim() +'.thr');
    
    scope[name.trim()].onecho = statement => {
     thread.on('message', e => {
      scope.echo = { value: e.data[0], type: typeof e.data[0] };
      foxx.run(findBlock(statement)).then(x => (delete scope.echo));
     })
    };
    
    scope[name.trim()].echo = async statement => {
     thread.post(await get(statement));
    };
    
    scope[name.trim()].terminate = async statement => {
     thread.terminate();
    };
    
    thread.on('message', e => {
     if (e.data[0] == 'ready') resolve(1);
    });
   })
  },
  
  wait(statement) {
   const i = statement.indexOf(' ? ');
   if (i == -1) return $.for_([statement]);
   
   let [time, body] = [statement.slice(0, i).trim(), statement.slice(i +3).trim()];
   $.for_([time]).then(x => run(findBlock(body)));
  },
  
  '-db': name => {
   return new Promise(async resolve => {
    if (!directory)
    {
     throw `no directory set;`;
     reject(`no directory set;`);
    }
    
    name = await get(name);
    const i = Date.now();
    
    const filename = name +(!name.endsWith('.data') ? '.data' : '');
    const file = await directory.getFileHandle(filename.trim(), { create: true });
    
    scope[name.trim()] = {
     async TABLE(statement) {
      (new $.ROBJ(filename +i, await (await file.getFile()).text()));
      const table = await $.$.rdn(filename +i);
      
      const name = await get(statement.trim().split(' ')[0]);
      const func = findBlock(statement);
      if (table[name]) return;
      
      const og = scope;
      scope = { origin: og, db: table, ...(table[name] || {}) };
      await run(func);
      
      delete scope.origin;
      delete scope.db;
      const data = scope;
      
      table[name] = data;
      scope = og;
      save(table);
     },
     
     async ENTRY(statement) {
      (new $.ROBJ(filename +i, await (await file.getFile()).text()));
      const table = await $.$.rdn(filename +i);
      
      const name = await get(statement.trim().split(' ')[0]);
      const func = findBlock(statement);
      
      const og = scope;
      scope = { origin: og, db: table, ...(table[name] || {}) };
      await run(func);
      
      delete scope.db;
      delete scope.origin;
      const data = scope;
      
      table[name] = { ...table[name], ...data };
      scope = og;
      save(table);
     },
     
     async REMOVE(statement) {
      (new $.ROBJ(filename +i, await (await file.getFile()).text()));
      const table = await $.$.rdn(filename +i);
      
      const og = scope;
      scope = { ...table, ...og, origin: og };
      
      const path = await get(statement.replace('./', ''), { ...table, ...scope });
      const i = path.lastIndexOf('/');
      
      const file = path.slice((i != -1 ? i : 0) +1);
      const _path = await get('./' +(i != -1 ? path.slice(0, i) : ''), { ...table, origin: scope });
      delete _path[file.trim() ?? ''];
      save(table);
      
      scope = og;
     },
     
     async GET(statement) {
      (new $.ROBJ(filename +i, await (await file.getFile()).text()));
      const table = await $.$.rdn(filename +i);
      
      const value = await get(statement, { ...table, ...scope, origin: scope });
      returns.push(value);
     },
    };
    
    async function save(table) {
     delete table.parse;
     const writableStream = await file.createWritable();
     await writableStream.write($.$.stringify.obj(table));
     await writableStream.close();
    }
    
    returns.push(scope[name.trim()]);
    resolve(1);
   });
  },
  
  '-cd': dirName => { 
   return new Promise(async resolve => {
    const directoryName = await get(dirName);
    const id = `DIRECTORY - ${directoryName.trim()}`;
    
    const handle = scope[id] ?? $.$.modChildren[directoryName.trim()] ?? (await $.get(id)) ??
                   (await showDirectoryPicker());
    
    if (handle)
    {
     directory = handle;
     scope[id] = handle;
     
     await $.set(id, handle);
     $.$.modChildren[directoryName.trim()] = handle;
    }
    
    resolve(1);
   })
  },
  
  '-mkdir': dirName => { 
   return new Promise(async resolve => {
    if (!directory)
    {
     throw `no directory set;`;
     reject(`no directory set;`);
    }
    
    const directoryName = await get(dirName);
    const id = `DIRECTORY - ${directoryName.trim()}`;
    
    const handle = await directory.getDirectoryHandle(directoryName.trim(), { create: true });
    if (handle)
    {
     scope[id] = handle;
     await $.set(id, handle);
     $.$.modChildren[directoryName.trim()] = handle;
    }
    
    resolve(1);
   })
  },
  
  '-rmdir': dirName => { 
   return new Promise(async resolve => {
    const directoryName = await get(dirName);
    const id = `DIRECTORY - ${directoryName.trim()}`;
    
    const handle = scope[id] ?? $.$.modChildren[directoryName.trim()] ?? (await $.get(id)) ??
                   ((await showDirectoryPicker()));
    
    if (handle)
    {
     handle.remove();
     delete scope[id];
     
     await $.del(id);
     delete $.$.modChildren[directoryName.trim()];
    }
    
    resolve(1);
   })
  },
  
  '-write': statement => {
   return new Promise(async resolve => {
    if (!directory)
    {
     throw `no directory set;`;
     reject(`no directory set;`);
    }
    
    const date = Date.now();
    const [name, txt] = statement.replace('>>', date).split(date);
    const filename = await get(name);
    
    let file = await directory.getFileHandle(filename.trim(), { create: true });
    const value = (await get(txt)).trim();
    
    const writableStream = await file.createWritable();
    await writableStream.write(value.startsWith('#') ? value.slice(1).trim() : value);
    await writableStream.close();
    resolve(1);
   })
  },
  
  '-read': name => {
   return new Promise(async resolve => {
    if (!directory)
    {
     throw `no directory set;`;
     reject(`no directory set;`);
    }
    
    const filename = await get(name);
    let file = await directory.getFileHandle(filename.trim());
    file = await file.getFile();
    
    returns.push(await file.text());
    resolve(1);
   });
  },
  
  '-rm': name => {
   return new Promise(async resolve => {
    if (!directory)
    {
     throw `no directory set;`;
     reject(`no directory set;`);
    }
    
    const filename = await get(name);
    let file = await directory.getFileHandle(filename.trim());
    
    file.remove();
    resolve(1);
   });
  },
  
  '-execute': statement => {
   return new Promise(async resolve => {
    const i = statement.lastIndexOf(' ? ') == -1 ? statement.length : statement.lastIndexOf(' ? ');
    const [data, argument = '{}'] = [statement.slice(0, i), statement.slice(i +(i == statement.length ? 0 : 3))];
    let code = await get(data);
    
    if (typeof code == 'string')
    {
     if (data.includes('{'))
     {
      code = findBlock(data +' ');
     } else if (!directory)
     {
      throw `no directory set;`;
      reject(`no directory set;`);
     } else {
      const entries = directory.values();
      for await (let entry of entries)
      { 
       if (entry.name == code.trim())
       {
        const file = await entry.getFile();
        code = await file.text();
        break;
       }
      }
     }
    }
    
    const arg = await get(argument);
    if (typeof code == 'function') code(arg);
    else $.ruin(code);
    resolve(1);
   })
  },
  
  '-peer': async statement => {
   return new Promise(async resolve => {
    const name = await get(statement);
    const peer = (scope[name.trim()] = { handle: new Peer(name.trim(), config.webRTC) }).handle;
    
    peer.on('error', err => {
     if (err.type == 'unavailable-id')
     {
      $.log(`Id '${name}' is unavailable.`);
      resolve(1);
     } else console.error(err);
    });
    
    scope[name.trim()].peers = {};
    let conn, onecho;
    
    function handle(data, sender) {
     scope.packet = typeof data == 'string' ? $.Packet.parse(data) : null;
     const value = scope.packet != null && data.startsWith('###') ? scope.packet.getData() : data;
     
     scope.echo = value.value ? { type: typeof value.value, ...value } :
                                { type: typeof value, value, from: sender.peer };
     foxx.run(onecho).then(x => (delete scope.echo, scope.packet));
    }
    
    scope[name.trim()].onecho = statement => {
     onecho = findBlock(statement);
     peer.on('connection', sender => {
      scope[name.trim()].peers[sender.peer] = sender;
      sender.on('data', data => handle(data, sender));
     })
    };
    
    scope[name.trim()].echo = async statement => {
     const data = await get(statement);
     if (conn) conn.send(data.name == 'Packet' ? $.Packet.stringify(data) : data);
    };
    
    scope[name.trim()].connect = async statement => {
     let id = await get(statement);
     if (typeof id == 'object') id = id.id ?? id._id;
     conn = scope[name.trim()].peers[id] ?? peer.connect(id.trim());
     
     return new Promise(resolve => {
      conn.on('data', data => {
       if (onecho) handle(data, conn);
      })
      
      if (conn._open == true) return resolve(1);
      conn.on('open', x => {
       scope[name.trim()].peers[id] = conn;
       resolve(1);
      })
     })
    };
    
    scope[name.trim()].terminate = async statement => {
     peer.destroy();
    };
    
    peer.on('open', e => resolve(1));
    returns.push(scope[name.trim()]);
   })
  },
  
  '-channel': async statement => {
   return new Promise(async resolve => {
    const name = await get(statement);
    const channel = (scope[name.trim()] = {
     handle: new Peer('channel-' +name.trim(), config.webRTC),
     clients: {},
    }).handle;
    
    channel.on('error', err => {
     if (err.type == 'unavailable-id')
     {
      $.log(`channel '${name}' has already been created.`);
      resolve(1);
     } else console.error(err);
    });
    
    channel.on('connection', conn => {
     scope[name.trim()].clients[conn.peer] = conn;
     conn.on('data', async data => {
      if (typeof data == 'string')
      data = (await $.Packet.parse(data)).getData();
      data.exclude = data.exclude ?? [];
      
      $.$.opt(data.type, {
       default() {
        const receiver = scope[name.trim()].clients[data.to];
        if (receiver) receiver.send({ from: conn.peer, private: true, value: data.value });
       },
       
       leave() {
        delete scope[name.trim()].clients[conn.peer];
        conn.close();
       },
       
       broadcast() {
        for (let key in scope[name.trim()].clients)
        {
         const receiver = scope[name.trim()].clients[key];
         
         if (conn.peer != receiver.peer && !data.exclude.includes(receiver.peer))
         receiver.send({ from: conn.peer, private: false, value: data.value });
        }
       },
      })();
     })
    })
    
    channel.on('open', x => resolve(1));
   });
  },
  
  '-server': async statement => {
   return new Promise(async resolve => {
    const name = await get(statement);
    const server = (scope[name.trim()] = {
     handle: new Peer('server-' +name.trim(), config.webRTC),
     clients: {},
    }).handle;
    
    let onecho;
    function handle(data, sender) {
     scope.packet = typeof data == 'string' ? $.Packet.parse(data) : null;
     const value = scope.packet != null && data.startsWith('###') ? scope.packet.getData() : data;
     
     scope.echo = value.value ? { type: typeof value.value, ...value, sender } :
                                { type: typeof value, value, from: sender.peer, sender };
     foxx.run(onecho).then(x => (delete scope.echo, scope.packet));
    }
    
    scope[name.trim()].add = async statement => {
     const data = await get(statement);
     const conn = data.sender ?? data;
     
     scope[name.trim()].clients[conn.peer] = conn;
    }
    
    scope[name.trim()].remove = async statement => {
     const id = await get(statement);
     
     scope[name.trim()].clients[id].close();
     delete scope[name.trim()].clients[id];
    }
    
    scope[name.trim()].onecho = statement => {
     onecho = findBlock(statement);
     peer.on('connection', sender => {
      scope[name.trim()].peers[sender.peer] = sender;
      sender.on('data', data => handle(data, sender));
     })
    };
    
    scope[name.trim()].echo = async statement => {
     const data = await get(statement);
     if (data.name == 'Packet')
     data = data.getData();
     
     data.exclude = data.exclude ?? [];
     $.$.opt(data.type, {
      default() {
       const receiver = scope[name.trim()].clients[data.to];
       if (receiver) receiver.send({ from: conn.peer, private: true, value: data.value });
      },
      
      broadcast() {
       for (let key in scope[name.trim()].clients)
       {
        const receiver = scope[name.trim()].clients[key];
        
        if (!data.exclude.includes(receiver.peer))
        receiver.send({ from: conn.peer, private: false, value: data.value });
       }
      },
     })();
     if (receiver) receiver.send(data.name == 'Packet' ? $.Packet.stringify(data) : data);
    };
    
    server.on('error', err => {
     if (err.type == 'unavailable-id')
     {
      $.log(`server '${name}' has already been created.`);
      resolve(1);
     } else console.error(err);
    });
    
    server.on('open', x => resolve(1));
   });
  },
  
  '-packet': statement => {
   return new Promise(async resolve => {
    const packet = new $.Packet(await get(statement));
    returns.push(packet);
    
    resolve(1);
   })
  },
    
  async scope(statement) {
   const obj = statement.slice(0, statement.indexOf(':'));
   const s = scope;
   
   scope = { ...s, ...await get(obj), origin: s };
   await run(findBlock(statement));
   scopes.push(scope);
   
   scope = s;
  },
  
  run(statement) {
   return new Promise(async resolve => {
    const func = statement.trim().startsWith('{') ? findBlock(statement) : await get(statement);
    await run(func);
    
    resolve(1)
   })
  },
  
  Date(statement) {
   const date = $.$.opt(statement.trim(), {
    default: (new Date()).toLocaleString(),
    full: (new Date()).toString(),
    serial: Date.now(),
   })
   
   returns.push(date);
  },
  
  compile(statement) {
   return new Promise(async resolve => {
    const code = statement.trim().startsWith('{') ? findBlock(statement) : await get(statement);
    const exe = new $.Executeable(code);
    returns.push(exe);
    
    resolve(1);
   })
  },
 };
 
 function _assess(e, _scope = {}) {
  return $.assess(e, [{ ..._scope, ...scopes[0], ...(scope.origin || {}), ...scope }]);
 }
 
 async function get(input = '', _scope) {
  const _ = (_scope ?? scope);
  if (input.trim().startsWith('./'))
  return (new Function(`with(this) return ${input.trim().slice(2).replaceAll('/', '.')}`)).call(_);
  
  if (input.trim().startsWith('#')) return input.trim().slice(1);
  const [command] = input.trim().split(' ');
  const [keyword] = command.split(':');
  
  const item = _[keyword] ?? syntax[keyword];
  if (typeof item == 'function' || (typeof item == 'object' && command.includes(':')))
  {
   return new Promise(async resolve => {
    const s = scope;
    scope = _;
    
    await run(input);
    
    scope = s;
    resolve(returns.pop());
   })
  }
  
  try {
   if (input.trim().startsWith('`') && input.trim().endsWith('`'))
   return evaluateTemplate(input.trim(), get);
   
   const evaluated = _assess(input.trim(), _);
   if (input.trim().startsWith('[') && input.trim().endsWith(']'))
   {
    const array = [];
    for (let item of evaluated)
    {
     try {
      const newItem = item.trim ? await get(item) : item;
      array.push(newItem);
     } catch(e) {
      array.push(item);
     }
    };
   }
   
   if (evaluated?.trim && evaluated.trim().startsWith('./'))
   return (new Function(`with(this) return ${evaluated.trim().slice(2).replaceAll('/', '.')}`)).call(_);
   
   return evaluated;
  } catch(e) {
   throw e;
   return e.message;
  }
 };
 
 $.struct('Packet', {
  $data: null,
  construct({ data, type } = {}) {
   this.type = type ?? typeof data;
   this.$data = data;
  },
  
  static: {
   stringify(packet) {
    return '###' +$.$.stringify.ToBinary($.$.stringify.obj({
     data: packet.getData(),
     type: packet.type,
    }));
   },
   
   async parse(string) {
    const name = Date.now();
    string = $.$.parse.binary(string.slice(3));
    (new $.ROBJ(name, string));
    
    const rdn = await $.$.rdn(name);
    return new $.Packet(rdn);
   },
  },
  
  getData() {
   return this.$data;
  },
 })
 
 $.struct('Executeable', {
  construct(code) {
   const array = (Array.isArray(code) ? code : $.$.stringify.ToBinary(code).split('.')).map(num => Number(num))
                                                                          .filter(num => num.toString() != 'NaN');
   
   this.length = array.length;
   for (let i = 0; i < array.length; i ++)
   this[i] = array[i];
   array.length = 0;
  },
  
  array() {
   const arr = [];
   for (let i = 0; i < this.length; i ++)
   arr.push(this[i]);
   
   return arr;
  },
  
  stringify(join = '*') {
   return this.array().join(join);
  },
  
  parse() {
   return $.$.parse.binary(this.array().join('.'));
  },
 })
 
 function evaluateTemplate(template, callback) {
  return new Promise(async resolve => {
   const matches = template.match(/\${(.*?)}/g) || [];
   
   const promises = [];
   for (let match of matches) 
   {
    const result = await callback(match.slice(2, -1).trim());
    promises.push(result);
   };
   
   const results = await Promise.all(promises);
   let finalTemplate = template;
   
   results.forEach((result, i) => {
    finalTemplate = finalTemplate.replace(matches[i], result);
   });

   resolve(finalTemplate.slice(1, -1));
  })
 }
 
 function executeable(code) {
  return new $.Executeable(code);
 };
 
 function exec(exe) {
  return run(Array.isArray(exe) ? $.$.parse.binary(exe.join('.')) : exe.parse());
 };
 
 function run(code, breakOn = ';') {
  return new Promise(async resolve => {
   const statements = getStatements(code);
   let i = 0;
   
   const runId = runs.length;
   const program = runs.find(run => run.code.trim().includes(code.trim()));
   
   const lines = code.split('\n');
   const st = program ? program.statements.find(statement => statement.trim().includes(code.trim())) || '' : '';
   const l = program ? program.lines.find(line => line.trim().includes(code.trim())) || '' : '';
   
   const line = { data: l, index: program ? program.lines.indexOf(l || st.trim().split('\n')[0]) : '?' };
   const current = {
    parent: program,
    returned: false,
    statements,
    lines,
    runId,
    code,
    line,
   };
   
   runs.push(current);
   for await (let _statement of hoist(statements))
   {
    if (current.returned == true) break; 
    function error(description) {
     throw `Foxx Error:
description: "${description};
@program:
 statement: "${program ? st.replace(/\n/g, '\\n') : 'none'}";
 runId: ${program ? program.runId : 'none'};
 line: ${program ? line.index : 'none'};
;

@block:
 statement: "${_statement.replace(/\n/g, '\\n')};
 runId: ${runId};
 line: ${i};
;`;
    };
    
    const [command, ...characters] = _statement.trim().split(' ');
    const [keyword, ...path] = command.split(':');
    
    let property = syntax[keyword.trim()] ?? scope[keyword.trim()] ?? (scope.origin ?? {})[keyword.trim()];
    const statement = characters.join(' ');
    for (let name of path)
    {
     const prop = property[name];
     if (prop && typeof prop == 'function')
     property = prop;
    }
    
    if (property && typeof property == 'function' || (typeof property == 'object' && command.includes(':')))
    {
     try {
      await property(statement, { syntax, error, characters, current, stop(program) { program.returned = true }, returns(...data) { return returns.push(...data) } });
     } catch(e) {
      error(e.message); break;
     }
    } else if (keyword.trim() != '')
    {
     try {
      (new Function(`with(this) { return ${_statement} }`)).call(scope);
     } catch(e) {
      error(`Invalid Keyword: '${[keyword.trim(), ...path].join(':')}'`); break;
     }
    }
    
    i ++;
   }
   
   config.returnTo = null;
   resolve(1);
  })
 }
 
 function fix(statements) {
  
 }
 
 function hoist(statements, keyword = 'function') {
  const hoisted = statements.filter(item => item.trim().startsWith(keyword));
  const other = statements.filter(item => !item.trim().startsWith(keyword));
  return [...hoisted, ...other];
 }
 
 function getStatements(code = '') {
  const r = Date.now();
  const statements = [];
  let depth = 0, inString = false, buffer = '', stringChar = '';
  
  for (let i = 0; i < code.length; i ++)
  {
   const char = code[i];
   const nextChar = code[i +1];
   
   if ((char == '"' || char == "'") && !inString)
   {
    inString = true;
    stringChar = char;
   } else if (char == stringChar && inString && code[i -1] != '#')
   {
    inString = false;
    stringChar = '';
   } else if (inString)
   {
    buffer += char;
    continue;
   }
   
   if (char == '{')
   {
    depth ++;
    buffer += char;
   } else if (char == '}')
   {
    depth --;
    buffer += char;
   } else if (char == ';' && !depth)
   {
    statements.push(buffer.trim());
    buffer = '';
   } else buffer += char;
   
   if (depth == config.maxDepth)
   {
    throw `Maximum nesting depth exeeded`;
    break;
   }
  }
  
  if (buffer.trim())
  statements.push(buffer.trim());
  return statements;
 }
  
 return { run, other: { executeable, exec, scope() { return scope; }, setScope(obj) { return scope = obj; }, runs, scopes, returns, get, getStatements, directory() { return directory } }, syntax };
});

$.struct('Database', {
 $torage: null,
 construct(name = 'IndexedDB') {
  this.name = name.trim();
  this.store('main');
 },

 store(store) {
  const request = indexedDB.open(this.name);
  request.onupgradeneeded = x => request.result.createObjectStore(store);
  
  const promise = this.promisifyRequest(request);
  this.$torage = (mode, callback) => promise.then(promise => callback(promise.transaction(store, mode).objectStore(store)));
 },

 promisifyRequest(e) { 
  return new Promise((resolve, reject) => { 
   e.oncomplete = e.onsuccess = x => resolve(e.result);
   e.onabort = e.onerror = x => reject(e.error);
  }) 
 },

 get(name) {
  return this.$torage('readonly', store => {
   if (typeof name == 'string') return this.promisifyRequest(store.get(name));
   return Promise.all(name.map(key => this.promisifyRequest(store.get(key))));
  });
 },

 set(name, value) {
  return this.$torage('readwrite', store => {
   store.put(value, name);
   return this.promisifyRequest(store.transaction);
  });
 },

 setMany(entries) {
  return this.$torage('readwrite', store => {
   entries.forEach(([key, value]) => store.put(value, key));
   return this.promisifyRequest(store.transaction);
  });
 },

 del(name) {
  return this.$torage('readwrite', store => {
   if (typeof name == 'string') store.delete(name);
   else name.forEach(key => store.delete(key));
   
   return this.promisifyRequest(store.transaction);
  });
 },

 update(key, updater) {
  return this.$torage('readwrite', store => {
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
 },

 clear() {
  return this.$torage('readwrite', store => {
   store.clear();
   return promisifyRequest(store.transaction);
  });
 },
});

$.struct('RLN', {
 construct(levelData, learningRate = 5) {
  this.nets = [];
  this.learningRate = learningRate;
  
  for (let i = 0; i < this.learningRate; i ++)
  {
   const net = new $.NeuralNetwork(levelData);
   net.id = i;
   
   this.nets.push(net);
  }
 },
 
 setData(net, t = .2) {
  net.id = 0;
  this.nets.length = 0;
  this.nets.push(net);
  
  const n = typeof t == 'number';
  for (let i = 1; i < this.learningRate; i ++)
  {
   const child = net.mutate(n ? t : t[i -1], true);
   child.id = i;
   
   this.nets.push(child);
  }
 },
 
 run(callback) {
  return new Promise(async resolve => {
   for await (let net of this.nets)
   await callback(net);
   
   this.sort();
   resolve(this.nets[0]);
  })
 },
 
 sort() {
  this.nets.sort((a, b) => b.score -a.score);
  return this.nets[0];
 },
 
 push(net) {
  net.id = this.learningRate ++;
  this.nets.push(net);
 },
 
 static: {
  stringifyBest(rln) {
   const binaryData = $.NeuralNetwork.stringify(rln.nets[0]);
   return binaryData;
  },
  
  parseBest(binaryData) {
   const net = $.NeuralNetwork.parse(binaryData);
   return net;
  },
 },
})

$.struct('NeuralNetwork', {
 construct(levelData) {
  this.score = 0;
  this.levels = [];
  this.setData(levelData);
 },
 
 reward(amount) {
  this.score += amount;
 },
 
 sanction(amount) {
  this.score -= amount;
 },
 
 setData(levelData, levels) {
  this.levels.length = 0;
  this.levelData = levelData;
  if (levels)
  {
   for (let lvl of levels)
   this.levels.push(typeof lvl == 'string' ? $.Level.parse(lvl) : lvl.copy());
   
   return;
  }
  
  for (let i = 0; i < levelData.length -1; i ++)
  this.levels.push(new $.Level(levelData[i], levelData[i +1]));
 },
 
 copy() {
  const network = $.NeuralNetwork.parse($.NeuralNetwork.stringify(this));
  const copy = new $.NeuralNetwork([]);
  
  copy.setData(network.levelData, network.levels);
  return copy;
 },

 mutate(t = .5, copy) {
  const net = copy ? this.copy() : this;
  net.levels.forEach(lvl => {
   for (let i = 0; i < lvl.biases.length; i ++)
   lvl.biases[i] = $.math.lerp(lvl.biases[i], $.math.rand(-1, 1), Number(t));
   
   for (let i = 0; i < lvl.weights.length; i ++)
   for (let j = 0; j < lvl.weights[i].length; j ++)
   lvl.weights[i][j] = $.math.lerp(lvl.weights[i][j], $.math.rand(-1, 1), Number(t));
  });
  
  return net;
 },
 
 feedForward(givenInputs) {
  let inputs = this.levels[0].feedForward(givenInputs);
  let outputs = null;
  
  for (let lvl of this.levels.slice(1))
  {
   inputs = lvl.feedForward(inputs);
   outputs = inputs;
  }
  
  return outputs;
 },
 
 static: {  
  stringify({ levelData, levels }, binary = true) {
   const net = { levelData, levels: levels.map(lvl => $.Level.stringify(lvl)) };
   return (binary ? $.$.stringify.ToBinary : x => x)($.$.stringify.obj(net));
  },
  
  parse(binaryData) {
   const data = $.$.parse.obj($.$.parse.binary(binaryData));
   const network = new $.NeuralNetwork([]);
   network.setData(data.levelData, data.levels);
   
   return network;
  },
 },
})

$.struct('Level', {
 construct(inputs, outputs, biases, weights = []) {
  this.inputs = new Array(inputs);
  this.outputs = new Array(outputs);
  this.biases = biases ?? new Array(outputs);
  this.weights = weights;
  
  if (!weights.length) 
  for (let i = 0; i < inputs; i ++)
  this.weights.push(new Array(outputs));
  
  if (!biases) $.Level.randomize(this);
 },
 
 copy() {
  const lvl = $.Level.parse($.Level.stringify(this));
  const copy = new $.Level(lvl.inputs, lvl.outputs, lvl.biases, lvl.weights);
  return copy;
 },
  
 feedForward(givenInputs, useDefault = true) {
  const outputs = this.outputs;
  
  for (let i = 0; i < this.inputs.length; i ++)
  this.inputs[i] = givenInputs[i];
  
  for (let i = 0; i < outputs.length; i ++)
  {
   let sum = 0;
   for (let j = 0; j < this.inputs.length; j ++)
   sum += this.inputs[j] *this.weights[j][i];
   
   outputs[i] = useDefault ? (sum > this.biases[i] ? 1 : 0) :
   { sum, bias: this.biases[i] };
  }
  
  return outputs;
 },
 
 static: {
  stringify({ inputs, outputs, biases, weights }, binary = true) {
   const lvl = { inputs, outputs, biases, weights };
   return (binary ? $.$.stringify.ToBinary : x => x)($.$.stringify.obj(lvl));
  },
  
  parse(binaryData) {
   const data = $.$.parse.obj($.$.parse.binary(binaryData));
   const lvl = new $.Level(data.inputs, data.outputs, data.biases, data.weights);
   return lvl;
  },

  randomize(lvl) {
   for (let i = 0; i < lvl.inputs.length; i ++)
   for (let j = 0; j < lvl.outputs.length; j ++)
   lvl.weights[i][j] = $.math.rand(-1, 1);
   
   for (let i = 0; i < lvl.biases.length; i ++)
   lvl.biases[i] = $.math.rand(-1, 1);
  },
 },
})

$.struct('Visualizer: static', {
 drawNetwork(ctx, network, { margin = 50, outputLabels = x => ([]) } = {}) {
  const board = ctx.canvas ?? ctx.board;
  const left = margin;
  const top = margin;
  
  const width = board.width -margin *2;
  const height = board.height -margin *2;
  const lvlHeight = height /network.levels.length;
  
  for (let i = network.levels.length -1; i >= 0; -- i)
  {
   const t = network.levels.length == 1 ? 0.5 : i /(network.levels.length -1);
   const lvlTop = top +$.math.lerp(height -lvlHeight, 0, t);
   ctx.setLineDash([7.3]);
   
   $.Visualizer.drawLevel(ctx, network.levels[i], left, lvlTop, width, lvlHeight, outputLabels(network, i));
  }
 },
 
 drawLevel(ctx, lvl, left, top, width, height, outputLabels) {
  const right = left +width;
  const bottom = top +height;
  const nodeRadius = 18;
  
  const { inputs, outputs, weights, biases } = lvl;
  for (let i = 0; i < inputs.length; i ++)
  for (let j = 0; j < outputs.length; j ++)
  {
   ctx.beginPath();
   ctx.lineWidth = 2;
   ctx.strokeStyle = $.getRGBA(weights[i][j]);
   
   ctx.moveTo($.Visualizer.getNodeX(inputs, i, left, right), bottom);
   ctx.lineTo($.Visualizer.getNodeX(outputs, j, left, right), top);
   ctx.stroke();
  }
  
  for (let i = 0; i < inputs.length; i ++)
  {
   const x = $.Visualizer.getNodeX(inputs, i, left, right);
   
   ctx.beginPath();
   ctx.arc(x, bottom, nodeRadius, 0, $.math.pi *2);
   ctx.fillStyle = 'black';
   ctx.fill();
   
   ctx.beginPath();
   ctx.arc(x, bottom, nodeRadius *.6, 0, $.math.pi *2);
   ctx.fillStyle = $.getRGBA(inputs[i]);
   ctx.fill()
  }
  
  for (let i = 0; i < outputs.length; i ++)
  {
   const x = $.Visualizer.getNodeX(outputs, i, left, right);
   
   ctx.beginPath();
   ctx.arc(x, top, nodeRadius, 0, $.math.pi *2);
   ctx.fillStyle = 'black';
   ctx.fill();
   
   ctx.beginPath();
   ctx.arc(x, top, nodeRadius *.6, 0, $.math.pi *2);
   ctx.fillStyle = $.getRGBA(outputs[i]);
   ctx.fill();
   
   ctx.beginPath();
   ctx.lineWidth = 2;;
   ctx.arc(x, top, nodeRadius *.8, 0, $.math.pi *2);
   ctx.strokeStyle = $.getRGBA(biases[i])
   ctx.setLineDash([3, 3]);
   
   ctx.stroke();
   ctx.setLineDash([]);
   
   if (outputLabels[i])
   {
    ctx.beginPath();
    ctx.lineWidth = 0.5;
    ctx.fillStyle = 'black';
    ctx.strokeStyle = 'white';
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = (nodeRadius *1.5) +'px Courier New';
    
    const y = top +nodeRadius *.1;
    ctx.fillText(outputLabels[i], x, y);
    ctx.strokeText(outputLabels[i], x, y);
   }
  }
 },
 
 getNodeX(nodes, index, left, right) {
  return $.math.lerp(left, right, nodes.length == 1 ? .5 : index /(nodes.length -1));
 },
})

$.struct('Sensor', {
 construct(object, { count = 5, length = 150, spread = $.math.pi /2 } = {}) {
  this.object = object;
  this.ray = { count, length, spread };

  this.rays = [];
  this.readings = [];
 },
 
 update(callback) {
  this.$castRays();
  this.readings.length = 0;
  
  for (let ray of this.rays)
  {
   const reading = this.$getReading(ray, callback);
   this.readings.push(reading);
  }
 },
 
 $getReading(ray, callback) {
  const touches = [];
  const result = callback(ray, touches);
  
  $.log([result, touches])
  if (result != undefined) return result;
  if (touches.length == 0) return null;
  
  const offsets = touches.map(e => e.offset);
  const minOffset = $.math.min(...offsets);
  
  return touches.find(e => e.offset == minOffset);
 },
  
 $castRays() {
  this.rays.length = 0;
  const { x, y, angle } = this.object.location ?? this.object;
  
  for (let i = 0; i < this.ray.count; i ++)
  {
   const t = this.ray.count == 1 ? .5 : i /(this.ray.count -1);
   const rayAngle = $.math.lerp(this.ray.spread /2, -this.ray.spread /2, t) +angle;

   const start = { x, y };
   const end = {
    x: x -$.math.sin(rayAngle) *this.ray.length,
    y: y -$.math.cos(rayAngle) *this.ray.length,
   };
    
   this.rays.push([start, end]);
  }
 },
  
 draw(ctx) {
  for (let i = 0; i < this.ray.count; i ++)
  {
   const ray = this.rays[i];
   const end = this.readings[i] ?? ray[i][1];
   if (!ray) continue;
   
   ctx.beginPath();
   ctx.lineWidth = 2;
   ctx.strokeStyle = 'yellow';
   
   ctx.arc(end.x, end.y, 4, 0, $.math.pi *2);
   ctx.moveTo(ray[0].x, ray[0].y);
   ctx.lineTo(end.x, end.y);
   
   ctx.stroke();
   ctx.fill();

   ctx.beginPath();
   ctx.lineWidth = 2;
   ctx.strokeStyle = 'black';
   
   ctx.moveTo(ray[1].x, ray[1].y);
   ctx.lineTo(end.x, end.y);
   ctx.stroke();
  }
 },
})

$.projects = [];
$.struct('Template', {
 construct(schema) {
  return $.struct('⌁', {
   schema,
   construct(object) {
    if (!this.eval(object)) throw `The given Object doesn\'t match the Template`;
    this.data = object;
   },
   
   save(db, to = 'schema') {
    db.add(to, this.data);
   }, 
   
   remove(db, from = 'schema') {
    db.delete(from);
   },
 
   eval(obj) {
    for (let key in obj)
    {
     const fn = this.schema[key]?.validate || this.schema[key];
     if (typeof obj[key] !== (this.schema[key]?.type || this.schema[key]) && typeof fn !== 'function') return;

     if (typeof fn === 'function' && !fn?.(obj[key])) return;

     if (!this.schema[key]) return;
    }
     
    return true;
   }
  })
 },
})