/// <reference path="../typings/jscodeshift.d.ts" />

import {
  Node,
  NodePath,
  Type,
  Expression,
  builders
} from 'ast-types';
import { Collection } from 'jscodeshift-collection';
import * as js from 'jscodeshift';

// Important! Even though recast just re-exports types from ast-types, JS will
// consider them to be different objects. When jscodeshift gets a NodePath that
// was created in ast-types instead of recast, it won't recognise it and fail.
const visit = require('recast').visit;

export type TypeIdentifier = (Node | Type | string);
export type GenericJsNode = JsNode<Node, any>;
export type JsNodeType<T extends GenericJsNode> = {
  new(): T,
  check?: (node: GenericJsNode) => boolean
};

export class InvalidTypeError extends Error {
  constructor(public typeId: string) {
    super(`Invalid type "${typeId}"; only annotated types are allowed`);
  }
}

export class JsNodeFactory {
  static registeredTypes: {[typeName: string]: JsNodeType<any>} = {};

  static registerType(type: JsNodeType<any>): void {
    JsNodeFactory.registeredTypes[type.name] = type;
  }

  static getType<T extends GenericJsNode>(typeName: string): JsNodeType<T> {
    return JsNodeFactory.registeredTypes[typeName];
  }

  static create<T extends GenericJsNode>(typeName: string): T {
    const type = JsNodeFactory.getType<T>(typeName);
    if (!type) {
      // console.warn('Attempted to create unknown node type: ' + typeName);
      return <T>new JsNode<any, any>();
    }
    return new type();
  }
}

/**
 * Represents a collection of nodes. These nodes can be anywhere in the AST.
 */
export class JsNodeList<T extends GenericJsNode> {
  protected _paths: NodePath[] = [];

  static fromPath(path: NodePath): JsNodeList<any> {
    const list = new JsNodeList();
    list._paths = path.map(p => p);
    return list;
  }

  static fromPaths(paths: NodePath[]): JsNodeList<any> {
    const list = new JsNodeList();
    list._paths = paths;
    return list;
  }

  static fromCollection(collection: Collection): JsNodeList<any> {
    const list = new JsNodeList();
    list._paths = collection.paths();
    return list;
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
    if (index >= this._paths.length) {
      throw new Error('Index out of bounds');
    }
    return <T>JsNode.fromPath(this._paths[index]);
  }

  map(func: (node: T, index?: number) => any): any[] {
    return this._paths.map((value, index, array) =>
      func(<T>JsNode.fromPath(value), index));
  }

  filter(predicate: (node: T, index?: number) => boolean): JsNodeList<T> {
    return JsNodeList.fromPaths(this._paths.filter((value, index, array) =>
      predicate(<T>JsNode.fromPath(value), index)));
  }

  forEach(func: (node: T, index?: number) => any): void {
    this._paths.forEach((value, index, array) =>
      func(<T>JsNode.fromPath(value), index));
  }

  /**
   * Returns true if the predicate evaluates to true for any node in the
   * collection.
   */
  has(func: (node: T, index?: number) => any): boolean {
    for (let i = 0; i < this._paths.length; i++) {
      if (func(<T>JsNode.fromPath(this._paths[i]), i)) {
        return true;
      }
    }
    return false;
  }

  push(node: T): this {
    this._paths.push(node.path);
    return this;
  }

  pushPath(path: NodePath): this {
    this._paths.push(path);
    return this;
  }

  removeAll(): this {
    this._paths.forEach(path => path.prune());
    return this;
  }

  // TODO: find a way to properly type this array or remove the method
  // toArray(): GenericJsNode[] {
  //   return this._paths.map(path => JsNode.fromPath(path));
  // }
}

/**
 * Represents a node in the AST tree.
 */
export class JsNode<T extends Node, P> {
  protected _path: NodePath;

  public props: P;

  static fromNode<T extends GenericJsNode>(astNode: Node): T {
    let node = JsNodeFactory.create<T>(astNode.type.toString());
    node.node = astNode;
    return node;
  }

  static fromPath<T extends GenericJsNode>(path: NodePath): T {
    const node = JsNodeFactory.create<T>(path.value.type.toString());
    node.path = path;
    return node;
  }

  static fromModuleCode(code: string, args?: Object): GenericJsNode {
    return JsNode.fromCollection(js(code, args));
  }

  static fromCode<T extends GenericJsNode>(code: string, args?: Object): JsNodeList<T> {
    return JsNode
      .fromCollection(js(code, args).find('Program'))
      .children<T>();
  }

  static fromCollection(collection: Collection): GenericJsNode {
    return JsNode.fromPath(collection.get());
  }

  static fromExpressionStatement(code: string, args?: Object): GenericJsNode {
    return JsNode
      .fromCollection(js(`() => ${code}`, args).find('ArrowFunctionExpression'))
      .descend();
  }

  static fromFunctionBody<T extends GenericJsNode>(code: string, args?: Object): JsNodeList<T> {
    return JsNode
      .fromCollection(js(`() => {${code}}`, args).find('BlockStatement'))
      .children<T>();
  }

  hasParent(): boolean {
    return !!this._path && !!this._path.parent;
  }

  /**
   * Returns the source code for the

   */
  format(): string {
    return js(this._path.value).toSource().replace(/\r/g, '');
  }

  /**
   * Returns a path object for the current AST root.
   *
   * For more information about Paths, see:
   * https://github.com/benjamn/ast-types
   */
  get path(): NodePath {
    return this._path;
  }

  set path(path: NodePath) {
    this._path = path;
  }

  /**
   * Returns a node object for the current AST root.
   *
   * For more information about Paths, see:
   * https://github.com/benjamn/ast-types
   */
  get node(): T {
    return <T>this._path.value;
  }

  set node(node: T) {
    this._path = new NodePath(node);
  }

  build(props: P, children: any[]): JsNode<T, P> {
    this.props = props;
    if (!this.node || !this.node.type) {
      throw new Error(`${this.constructor.name}.build() did not assign a valid node`);
    }
    // console.warn(this.constructor.name, this.node);
    return this;
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
   * Returns true if the node type matches the specified type.
   */
  check<T extends GenericJsNode>(type: JsNodeType<T>): this is T {
    if (type.check) {
      // If the type has a static check(), use that one instead. This allows
      // complex types to perform more sophisticated checks.
      return type.check(this);
    }
    return this.type() === type.name;
  }

  findFirstChildOfType<T extends GenericJsNode>(type: JsNodeType<T>): T {
    const matchedNode = <T>this.descend(node => node.check(type));
    // We can't just return matchedNode since it will always be a registered
    // type. In case we are looking for a complex type, we need to explicitly
    // construct it from the matched node.
    const node = new type();
    node.path = matchedNode.path;
    return node;
  }

  findClosestParentOfType<T extends GenericJsNode>(type: JsNodeType<T>): T {
    const matchedNode = <T>this.ascend(node => node.check(type));
    if (matchedNode) {
      // See findFirstChildOfType()
      const node = new type();
      node.path = matchedNode.path;
      return node;
    }
  }

  findClosestScope(): GenericJsNode {
    const scope = this._path.scope && this._path.scope.path;
    if (scope) {
      return JsNode.fromPath(scope);
    }
  }

  /**
   * Descends the AST and returns the next node that satisfies the
   * predicate callback.
   */
  descend<T extends GenericJsNode>(predicate?: (node: GenericJsNode) => boolean): T {
    let result: NodePath;
    const self = this.node;
    visit(this.node, {
      visitNode: function(p: NodePath) {
        if (p.node === self) {
          this.traverse(p);
        } else if (!result) {
          const node = JsNode.fromPath(p);
          if (predicate === undefined || predicate(node)) {
            result = p;
            return false;
          }
          this.traverse(p);
        }
        return false;
      }
    });
    if (result) {
      return JsNode.fromPath<T>(result);
    }
  }

  /**
   * Descends the AST and returns all nodes that satisfies the predicate.
   */
  find<T extends GenericJsNode>(predicate: (node: T) => boolean): JsNodeList<T> {
    let result = new JsNodeList<T>();
    const self = this.node;
    visit(this.node, {
      visitNode: function(p: NodePath) {
        if (p.node === self) {
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
   * Descends the AST and returns all nodes that satisfies the predicate.
   */
  findChildrenOfType<T extends GenericJsNode>(
    type: JsNodeType<T>, predicate?: (node: T) => boolean,
    includeSelf: boolean = false): JsNodeList<T> {

    let result = new JsNodeList<T>();
    const self = this.node;
    visit(this.node, {
      visitNode: function(p: NodePath) {
        if (p.node === self && !includeSelf) {
          this.traverse(p);
        } else {
          const node = JsNode.fromPath(p);
          if (node.check(type) && (!predicate || predicate(node))) {
            result.push(node);
          }
          this.traverse(p);
        }
      }
    });
    return result;
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
    const matchedNode = <T>this.ascend(node => node.check(type));
    // See findFirstChildOfType()
    const node = new type();
    node.path = matchedNode.path;
    return node;
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
  replace(node: (GenericJsNode | Node)): this {
    let astNode = this.toAstNode(node);
    if (!this._path.parent) {
      this._path = new NodePath(astNode);
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
      visitNode: function(p: NodePath) {
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
      visitNode: function(p: NodePath) {
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
      visitNode: function(p: NodePath) {
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
  insertBefore(node: (GenericJsNode | Node)): this {
    this._path.insertBefore(this.toAstNode(node));
    return this;
  }

  /**
   * Inserts a new node as a sibling of the current node.
   */
  insertAfter(node: (GenericJsNode | Node)): this {
    this._path.insertAfter(this.toAstNode(node));
    return this;
  }

  /**
   * Helper to unwrap a node to an ast-types node.
   */
  protected toAstNode(node: (GenericJsNode | Node)): Node {
    return (node instanceof JsNode) ? node.node : node;
  }

  /**
   * Gets the node that wraps a property of the current node.
   */
  protected getNode<T extends GenericJsNode>(propertyName: string): T {
    return JsNode.fromPath<T>(this._path.get(propertyName));
  }

  /**
   * Get a list of nodes that wrap a property of the current node.
   */
  protected getNodes<T extends GenericJsNode>(propertyName: string): JsNodeList<T> {
    return JsNodeList.fromPath(this._path.get(propertyName));
  }

  /**
   * Returns the AST node if the argument is a JsNode. Calls the fallback
   * callback, otherwise.
   */
  protected getNodeOrFallback<T extends Node>(obj: (string | GenericJsNode),
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

  protected morph<T extends GenericJsNode>(type: JsNodeType<T>): T {
    let node = new type();
    node.path = this.path;
    return node;
  }
}

// Use global augmentation to resolve JsCode types
declare global {
  namespace JSX {
    interface Element extends GenericJsNode {}
    interface ElementAttributesProperty {
      props: any;
    }
  }
}
