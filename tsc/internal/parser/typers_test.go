package parser_test

import (
	"testing"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/parser"
)

func TestTypersIfLetParser(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name   string
		source string
		valid  bool
	}{
		{"some", `if let Some(value) = option { use(value); }`, true},
		{"else", `if let Some(value) = option { use(value); } else { missing(); }`, true},
		{"nested", `if let Some(value) = option { if let Some(inner) = value { use(inner); } }`, true},
		{"contextual", `const Some = 1; if let Some(value) = option { use(value); }`, true},
		{"top-level await", `export {}; if let Some(value) = await option { use(value); }`, true},
		{"arrow", `const fn = () => { if let Some(value) = option { return value; } };`, true},
		{"unsupported pattern", `if let Ok(value) = result { use(value); }`, false},
		{"missing binding", `if let Some() = option {}`, false},
		{"multiple bindings", `if let Some(a, b) = option {}`, false},
		{"destructured binding", `if let Some({value}) = option {}`, false},
		{"missing block", `if let Some(value) = option use(value);`, false},
		{"else without block", `if let Some(value) = option {} else missing();`, false},
		{"incomplete", `if let Some(`, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			file := parser.ParseSourceFile(ast.SourceFileParseOptions{
				FileName: "/test.ts", ExperimentalTypersSyntax: true,
			}, test.source, core.ScriptKindTS)
			if got := len(file.Diagnostics()) == 0; got != test.valid {
				t.Fatalf("valid=%v, diagnostics=%v", got, file.Diagnostics())
			}
			if !test.valid {
				return
			}
			var checkParents func(*ast.Node)
			checkParents = func(parent *ast.Node) {
				if parent.Kind == ast.KindIdentifier && parent.Text() == "" {
					t.Fatal("generated temporary has no name")
				}
				parent.ForEachChild(func(child *ast.Node) bool {
					if child.Parent != parent {
						t.Fatalf("incorrect parent for %v: got %v, expected %v", child.Kind, child.Parent, parent.Kind)
					}
					checkParents(child)
					return false
				})
			}
			checkParents(file.AsNode())
		})
	}
}

func TestTypersIfLetRequiresOptIn(t *testing.T) {
	t.Parallel()
	source := `if let Some(value) = option { use(value); }`
	for _, kind := range []core.ScriptKind{core.ScriptKindTS, core.ScriptKindJS} {
		file := parser.ParseSourceFile(ast.SourceFileParseOptions{FileName: "/test.ts"}, source, kind)
		if len(file.Diagnostics()) == 0 {
			t.Fatal("if let must require opt-in")
		}
	}
	js := parser.ParseSourceFile(ast.SourceFileParseOptions{
		FileName: "/test.js", ExperimentalTypersSyntax: true,
	}, source, core.ScriptKindJS)
	if len(js.Diagnostics()) == 0 {
		t.Fatal("the initial extension is limited to TypeScript sources")
	}
}

func TestTypersIfLetKeepsStandardParsing(t *testing.T) {
	t.Parallel()
	source := `const Some = (x: number) => x;
const letIdentifier = true;
if (letIdentifier) { Some(1); } else if (false) { Some(2); }
const optional: {value?: number} | undefined = undefined;
const result = optional?.value ?? (letIdentifier ? 1 : 2);`
	for _, enabled := range []bool{false, true} {
		file := parser.ParseSourceFile(ast.SourceFileParseOptions{
			FileName: "/test.ts", ExperimentalTypersSyntax: enabled,
		}, source, core.ScriptKindTS)
		if len(file.Diagnostics()) != 0 {
			t.Fatalf("enabled=%v: %v", enabled, file.Diagnostics())
		}
		if len(file.Statements.Nodes) != 5 {
			t.Fatalf("enabled=%v changed standard source shape", enabled)
		}
	}
}
