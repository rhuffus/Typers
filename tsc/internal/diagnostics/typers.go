package diagnostics

// Typers diagnostics live outside the upstream generated catalog. Their codes are
// reserved for this experimental fork and must not be reused for different errors.
var (
	Typers_Enable_experimental_syntax = &Message{
		code: 180000, category: CategoryMessage, key: "Typers_Enable_experimental_syntax_180000",
		text: "Enable experimental Typers syntax.",
	}
	Typers_Only_Some_binding_is_supported = &Message{
		code: 180001, category: CategoryError, key: "Typers_Only_Some_binding_is_supported_180001",
		text: "The experimental 'if let' statement supports only the pattern 'Some(identifier)'.",
	}
	Typers_If_let_requires_a_block = &Message{
		code: 180002, category: CategoryError, key: "Typers_If_let_requires_a_block_180002",
		text: "The experimental 'if let' statement requires a block for each branch.",
	}
)

func typersMessageForKey(key Key) *Message {
	switch key {
	case Typers_Enable_experimental_syntax.key:
		return Typers_Enable_experimental_syntax
	case Typers_Only_Some_binding_is_supported.key:
		return Typers_Only_Some_binding_is_supported
	case Typers_If_let_requires_a_block.key:
		return Typers_If_let_requires_a_block
	}
	return nil
}
