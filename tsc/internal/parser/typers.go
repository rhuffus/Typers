package parser

import (
	"strconv"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/diagnostics"
)

// parseTypersIfLet lowers syntax directly to native AST nodes before binding and
// checking. Some is contextual pattern syntax, not a call to a runtime constructor.
// The experimental AST is normalized; it is not a lossless source-editing API.
func (p *Parser) parseTypersIfLet(pos int, jsdoc jsdocScannerInfo) *ast.Node {
	p.parseExpected(ast.KindLetKeyword)
	if p.token != ast.KindIdentifier || p.scanner.TokenValue() != "Some" {
		p.parseErrorAtCurrentToken(diagnostics.Typers_Only_Some_binding_is_supported)
	}
	p.parseIdentifierNameErrorOnUnicodeEscapeSequence()
	p.parseExpected(ast.KindOpenParenToken)
	if !p.isBindingIdentifier() {
		p.parseErrorAtCurrentToken(diagnostics.Typers_Only_Some_binding_is_supported)
	}
	binding := p.parseBindingIdentifier()
	p.parseExpected(ast.KindCloseParenToken)
	p.parseExpected(ast.KindEqualsToken)
	expression := p.parseExpressionAllowIn()
	thenStatement := p.parseTypersBranch()
	var elseStatement *ast.Node
	if p.parseOptional(ast.KindElseKeyword) {
		elseStatement = p.parseTypersBranch()
	}

	// The satisfies check validates the structural Option protocol while preserving
	// the inferred value type. The second local widens impossible variants with a
	// never payload, so a statically known None remains valid and a generic Some<T>
	// still binds T. The intersection prevents cascading errors on generated
	// property accesses after an invalid input has already failed satisfies.
	// These are type-only constructs; the input is evaluated once.
	rawName := p.newTypersTemporary()
	wideName := p.newTypersTemporary()
	checked := p.typersNode(p.factory.NewSatisfiesExpression(expression, p.typersOptionType(ast.KindUnknownKeyword)))
	checked.Loc = expression.Loc
	rawStatement := p.typersConst(p.typersTemporaryReference(rawName), checked)

	wideType := p.typersNode(p.factory.NewUnionTypeNode(p.factory.NewNodeList([]*ast.Node{
		p.typersNode(p.factory.NewIntersectionTypeNode(p.factory.NewNodeList([]*ast.Node{
			p.typersNode(p.factory.NewTypeQueryNode(p.typersTemporaryReference(rawName), nil)),
			p.typersOptionType(ast.KindUnknownKeyword),
		}))),
		p.typersOptionType(ast.KindNeverKeyword),
	})))
	wideExpression := p.typersNode(p.factory.NewAsExpression(p.typersTemporaryReference(rawName), wideType))
	wideExpression.Loc = expression.Loc
	wideStatement := p.typersConst(p.typersTemporaryReference(wideName), wideExpression)
	condition := p.typersNode(p.factory.NewBinaryExpression(nil,
		p.typersProperty(p.typersTemporaryReference(wideName), "kind"), nil,
		p.typersNode(p.factory.NewToken(ast.KindEqualsEqualsEqualsToken)),
		p.typersNode(p.factory.NewStringLiteral("some", ast.TokenFlagsNone)),
	))
	bindingStatement := p.typersConst(binding, p.typersProperty(p.typersTemporaryReference(wideName), "value"))
	thenBlock := thenStatement.AsBlock()
	thenBlock.Statements.Nodes = append([]*ast.Node{bindingStatement}, thenBlock.Statements.Nodes...)
	p.overrideParentInImmediateChildren(thenStatement)
	branch := p.typersNode(p.factory.NewIfStatement(condition, thenStatement, elseStatement))
	branch.Loc = core.NewTextRange(pos, p.nodePos())
	result := p.finishNode(p.factory.NewBlock(p.factory.NewNodeList([]*ast.Node{
		rawStatement, wideStatement, branch,
	}), true), pos)
	p.withJSDoc(result, jsdoc)
	return result
}

func (p *Parser) parseTypersBranch() *ast.Node {
	if p.token == ast.KindOpenBraceToken {
		return p.parseBlock(false, nil)
	}
	p.parseErrorAtCurrentToken(diagnostics.Typers_If_let_requires_a_block)
	// Consume a statement for recovery, but retain the block shape used by the
	// lowering. A malformed branch must never make the parser panic or loop.
	pos := p.nodePos()
	statement := p.parseStatement()
	return p.finishNode(p.factory.NewBlock(p.factory.NewNodeList([]*ast.Node{statement}), true), pos)
}

// Keep generated names synthetic. Giving them a source range would make the
// printer reuse unrelated source text instead of the generated identifier text.
func (p *Parser) typersNode(node *ast.Node) *ast.Node {
	node.Flags |= p.contextFlags
	p.overrideParentInImmediateChildren(node)
	return node
}

func (p *Parser) typersConst(name, initializer *ast.Node) *ast.Node {
	declaration := p.typersNode(p.factory.NewVariableDeclaration(name, nil, nil, initializer))
	list := p.typersNode(p.factory.NewVariableDeclarationList(p.factory.NewNodeList([]*ast.Node{declaration}), ast.NodeFlagsConst))
	return p.typersNode(p.factory.NewVariableStatement(nil, list))
}

func (p *Parser) typersProperty(expression *ast.Node, name string) *ast.Node {
	return p.typersNode(p.factory.NewPropertyAccessExpression(expression, nil, p.typersNode(p.factory.NewIdentifier(name)), ast.NodeFlagsNone))
}

func (p *Parser) typersOptionType(valueKind ast.KeywordTypeSyntaxKind) *ast.Node {
	property := func(name string, value *ast.Node) *ast.Node {
		return p.typersNode(p.factory.NewPropertySignatureDeclaration(
			p.factory.NewModifierList([]*ast.Node{p.typersNode(p.factory.NewToken(ast.KindReadonlyKeyword))}),
			p.typersNode(p.factory.NewIdentifier(name)), nil, value, nil,
		))
	}
	kind := func(value string) *ast.Node {
		return p.typersNode(p.factory.NewLiteralTypeNode(p.typersNode(p.factory.NewStringLiteral(value, ast.TokenFlagsNone))))
	}
	some := p.typersNode(p.factory.NewTypeLiteralNode(p.factory.NewNodeList([]*ast.Node{
		property("kind", kind("some")),
		property("value", p.typersNode(p.factory.NewKeywordTypeNode(valueKind))),
	})))
	none := p.typersNode(p.factory.NewTypeLiteralNode(p.factory.NewNodeList([]*ast.Node{property("kind", kind("none"))})))
	return p.typersNode(p.factory.NewUnionTypeNode(p.factory.NewNodeList([]*ast.Node{some, none})))
}

func (p *Parser) newTypersTemporary() int {
	id := len(p.typersTemporaries)
	p.typersTemporaries = append(p.typersTemporaries, nil)
	return id
}

func (p *Parser) typersTemporaryReference(id int) *ast.Node {
	node := p.typersNode(p.factory.NewIdentifier(""))
	p.typersTemporaries[id] = append(p.typersTemporaries[id], node)
	p.identifierCount++
	return node
}

// Allocate names after parsing the complete source so later declarations and
// references (including Unicode-escaped identifiers) cannot be captured.
func (p *Parser) finalizeTypersTemporaries() {
	next := 0
	for _, references := range p.typersTemporaries {
		var name string
		for {
			name = "__typers_iflet_" + strconv.Itoa(next)
			next++
			if _, exists := p.identifiers[name]; !exists {
				break
			}
		}
		name = p.internIdentifier(name)
		for _, reference := range references {
			reference.AsIdentifier().Text = name
		}
	}
}
