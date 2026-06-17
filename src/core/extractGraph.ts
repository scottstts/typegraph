import {
  Node,
  SyntaxKind,
  type CallSignatureDeclaration,
  type ClassDeclaration,
  type EnumDeclaration,
  type ExpressionWithTypeArguments,
  type InterfaceDeclaration,
  type MethodDeclaration,
  type MethodSignature,
  type ParameterDeclaration,
  type Project,
  type PropertyDeclaration,
  type PropertySignature,
  type SourceFile,
  type Symbol,
  type TypeAliasDeclaration,
  type TypeElementTypes,
  type TypeNode
} from "ts-morph";
import type {
  TypeGraphEdge,
  TypeGraphEdgeKind,
  TypeGraphMember,
  TypeGraphMemberKind,
  TypeGraphNode,
  TypeGraphNodeKind,
  TypeGraphPayload
} from "../shared/graphTypes.js";
import { formatDisplayText } from "./formatDisplayText.js";
import { dirname, displayPath, isInsidePath, normalizePath } from "./pathUtils.js";
import {
  createExternalNode,
  createPrimitiveNode,
  externalNodeId,
  isPrimitiveTypeName,
  localNodeId,
  primitiveNodeId
} from "./primitives.js";
import {
  registerSymbol,
  resolveSymbolId,
  type SymbolIdMap
} from "./resolveReferences.js";

type LocalDeclaration =
  | TypeAliasDeclaration
  | InterfaceDeclaration
  | ClassDeclaration
  | EnumDeclaration;

type ExtractGraphOptions = {
  project: Project;
  projectRoot: string;
  tsconfigPath: string;
  scopePath?: string;
  source?: TypeGraphPayload["source"];
};

type LocalDeclarationRecord = {
  declaration: LocalDeclaration;
  id: string;
  name: string;
  kind: TypeGraphNodeKind;
};

type Reference = {
  id: string;
  kind: TypeGraphEdgeKind;
};

type ExtractContext = {
  projectRoot: string;
  nodes: Map<string, TypeGraphNode>;
  edges: Map<string, TypeGraphEdge>;
  declarations: LocalDeclarationRecord[];
  symbolIds: SymbolIdMap;
};

function isProjectSourceFile(sourceFile: SourceFile, projectRoot: string): boolean {
  const filePath = sourceFile.getFilePath();

  if (sourceFile.isDeclarationFile()) {
    return false;
  }

  if (!isInsidePath(projectRoot, filePath)) {
    return false;
  }

  const normalized = normalizePath(filePath);
  return !(
    normalized.includes("/node_modules/") ||
    normalized.includes("/dist/") ||
    normalized.includes("/.tmp/")
  );
}

function declarationKind(declaration: LocalDeclaration): TypeGraphNodeKind {
  if (Node.isTypeAliasDeclaration(declaration)) {
    return "typeAlias";
  }

  if (Node.isInterfaceDeclaration(declaration)) {
    return "interface";
  }

  if (Node.isClassDeclaration(declaration)) {
    return "class";
  }

  return "enum";
}

function getDeclarationSymbol(declaration: LocalDeclaration): Symbol | undefined {
  return declaration.getNameNode()?.getSymbol();
}

function getLocation(declaration: LocalDeclaration): Pick<
  TypeGraphNode,
  "startLine" | "startColumn" | "endLine" | "endColumn"
> {
  const sourceFile = declaration.getSourceFile();
  const start = sourceFile.getLineAndColumnAtPos(declaration.getStart());
  const end = sourceFile.getLineAndColumnAtPos(declaration.getEnd());

  return {
    startLine: start.line,
    startColumn: start.column,
    endLine: end.line,
    endColumn: end.column
  };
}

function createLocalNode(
  declaration: LocalDeclaration,
  id: string,
  name: string,
  kind: TypeGraphNodeKind,
  projectRoot: string
): TypeGraphNode {
  const filePath = declaration.getSourceFile().getFilePath();
  const relativeFilePath = displayPath(projectRoot, filePath);

  return {
    id,
    name,
    kind,
    filePath,
    relativeFilePath,
    ...getLocation(declaration),
    exported: declaration.isExported(),
    sourceText: declaration.getText(),
    displayText: formatDisplayText(declaration),
    members: [],
    dependsOn: [],
    dependedOnBy: [],
    scopePath: dirname(filePath),
    isProjectLocal: true,
    isPrimitiveLike: false,
    isExternal: false
  };
}

function ensureLocalDeclarations(context: ExtractContext, sourceFiles: SourceFile[]): void {
  for (const sourceFile of sourceFiles) {
    const declarations: LocalDeclaration[] = [
      ...sourceFile.getTypeAliases(),
      ...sourceFile.getInterfaces(),
      ...sourceFile.getClasses().filter((declaration) => declaration.getName() !== undefined),
      ...sourceFile.getEnums()
    ];

    for (const declaration of declarations) {
      const name = declaration.getName();
      if (name === undefined) {
        continue;
      }

      const kind = declarationKind(declaration);
      const relativeFilePath = displayPath(context.projectRoot, sourceFile.getFilePath());
      const baseId = localNodeId(relativeFilePath, name);
      const id = context.nodes.has(baseId)
        ? `${baseId}@${declaration.getStartLineNumber()}`
        : baseId;

      const node = createLocalNode(declaration, id, name, kind, context.projectRoot);
      context.nodes.set(id, node);
      context.declarations.push({ declaration, id, name, kind });
      registerSymbol(getDeclarationSymbol(declaration), id, context.symbolIds);
    }
  }
}

function ensurePrimitiveOrExternalNode(name: string, context: ExtractContext): string {
  if (isPrimitiveTypeName(name)) {
    const id = primitiveNodeId(name);
    if (!context.nodes.has(id)) {
      context.nodes.set(id, createPrimitiveNode(name));
    }
    return id;
  }

  const id = externalNodeId(name);
  if (!context.nodes.has(id)) {
    context.nodes.set(id, createExternalNode(name));
  }
  return id;
}

function edgeId(from: string, to: string, via: string, kind: TypeGraphEdgeKind): string {
  return `${from}->${to}:${kind}:${via}`;
}

function addEdge(
  context: ExtractContext,
  from: string,
  to: string,
  via: string,
  kind: TypeGraphEdgeKind
): void {
  if (from === to && kind !== "union" && kind !== "intersection") {
    return;
  }

  const id = edgeId(from, to, via, kind);
  if (!context.edges.has(id)) {
    context.edges.set(id, { id, from, to, via, kind });
  }
}

function typeNameFromReferenceText(text: string): string {
  const lastDot = text.lastIndexOf(".");
  return lastDot === -1 ? text : text.slice(lastDot + 1);
}

function symbolForReferenceNode(node: Node): Symbol | undefined {
  if (Node.isTypeReference(node)) {
    return node.getTypeName().getSymbol();
  }

  if (Node.isExpressionWithTypeArguments(node)) {
    return node.getExpression().getSymbol();
  }

  return undefined;
}

function displayNameForReferenceNode(node: Node): string | undefined {
  if (Node.isTypeReference(node)) {
    return typeNameFromReferenceText(node.getTypeName().getText());
  }

  if (Node.isExpressionWithTypeArguments(node)) {
    return typeNameFromReferenceText(node.getExpression().getText());
  }

  return undefined;
}

function resolveReferenceNode(
  node: Node,
  context: ExtractContext
): string | undefined {
  const symbol = symbolForReferenceNode(node);
  const localId = resolveSymbolId(symbol, context.symbolIds);
  if (localId !== undefined) {
    return localId;
  }

  const name = displayNameForReferenceNode(node);
  if (name === undefined || name === "") {
    return undefined;
  }

  return ensurePrimitiveOrExternalNode(name, context);
}

function primitiveNameForKeyword(kind: SyntaxKind): string | undefined {
  switch (kind) {
    case SyntaxKind.StringKeyword:
      return "string";
    case SyntaxKind.NumberKeyword:
      return "number";
    case SyntaxKind.BooleanKeyword:
      return "boolean";
    case SyntaxKind.BigIntKeyword:
      return "bigint";
    case SyntaxKind.SymbolKeyword:
      return "symbol";
    case SyntaxKind.UnknownKeyword:
      return "unknown";
    case SyntaxKind.AnyKeyword:
      return "any";
    case SyntaxKind.NeverKeyword:
      return "never";
    case SyntaxKind.VoidKeyword:
      return "void";
    case SyntaxKind.ObjectKeyword:
      return "object";
    case SyntaxKind.UndefinedKeyword:
      return "undefined";
    case SyntaxKind.NullKeyword:
      return "null";
    default:
      return undefined;
  }
}

function primitiveNameForLiteral(node: Node): string | undefined {
  if (!Node.isLiteralTypeNode(node)) {
    return undefined;
  }

  const literal = node.getLiteral();
  if (literal.getKind() === SyntaxKind.NullKeyword) {
    return "null";
  }

  if (
    literal.getKind() === SyntaxKind.TrueKeyword ||
    literal.getKind() === SyntaxKind.FalseKeyword
  ) {
    return "boolean";
  }

  if (Node.isStringLiteral(literal)) {
    return "string";
  }

  if (Node.isNumericLiteral(literal)) {
    return "number";
  }

  return undefined;
}

function collectReferences(
  node: Node | undefined,
  context: ExtractContext,
  kind: TypeGraphEdgeKind
): Reference[] {
  if (node === undefined) {
    return [];
  }

  const primitiveName =
    primitiveNameForKeyword(node.getKind()) ?? primitiveNameForLiteral(node);
  if (primitiveName !== undefined && isPrimitiveTypeName(primitiveName)) {
    return [{ id: ensurePrimitiveOrExternalNode(primitiveName, context), kind }];
  }

  if (Node.isTypeReference(node) || Node.isExpressionWithTypeArguments(node)) {
    const references: Reference[] = [];
    const id = resolveReferenceNode(node, context);
    if (id !== undefined) {
      references.push({ id, kind });
    }

    for (const typeArgument of node.getTypeArguments()) {
      references.push(...collectReferences(typeArgument, context, "genericArg"));
    }

    return references;
  }

  if (Node.isArrayTypeNode(node)) {
    return collectReferences(node.getElementTypeNode(), context, "arrayElement");
  }

  if (Node.isTupleTypeNode(node)) {
    return node
      .getElements()
      .flatMap((element) => collectReferences(element, context, "tupleElement"));
  }

  if (Node.isUnionTypeNode(node)) {
    return node
      .getTypeNodes()
      .flatMap((typeNode) => collectReferences(typeNode, context, "union"));
  }

  if (Node.isIntersectionTypeNode(node)) {
    return node
      .getTypeNodes()
      .flatMap((typeNode) => collectReferences(typeNode, context, "intersection"));
  }

  if (Node.isTypeOperatorTypeNode(node)) {
    return collectReferences(node.getTypeNode(), context, kind);
  }

  if (Node.isParenthesizedTypeNode(node)) {
    return collectReferences(node.getTypeNode(), context, kind);
  }

  if (Node.isFunctionTypeNode(node)) {
    const references: Reference[] = [];
    for (const parameter of node.getParameters()) {
      references.push(
        ...collectReferences(parameter.getTypeNode(), context, "functionParam")
      );
    }
    references.push(
      ...collectReferences(node.getReturnTypeNode(), context, "functionReturn")
    );
    return references;
  }

  if (Node.isIndexedAccessTypeNode(node)) {
    return [
      ...collectReferences(node.getObjectTypeNode(), context, kind),
      ...collectReferences(node.getIndexTypeNode(), context, kind)
    ];
  }

  if (Node.isTypeLiteral(node)) {
    return node
      .getMembers()
      .flatMap((member) => collectReferencesFromTypeElement(member, context));
  }

  return node
    .getChildren()
    .flatMap((child) => collectReferences(child, context, kind));
}

function uniqueReferenceIds(references: Reference[]): string[] {
  return [...new Set(references.map((reference) => reference.id))];
}

function addDependencyEdges(
  context: ExtractContext,
  from: string,
  typeNode: Node | undefined,
  via: string,
  kind: TypeGraphEdgeKind
): string[] {
  const references = collectReferences(typeNode, context, kind);
  for (const reference of references) {
    addEdge(context, from, reference.id, via, reference.kind);
  }
  return uniqueReferenceIds(references);
}

function memberBase(
  name: string,
  displayType: string,
  referencedTypeIds: string[],
  kind: TypeGraphMemberKind,
  optional = false,
  readonly = false
): TypeGraphMember {
  return {
    name,
    optional,
    readonly,
    displayType,
    referencedTypeIds,
    kind
  };
}

function propertyMember(
  context: ExtractContext,
  ownerId: string,
  property: PropertySignature | PropertyDeclaration
): TypeGraphMember {
  const typeNode = property.getTypeNode();
  const name = property.getName();
  const referencedTypeIds = addDependencyEdges(
    context,
    ownerId,
    typeNode,
    name,
    "property"
  );

  return memberBase(
    name,
    typeNode?.getText() ?? "unknown",
    referencedTypeIds,
    "property",
    property.hasQuestionToken(),
    Node.isReadonlyable(property) ? property.isReadonly() : false
  );
}

function parameterMember(
  context: ExtractContext,
  ownerId: string,
  parameter: ParameterDeclaration,
  kind: TypeGraphMemberKind,
  edgeKind: TypeGraphEdgeKind
): TypeGraphMember {
  const typeNode = parameter.getTypeNode();
  const name = parameter.getName();
  const referencedTypeIds = addDependencyEdges(
    context,
    ownerId,
    typeNode,
    name,
    edgeKind
  );

  return memberBase(
    name,
    typeNode?.getText() ?? "unknown",
    referencedTypeIds,
    kind,
    parameter.hasQuestionToken(),
    Node.isReadonlyable(parameter) ? parameter.isReadonly() : false
  );
}

function returnMember(
  context: ExtractContext,
  ownerId: string,
  typeNode: TypeNode | undefined,
  kind: TypeGraphMemberKind,
  edgeKind: TypeGraphEdgeKind
): TypeGraphMember {
  const referencedTypeIds = addDependencyEdges(
    context,
    ownerId,
    typeNode,
    "return",
    edgeKind
  );

  return memberBase(
    "return",
    typeNode?.getText() ?? "void",
    referencedTypeIds,
    kind
  );
}

function methodLikeMembers(
  context: ExtractContext,
  ownerId: string,
  method: MethodSignature | MethodDeclaration
): TypeGraphMember[] {
  const members: TypeGraphMember[] = [];
  for (const parameter of method.getParameters()) {
    members.push(parameterMember(context, ownerId, parameter, "functionParam", "method"));
  }

  members.push(
    returnMember(context, ownerId, method.getReturnTypeNode(), "functionReturn", "method")
  );

  return [
    memberBase(
      method.getName(),
      method.getText(),
      uniqueReferenceIds(members.flatMap((member) => member.referencedTypeIds.map((id) => ({ id, kind: "method" as const })))),
      "method",
      method.hasQuestionToken()
    ),
    ...members
  ];
}

function callSignatureMembers(
  context: ExtractContext,
  ownerId: string,
  signature: CallSignatureDeclaration
): TypeGraphMember[] {
  return [
    ...signature
      .getParameters()
      .map((parameter) =>
        parameterMember(context, ownerId, parameter, "functionParam", "callSignature")
      ),
    returnMember(
      context,
      ownerId,
      signature.getReturnTypeNode(),
      "functionReturn",
      "callSignature"
    )
  ];
}

function collectReferencesFromTypeElement(
  member: TypeElementTypes,
  context: ExtractContext
): Reference[] {
  if (Node.isPropertySignature(member)) {
    return collectReferences(member.getTypeNode(), context, "property");
  }

  if (Node.isMethodSignature(member)) {
    return [
      ...member
        .getParameters()
        .flatMap((parameter) =>
          collectReferences(parameter.getTypeNode(), context, "method")
        ),
      ...collectReferences(member.getReturnTypeNode(), context, "method")
    ];
  }

  if (Node.isCallSignatureDeclaration(member)) {
    return [
      ...member
        .getParameters()
        .flatMap((parameter) =>
          collectReferences(parameter.getTypeNode(), context, "callSignature")
        ),
      ...collectReferences(member.getReturnTypeNode(), context, "callSignature")
    ];
  }

  if (Node.isIndexSignatureDeclaration(member)) {
    return collectReferences(member.getReturnTypeNode(), context, "indexSignature");
  }

  return [];
}

function typeElementMembers(
  context: ExtractContext,
  ownerId: string,
  members: TypeElementTypes[]
): TypeGraphMember[] {
  const result: TypeGraphMember[] = [];

  for (const member of members) {
    if (Node.isPropertySignature(member)) {
      result.push(propertyMember(context, ownerId, member));
      continue;
    }

    if (Node.isMethodSignature(member)) {
      result.push(...methodLikeMembers(context, ownerId, member));
      continue;
    }

    if (Node.isCallSignatureDeclaration(member)) {
      result.push(...callSignatureMembers(context, ownerId, member));
      continue;
    }

    if (Node.isIndexSignatureDeclaration(member)) {
      const typeNode = member.getReturnTypeNode();
      const referencedTypeIds = addDependencyEdges(
        context,
        ownerId,
        typeNode,
        "index",
        "indexSignature"
      );

      result.push(
        memberBase(
          "index",
          typeNode?.getText() ?? "unknown",
          referencedTypeIds,
          "indexSignature"
        )
      );
    }
  }

  return result;
}

function typeAliasMembers(
  context: ExtractContext,
  ownerId: string,
  declaration: TypeAliasDeclaration
): TypeGraphMember[] {
  const typeNode = declaration.getTypeNodeOrThrow();

  if (Node.isTypeLiteral(typeNode)) {
    return typeElementMembers(context, ownerId, typeNode.getMembers());
  }

  if (Node.isFunctionTypeNode(typeNode)) {
    return [
      ...typeNode
        .getParameters()
        .map((parameter) =>
          parameterMember(context, ownerId, parameter, "functionParam", "functionParam")
        ),
      returnMember(
        context,
        ownerId,
        typeNode.getReturnTypeNode(),
        "functionReturn",
        "functionReturn"
      )
    ];
  }

  if (Node.isUnionTypeNode(typeNode) || Node.isIntersectionTypeNode(typeNode)) {
    const kind: TypeGraphMemberKind = Node.isUnionTypeNode(typeNode)
      ? "unionMember"
      : "intersectionMember";
    const edgeKind: TypeGraphEdgeKind = Node.isUnionTypeNode(typeNode)
      ? "union"
      : "intersection";

    return typeNode.getTypeNodes().flatMap((child, index) => {
      if (Node.isTypeLiteral(child)) {
        return typeElementMembers(context, ownerId, child.getMembers());
      }

      const referencedTypeIds = addDependencyEdges(
        context,
        ownerId,
        child,
        child.getText(),
        edgeKind
      );

      return [
        memberBase(String(index + 1), child.getText(), referencedTypeIds, kind)
      ];
    });
  }

  const referencedTypeIds = addDependencyEdges(
    context,
    ownerId,
    typeNode,
    declaration.getName(),
    "property"
  );

  return [
    memberBase("type", typeNode.getText(), referencedTypeIds, "property")
  ];
}

function interfaceMembers(
  context: ExtractContext,
  ownerId: string,
  declaration: InterfaceDeclaration
): TypeGraphMember[] {
  for (const extension of declaration.getExtends()) {
    addExpressionWithTypeArgumentsEdge(context, ownerId, extension, "extends", "extends");
  }

  return typeElementMembers(context, ownerId, declaration.getMembers());
}

function addExpressionWithTypeArgumentsEdge(
  context: ExtractContext,
  ownerId: string,
  node: ExpressionWithTypeArguments,
  via: string,
  kind: TypeGraphEdgeKind
): void {
  const id = resolveReferenceNode(node, context);
  if (id !== undefined) {
    addEdge(context, ownerId, id, via, kind);
  }

  for (const typeArgument of node.getTypeArguments()) {
    for (const reference of collectReferences(typeArgument, context, "genericArg")) {
      addEdge(context, ownerId, reference.id, via, reference.kind);
    }
  }
}

function classMembers(
  context: ExtractContext,
  ownerId: string,
  declaration: ClassDeclaration
): TypeGraphMember[] {
  const members: TypeGraphMember[] = [];
  const extension = declaration.getExtends();
  if (extension !== undefined) {
    addExpressionWithTypeArgumentsEdge(context, ownerId, extension, "extends", "extends");
  }

  for (const implementation of declaration.getImplements()) {
    addExpressionWithTypeArgumentsEdge(
      context,
      ownerId,
      implementation,
      "implements",
      "implements"
    );
  }

  for (const property of declaration.getProperties()) {
    members.push(propertyMember(context, ownerId, property));
  }

  for (const constructorDeclaration of declaration.getConstructors()) {
    for (const parameter of constructorDeclaration.getParameters()) {
      if (parameter.isParameterProperty()) {
        members.push(
          parameterMember(context, ownerId, parameter, "property", "property")
        );
      }
    }
  }

  for (const method of declaration.getMethods()) {
    members.push(...methodLikeMembers(context, ownerId, method));
  }

  return members;
}

function populateLocalNode(context: ExtractContext, record: LocalDeclarationRecord): void {
  const node = context.nodes.get(record.id);
  if (node === undefined) {
    return;
  }

  if (Node.isTypeAliasDeclaration(record.declaration)) {
    node.members = typeAliasMembers(context, record.id, record.declaration);
    return;
  }

  if (Node.isInterfaceDeclaration(record.declaration)) {
    node.members = interfaceMembers(context, record.id, record.declaration);
    return;
  }

  if (Node.isClassDeclaration(record.declaration)) {
    node.members = classMembers(context, record.id, record.declaration);
    return;
  }

  if (Node.isEnumDeclaration(record.declaration)) {
    node.members = record.declaration.getMembers().map((member) =>
      memberBase(member.getName(), member.getValue()?.toString() ?? "", [], "property")
    );
  }
}

function hydrateNodeEdgeLists(context: ExtractContext): void {
  for (const node of context.nodes.values()) {
    node.dependsOn = [];
    node.dependedOnBy = [];
  }

  for (const edge of context.edges.values()) {
    const from = context.nodes.get(edge.from);
    const to = context.nodes.get(edge.to);
    if (from !== undefined && !from.dependsOn.includes(edge.to)) {
      from.dependsOn.push(edge.to);
    }
    if (to !== undefined && !to.dependedOnBy.includes(edge.from)) {
      to.dependedOnBy.push(edge.from);
    }
  }

  for (const node of context.nodes.values()) {
    node.dependsOn.sort();
    node.dependedOnBy.sort();
  }
}

export function extractGraph(options: ExtractGraphOptions): TypeGraphPayload {
  const sourceFiles = options.project
    .getSourceFiles()
    .filter((sourceFile) => isProjectSourceFile(sourceFile, options.projectRoot));

  const context: ExtractContext = {
    projectRoot: options.projectRoot,
    nodes: new Map(),
    edges: new Map(),
    declarations: [],
    symbolIds: new Map()
  };

  ensureLocalDeclarations(context, sourceFiles);

  for (const declaration of context.declarations) {
    populateLocalNode(context, declaration);
  }

  hydrateNodeEdgeLists(context);

  return {
    projectRoot: options.projectRoot,
    tsconfigPath: options.tsconfigPath,
    ...(options.scopePath === undefined ? {} : { scopePath: options.scopePath }),
    indexedAt: new Date().toISOString(),
    ...(options.source === undefined ? {} : { source: options.source }),
    nodes: [...context.nodes.values()].sort((a, b) => a.id.localeCompare(b.id)),
    edges: [...context.edges.values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}
