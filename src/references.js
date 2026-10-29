'use strict';
const ts = require('typescript');

function collectReferences(ast) {
  const references = new Map();
  function add(specifier, node, imported, local, syntax, typeOnly = false) {
    const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
    const list = references.get(specifier) || [];
    list.push({ imported, local, syntax, typeOnly, line });
    references.set(specifier, list);
  }
  function binding(name, addName) {
    if (ts.isIdentifier(name)) addName('*', name.text);
    else if (ts.isObjectBindingPattern(name)) {
      for (const part of name.elements) addName(part.dotDotDotToken ? '*' : part.propertyName?.text || part.name.getText(ast), part.name.getText(ast));
    } else addName('*', name.getText(ast));
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text, clause = node.importClause;
      if (!clause) add(spec, node, '', '', 'side-effect');
      else {
        if (clause.name) add(spec, node, 'default', clause.name.text, 'default', clause.isTypeOnly);
        if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) add(spec, node, '*', clause.namedBindings.name.text, 'namespace', clause.isTypeOnly);
        else for (const part of clause.namedBindings?.elements || []) add(spec, part, part.propertyName?.text || part.name.text, part.name.text, 'named', clause.isTypeOnly || part.isTypeOnly);
      }
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      const spec = node.moduleSpecifier.text;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const part of node.exportClause.elements) add(spec, part, part.propertyName?.text || part.name.text, part.name.text, 're-export', node.isTypeOnly || part.isTypeOnly);
      } else add(spec, node, '*', node.exportClause?.name?.text || '*', 're-export', node.isTypeOnly);
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression && ts.isStringLiteral(node.moduleReference.expression)) {
      add(node.moduleReference.expression.text, node, '*', node.name.text, 'require', node.isTypeOnly);
    }
    if (ts.isCallExpression(node) && node.arguments.length && ts.isStringLiteral(node.arguments[0]) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const spec = node.arguments[0].text;
      const syntax = node.expression.kind === ts.SyntaxKind.ImportKeyword ? 'dynamic' : 'require';
      let expression = node;
      if (ts.isAwaitExpression(expression.parent)) expression = expression.parent;
      if (ts.isVariableDeclaration(expression.parent) && expression.parent.initializer === expression) binding(expression.parent.name, (imported, local) => add(spec, node, imported, local, syntax));
      else if (ts.isPropertyAccessExpression(node.parent) && node.parent.expression === node) add(spec, node, node.parent.name.text, node.parent.name.text, syntax);
      else add(spec, node, '*', '', syntax);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return references;
}

function exportKinds(ast) {
  const declarations = new Map();
  const exports = new Map();
  for (const node of ast.statements) {
    const kind = ts.isFunctionDeclaration(node) ? 'function' : ts.isClassDeclaration(node) ? 'class' : ts.isInterfaceDeclaration(node) ? 'interface' : ts.isTypeAliasDeclaration(node) ? 'type' : ts.isEnumDeclaration(node) ? 'enum' : null;
    if (kind && node.name) declarations.set(node.name.text, kind);
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) declarations.set(declaration.name.text, declaration.initializer && (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) ? 'function' : 'variable');
      }
    }
  }
  for (const node of ast.statements) {
    const exported = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exported) {
      if (node.name) exports.set(node.name.text, declarations.get(node.name.text));
      if (ts.isVariableStatement(node)) for (const declaration of node.declarationList.declarations) if (ts.isIdentifier(declaration.name)) exports.set(declaration.name.text, declarations.get(declaration.name.text));
      if (node.modifiers.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)) exports.set('default', ts.isFunctionDeclaration(node) ? 'function' : ts.isClassDeclaration(node) ? 'class' : 'symbol');
    }
    if (ts.isExportDeclaration(node) && !node.moduleSpecifier && node.exportClause && ts.isNamedExports(node.exportClause)) for (const part of node.exportClause.elements) exports.set(part.name.text, declarations.get(part.propertyName?.text || part.name.text) || 'symbol');
    if (ts.isExportAssignment(node) && !node.isExportEquals) exports.set('default', ts.isIdentifier(node.expression) ? declarations.get(node.expression.text) || 'symbol' : ts.isArrowFunction(node.expression) || ts.isFunctionExpression(node.expression) ? 'function' : 'symbol');
  }
  return exports;
}
module.exports = { collectReferences, exportKinds };
