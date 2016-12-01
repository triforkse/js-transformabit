import {
  VariableDeclaration,
  VariableDeclarator,
  VariableKind,
  Literal,
  Identifier,
  CallExpression,
  BlockStatement,
  FunctionDeclaration,
  ExpressionStatement,
  JsCode
} from './jscode';

import { JsNode } from './jsnode';
import { namedTypes as t } from 'ast-types';

describe('demo', () => {
  it('insert into method body', () => {
    let code =
`class Foo {
  bar() {}
}`;
    let expectedCode =
`class Foo {
  bar() {
    let baz = 42;
  }
}`;
    let node = JsNode.fromModuleCode(code);
    node
      .findFirstChildOfType(t.MethodDefinition)
      .findFirstChildOfType(t.BlockStatement)
      .replace(
        <BlockStatement>
          <VariableDeclaration name='baz' kind={VariableKind.Let}>
            <Literal value={42}/>
          </VariableDeclaration>
        </BlockStatement>
      );
    expect(node.format()).toBe(expectedCode);
  });
});