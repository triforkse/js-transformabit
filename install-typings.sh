#!/bin/sh

if [  ! -d "node_modules/@types" ]; then
  mkdir node_modules/@types
fi
if [ ! -d "node_modules/@types/ast-types" ]; then
  mkdir node_modules/@types/ast-types
fi
cp typings/ast-types.d.ts node_modules/@types/ast-types/index.d.ts
#mkdir node_modules/@types/jscodeshift
#cp typings/jscodeshift.d.ts node_modules/@types/jscodeshift/index.d.ts
