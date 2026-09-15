package tsoptions_test

import (
	"testing"

	"github.com/microsoft/typescript-go/internal/tsoptions"
	"github.com/microsoft/typescript-go/internal/tsoptions/tsoptionstest"
)

func TestTypersExperimentalOption(t *testing.T) {
	t.Parallel()
	host := tsoptionstest.NewVFSParseConfigHost(map[string]string{
		"/project/index.ts":      "export {};",
		"/project/tsconfig.json": `{"compilerOptions":{"experimentalTypersSyntax":true},"files":["index.ts"]}`,
	}, "/project", true)
	for _, enabled := range []bool{false, true} {
		args := []string{"index.ts"}
		if enabled {
			args = append(args, "--experimentalTypersSyntax")
		}
		parsed := tsoptions.ParseCommandLine(args, host)
		if len(parsed.Errors) != 0 {
			t.Fatal(parsed.Errors)
		}
		if parsed.CompilerOptions().ExperimentalTypersSyntax.IsTrue() != enabled {
			t.Fatalf("incorrect option value: enabled=%v", enabled)
		}
	}
	parsed, diagnostics := tsoptions.GetParsedCommandLineOfConfigFile("/project/tsconfig.json", nil, nil, host, nil)
	if len(diagnostics) != 0 || len(parsed.Errors) != 0 {
		t.Fatalf("invalid config: %v %v", diagnostics, parsed.Errors)
	}
	if !parsed.CompilerOptions().ExperimentalTypersSyntax.IsTrue() {
		t.Fatal("tsconfig option was not recognized")
	}
}
