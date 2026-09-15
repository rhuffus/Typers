package compiler_test

import (
	"context"
	"encoding/json"
	"maps"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/bundled"
	"github.com/microsoft/typescript-go/internal/compiler"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/tsoptions"
	"github.com/microsoft/typescript-go/internal/vfs/vfstest"
)

var typersLibraries = sync.OnceValues(func() (map[string]string, error) {
	entries, err := os.ReadDir(bundled.TestingLibPath())
	if err != nil {
		return nil, err
	}
	files := make(map[string]string)
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".d.ts") {
			continue
		}
		content, err := os.ReadFile(filepath.Join(bundled.TestingLibPath(), entry.Name()))
		if err != nil {
			return nil, err
		}
		files["/lib/"+entry.Name()] = string(content)
	}
	return files, nil
})

const typersOptionFixture = `
type Some<T> = { readonly kind: 'some'; readonly value: T };
type None = { readonly kind: 'none' };
type Option<T> = Some<T> | None;
function Some<T>(value: T): Some<T> { return {kind:'some', value}; }
const None: None = {kind:'none'};
`

func compileTypers(t *testing.T, source string, enabled bool, emit bool) (map[string]string, []*ast.Diagnostic) {
	t.Helper()
	libs, err := typersLibraries()
	if err != nil {
		t.Fatal(err)
	}
	files := maps.Clone(libs)
	files["/src/test.ts"] = source
	fs := vfstest.FromMap(files, true)
	options := &core.CompilerOptions{
		Target: core.ScriptTargetES2022, Module: core.ModuleKindCommonJS,
		Lib: []string{"lib.es2022.d.ts"}, OutDir: "/out",
		Strict: core.TSTrue, SkipLibCheck: core.TSTrue,
		Declaration: core.TSTrue, SourceMap: core.TSTrue, InlineSources: core.TSTrue,
		ExperimentalTypersSyntax: core.IfElse(enabled, core.TSTrue, core.TSFalse),
	}
	program := compiler.NewProgram(compiler.ProgramOptions{
		Config: &tsoptions.ParsedCommandLine{ParsedConfig: &core.ParsedOptions{
			FileNames: []string{"/src/test.ts"}, CompilerOptions: options,
		}},
		Host: compiler.NewCompilerHost("/src", fs, "/lib", nil, nil),
	})
	ctx := context.Background()
	diagnostics := program.GetConfigFileParsingDiagnostics()
	diagnostics = append(diagnostics, program.GetProgramDiagnostics()...)
	diagnostics = append(diagnostics, program.GetGlobalDiagnostics(ctx)...)
	diagnostics = append(diagnostics, program.GetSyntacticDiagnostics(ctx, nil)...)
	diagnostics = append(diagnostics, program.GetSemanticDiagnostics(ctx, nil)...)
	output := map[string]string{}
	if emit && len(diagnostics) == 0 {
		result := program.Emit(ctx, compiler.EmitOptions{WriteFile: func(path, text string, _ *compiler.WriteFileData) error {
			output[path] = text
			return nil
		}})
		diagnostics = append(diagnostics, result.Diagnostics...)
	}
	return output, diagnostics
}

func requireTypersCompiles(t *testing.T, source string) map[string]string {
	t.Helper()
	output, diagnostics := compileTypers(t, source, true, true)
	if len(diagnostics) != 0 {
		for _, diagnostic := range diagnostics {
			t.Errorf("%d at %d: %s", diagnostic.Code(), diagnostic.Pos(), diagnostic.String())
		}
		t.FailNow()
	}
	return output
}

func TestTypersIfLetTypes(t *testing.T) {
	t.Parallel()
	source := typersOptionFixture + `
export function unwrap<T>(option: Option<T>): T | undefined {
  if let Some(value) = option { const result: T = value; return result; }
  return undefined;
}
export function knownNone(): number {
  if let Some(value) = None { const impossible: never = value; return impossible; }
  return 1;
}
export function knownSome(): number {
  if let Some(value) = Some(2) { const result: number = value; return result; }
  return 0;
}
export function constrained<T extends Option<string>>(option: T): string | undefined {
  if let Some(value) = option { const result: string = value; return result; }
}
`
	output := requireTypersCompiles(t, source)
	declarations := output["/out/test.d.ts"]
	if !strings.Contains(declarations, "unwrap<T>(option: Option<T>): T | undefined") {
		t.Fatalf("lost generic declaration: %s", declarations)
	}
	if strings.Contains(declarations, "__typers_iflet_") || strings.Contains(declarations, "if let") {
		t.Fatalf("internal lowering leaked into public declarations: %s", declarations)
	}
	var sourceMap struct {
		Sources        []string `json:"sources"`
		SourcesContent []string `json:"sourcesContent"`
		Mappings       string   `json:"mappings"`
	}
	if err := json.Unmarshal([]byte(output["/out/test.js.map"]), &sourceMap); err != nil {
		t.Fatal(err)
	}
	if len(sourceMap.Sources) != 1 || len(sourceMap.SourcesContent) != 1 || sourceMap.SourcesContent[0] != source || sourceMap.Mappings == "" {
		t.Fatalf("source map lost original source: %+v", sourceMap)
	}
}

func TestTypersIfLetRejectsInvalidTypes(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name string
		code string
	}{
		{"number", `if let Some(value) = 42 {}`},
		{"unknown", `declare const option: unknown; if let Some(value) = option {}`},
		{"null", `if let Some(value) = null {}`},
		{"wrong variant", `if let Some(value) = {kind:'other'} as const {}`},
		{"missing payload", `if let Some(value) = {kind:'some'} as const {}`},
		{"wrong binding type", `if let Some(value) = Some(1) { const bad: string = value; }`},
		{"escaped scope", `if let Some(value) = Some(1) {} const bad = value;`},
		{"duplicate binding", `if let Some(value) = Some(1) { const value = 2; }`},
		{"immutable binding", `if let Some(value) = Some(1) { value = 2; }`},
	} {
		t.Run(test.name, func(t *testing.T) {
			source := typersOptionFixture + test.code
			_, diagnostics := compileTypers(t, source, true, false)
			if len(diagnostics) == 0 {
				t.Fatal("expected a diagnostic")
			}
			for _, diagnostic := range diagnostics {
				if diagnostic.Pos() < 0 || diagnostic.End() > len(source) {
					t.Errorf("diagnostic points outside the source: %d at %d: %s", diagnostic.Code(), diagnostic.Pos(), diagnostic.String())
				}
			}
		})
	}
}

func TestTypersIfLetRuntime(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Skip("Node.js is required to execute the emitted JavaScript")
	}
	source := typersOptionFixture + `
function assert(value: boolean): void { if (!value) throw new Error('assertion failed'); }
let calls = 0;
function option<T>(value: T): Option<T> { calls++; return Some(value); }
for (const expected of [0, false, '', undefined, null]) {
  const before = calls;
  if let Some(value) = option(expected) { assert(value === expected); }
  else { throw new Error('present value treated as absent'); }
  assert(calls === before + 1);
}
let missing = 0;
if let Some(value) = None { throw new Error('None matched'); } else { missing++; }
assert(missing === 1);
const __typers_iflet_0 = 10;
if let Some(value) = Some(__typers_iflet_0) { assert(value === 10); }
const __typers_iflet_1 = 20;
if let Some(value) = Some(20) { assert(value === __typers_iflet_1); }
function later(): number {
  if let Some(value) = Some(30) { return value + __typers_iflet_2; }
  return 0;
}
const __typers_iflet_2 = 40;
assert(later() === 70);
const __typers_iflet_\u0033 = 33;
if let Some(value) = Some(33) { assert(value === __typers_iflet_\u0033); }
{
  const Some = 0;
  if let Some(value) = option(5) { assert(value === 5 && Some === 0); }
}
if let Some(outerValue) = Some(Some(12)) {
  if let Some(innerValue) = outerValue { assert(innerValue === 12); }
}
let finalizations = 0;
function early(): number {
  try { if let Some(value) = Some(8) { return value; } }
  finally { finalizations++; }
  return 0;
}
assert(early() === 8 && finalizations === 1);
let sum = 0;
outer: for (let index = 0; index < 5; index++) {
  try {
    if let Some(value) = Some(index) {
      if (value === 1) continue outer;
      if (value === 3) break outer;
      sum += value;
    }
  } finally { finalizations++; }
}
assert(sum === 2 && finalizations === 5);
const receiver = {
  amount: 5,
  method(input: number) {
    if let Some(value) = Some(input) { return value + this.amount + arguments.length; }
    return 0;
  }
};
assert(receiver.method(2) === 8);
async function asynchronous(): Promise<void> {
  if let Some(value) = await Promise.resolve(Some(9)) { assert(value === 9); }
  else { throw new Error('async Some failed'); }
  let rejected = false;
  try { if let Some(value) = await Promise.reject(new Error('expected')) {} }
  catch { rejected = true; }
  assert(rejected);
}
asynchronous().catch(error => { throw error; });
`
	output := requireTypersCompiles(t, source)
	command := exec.Command(node, "--input-type=commonjs", "-e", output["/out/test.js"])
	if result, err := command.CombinedOutput(); err != nil {
		t.Fatalf("emitted program failed: %v\n%s\n%s", err, result, output["/out/test.js"])
	}
}

func TestTypersFlagDoesNotChangeStandardEmit(t *testing.T) {
	t.Parallel()
	source := `export function existing(value?: { amount: number }): number {
  const letIdentifier = value?.amount ?? 0;
  if (letIdentifier) return letIdentifier;
  return value ? 1 : 2;
}`
	plain, plainDiagnostics := compileTypers(t, source, false, true)
	extended, extendedDiagnostics := compileTypers(t, source, true, true)
	if len(plainDiagnostics) != 0 || len(extendedDiagnostics) != 0 {
		t.Fatalf("unexpected diagnostics: %v %v", plainDiagnostics, extendedDiagnostics)
	}
	if !maps.Equal(plain, extended) {
		t.Fatal("enabling the experimental flag changed standard TypeScript output")
	}
}
