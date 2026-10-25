/**
 * Splits the per-tab JSX sections of a large page component into their own files.
 *
 *   node tools/split-page-tabs.cjs <page.tsx> <ComponentName> <outDir> [minLines]
 *
 * For every top-level `{activeTab === '...' && (...)}` block in the component's final return,
 * the TypeScript checker finds which component-scope values the block uses (state, setters,
 * handlers, derived values) and which imports / module-level helpers it needs. The block is
 * moved into `<outDir>/<Name>Tab.tsx` as a component whose typed props are exactly those
 * values, and the page renders `<NameTab ... />` in its place. Module-level helpers used by
 * the tabs move to `<outDir>/shared.tsx`.
 */
const fs = require('fs');
const path = require('path');
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));

const [pageArg, componentName, outDirArg, minLinesArg] = process.argv.slice(2);
const pagePath = path.resolve(pageArg);
const outDir = path.resolve(outDirArg);
const minLines = Number(minLinesArg || 25);

const configPath = path.resolve(__dirname, '../tsconfig.app.json');
const parsed = ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, path.dirname(configPath));
const program = ts.createProgram([pagePath], { ...parsed.options, noEmit: true });
const checker = program.getTypeChecker();
const sf = program.getSourceFile(pagePath);
const text = sf.getFullText();

const pascal = (s) => s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join('');

// --- locate component + its final return -------------------------------------------------
let componentFn = null;
sf.forEachChild((node) => {
  if (ts.isVariableStatement(node)) {
    for (const decl of node.declarationList.declarations) {
      if (decl.name.getText(sf) === componentName && decl.initializer && ts.isArrowFunction(decl.initializer)) componentFn = decl.initializer;
    }
  }
});
if (!componentFn) throw new Error(`Component ${componentName} not found`);
const body = componentFn.body;
const finalReturn = [...body.statements].reverse().find((s) => ts.isReturnStatement(s));

// --- collect tab blocks --------------------------------------------------------------------
const blocks = [];
const visit = (node) => {
  if (ts.isJsxExpression(node) && node.expression && ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    // condition chain: a && b && (<jsx>)
    let rightmost = node.expression.right;
    const condText = node.expression.left.getText(sf);
    const m = condText.match(/activeTab === '([a-z_]+)'/);
    const startLine = sf.getLineAndCharacterOfPosition(node.getStart(sf)).line;
    const endLine = sf.getLineAndCharacterOfPosition(node.getEnd()).line;
    if (m && endLine - startLine >= minLines) {
      while (ts.isParenthesizedExpression(rightmost)) rightmost = rightmost.expression;
      blocks.push({ node, tab: m[1], condText, jsx: rightmost });
      return;
    }
  }
  ts.forEachChild(node, visit);
};
visit(finalReturn);
if (blocks.length === 0) throw new Error('No tab blocks found');

// --- scope classification -------------------------------------------------------------------
const isInside = (n, container) => n.getStart(sf) >= container.getStart(sf) && n.getEnd() <= container.getEnd();
const componentLocals = new Map(); // name -> declaration node (top-level in component body)
for (const st of body.statements) {
  if (ts.isVariableStatement(st)) {
    for (const decl of st.declarationList.declarations) {
      const addNames = (b) => {
        if (ts.isIdentifier(b)) componentLocals.set(b.text, decl);
        else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) b.elements.forEach((e) => e.name && addNames(e.name));
      };
      addNames(decl.name);
    }
  } else if (ts.isFunctionDeclaration(st) && st.name) componentLocals.set(st.name.text, st);
}
const importMap = new Map(); // local name -> { module, imported, isType, isDefault }
for (const st of sf.statements) {
  if (!ts.isImportDeclaration(st) || !st.importClause) continue;
  const mod = st.moduleSpecifier.text;
  const ic = st.importClause;
  if (ic.name) importMap.set(ic.name.text, { module: mod, isDefault: true, isType: ic.isTypeOnly });
  if (ic.namedBindings && ts.isNamedImports(ic.namedBindings)) {
    for (const el of ic.namedBindings.elements) {
      importMap.set(el.name.text, { module: mod, imported: (el.propertyName || el.name).text, isType: ic.isTypeOnly || el.isTypeOnly });
    }
  }
}
const moduleDecls = new Map(); // module-level (non-import, non-component) declarations
for (const st of sf.statements) {
  if (ts.isVariableStatement(st)) {
    for (const decl of st.declarationList.declarations) {
      if (decl.name.getText(sf) !== componentName && ts.isIdentifier(decl.name)) moduleDecls.set(decl.name.text, st);
    }
  } else if ((ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st) || ts.isFunctionDeclaration(st)) && st.name) {
    moduleDecls.set(st.name.text, st);
  }
}

const relImport = (mod, fromDir) => {
  if (!mod.startsWith('.')) return mod;
  const abs = path.resolve(path.dirname(pagePath), mod);
  let rel = path.relative(fromDir, abs).split(path.sep).join('/');
  return rel.startsWith('.') ? rel : './' + rel;
};
const typeText = (node) => {
  // Type as seen at the value's FIRST use in the tab block: this keeps narrowing done by the page
  // before the tab renders (e.g. `if (!profile) return`) but not narrowing inside the block itself
  const t = checker.getTypeAtLocation(node);
  return checker.typeToString(t, undefined, ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.UseFullyQualifiedType | ts.TypeFormatFlags.UseAliasDefinedOutsideCurrentScope);
};
// Types printed by the checker reference other modules as `import("abs/path").X`; make paths relative
const fixImportTypes = (s, fromDir) =>
  s.replace(/import\("([^"]+)"\)/g, (_, p) => {
    if (!path.isAbsolute(p) && !/^[A-Za-z]:/.test(p)) return `import("${p}")`;
    let rel = path.relative(fromDir, p).split(path.sep).join('/');
    if (rel.includes('node_modules/')) rel = rel.slice(rel.lastIndexOf('node_modules/') + 'node_modules/'.length).replace(/\/index$/, '').replace(/\.d$/, '');
    else if (!rel.startsWith('.')) rel = './' + rel;
    return `import("${rel}")`;
  });

// Exported type/value names -> defining module, so printed prop types can be imported
const SKIP_TYPE_NAMES = new Set(['Promise', 'Record', 'Array', 'Partial', 'Pick', 'Omit', 'Date', 'Map', 'Set', 'Error', 'Element', 'HTMLElement', 'Readonly', 'ReadonlyArray', 'Function', 'Object', 'String', 'Number', 'Boolean']);
const exportIndex = new Map();
const srcRoot = path.resolve(__dirname, '../src');
const externalModules = ['@tanstack/react-query', 'react', 'react-router-dom'];
for (const file of program.getSourceFiles()) {
  const fn = path.resolve(file.fileName);
  const isSrc = fn.startsWith(srcRoot) && !fn.startsWith(outDir);
  const ext = externalModules.find((m) => fn.split(path.sep).join('/').includes(`/node_modules/${m}/`) || fn.split(path.sep).join('/').includes(`/node_modules/@types/${m}/`));
  if (!isSrc && !ext) continue;
  const modSym = checker.getSymbolAtLocation(file);
  if (!modSym) continue;
  for (const exp of checker.getExportsOfModule(modSym)) {
    const spec = isSrc ? fn.replace(/\.(tsx?|d\.ts)$/, '') : ext;
    // prefer src/types definitions, then first seen
    if (!exportIndex.has(exp.name) || (isSrc && fn.includes(`${path.sep}types${path.sep}`))) exportIndex.set(exp.name, { spec, isSrc });
  }
}
const typeImportsFor = (typeStrings, fromDir, alreadyImported) => {
  const names = new Set();
  for (const s of typeStrings) for (const m of s.matchAll(/(?<![.\w"])([A-Z][A-Za-z0-9_]*)\b/g)) names.add(m[1]);
  const byMod = new Map();
  for (const n of names) {
    if (SKIP_TYPE_NAMES.has(n) || alreadyImported.has(n)) continue;
    if (importMap.has(n)) {
      const info = importMap.get(n);
      const key = relImport(info.module, fromDir);
      if (!byMod.has(key)) byMod.set(key, new Set());
      byMod.get(key).add(info.isDefault ? `default as ${n}` : info.imported === n ? n : `${info.imported} as ${n}`);
      continue;
    }
    const hit = exportIndex.get(n);
    if (!hit) continue;
    let key = hit.spec;
    if (hit.isSrc) { key = path.relative(fromDir, hit.spec).split(path.sep).join('/'); if (!key.startsWith('.')) key = './' + key; }
    if (!byMod.has(key)) byMod.set(key, new Set());
    byMod.get(key).add(n);
  }
  return [...byMod.entries()].map(([mod, set]) => `import type { ${[...set].sort().join(', ')} } from '${mod}';`);
};

// Types/interfaces moved to shared.tsx must be imported type-only (verbatimModuleSyntax)
const sharedSpec = (name) => {
  const st = moduleDecls.get(name);
  return st && (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) ? `type ${name}` : name;
};

fs.mkdirSync(outDir, { recursive: true });
const sharedNeeded = new Set();
const replacements = [];

for (const b of blocks) {
  const name = `${pascal(b.tab)}Tab`;
  const usedLocals = new Map();
  const usedImports = new Map();
  const usedModule = new Set();
  const walk = (n) => {
    if (ts.isIdentifier(n)) {
      // skip property names in `a.b` and object literal keys / JSX attribute names
      const p = n.parent;
      const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || ts.isJsxAttribute(p) || (ts.isQualifiedName(p) && p.right === n);
      if (!isPropName) {
        const sym = checker.getSymbolAtLocation(n);
        const decl = sym && sym.declarations && sym.declarations[0];
        if (ts.isShorthandPropertyAssignment(p)) {
          const vs = checker.getShorthandAssignmentValueSymbol(p);
          const vd = vs && vs.declarations && vs.declarations[0];
          if (vd && componentLocals.has(n.text) && !isInside(vd, b.jsx) && !usedLocals.has(n.text)) usedLocals.set(n.text, n);
        } else if (decl && decl.getSourceFile() === sf && !isInside(decl, b.jsx)) {
          if (componentLocals.has(n.text) && isInside(decl, body)) { if (!usedLocals.has(n.text)) usedLocals.set(n.text, n); }
          else if (importMap.has(n.text)) usedImports.set(n.text, importMap.get(n.text));
          else if (moduleDecls.has(n.text)) usedModule.add(n.text);
        } else if (decl && importMap.has(n.text) && decl.getSourceFile() !== sf) {
          usedImports.set(n.text, importMap.get(n.text));
        } else if (!decl && importMap.has(n.text)) {
          usedImports.set(n.text, importMap.get(n.text));
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(b.jsx);
  // JSX intrinsic React usage
  if (!usedImports.has('React') && importMap.has('React')) usedImports.set('React', importMap.get('React'));
  usedModule.forEach((m) => sharedNeeded.add(m));

  const props = [...usedLocals.keys()].sort();
  const propLines = props.map((p) => `  ${p}: ${fixImportTypes(typeText(usedLocals.get(p)), outDir)};`);
  // Page-level types that appear in the printed prop types also move to shared.tsx
  for (const line of propLines) {
    for (const m of line.matchAll(/(?<![.\w"])([A-Z][A-Za-z0-9_]*)\b/g)) {
      if (moduleDecls.has(m[1])) { usedModule.add(m[1]); sharedNeeded.add(m[1]); }
    }
  }

  // imports grouped by module
  const byModule = new Map();
  for (const [local, info] of usedImports) {
    const key = info.module;
    if (!byModule.has(key)) byModule.set(key, { def: null, named: [] });
    const g = byModule.get(key);
    if (info.isDefault) g.def = local;
    else g.named.push(`${info.isType ? 'type ' : ''}${info.imported === local ? local : `${info.imported} as ${local}`}`);
  }
  const importLines = [...byModule.entries()].map(([mod, g]) => {
    const parts = [];
    if (g.def) parts.push(g.def);
    if (g.named.length) parts.push(`{ ${g.named.join(', ')} }`);
    return `import ${parts.join(', ')} from '${relImport(mod, outDir)}';`;
  });
  if (usedModule.size) importLines.push(`import { ${[...usedModule].sort().map(sharedSpec).join(', ')} } from './shared';`);
  importLines.push(...typeImportsFor(propLines, outDir, new Set([...usedImports.keys(), ...usedModule])));

  const jsxText = text.slice(b.jsx.getStart(sf), b.jsx.getEnd());
  const file = [
    `// Extracted from ${path.basename(pagePath)} — the "${b.tab}" tab.`,
    ...importLines,
    '',
    `export interface ${name}Props {`,
    ...propLines,
    '}',
    '',
    `export const ${name}: React.FC<${name}Props> = (${props.length ? `{ ${props.join(', ')} }` : '_props'}) => {`,
    '  return (',
    jsxText.replace(/^/gm, '  ').replace(/^  /, '    '),
    '  );',
    '};',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, `${name}.tsx`), file);

  const propsAttr = props.map((p) => `${p}={${p}}`).join(' ');
  replacements.push({ start: b.node.getStart(sf), end: b.node.getEnd(), text: `{${b.condText} && <${name} ${propsAttr} />}`, name });
  console.log(`${name}: ${props.length} props, ${jsxText.split('\n').length} lines`);
}

// shared.tsx with module-level helpers used by tabs (removed from the page, imported back)
if (sharedNeeded.size) {
  const sharedDecls = [...sharedNeeded].map((n) => moduleDecls.get(n));
  const uniqueStmts = [...new Set(sharedDecls)];
  const needImports = new Map();
  for (const st of uniqueStmts) {
    const w = (n) => { if (ts.isIdentifier(n) && importMap.has(n.text)) needImports.set(n.text, importMap.get(n.text)); ts.forEachChild(n, w); };
    w(st);
  }
  const lines = [...needImports.entries()].map(([local, info]) =>
    info.isDefault ? `import ${local} from '${relImport(info.module, outDir)}';` : `import { ${info.isType ? 'type ' : ''}${info.imported === local ? local : `${info.imported} as ${local}`} } from '${relImport(info.module, outDir)}';`);
  const body2 = uniqueStmts.map((st) => {
    const t = text.slice(st.getFullStart(), st.getEnd()).replace(/^\s+/, '');
    return /^export /.test(t) ? t : `export ${t}`;
  });
  fs.writeFileSync(path.join(outDir, 'shared.tsx'), [`// Helpers shared by ${componentName} and its tab components.`, ...lines, '', ...body2, ''].join('\n'));
  for (const st of uniqueStmts) replacements.push({ start: st.getFullStart(), end: st.getEnd(), text: '' });
}

// rewrite page
let out = text;
for (const r of replacements.sort((a, b) => b.start - a.start)) out = out.slice(0, r.start) + r.text + out.slice(r.end);
const relOut = (() => { let r = path.relative(path.dirname(pagePath), outDir).split(path.sep).join('/'); return r.startsWith('.') ? r : './' + r; })();
const tabImports = blocks.map((b) => `import { ${pascal(b.tab)}Tab } from '${relOut}/${pascal(b.tab)}Tab';`);
if (sharedNeeded.size) tabImports.push(`import { ${[...sharedNeeded].sort().map(sharedSpec).join(', ')} } from '${relOut}/shared';`);
// insert after last import
const lastImport = [...sf.statements].filter(ts.isImportDeclaration).pop();
const lastImportEnd = out.indexOf('\n', out.indexOf(text.slice(lastImport.getStart(sf), lastImport.getEnd()))) + 1;
out = out.slice(0, lastImportEnd) + tabImports.join('\n') + '\n' + out.slice(lastImportEnd);
fs.writeFileSync(pagePath, out);

// Drop imports the slimmed-down page no longer uses (TypeScript's own "organize imports")
const files = new Map([[pagePath, out]]);
const host = {
  getScriptFileNames: () => [pagePath],
  getScriptVersion: () => '1',
  getScriptSnapshot: (f) => {
    const content = files.get(path.resolve(f)) ?? (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : undefined);
    return content === undefined ? undefined : ts.ScriptSnapshot.fromString(content);
  },
  getCurrentDirectory: () => path.dirname(configPath),
  getCompilationSettings: () => parsed.options,
  getDefaultLibFileName: (o) => ts.getDefaultLibFilePath(o),
  fileExists: ts.sys.fileExists,
  readFile: ts.sys.readFile,
  readDirectory: ts.sys.readDirectory,
  directoryExists: ts.sys.directoryExists,
  getDirectories: ts.sys.getDirectories,
};
const ls = ts.createLanguageService(host, ts.createDocumentRegistry());
const changes = ls.organizeImports({ type: 'file', fileName: pagePath, mode: ts.OrganizeImportsMode.RemoveUnused }, {}, undefined);
let pruned = out;
for (const fc of changes) {
  for (const tc of [...fc.textChanges].sort((a, b) => b.span.start - a.span.start)) {
    pruned = pruned.slice(0, tc.span.start) + tc.newText + pruned.slice(tc.span.start + tc.span.length);
  }
}
fs.writeFileSync(pagePath, pruned);
console.log(`Page rewritten: ${text.split('\n').length} -> ${pruned.split('\n').length} lines`);
