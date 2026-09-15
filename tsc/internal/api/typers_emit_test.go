package api

import (
	"context"
	"errors"
	"slices"
	"strings"
	"testing"

	"github.com/microsoft/typescript-go/internal/bundled"
	"github.com/microsoft/typescript-go/internal/json"
	"github.com/microsoft/typescript-go/internal/testutil/projecttestutil"
)

func typersEmissionSession(t *testing.T, options, source string, extra map[string]any) (*Session, *GetProjectDiagnosticsParams, *projecttestutil.SessionUtils) {
	t.Helper()
	if !bundled.Embedded {
		t.Skip("bundled files are not embedded")
	}
	files := map[string]any{
		"/project/tsconfig.json": `{"compilerOptions":{"strict":true,"target":"es2022","module":"commonjs","lib":["es2022"],"types":[],"outDir":"./dist",` + options + `},"files":["input.ts"]}`,
		"/project/input.ts":      source,
	}
	for name, content := range extra {
		files[name] = content
	}
	projectSession, utils := projecttestutil.Setup(files)
	session := NewSession(projectSession, nil)
	t.Cleanup(func() {
		session.Close()
		projectSession.Close()
	})
	opened, err := session.handleUpdateSnapshot(context.Background(), &UpdateSnapshotParams{
		OpenProjects: []DocumentIdentifier{{FileName: "/project/tsconfig.json"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	return session, &GetProjectDiagnosticsParams{Snapshot: opened.Snapshot, Project: ProjectID("/project/tsconfig.json")}, utils
}

func requestTypersEmit(t *testing.T, session *Session, params *GetProjectDiagnosticsParams) (*TypersEmitResult, error) {
	t.Helper()
	payload, err := json.Marshal(params)
	if err != nil {
		t.Fatal(err)
	}
	response, err := session.HandleRequest(context.Background(), string(MethodTypersEmitProject), json.Value(payload))
	if err != nil {
		return nil, err
	}
	return response.(*TypersEmitResult), nil
}

func emittedTypersText(result *TypersEmitResult, suffix string) string {
	for _, output := range result.Outputs {
		if strings.HasSuffix(output.FileName, suffix) {
			return output.Text
		}
	}
	return ""
}

func TestTypersEmitProjectCapturesOutputs(t *testing.T) {
	t.Parallel()
	source := `
type Option<T> = {readonly kind:'some';readonly value:T}|{readonly kind:'none'};
export function unwrap<T>(option: Option<T>): T | undefined {
  if let Some(value) = option { return value; }
}
function injectable(): ClassDecorator { return () => {}; }
export class Dependency {}
@injectable()
export class Service { constructor(readonly dependency: Dependency) {} }
`
	session, params, utils := typersEmissionSession(t,
		`"experimentalTypersSyntax":true,"experimentalDecorators":true,"emitDecoratorMetadata":true,"declaration":true,"declarationMap":true,"sourceMap":true,"inlineSources":true`,
		source, nil)
	result, err := requestTypersEmit(t, session, params)
	if err != nil {
		t.Fatal(err)
	}
	if result.EmitSkipped || len(result.Diagnostics) != 0 || len(result.Outputs) != 4 {
		t.Fatalf("unexpected result: %+v", result)
	}
	if !slices.IsSortedFunc(result.Outputs, func(a, b TypersEmitOutput) int { return strings.Compare(a.FileName, b.FileName) }) {
		t.Fatal("outputs are not sorted")
	}
	js := emittedTypersText(result, ".js")
	if strings.Contains(js, "if let") || !strings.Contains(js, "__typers_iflet_") || !strings.Contains(js, `__metadata("design:paramtypes", [Dependency])`) {
		t.Fatalf("native transformation or decorator metadata missing: %s", js)
	}
	declarations := emittedTypersText(result, ".d.ts")
	if !strings.Contains(declarations, "unwrap<T>") || strings.Contains(declarations, "__typers_iflet_") {
		t.Fatalf("invalid declaration output: %s", declarations)
	}
	for _, output := range result.Outputs {
		if utils.FS().FileExists(output.FileName) {
			t.Fatalf("emitter wrote to filesystem: %s", output.FileName)
		}
	}
	if !strings.Contains(emittedTypersText(result, ".js.map"), "sourcesContent") {
		t.Fatal("source map did not preserve configured inline sources")
	}
	repeated, err := requestTypersEmit(t, session, params)
	if err != nil || !slices.Equal(result.Outputs, repeated.Outputs) {
		t.Fatalf("emission of the same snapshot changed: %v", err)
	}
}

func TestTypersEmitProjectOptionsAndDiagnostics(t *testing.T) {
	t.Parallel()
	for _, test := range []struct {
		name         string
		options      string
		source       string
		skipped      bool
		diagnostic   bool
		outputSuffix string
	}{
		{"standard", `"noEmitOnError":true`, `export const value = 1;`, false, false, ".js"},
		{"noEmit", `"noEmit":true`, `export const value = 1;`, true, false, ""},
		{"noEmit errors", `"noEmit":true`, `export const value: string = 1;`, true, true, ""},
		{"noEmitOnError", `"noEmitOnError":true`, `export const value: string = 1;`, true, true, ""},
		{"emit with errors", `"noEmitOnError":false`, `export const value: string = 1;`, false, true, ".js"},
		{"syntax diagnostics", `"noEmitOnError":true`, `export const value = ;`, true, true, ""},
		{"config diagnostics", `"noEmitOnError":true,"unknownTypersOption":true`, `export const value = 1;`, true, true, ""},
		{"global diagnostics", `"noEmitOnError":true,"noLib":true`, `export const value = 1;`, true, true, ""},
		{"declaration only", `"declaration":true,"emitDeclarationOnly":true`, `export const value = 1;`, false, false, ".d.ts"},
		{"declaration diagnostics", `"declaration":true,"isolatedDeclarations":true,"noEmitOnError":true`, `export function value() { return Math.random(); }`, true, true, ""},
	} {
		t.Run(test.name, func(t *testing.T) {
			session, params, _ := typersEmissionSession(t, test.options, test.source, nil)
			result, err := requestTypersEmit(t, session, params)
			if err != nil {
				t.Fatal(err)
			}
			if result.EmitSkipped != test.skipped || (len(result.Diagnostics) != 0) != test.diagnostic {
				t.Fatalf("unexpected skipped/diagnostics: %+v", result)
			}
			if test.outputSuffix == "" && len(result.Outputs) != 0 {
				t.Fatal("output returned when emission should be skipped")
			}
			if test.outputSuffix != "" && emittedTypersText(result, test.outputSuffix) == "" {
				t.Fatalf("missing %s output: %+v", test.outputSuffix, result.Outputs)
			}
			if test.name == "declaration only" && len(result.Outputs) != 1 {
				t.Fatalf("declaration-only emission included other outputs: %+v", result.Outputs)
			}
			if test.name == "global diagnostics" && !slices.ContainsFunc(result.Diagnostics, func(d *DiagnosticResponse) bool { return d.Code == 2318 }) {
				t.Fatal("global diagnostics from the project checker pool were not returned")
			}
		})
	}
}

func TestTypersEmitProjectRejectsUnsupportedBuildModes(t *testing.T) {
	t.Parallel()
	for _, option := range []string{`"incremental":true`, `"composite":true`} {
		session, params, _ := typersEmissionSession(t, option, `export const value = 1;`, nil)
		_, err := requestTypersEmit(t, session, params)
		if !errors.Is(err, ErrClientError) || !strings.Contains(err.Error(), "does not support") {
			t.Fatalf("unsupported build mode did not fail clearly: %v", err)
		}
	}
	session, params, _ := typersEmissionSession(t, `"strict":true`, `export const value = 1;`, map[string]any{
		"/project/tsconfig.json":            `{"compilerOptions":{"outDir":"dist","types":[]},"files":["input.ts"],"references":[{"path":"./dependency"}]}`,
		"/project/dependency/tsconfig.json": `{"compilerOptions":{"composite":true},"files":["index.ts"]}`,
		"/project/dependency/index.ts":      `export const dependency = 1;`,
	})
	_, err := requestTypersEmit(t, session, params)
	if !errors.Is(err, ErrClientError) || !strings.Contains(err.Error(), "project references") {
		t.Fatalf("project reference was silently accepted: %v", err)
	}
}

func TestTypersEmitProjectSnapshotIsolationAndRelease(t *testing.T) {
	t.Parallel()
	session, firstParams, utils := typersEmissionSession(t, `"noEmitOnError":true`, `export const value = 1;`, nil)
	first, err := requestTypersEmit(t, session, firstParams)
	if err != nil {
		t.Fatal(err)
	}
	if err := utils.FS().WriteFile("/project/input.ts", `export const value = 2;`); err != nil {
		t.Fatal(err)
	}
	updated, err := session.handleUpdateSnapshot(context.Background(), &UpdateSnapshotParams{
		FileChanges: &APIFileChanges{Changed: []DocumentIdentifier{{FileName: "/project/input.ts"}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	second, err := requestTypersEmit(t, session, &GetProjectDiagnosticsParams{Snapshot: updated.Snapshot, Project: firstParams.Project})
	if err != nil {
		t.Fatal(err)
	}
	old, err := requestTypersEmit(t, session, firstParams)
	if err != nil || !slices.Equal(first.Outputs, old.Outputs) || slices.Equal(first.Outputs, second.Outputs) {
		t.Fatalf("emission did not respect snapshot state: %v", err)
	}
	if _, err := session.handleRelease(context.Background(), &ReleaseParams{Snapshot: firstParams.Snapshot}); err != nil {
		t.Fatal(err)
	}
	if _, err := requestTypersEmit(t, session, firstParams); !errors.Is(err, ErrClientError) {
		t.Fatalf("released snapshot was accepted: %v", err)
	}
	_, err = requestTypersEmit(t, session, &GetProjectDiagnosticsParams{Snapshot: updated.Snapshot, Project: "/missing/tsconfig.json"})
	if !errors.Is(err, ErrClientError) {
		t.Fatalf("unknown project was accepted: %v", err)
	}
}

func TestTypersEmitProjectMultipleFiles(t *testing.T) {
	t.Parallel()
	session, params, utils := typersEmissionSession(t, `"declaration":true,"sourceMap":true`,
		`import { a } from './a'; import { b } from './b'; export const value = a + b;`, map[string]any{
			"/project/a.ts": `export const a = 1;`,
			"/project/b.ts": `export const b = 2;`,
		})
	result, err := requestTypersEmit(t, session, params)
	if err != nil || len(result.Diagnostics) != 0 || len(result.Outputs) != 9 {
		t.Fatalf("multi-file emission failed: %v %+v", err, result)
	}
	if !slices.IsSortedFunc(result.Outputs, func(a, b TypersEmitOutput) int { return strings.Compare(a.FileName, b.FileName) }) {
		t.Fatal("concurrent emitter output was not sorted")
	}
	for _, output := range result.Outputs {
		if utils.FS().FileExists(output.FileName) {
			t.Fatalf("emitter wrote %s", output.FileName)
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := session.handleTypersEmitProject(ctx, params); !errors.Is(err, context.Canceled) {
		t.Fatalf("canceled request was not rejected: %v", err)
	}
}
