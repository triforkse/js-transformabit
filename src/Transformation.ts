import { GenericJsNode } from './JsNode';
import { Project } from './Project';

export interface Transformation {
  configure(...args: any[]): void;
  check?(root: GenericJsNode, project: Project): boolean;
  apply(root: GenericJsNode, project: Project): GenericJsNode;
}

export type TransformationClass<T extends Transformation> = {
  new(): T
  name: string;
};
