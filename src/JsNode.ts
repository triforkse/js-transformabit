/**
 * Contains various wrappers for AST nodes and AST node lists.
 */

import { ast, recast } from '../deps/bundle';

// Important! Even though recast just re-exports types from ast-types, JS will
// consider them to be different objects. When jscodeshift gets a ast.NodePath that
// was created in ast-types instead of recast, it won't recognise it and fail.
const visit = recast.visit;

export type TypeIdentifier = (ast.Node | ast.Type | string);
export type GenericJsNode = JsNode<ast.Node, any>;

export type JsNodeType<T extends GenericJsNode> = {
  new (): T;
  check?: (node: GenericJsNode) => boolean;
};

export type JsNodeProps = {
  [key: string]: any
};

export type JsNodeChildren = any[];

export type JsNodeMeta = {
  [key: string]: JsNodeMetaProp
};

export type JsNodeMetaProp = {
  fromProp?: (v: GenericJsNode) => any,
  fromChild?: Array<string | JsNodeType<any>>,
  fromChildren?: Array<string | JsNodeType<any>>,
  /**
   * Called for all non-JsNode values in props and children.
   */
  convert?: (s: string) => any,
  default?: any
};

export type JsNodeBuilder = (...args: any[]) => ast.Node;

export class InvalidTypeError extends Error {
  constructor(public typeId: string) {
    super(`Invalid type "${typeId}"; only annotated types are allowed`);
  }
}

/**
 * Represents a collection of nodes. These nodes can be anywhere in the AST.
 */
export class JsNodeList<T extends GenericJsNode> {
  protected _paths: ast.NodePath[] = [];
  protected _type: JsNodeType<T>;

  static fromPath<T extends GenericJsNode>(
    path: ast.NodePath, type?: JsNodeType<T>): JsNodeList<any> {

    const list = new JsNodeList(type);
    list._paths = path.map(p => p);
    return list;
  }

  static fromPaths<T extends GenericJsNode>(
    paths: ast.NodePath[], type?: JsNodeType<T>): JsNodeList<any> {

    const list = new JsNodeList(type);
    list._paths = paths;
    return list;
  }

  // for jscodeshift
  // static fromCollection(collection: Collection): JsNodeList<any> {
  //   const list = new JsNodeList();
  //   list._paths = collection.paths();
  //   return list;
  // }

  constructor(type?: JsNodeType<T>) {
    this._type = type;
  }

  /**
   * Returns the number of nodes in the collection.
   */
  size(): number {
    return this._paths.length;
  }

  /**
   * Returns the first element, or undefined if the collection is empty.
   */
  first(): T {
    if (this.size() > 0) {
      return this.at(0);
    }
  }

  /**
   * Returns the last element, or undefined if the collection is empty.
   */
  last(): T {
    let size = this.size();
    if (size > 0) {
      return this.at(size - 1);
    }
  }

  /**
   * If the node represents a collection of nodes, this method will pick the
   * node at a specified index.
   */
  at(index: number): T {
    return this.getTypedNode(index);
  }

  /**
   * Implements Iterator.
   */
  // private _pointer = 0;
  // next(): IteratorResult<T> {
  //   if (this._pointer < this._paths.length) {
  //     return {
  //       done: false,
  //       value: this.at(this._pointer++)
  //     }
  //   } else {
  //     return {
  //       done: true,
  //       value: undefined
  //     };
  //   }
  // }

  /**
   * Implements Iterable.
   */
  // [Symbol.iterator]() {
  //   return this;
  // }

  toList(): T[] {
    return this.map(node => node);
  }

  map(func: (node: T, index?: number) => any): any[] {
    return this._paths.map((value, index, array) =>
      func(this.getTypedNode(index), index));
  }

  filter(predicate: (node: T, index?: number) => boolean): this {
    this._paths = this._paths.filter((value, index) => predicate(this.getTypedNode(index), index));
    return this;
  }

  forEach(func: (node: T, index?: number) => any): this {
    this._paths.forEach((value, index) => func(this.getTypedNode(index), index));
    return this;
  }

  /**
   * Returns true if the predicate evaluates to true for any node in the
   * collection.
   */
  has(func: (node: T, index?: number) => any): boolean {
    for (let i = 0; i < this._paths.length; i++) {
      if (func(this.getTypedNode(i), i)) {
        return true;
      }
    }
    return false;
  }

  push(node: T): this {
    this._paths.push(node.path);
    return this;
  }

  pushPath(path: ast.NodePath): this {
    this._paths.push(path);
    return this;
  }

  removeAll(): this {
    this._paths.forEach(path => path.prune());
    return this;
  }

  copy(): JsNodeList<T> {
    return JsNodeList.fromPaths(this._paths.slice(0), this._type);
  }

  concat(list: JsNodeList<T>): JsNodeList<T> {
    const newList = new JsNodeList<T>();
    let type: JsNodeType<T>;
    if (this._type !== list._type) {
      throw new Error('Can not concatenate lists of different type');
    }
    return JsNodeList.fromPaths(this._paths.concat(list._paths), type);
  }

  nodes<T extends ast.Node>(): T[] {
    return this._paths.map(p => <T>p.value);
  }

  protected getTypedNode(index: number): T {
    if (index >= this._paths.length) {
      throw new Error('Index out of bounds');
    }
    if (this._type) {
      const node = new this._type();
      node.path = this._paths[index];
      return node;
    }
    return <T>JsNode.fromPath(this._paths[index]);
  }
}

function flatten(arr) {
  let ret = [];
  for (let i = 0; i < arr.length; i++) {
    if (Array.isArray(arr[i])) {
      ret = ret.concat(flatten(arr[i]));
    } else {
      ret.push(arr[i]);
    }
  }
  return ret;
}

/**
 * Represents a node in the AST tree.
 */
export class JsNode<T extends ast.Node, P> {
  static registeredTypes: { [typeName: string]: JsNodeType<any> } = {};

  static registerType() {
    return function(type: JsNodeType<any>) {
      JsNode.registeredTypes[type.name] = type;
    }
  }

  static getType<T extends GenericJsNode>(typeName: string): JsNodeType<T> {
    return JsNode.registeredTypes[typeName];
  }

  static isComplex(typeName: string): boolean {
    return JsNode.registeredTypes[typeName] === undefined;
  }

  static create<T extends GenericJsNode>(typeName: string): T {
    const type = JsNode.getType<T>(typeName);
    if (!type) {
      // TODO: once we have all node types implemented, we can throw here.
      // console.warn('Attempted to create unknown node type: ' + typeName);
      return <T>new JsNode<any, any>();
    }
    return new type();
  }

  static fromNode<T extends GenericJsNode>(astNode: ast.Node): T {
    let node = JsNode.create<T>(astNode.type.toString());
    node.node = astNode;
    return node;
  }

  static fromPath<T extends GenericJsNode>(path: ast.NodePath): T {
    const node = JsNode.create<T>(path.value.type.toString());
    node.path = path;
    return node;
  }

  static fromModuleCode(code: string, args?: Object): GenericJsNode {
    return JsNode.parse(code, args);
  }

  static fromCode<T extends GenericJsNode>(code: string, args?: Object): JsNodeList<T> {
    return JsNode
      .parse(code, args)
      .descend(n => n.node.type === 'Program')
      .children<T>();
  }

  // for jscodeshift
  // static fromCollection(collection: Collection): GenericJsNode {
  //   return JsNode.fromPath(collection.get());
  // }

  static fromExpressionStatement(code: string, args?: Object): GenericJsNode {
    return JsNode
      .parse(`() => ${code}`, args)
      .descend(n => n.node.type === 'ArrowFunctionExpression')
      .descend();
  }

  static fromFunctionBody<T extends GenericJsNode>(code: string, args?: Object): JsNodeList<T> {
    return JsNode
      .parse(`() => {${code}}`, args)
      .descend(n => n.node.type === 'BlockStatement')
      .children<T>();
  }

  static parse(code: string, args?: Object) {
    return JsNode.fromPath(new ast.NodePath(recast.parse(code, args)));
  }

  protected _path: ast.NodePath;

  /**
   * This is a required property to make TypeScript analyse property types.
   * It will always be undefined, do reference it in code!
   */
  props: P;

  /**
   * Contains information for building nodes from JsCode.
   */
  protected meta: JsNodeMeta = {};

  /**
   * Called when building AST nodes in build(). Every key in meta results in an
   * argument (in the order they are declared). The remaining arguments are the
   * children passed in JsCode, converted to AST nodes.
   */
  protected builder: JsNodeBuilder;

  /**
   * Specifies the types that are valid for children in JsCode.
   */
  protected childTypes: JsNodeType<any>[] = [JsNode];

  get sourceLocation() {
    return this.node.loc;
  }

  set sourceLocation(value: ast.SourceLocation) {
    this.node.loc = value;
  }

  hasParent(): boolean {
    return !!this._path && !!this._path.parent;
  }

  /**
   * Returns the source code for AST with this node as the root.
   */
  format(): string {
    return recast.print(this._path.value).code.replace(/\r/g, '');
  }

  /**
   * Like format(), but with newlines and indentation stripped.
   */
  formatStripped(): string {
    return this.format().replace(/\n([\s]*)/g, "");
  }

  /**
   * Returns a path object for the current AST root.
   *
   * For more information about Paths, see:
   * https://github.com/benjamn/ast-types
   */
  get path(): ast.NodePath {
    return this._path;
  }

  set path(path: ast.NodePath) {
    this._path = path;
  }

  /**
   * Returns a node object for the current AST root.
   *
   * For more information about Paths, see:
   * https://github.com/benjamn/ast-types
   */
  get node(): T {
    return this.path ? <T>this._path.value : null;
  }

  set node(node: T) {
    this._path = new ast.NodePath(node);
  }

  /**
   * Returns the type string for the current AST root, as specified by the
   * Mozilla Parser API:
   *
   * https://developer.mozilla.org/en-US/docs/Mozilla/Projects/SpiderMonkey/Parser_API
   */
  type(): string {
    return this._path.value.type;
  }

  /**
   * Returns true if this node can be converted to a complex node of a given
   * type. See castTo() for details on casting.
   */
  canCastTo<T extends GenericJsNode>(type: JsNodeType<T>): boolean {
    if (!type.check) {
      throw new Error('Can only cast to complex types');
    }
    return (this instanceof type) || type.check(this);
  }

  /**
   * Casts this node to a certain type.
   *
   * This is used to "upgrade" primitive nodes (like a ClassDeclaration) to a
   * corresponding complex node (like ReactClassComponent). It doesn't
   * influence the AST structure in any way, but provices the methods for that
   * specific complex type.
   *
   * A cast will always succeed, but may not always be meaningful. Unless you
   * know what you're doing, call canCastTo() first to make sure that the
   * current node is compatible.
   */
  castTo<T extends GenericJsNode>(type: JsNodeType<T>): T {
    if (this instanceof type) {
      return this;
    }
    if (!type.check) {
      throw new Error('Can only cast to complex types');
    }
    const node = new type();
    node.path = this.path;
    return node;
  }

  /**
   * Descends the AST and returns the next node that satisfies the
   * predicate callback.
   */
  descend<T extends GenericJsNode>(predicate?: (node: GenericJsNode) => boolean): T {
    let result: T;
    const self = this.node;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.node === self) {
          this.traverse(p);
        } else if (!result) {
          const node = JsNode.fromPath(p);
          if (!predicate || predicate(node)) {
            result = JsNode.fromPath<T>(p);
            return false;
          }
          this.traverse(p);
        } else {
          return false;
        }
      }
    });
    return result;
  }

  /**
   * Descends the AST and returns all nodes that satisfies the predicate.
   */
  findChildren<T extends GenericJsNode>(predicate: (node: T) => boolean,
    includeSelf: boolean = false): JsNodeList<T> {

    let result = new JsNodeList<T>();
    const self = this.node;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.node === self && !includeSelf) {
          this.traverse(p);
        } else {
          const node = JsNode.fromPath(p);
          if (predicate === undefined || predicate(<T>node)) {
            result.push(<T>node);
          }
          this.traverse(p);
        }
      }
    });
    return result;
  }

  /**
   * Descends the AST and returns the first node of a given type that satisfies
   * the predicate.
   */
  findFirstChildOfType<T extends GenericJsNode>(
    type: JsNodeType<T>, predicate?: (node: T) => boolean,
    includeSelf: boolean = false): T {

    let result: T;
    const checkType = this.checkType;
    const self = this.node;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.node === self && !includeSelf) {
          this.traverse(p);
        } else if (!result) {
          const node = JsNode.fromPath(p);
          if (checkType(node, type) && (!predicate || predicate(node))) {
            result = node.castTo(type);
            return false;
          }
          this.traverse(p);
        } else {
          return false;
        }
      }
    });
    if (result) {
      return result;
    }
  }

  /**
   * Descends the AST and returns all nodes of a given type that satisfy the
   * predicate.
   */
  findChildrenOfType<T extends GenericJsNode>(
    type: JsNodeType<T>, predicate?: (node: T) => boolean,
    includeSelf: boolean = false): JsNodeList<T> {

    let result = new JsNodeList<T>(type);
    const self = this;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.node === self.node && !includeSelf) {
          this.traverse(p);
        } else {
          const node = JsNode.fromPath(p);
          if (self.checkType(node, type) && (!predicate || predicate(node))) {
            result.pushPath(p);
          }
          this.traverse(p);
        }
      }
    });
    return result;
  }

  /**
   * Descends the AST and returns all nodes of several given types that satisfy
   * the predicate.
   */
  findChildrenOfTypes(
    types: JsNodeType<any>[], predicate?: (node: GenericJsNode) => boolean,
    includeSelf: boolean = false): JsNodeList<any> {

    let result = new JsNodeList<any>();
    const self = this;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.node === self.node && !includeSelf) {
          this.traverse(p);
        } else {
          const node = JsNode.fromPath(p);
          if (self.checkTypes(node, types) && (!predicate || predicate(node))) {
            result.pushPath(p);
          }
          this.traverse(p);
        }
      }
    });
    return result;
  }

  findClosestParentOfType<T extends GenericJsNode>(type: JsNodeType<T>): T {
    const matchedNode = <T>this.ascend(node => this.checkType(node, type));
    if (matchedNode) {
      // We can't just return matchedNode since it will always be a registered
      // type. In case we are looking for a complex type, we need to explicitly
      // construct it from the matched node.
      return matchedNode.castTo(type);
    }
  }

  findClosestScope(): GenericJsNode {
    const scope = this._path.scope && this._path.scope.path;
    if (scope) {
      return JsNode.fromPath(scope);
    }
  }

  /**
   * Ascends the AST and returns the first parent node that satisfies the
   * predicate callback.
   */
  ascend<T extends GenericJsNode>(predicate?: (node: GenericJsNode) => boolean): T {
    if (this._path.parent) {
      let currentPath = this._path.parent;
      if (predicate) {
        while (currentPath && !predicate(JsNode.fromPath(currentPath))) {
          currentPath = currentPath.parent;
        }
      }
      if (currentPath) {
        return JsNode.fromPath<T>(currentPath);
      }
    }
  }

  /**
   * Finds the first parent node of a given type.
   */
  findParentOfType<T extends GenericJsNode>(type: JsNodeType<T>): T {
    const matchedNode = <T>this.ascend(node => this.checkType(node, type));
    if (matchedNode) {
      // See findClosestParentOfType()
      return matchedNode.castTo(type);
    }
  }

  /**
   * Returns the node at the root of the current AST.
   */
  getRoot<T extends GenericJsNode>(): T {
    if (this._path.parent) {
      let path = this._path;
      while (path.parent) {
        path = path.parent;
      }
      return JsNode.fromPath<T>(path);
    }
  }

  /**
   * Replaces the current node with another.
   */
  replace(node: (GenericJsNode | ast.Node)): this {
    let astNode = this.toAstNode(node);
    if (!this._path.parent) {
      this._path = new ast.NodePath(astNode);
    } else {
      this._path.replace(astNode);
    }
    return this;
  }

  /**
   * Removes the sub-tree from the AST that has this node at the root.
   */
  remove(): void {
    if (this._path.parent) {
      this._path.prune();
    }
  }

  /**
   * Returns child nodes.
   */
  children<T extends GenericJsNode>(): JsNodeList<T> {
    const self = this.node;
    let children = new JsNodeList<T>();
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.parent && p.parent.node === self) {
          children.push(JsNode.fromPath<T>(p));
        }
        this.traverse(p);
      }
    });
    return children;
  }

  /**
   * Removes child nodes.
   */
  removeChildren(predicate?: (node: GenericJsNode) => boolean): this {
    const self = this.node;
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        if (p.parent && p.parent.node === self) {
          const node = JsNode.fromPath(p);
          if (predicate === undefined || predicate(node)) {
            p.prune();
          }
        }
        this.traverse(p);
      }
    });
    return this;
  }

  /**
   * Removes all child matching descendants.
   */
  removeDescendants(predicate: (node: GenericJsNode) => boolean): this {
    visit(this.node, {
      visitNode: function (p: ast.NodePath) {
        const node = JsNode.fromPath(p);
        if (predicate(node)) {
          p.prune();
        }
        this.traverse(p);
      }
    });
    return this;
  }

  /**
   * Inserts a new node as a sibling of the current node.
   */
  insertBefore(node: (GenericJsNode | ast.Node)): this {
    this._path.insertBefore(this.toAstNode(node));
    return this;
  }

  /**
   * Inserts a new node as a sibling of the current node.
   */
  insertAfter(node: (GenericJsNode | ast.Node)): this {
    this._path.insertAfter(this.toAstNode(node));
    return this;
  }

  /**
   * Finds an element using the findCallback, or creates the element using the
   * createCallback if no element was found.
   */
  findOrCreate<T extends GenericJsNode>(findCallback: () => T, createCallback: () => any): T {
    let node = findCallback.call(this);
    if (!node) {
      createCallback.call(this);
      node = findCallback.call(this);
    }
    return node;
  }

  /**
   * Assigns an AST node, which is constructed from props and children. This
   * method is usually only called through JsCode and requires the meta and
   * builder class properties to be assigned.
   */
  build(props: JsNodeProps, children: JsNodeChildren = [],
    meta?: JsNodeMeta, builder?: JsNodeBuilder): this {

    meta = meta || this.meta;
    builder = builder || this.builder;
    children = flatten(children);
    // Create AST nodes from meta definitions
    // map() auto-converts JsNode instances to AST nodes
    const nodes = this
      .buildNodes(props, children, meta)
      .map(n => n instanceof JsNode ? n.node : n);
    if (children.length > 0) {
      throw new Error(`${this.constructor.name}: Invalid children: ${children}`);
    }
    // Invoke builder
    try {
      this.node = (builder as any)(...nodes);
    }
    catch (e) {
      console.error('AST nodes passed to the builder:\n', nodes);
      throw new Error(`Failed run the AST builder for ${this.constructor.name}: ${e.message}`);
    }
    if (this.node === undefined) {
      throw new Error(`Builder for ${this.constructor.name} did not return anything`);
    }
    return this;
  }

  /**
   * Helper to check a type.
   */
  protected checkType<T extends GenericJsNode>(
    node: GenericJsNode, type: JsNodeType<T>): node is T {

    return type.check ? type.check(node) : node instanceof type;
  }

  /**
   * Helper to check multiple types.
   */
  protected checkTypes(node: GenericJsNode, types: JsNodeType<any>[]): boolean {
    for (const type of types) {
      if (this.checkType(node, type)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Helper to unwrap a node to an ast-types node.
   */
  protected toAstNode(node: (GenericJsNode | ast.Node)): ast.Node {
    return (node instanceof JsNode) ? node.node : node;
  }

  protected getProp<T>(propertyName: string): T {
    return <T>this.node[propertyName];
  }

  /**
   * Gets the node that wraps a property of the current node.
   */
  protected getNodeForProp<T extends GenericJsNode>(props: (string | string[])): T {
    return JsNode.fromPath<T>(this.resolvePropPath(props));
  }

  /**
   * Get a list of nodes that wrap a property of the current node.
   */
  protected getNodesForProp<T extends GenericJsNode>(
    props: (string | string[]), type?: JsNodeType<T>): JsNodeList<T> {

    return JsNodeList.fromPath(this.resolvePropPath(props), type);
  }

  /**
   * Navigates an AST tree by following a chain of property names.
   */
  protected resolvePropPath(props: (string | string[])): ast.NodePath {
    if (props instanceof Array) {
      let path = this._path;
      props.forEach(s => {
        path = path.get(s);
      });
      return path;
    } else {
      return this._path.get(props);
    }
  }

  /**
   * Returns the AST node if the argument is a JsNode. Calls the fallback
   * callback, otherwise.
   */
  protected getNodeOrFallback<T extends ast.Node>(obj: (string | GenericJsNode),
    fallback: (s: string) => T): T {

    return (typeof obj === 'string') ? <T>fallback(obj) : <T>obj.node;
  }

  /**
   * Repairs the node after modifications occurred somewhere in its AST.
   *
   * This re-establishes all parent relationships.
   */
  protected repair(): this {
    // TODO
    // this.path = JsNode.fromCollection(js(this.node)).path;
    return this;
  }

  /**
   * Maps each key in the meta object to an AST node.
   *
   * Important: if a child was mapped to a node it will be removed in-place from
   * the children array!
   */
  private buildNodes(props: JsNodeProps, children: JsNodeChildren, meta: JsNodeMeta) {
    return Object.keys(meta).map(metaPropName => {
      const metaProp = meta[metaPropName];
      const node =
        this.buildNodeFromProp(props[metaPropName], metaProp) ||
        this.buildNodeFromChild(children, metaProp) ||
        this.buildNodeFromChildren(children, metaProp) ||
        this.buildNodeFromDefault(metaProp);
      if (node === undefined) {
        console.error('Properties and children:', props, children);
        throw new Error(
          `${this.constructor.name}: missing child or property for "${metaPropName}"`
        );
      }
      return node;
    });
  }

  private buildConvert(v, metaProp: JsNodeMetaProp) {
    if (v instanceof JsNode) {
      return v.node;
    } else if (metaProp.convert) {
      return metaProp.convert(v);
    } else {
      return v;
    }
  }

  private buildCheckType(child, type) {
    return (typeof type === 'string') ?
     typeof child === 'string' : child instanceof type;
  }

  private buildNodeFromProp(prop: any, metaProp: JsNodeMetaProp) {
    if (prop && metaProp.fromProp) {
      return this.buildConvert(metaProp.fromProp(prop), metaProp);
    }
  }

  private buildNodeFromChild(children: JsNodeChildren, metaProp: JsNodeMetaProp) {
    if (metaProp.fromChild) {
      for (let i = 0; i < children.length; i++) {
        // Figure out if the child matches at least one of the type constraints
        if (metaProp.fromChild.some(type => this.buildCheckType(children[i], type))) {
          // We're done with this child; remove it from the input
          const child = children.splice(i, 1)[0];
          return this.buildConvert(child, metaProp);
        }
      }
    }
  }

  private buildNodeFromChildren(children: JsNodeChildren, metaProp: JsNodeMetaProp) {
    if (metaProp.fromChildren) {
      let matches = [];
      for (let i = 0; i < children.length; i++) {
        // Figure out if the child matches at least one of the type constraints
        if (metaProp.fromChildren.some(type => this.buildCheckType(children[i], type))) {
          // We're done with this child; remove it from the input
          const child = children.splice(i--, 1)[0];
          matches.push(this.buildConvert(child, metaProp));
        }
      }
      return matches;
    }
  }

  private buildNodeFromDefault(metaProp: JsNodeMetaProp) {
    if (metaProp.default !== undefined) {
      return (typeof metaProp.default === 'function') ? metaProp.default() : metaProp.default;
    }
  }
}

// Use global augmentation to resolve JsCode types
declare global {
  namespace JSX {
    interface Element extends GenericJsNode { }
    interface ElementAttributesProperty {
      props: any;
    }
  }
}

/**
 * A compositional decorator for nodes that contain a list of other nodes.
 */
export function JsContainerNode(options?: {
  getChildNodes?: () => ast.Node[]
}) {
  return function(type: JsNodeType<any>) {
    type.prototype.getChildNodes = (options && options.getChildNodes) ?
      options.getChildNodes :
      function(): ast.Node[] {
        return this.node.body;
      };
    type.prototype.append = function(node: GenericJsNode) {
      this.getChildNodes().push(node.node);
      return this;
    };
    type.prototype.insert = function(index: number, node: GenericJsNode) {
      this.getChildNodes().splice(index, 0, node.node);
      return this;
    };
    type.prototype.prepend = function(node: GenericJsNode) {
      this.getChildNodes().splice(0, 0, node.node);
      return this;
    };
  };
}
