
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
  ReturnStatement,
  ThisExpression,
  MemberExpression,
  JsCode
} from './jscode'



describe('jscode', () => {

    it('VariableDeclaration', () => {
      let foo = <VariableDeclaration name="foo" kind={VariableKind.Let}></VariableDeclaration> as VariableDeclaration
      expect(foo.format()).toBe("let foo;");

      let bar = new VariableDeclaration({name: "bar"}, []);
      expect(bar.format()).toBe("var bar;");

      let letbar = new VariableDeclaration({name: "bar", kind: VariableKind.Let}, []);
      expect(letbar.format()).toBe("let bar;");

      let foobar = (
        <VariableDeclaration kind={VariableKind.Let}>
          <VariableDeclarator name="foo"/>
          <VariableDeclarator name="bar"/>
        </VariableDeclaration>
      ) as VariableDeclaration

      expect(foobar.format()).toBe("let foo, bar;");


      let age = <VariableDeclaration name="age" kind={VariableKind.Let}><Literal value={3}/></VariableDeclaration> as VariableDeclaration
      expect(age.format()).toBe("let age = 3;");


      let bananasInPajamas = (
        <VariableDeclaration kind={VariableKind.Const}>
          <VariableDeclarator name="b1">
            <Literal value={1}/>
          </VariableDeclarator>
          <VariableDeclarator name="b2">
            <Literal value={2}/>
          </VariableDeclarator>
        </VariableDeclaration>
      ) as VariableDeclaration

      expect(bananasInPajamas.format()).toBe("const b1 = 1, b2 = 2;");

    });

    it('Literal', () => {
      let int = new Literal({value: 8});
      let bol = new Literal({value: true});
      let str = new Literal({value: "Hello"});
    });


    it('CallExpression', () => {
      let foo = <CallExpression name="foo"/> as CallExpression
      expect(foo.format()).toBe("foo()");

      let isTall = (
          <CallExpression name="isTall">
            <Literal value={193}/>
            <Identifier name="isMale"/>
          </CallExpression>
      ) as CallExpression

      expect(isTall.format()).toBe("isTall(193, isMale)");

      let toString = (
          <CallExpression name="toString">
            {isTall}
          </CallExpression>
      ) as CallExpression

      expect(toString.format()).toBe("toString(isTall(193, isMale))");
    });

    it('BlockStatement', () => {
      let emptyBlock = (
        <BlockStatement></BlockStatement>
      ) as BlockStatement

      expect(emptyBlock.format()).toBe("{}");

      let simpleBlock = (
        <BlockStatement>
          <VariableDeclaration name="num" kind={VariableKind.Let}>
            <Literal value={3}/>
          </VariableDeclaration>
        </BlockStatement>
      ) as BlockStatement

      expect(simpleBlock.format().replace(/\n/g, "")).toBe("{    let num = 3;}");
    });


    it('FunctionDeclaration', () => {
      let empty = <FunctionDeclaration name="skip"/> as FunctionDeclaration
      expect(empty.format()).toBe("function skip() {}");

      let emptyWithParams = (
        <FunctionDeclaration name="foo">
          <Identifier name="bar"/>
          <Identifier name="baz"/>
        </FunctionDeclaration>
      ) as FunctionDeclaration
      expect(emptyWithParams.format()).toBe("function foo(bar, baz) {}");

      let blockWithNoParams = (
        <FunctionDeclaration name="foo">
          <BlockStatement>
            <VariableDeclaration name="num" kind={VariableKind.Let}>
              <Literal value={3}/>
            </VariableDeclaration>
          </BlockStatement>
        </FunctionDeclaration>
      ) as FunctionDeclaration
      expect(blockWithNoParams.format().replace(/\n/g, "")).toBe("function foo() {    let num = 3;}")

      let withParamsAndBody = (
        <FunctionDeclaration name="foo">
          <Identifier name="bar"/>
          <Identifier name="baz"/>
          <BlockStatement>
            <VariableDeclaration name="num" kind={VariableKind.Let}>
              <Literal value={3}/>
            </VariableDeclaration>
          </BlockStatement>
        </FunctionDeclaration>
      ) as FunctionDeclaration
      expect(withParamsAndBody.format().replace(/\n/g, "")).toBe("function foo(bar, baz) {    let num = 3;}")
    });

    it('ExpressionStatement', () => {
      let call = (
        <ExpressionStatement>
          <CallExpression name="foo"/>
        </ExpressionStatement>
      ) as ExpressionStatement
      expect(call.format()).toBe("foo();")

      let identifier = (
        <ExpressionStatement>
          <Identifier name="mevar"/>
        </ExpressionStatement>
      ) as ExpressionStatement
      expect(identifier.format()).toBe("mevar;");
    });

    it('ReturnStatement', () => {
      let bol = (
          <ReturnStatement>
            <Literal value={true}/>
          </ReturnStatement>
      ) as ReturnStatement
      expect(bol.format()).toBe("return true;");

      let func = (
        <ReturnStatement>
          <CallExpression name="toInt">
            <Identifier name="approx"/>
          </CallExpression>
        </ReturnStatement>
      ) as ReturnStatement
      expect(func.format()).toBe("return toInt(approx);");

      let nothing = (
        <ReturnStatement/>
      ) as ReturnStatement
      expect(nothing.format()).toBe("return;");
    });

    it('ThisExpression', () => {
      let ths = <ThisExpression/> as ThisExpression
      expect(ths.format()).toBe("this");
      let thss = new ThisExpression({},[]);
      expect(thss.format()).toBe("this");
    });


    it('MemberExpression', () => {
      let thisFoo = <MemberExpression object={new ThisExpression({}, [])} property={new Identifier({name: "foo"})}/> as ThisExpression
      expect(thisFoo.format()).toBe("this.foo");

      let noThis = <MemberExpression property={new Identifier({name: "bar"})}/> as ThisExpression
      expect(noThis.format()).toBe("this.bar");
    });

});
