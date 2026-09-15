package diagnostics

import (
	"testing"

	"github.com/microsoft/typescript-go/internal/locale"
)

func TestTypersDiagnosticLocalizationByKey(t *testing.T) {
	t.Parallel()
	for _, message := range []*Message{
		Typers_Enable_experimental_syntax,
		Typers_Only_Some_binding_is_supported,
		Typers_If_let_requires_a_block,
	} {
		if got := Localize(locale.Default, nil, message.Key()); got != message.String() {
			t.Fatalf("serialized diagnostic changed: got %q, want %q", got, message.String())
		}
	}
}
