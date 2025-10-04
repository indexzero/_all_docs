// ['0', (...), '9']
const numbers = Array.from({ length: 10 }, (_, i) => String.fromCharCode(48 + i));

// ['a', (...), 'z']
const alphabet = Array.from({ length: 26 }, (_, i) => String.fromCharCode(97 + i));

/*
  azExpand('a') => [
    'aa', 'ab', 'ac', 'ad', 'ae',
    'af', 'ag', 'ah', 'ai', 'aj',
    'ak', 'al', 'am', 'an', 'ao',
    'ap', 'aq', 'ar', 'as', 'at',
    'au', 'av', 'aw', 'ax', 'ay',
    'az'
  ]
*/
function azExpand(prefix) {
  return [
    ...alphabet.map(c => `${prefix}${c}`)
  ];
}

// ['a', (...), 'zzz']
const atozzz = alphabet.reduce((acc, a) => {
  acc.push(a);                  // ['a', (...)

  azExpand(a)
    .forEach(aa => {
      acc.push(...azExpand(aa)) //  (...) aaa', 'aab', 'aac']
    });

  return acc;
}, []);

const allPivots = [
  null,
  /* 0 – 9 */
  ...numbers,
  '@!',
  /* @0 – @9 */
  ...numbers.map(c => `@${c}`),
  '@_',
  //
  // TODO (cjr) must partition @ali__@alj
  // [@ali, @alicn, @alifd, @alifd/theme-{???}, @aligov, @aliwind, @alj]
  //
  /* @a[a-z] - @z[a-z] */
  ...atozzz.map(cc => `@${cc}`),
  //
  // TODO (cjr) must partition nod_noe
  // entire `node-*` package namespace
  //
  '@~',
  'A',
  'Z',
  ...atozzz,
  null
]

const pivots = allPivots;

export {
  pivots
}
