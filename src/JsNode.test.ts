import { JsNode, JsNodeList } from './JsNode';
import { JsCode } from './JsCode';
import { ast } from '../deps/bundle';
import * as js from './Js';

const b = ast.builders;

describe('JsNodeList', () => {
  it('create', () => {
    const code = 'let foo, bar; let baz;';
    const node = JsNode.fromModuleCode(code);
    const identifiers = node.findChildrenOfType(js.Identifier);
    expect(identifiers.size()).toBe(3);
    expect(identifiers.at(2).node.name).toBe('baz');
  });

  it('iterate', () => {
    const code = 'let foo, bar; let baz;';
    const identifiers = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier);
    // This feature will work as soon as we start targeting ES6.
    // for (let id of identifiers) {
    //   expect(id).toBeDefined();
    // }
    for (let id of identifiers.toList()) {
      expect(id).toBeDefined();
    }
  });

  it('map', () => {
    const code = 'let foo, bar; let baz;';
    const identifiers = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier)
      .map(n => n.node.name)
      .join();
    expect(identifiers).toBe('foo,bar,baz');
  });

  it('filter', () => {
    const code = 'let foo, bar; let baz;';
    const identifiers = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier)
      .filter(n => n.node.name === 'bar');
    expect(identifiers.size()).toBe(1);
    expect(identifiers.at(0).format()).toBe('bar');
  });

  it('forEach', () => {
    const code = 'let foo, bar; let baz;';
    const node = JsNode.fromModuleCode(code);
    node
      .findChildrenOfType(js.Identifier)
      .forEach(n => n.node.name = n.node.name.split('').reverse().join(''));
    expect(node.format()).toBe('let oof, rab; let zab;');
  });

  it('has', () => {
    const code = 'let foo, bar; let baz;';
    const nodes = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier);
    expect(nodes.has(n => n.node.name === 'baz')).toBe(true);
    expect(nodes.has(n => n.node.name === 'qux')).toBe(false);
  });

  it('push', () => {
    const code = 'let foo, bar; let baz;';
    const nodes = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier);
    const list = new JsNodeList();
    list.push(nodes.at(1));
    list.pushPath(nodes.at(0).path);
    expect(list.size()).toBe(2);
    expect(list.at(0).format()).toBe('bar');
    expect(list.at(1).format()).toBe('foo');
  });

  it('remove all', () => {
    const code = 'let foo = 23, bar = 42;';
    let node = JsNode.fromModuleCode(code);
    node
      .findChildrenOfType(js.Literal)
      .removeAll();
    expect(node.format()).toBe('let foo, bar;');
  });

  it('concat', () => {
    const list1 = JsNode
      .fromModuleCode('let foo;')
      .findChildrenOfType(js.Identifier);
    const list2 = JsNode
      .fromModuleCode('let bar;')
      .findChildrenOfType(js.Identifier);
    const concat = list1.concat(list2);
    expect(concat.size()).toBe(2);
    expect(concat.at(0).format()).toBe('foo');
    expect(concat.at(1).format()).toBe('bar');
  });

  it('nodes', () => {
    const code = 'let foo, bar; let baz;';
    const nodes = JsNode.fromModuleCode(code)
      .findChildrenOfType(js.Identifier)
      .nodes<ast.Identifier>();
    expect(nodes.length).toBe(3);
    expect(nodes[0].name).toBe('foo');
    expect(nodes[1].name).toBe('bar');
    expect(nodes[2].name).toBe('baz');
  });
});

describe('JsNode', () => {
  it('create node via factory', () => {
    expect(JsNode.create('Identifier')).toBeInstanceOf(js.Identifier);
  });

  it('check super class type', () => {
    const code = 'this.foo = bar;';
    const node = JsNode.fromModuleCode(code).findFirstChildOfType(js.ThisExpression);
    expect(node).toBeInstanceOf(js.ThisExpression);
    expect(node).toBeInstanceOf(js.Expression);
  });

  it('create & format', () => {
    const code = 'const foo = 42;';
    expect(JsNode.fromModuleCode(code).format()).toBe(code);
  });

  it('create from module', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromModuleCode(code);
    expect(node).toBeInstanceOf(js.File);
  });

  it('create from code', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromCode(code).first();
    expect(node).toBeInstanceOf(js.VariableDeclaration);
  });

  it('create from expression statement', () => {
    const code = '<div>foo!</div>';
    const node = JsNode.fromExpressionStatement(code);
    expect(node.format()).toBe(code);
  });

  it('create from function body', () => {
    const code = 'let foo = 42; return foo;';
    const nodes = JsNode.fromFunctionBody(code);
    expect(nodes.at(1).format()).toBe('return foo;');
  });

  it('cast', () => {
    const code = 'let foo;';
    const node = JsNode.fromModuleCode(code).findFirstChildOfType(js.Identifier);
    // TODO: strangely enough, Jest complains about this throwing an error
    // expect(node.canCastTo(js.Expression)).toThrow();
    expect(node.castTo(js.Expression)).toBeInstanceOf(js.Expression);
  });

  it('descend', () => {
    const code = 'const foo = 42;';
    let node = JsNode.fromCode(code).first().descend();
    expect(node.format()).toBe('foo = 42');
    node = JsNode.fromModuleCode(code).descend(node => node instanceof js.Literal);
    expect(node.format()).toBe('42');
  });

  it('find children', () => {
    const code = 'const foo = 42, bar = 23;';
    let nodes = JsNode.fromCode(code)
      .first()
      .findChildren<js.Identifier>(node => node instanceof js.Identifier);
    expect(nodes.map(n => n.name).join()).toBe('foo,bar');
  });

  it('chain find calls', () => {
    const code = 'class Foo { bar() {} };';
    const method = JsNode
      .fromModuleCode(code)
      .findFirstChildOfType(js.MethodDefinition);
    expect(method.format()).toBe('bar() {}');
    const block = method.findFirstChildOfType(js.BlockStatement);
    expect(block.format()).toBe('{}');
  });

  it('find children of type', () => {
    const code = 'const foo = 42, bar = 23;';
    const identifiers = JsNode
      .fromModuleCode(code)
      .findChildrenOfType(js.Identifier);
    expect(identifiers.size()).toBe(2);
    expect(identifiers.at(0).name).toBe('foo');
    expect(identifiers.at(1).name).toBe('bar');
  });

  it('find children of types', () => {
    const code = 'const foo = 42, bar = 23;';
    const nodes = JsNode
      .fromModuleCode(code)
      .findChildrenOfTypes([js.Identifier, js.Literal]);
    expect(nodes.size()).toBe(4);
    expect(nodes.at(0).format()).toBe('foo');
    expect(nodes.at(1).format()).toBe('42');
    expect(nodes.at(2).format()).toBe('bar');
    expect(nodes.at(3).format()).toBe('23');
  });

  it('find first child of type', () => {
    const code = 'const foo = 42;';
    let node = JsNode.fromCode(code)
      .first()
      .findFirstChildOfType(js.Identifier)
      .findChildrenOfType(js.Identifier, null, true)
      .first();
    expect(node.format()).toBe('foo');
  });

  it('find closest parent', () => {
    const code = 'class Foo { bar() {} }';
    const node = JsNode.fromModuleCode(code);
    const method = node.findFirstChildOfType(js.MethodDefinition);
    expect(method.format()).toBe('bar() {}');
    const program = method.findClosestParentOfType(js.Program);
    expect(program.format()).toBe(code);
  });

  it('find closest scope', () => {
    const code = 'function foo() { const foo = 42; }';
    const node = JsNode.fromModuleCode(code)
      .findFirstChildOfType(js.VariableDeclaration)
      .findClosestScope();
    expect(node.type()).toBe('FunctionDeclaration');
    expect(node.format()).toBe(code);
  });

  it('ascend', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromModuleCode(code).findFirstChildOfType(js.Literal);
    expect(node.ascend().format()).toBe('foo = 42');
    expect(node.ascend(node => node instanceof js.Program).format()).toBe(code);
  });

  it('find parent of type', () => {
    const code = 'class Foo { bar() { let foo; } }';
    const node = JsNode.fromModuleCode(code).findFirstChildOfType(js.VariableDeclaration);
    expect(node.findParentOfType(js.ClassBody).format()).toBe('{ bar() { let foo; } }');
  });

  it('get root', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromModuleCode(code);
    const literal = node.findFirstChildOfType(js.Literal);
    expect(literal.format()).toBe('42');
    expect(literal.getRoot().format()).toBe(code);
  });

  it('replace', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromModuleCode(code);
    node
      .findFirstChildOfType(js.Literal)
      .replace(ast.builders.literal(23));
    expect(node.format()).toBe(code.replace('42', '23'));
  });

  it('remove', () => {
    const code = 'const foo = 42;';
    const node = JsNode.fromModuleCode(code);
    node
      .findFirstChildOfType(js.Literal)
      .remove();
    expect(node.format()).toBe('const foo;');
  });

  it('get children', () => {
    const code = 'class Foo { bar() { return 23; } baz() { return 42; } }';
    const node = JsNode.fromModuleCode(code);
    const children = node
      .findFirstChildOfType(js.ClassBody)
      .children();
    expect(children.size()).toBe(2);
    expect(children.at(0).format()).toBe('bar() { return 23; }');
    expect(children.at(1).format()).toBe('baz() { return 42; }');
  });

  it('remove children', () => {
    const code = 'class Foo { bar() { return 23; } baz() { return 42; } }';
    const node = JsNode.fromModuleCode(code);
    node
      .findFirstChildOfType(js.ClassBody)
      .removeChildren();
    expect(node.format()).toBe('class Foo {}');
  });

  it('remove ancestors', () => {
    const code = 'class Foo { bar() { return 23; } baz() { return 42; } }';
    const node = JsNode.fromModuleCode(code);
    node.removeDescendants(node => node instanceof js.ReturnStatement);
    expect(node.format()).toBe('class Foo { bar() {} baz() {} }');
  });

  it('insert before/after', () => {
    const code = 'let foo; let bar;';
    let baz = b.variableDeclaration('let', [
      b.variableDeclarator(b.identifier('baz'), null)
    ]);
    expect(JsNode.fromModuleCode(code)
      .findFirstChildOfType(js.VariableDeclaration)
      .insertAfter(baz)
      .getRoot()
      .format()
    ).toBe('let foo;\nlet baz;\nlet bar;');
    expect(JsNode.fromModuleCode(code)
      .findFirstChildOfType(js.VariableDeclaration)
      .insertBefore(baz)
      .getRoot()
      .format()
    ).toBe('let baz;\nlet foo;let bar;');
    // TODO: insertBefore/After does not work with Identifiers for some reason
    // expect(JsNode.fromModuleCode(code)
    //   .findFirstChildOfType(js.VariableDeclaration)
    //   .insertAfter(js.Identifier.fromName('foo'))
    //   .getRoot()
    //   .format()
    // ).toBe('let baz;\nlet foo;let bar;');
  });

  it('find or create', () => {
    const code = 'class Foo {}';
    const node = JsNode
      .fromModuleCode(code)
      .findFirstChildOfType(js.ClassDeclaration);
    node.findOrCreate(node.findConstructor, node.createConstructor);
    expect(node.formatStripped()).toBe('class Foo {constructor() {super();}}');
  });

  it('append method to class body', () => {
    const code = 'class Foo {}';
    const node = JsNode.fromModuleCode(code);
    node
      .findFirstChildOfType(js.ClassBody)
      .addMethod(
        b.methodDefinition('method',
          b.identifier('bar'),
          b.functionExpression(null, [], b.blockStatement([]))
        )
      );
    expect(node.formatStripped()).toBe('class Foo {bar() {}}');
  });

  it('repairs parent relationship', () => {
    const code = 'class Foo {}';
    const node = JsNode.fromModuleCode(code);
    const foo = node
      .findFirstChildOfType(js.ClassBody)
      .addMethod(
        b.methodDefinition('method',
          b.identifier('bar'),
          b.functionExpression(null, [], b.blockStatement([
            b.variableDeclaration('let', [
              b.variableDeclarator(b.identifier('foo'), null)
            ])
          ]))
        )
      )
      .findChildrenOfType(js.Identifier)
      .last();
    expect(foo.format()).toBe('foo');
    // Here is where it gets interesting: the class was partially constructed,
    // so we won't be able to traverse all the way to the root since the
    // constructed tree doesn't magically link to the original AST.
    // We should silently fix that behind the scenes.
    // TODO
    // expect(foo.getRoot().type()).toBe('File');
  });
});

describe('JsContainerNode', () => {
  it('append, prepend & insert', () => {
    const program = JsNode
      .fromModuleCode('')
      .findFirstChildOfType(js.Program);
    let node = JsNode.fromCode<js.GenericStatement>('let foo;').first();
    expect(program.append(node).format()).toBe('let foo;');
    node = JsNode.fromCode<js.GenericStatement>('let bar;').first();
    expect(program.prepend(node).format()).toBe('let bar;let foo;');
    node = JsNode.fromCode<js.GenericStatement>('let baz;').first();
    expect(program.insert(1, node).format()).toBe('let bar;let baz;let foo;');
  });
});
