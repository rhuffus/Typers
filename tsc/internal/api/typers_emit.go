package api

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"

	"github.com/microsoft/typescript-go/internal/compiler"
	"github.com/microsoft/typescript-go/internal/core"
	"github.com/microsoft/typescript-go/internal/tspath"
)

type TypersEmitOutput struct {
	FileName string `json:"fileName"`
	Text     string `json:"text"`
}

type TypersEmitResult struct {
	EmitSkipped     bool                  `json:"emitSkipped"`
	Diagnostics     []*DiagnosticResponse `json:"diagnostics"`
	Outputs         []TypersEmitOutput    `json:"outputs"`
	ConfigFileNames []string              `json:"configFileNames"`
}

// handleTypersEmitProject emits the selected snapshot's project to memory. It is
// deliberately separate from printNode and the upstream API surface: this is
// compiler emission, including type erasure, decorators and declarations.
func (s *Session) handleTypersEmitProject(ctx context.Context, params *GetProjectDiagnosticsParams) (*TypersEmitResult, error) {
	// Keep the snapshot alive while diagnostics and emit run. In particular, an
	// overlapping release must not dispose the project's checker pool mid-request.
	s.snapshotsMu.RLock()
	defer s.snapshotsMu.RUnlock()
	sd, exists := s.snapshots[params.Snapshot]
	if !exists {
		return nil, fmt.Errorf("%w: snapshot %d not found", ErrClientError, params.Snapshot)
	}
	proj, err := sd.getProject(params.Project)
	if err != nil {
		return nil, err
	}
	program := proj.GetProgram()
	if program == nil {
		return nil, fmt.Errorf("%w: project has no program", ErrClientError)
	}
	options := program.Options()
	if options.Incremental.IsTrue() || options.Composite.IsTrue() || len(program.CommandLine().ProjectReferences()) != 0 {
		return nil, fmt.Errorf("%w: typersEmitProject does not support incremental, composite, or project references; use the Typers CLI for build graphs and build information", ErrClientError)
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	diagnosticsCtx := core.WithCheckerLifetime(ctx, core.CheckerLifetimeDiagnostics)
	diags := slices.Concat(
		program.GetConfigFileParsingDiagnostics(),
		program.GetSyntacticDiagnostics(diagnosticsCtx, nil),
		program.GetBindDiagnostics(diagnosticsCtx, nil),
		program.GetSemanticDiagnostics(diagnosticsCtx, nil),
	)
	if options.GetEmitDeclarations() {
		diags = append(diags, program.GetDeclarationDiagnostics(diagnosticsCtx, nil)...)
	}
	// API projects use an external checker pool. Program.GetGlobalDiagnostics
	// alone cannot retrieve the global errors that pool discovered while checking.
	diags = append(diags, proj.GetProjectDiagnostics(diagnosticsCtx)...)
	diags = compiler.SortAndDeduplicateDiagnostics(diags)
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	// These are the configuration files retained by this program's snapshot,
	// including transitive extends. Consumers must not reparse the live files to
	// discover which inputs need protection before publishing captured outputs.
	commandLine := program.CommandLine()
	configFileNames := make([]string, 0, len(commandLine.ExtendedSourceFiles())+1)
	for _, fileName := range append([]string{commandLine.ConfigName()}, commandLine.ExtendedSourceFiles()...) {
		if fileName != "" {
			configFileNames = append(configFileNames, tspath.GetNormalizedAbsolutePath(fileName, program.GetCurrentDirectory()))
		}
	}
	slices.Sort(configFileNames)
	result := &TypersEmitResult{
		Outputs:         []TypersEmitOutput{},
		ConfigFileNames: slices.Compact(configFileNames),
	}
	if options.NoEmit.IsTrue() || options.NoEmitOnError.IsTrue() && len(diags) != 0 {
		result.EmitSkipped = true
	} else {
		var outputsMu sync.Mutex
		emitted := program.Emit(core.WithCheckerLifetime(ctx, core.CheckerLifetimeTemporary), compiler.EmitOptions{
			WriteFile: func(fileName, text string, _ *compiler.WriteFileData) error {
				outputsMu.Lock()
				defer outputsMu.Unlock()
				result.Outputs = append(result.Outputs, TypersEmitOutput{FileName: fileName, Text: text})
				return nil
			},
		})
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if emitted == nil {
			return nil, fmt.Errorf("typersEmitProject: compiler returned no emission result")
		}
		result.EmitSkipped = emitted.EmitSkipped
		diags = append(diags, emitted.Diagnostics...)
		diags = append(diags, proj.GetProjectDiagnostics(diagnosticsCtx)...)
		diags = compiler.SortAndDeduplicateDiagnostics(diags)
	}
	slices.SortFunc(result.Outputs, func(a, b TypersEmitOutput) int {
		return strings.Compare(a.FileName, b.FileName)
	})
	result.Diagnostics = NewDiagnosticResponses(diags)
	if result.Diagnostics == nil {
		result.Diagnostics = []*DiagnosticResponse{}
	}
	return result, nil
}
